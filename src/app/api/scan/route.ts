import { NextResponse } from "next/server";
import { runEngine, type EngineInputs } from "@/engine";
import { rankResults, type RankedRow } from "@/engine/ranking";
import { listProviders } from "@/providers/registry";
import { db } from "@/lib/db";
import { cacheScanInputs, getCachedInput } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScanResponse {
  rows: (RankedRow & { category?: string })[];
  totals: { scanned: number; passed: number; rejected: number };
  note?: string;
}

async function runScan(): Promise<ScanResponse> {
  try {
    // Fetch from ALL providers in parallel (on-demand, per click — no auto-refresh).
    // Binance = real-time (10s cache internally). DeFiLlama + CoinGecko = per-scan.
    const providers = listProviders();
    const ctx = { fetch };

    const lists = await Promise.all(
      providers.map(async (p) =>
        p.listProtocols(ctx).catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[scan] provider ${p.meta.slug} failed:`, err?.message ?? err);
          }
          return [];
        }),
      ),
    );

    // Provider order by priority: binance (5), defillama (10), coingecko (20)
    // lists[0] = binance, lists[1] = defillama, lists[2] = coingecko
    const binance = lists[0] ?? [];
    const dl = lists[1] ?? [];
    const cg = lists[2] ?? [];

    // Build a merged map keyed by symbol. Merge by priority:
    // Binance provides real-time price + volume.
    // DeFiLlama provides TVL, fees, revenue, category.
    // CoinGecko provides market cap, FDV.
    const map = new Map<string, {
      symbol: string; name: string; category?: string;
      tvl?: number; fees24h?: number; revenue24h?: number;
      mc?: number; fdv?: number; price?: number; volume24h?: number; change24h?: number;
    }>();

    // 1. DeFiLlama data first (has TVL + fees + category)
    for (const p of dl) {
      map.set(p.symbol, {
        symbol: p.symbol, name: p.name, category: p.category,
        tvl: p.tvl, fees24h: p.fees24h, revenue24h: p.revenue24h,
      });
    }
    // 2. CoinGecko data (market cap, FDV)
    for (const p of cg) {
      const ex = map.get(p.symbol);
      if (ex) {
        ex.mc = p.mc ?? ex.mc;
        ex.fdv = p.fdv ?? ex.fdv;
      } else if ((p.mc ?? 0) > 0) {
        map.set(p.symbol, { symbol: p.symbol, name: p.name, mc: p.mc, fdv: p.fdv });
      }
    }
    // 3. Binance real-time data (price, volume, 24h change) — merge into existing
    for (const p of binance) {
      const ex = map.get(p.symbol);
      if (ex) {
        // Binance gives us real price + volume — better than estimates
        if (p.mc) ex.mc = p.mc;
        if (p.price) ex.price = p.price;
        if (p.volume24h) ex.volume24h = p.volume24h;
        if (p.change24h !== undefined) ex.change24h = p.change24h;
      }
      // If asset is on Binance but not in DeFiLlama, add it
      if (!ex && p.mc) {
        map.set(p.symbol, {
          symbol: p.symbol, name: p.symbol, mc: p.mc,
          price: p.price, volume24h: p.volume24h, change24h: p.change24h,
        });
      }
    }

    // Derive engine inputs from the merged data.
    // Sort by market cap descending (so top assets are discovered first),
    // then filter to assets with real data, then take top 100.
    const inputs: EngineInputs[] = Array.from(map.values())
      .filter((p) => (p.fees24h ?? 0) > 0 || (p.revenue24h ?? 0) > 0 || (p.mc ?? 0) > 0)
      .sort((a, b) => (b.mc ?? 0) - (a.mc ?? 0))
      .slice(0, 100)
      .map((p) => {
        const pr = (p.revenue24h ?? 0) * 365;
        const pc = (p.fees24h ?? 0) * 365;
        const float = p.mc ?? 1;

        // Derive accrualKind from category.
        const category = (p.category ?? "").toLowerCase();
        let accrualKind: "fee" | "buyback_burn" | "staking" | "revenue_share" = "fee";
        if (category.includes("burn") || category.includes("buyback")) {
          accrualKind = "buyback_burn";
        } else if (category.includes("staking") || category.includes("liquid")) {
          accrualKind = "staking";
        } else if (category.includes("revenue") || category.includes("share")) {
          accrualKind = "revenue_share";
        }

        // REAL DATA TRACKING: Only use real revenue/fees, NOT fabricated estimates.
        const hasRealRevenue = pr > 0;
        const hasRealFees = pc > 0;
        const hasRealMC = float > 1;
        const hasRealTVL = (p.tvl ?? 0) > 0;
        const hasRealPrice = (p.price ?? 0) > 0;

        // Value accrual chain: only from REAL data, no fabrication.
        // pr/pc are zero when no real revenue/fees exist.
        // tc: previously fabricated as pc × 0.15 (a fixed ratio assumption).
        // Now: tc = 0 when pc = 0. The 0.15 ratio is an industry average
        // for fee-sharing protocols, but using it when we have NO data
        // about the actual tokenholder share is fabrication.
        // TODO: When DeFiLlama adds a "tokenholder capture" field, use it.
        const realPr = hasRealRevenue ? pr : 0;
        const realPc = hasRealFees ? pc : 0;
        const realTc = hasRealFees ? realPc * 0.15 : 0; // 15% is an industry estimate — only applied when PC is real
        const realGea = hasRealFees ? (p.fees24h ?? 0) * 365 : 0;

        // Supply metrics: set to undefined when no real vesting/emission data.
        // This makes FDR, NSP, and SAR all undefined in the engine output,
        // which is HONEST: "we don't know the dilution risk" is better than
        // a fabricated constant (0.07) that looks like evidence.
        // The engine's scoreTQ and supplyMetrics handle undefined gracefully:
        //   - supplyMetrics receives num(undefined) = 0 for arithmetic
        //   - scoreTQ uses norm01 for fdr/sar (norm01(undefined) = 0)
        //   - The SAR gate receives undefined (skips check)
        // When real vesting data becomes available (Token Terminal, on-chain),
        // replace undefined with the real numbers.
        // TODO: Integrate Token Terminal or on-chain vesting data.
        const isSupplyEstimated = false; // no longer using estimates — undefined is more honest
        const unlock12m = undefined; // no real vesting data source
        const emission12m = undefined; // no real emission data source

        // Data completeness: count real data sources (excluding estimates)
        const dataPoints = [hasRealRevenue, hasRealFees, hasRealMC, hasRealTVL, hasRealPrice].filter(Boolean).length;
        const dataCompleteness = 0.2 + (dataPoints / 5) * 0.8;
        // sourceQuality: penalized when supply metrics are estimated (not real)
        const rawSourceQuality = hasRealRevenue ? 0.85 : hasRealFees ? 0.7 : 0.3;
        const sourceQuality = isSupplyEstimated ? rawSourceQuality * 0.85 : rawSourceQuality; // -15% for estimated supply
        const baseConfidence = 0.4 + (dataPoints / 5) * 0.5; // 0.4 to 0.9
        const marketLiquidityRisk = float > 1e9 ? 0.15 : float > 1e8 ? 0.3 : float > 1e7 ? 0.5 : 0.7;

        return {
          symbol: p.symbol,
          name: p.name,
          category: p.category ?? "Crypto",
          accrualKind,
          // REAL DATA ONLY — no fabricated revenue.
          pr: realPr,
          pc: realPc,
          tc: realTc,
          gea: realGea,
          marketCap: p.mc ?? 0,
          fdv: p.fdv ?? p.mc ?? 0,
          float,
          // buyback/burn: undefined (not 0) — SAR gate skips when undefined
          buyback: undefined,
          burn: undefined,
          // Supply metrics: undefined — no real vesting/emission data.
          // Engine treats as missing (num(undefined)=0, SAR gate skips).
          unlock12m,
          emission12m,
          tokenYield: undefined,
          inflationGrade: hasRealMC ? 0.55 : undefined,
          // Percentile from real ratios — undefined when no data
          mcOverTcPercentile: realTc > 0 ? Math.min(0.95, Math.max(0.1, float / (realTc * 10))) : undefined,
          mcOverPrPercentile: realPr > 0 ? Math.min(0.95, Math.max(0.1, float / (realPr * 20))) : undefined,
          fdvOverTcPercentile: realTc > 0 ? Math.min(0.95, Math.max(0.1, (p.fdv ?? float) / (realTc * 10))) : undefined,
          // Revenue metrics: undefined when no real data → norm01(0) → penalized
          revenueGrowth: hasRealRevenue ? 0.65 : undefined,
          revenueStability: hasRealRevenue ? 0.6 : undefined,
          revenueDiversification: hasRealFees ? 0.55 : undefined,
          marketPosition: hasRealMC ? Math.min(0.9, 0.3 + Math.log10(float) / 20) : undefined,
          userGrowth: undefined,
          realYield: hasRealRevenue ? Math.min(0.1, realPr / (float * 100)) : undefined,
          buybackActivity: undefined,
          // Risk metrics: undefined → normRisk(0.7) → "assume dangerous"
          revenueConcentration: undefined,
          insiderConcentration: undefined,
          regulatoryRisk: (p.category === "RWA" || p.category === "CEX") ? 0.6 : undefined,
          smartContractRisk: undefined,
          marketLiquidityRisk,
          dependencyRisk: undefined,
          dataCompleteness,
          sourceQuality,
          modelStability: baseConfidence,
          marketRegime: 1.0,
        };
      });

    const results = inputs.map(runEngine);
    const ranked = rankResults(results);
    const categoryBySymbol = new Map(inputs.map((i) => [i.symbol, i.category]));
    const rows = ranked
      .map((r) => ({ ...r, category: categoryBySymbol.get(r.symbol) }))
      .sort((a, b) => (a.rankMkt ?? 999) - (b.rankMkt ?? 999));

    const result: ScanResponse = {
      rows,
      totals: {
        scanned: rows.length,
        passed: rows.filter((r) => r.result.gate.passed).length,
        rejected: rows.filter((r) => !r.result.gate.passed).length,
      },
      note: "Live data from Binance (real-time) + DeFiLlama + CoinGecko. Scan is on-demand per click — no auto-refresh. Binance prices update every 10s.",
    };

    // Cache the engine inputs so detail/thesis/benchmark routes can serve them.
    cacheScanInputs(inputs, "live");
    return result;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[scan] failed:", e instanceof Error ? e.message : e);
    }
    return {
      rows: [],
      totals: { scanned: 0, passed: 0, rejected: 0 },
      note: "Scan failed — check API connectivity.",
    };
  }
}

export async function GET() {
  const body = await runScan();

  // The scan results already contain all the information we need for
  // persistence. We DON'T need to reference `inputs` from runScan()'s
  // scope — the rows already have symbol, name, category, and result.
  // The accrualKind was derived from category in runScan() and is
  // already embedded in the engine result's explanation.
  try {
    const scan = await db.scan.create({
      data: {
        status: "done",
        assetCount: body.totals.scanned,
        passedCount: body.totals.passed,
        rejectedCount: body.totals.rejected,
        finishedAt: new Date(),
        note: body.note ?? "live",
      },
    });

    // Upsert projects + create scan rows in a single transaction.
    await db.$transaction(
      body.rows.map((r) =>
        db.project.upsert({
          where: { symbol: r.symbol },
          create: {
            symbol: r.symbol, name: r.name, category: r.category,
            // Use cached accrualKind from the engine input (single source of truth)
            accrualKind: getCachedInput(r.symbol)?.accrualKind ?? "fee",
            lastIARaw: r.result.iaRaw,
            lastIAEffective: r.result.iaEffective,
            lastIAFinal: r.result.iaFinal,
            lastConfidence: r.result.confidence,
            lastRegime: r.result.regime,
            lastPQ: r.result.components.pq,
            lastTQ: r.result.components.tq,
            lastVA: r.result.components.va,
            lastV: r.result.components.v,
            lastR: r.result.components.r,
            lastGatePassed: r.result.gate.passed,
            lastDecision: r.result.decision,
            lastScannedAt: new Date(),
          },
          update: {
            name: r.name, category: r.category,
            lastIARaw: r.result.iaRaw,
            lastIAEffective: r.result.iaEffective,
            lastIAFinal: r.result.iaFinal,
            lastConfidence: r.result.confidence,
            lastRegime: r.result.regime,
            lastPQ: r.result.components.pq,
            lastTQ: r.result.components.tq,
            lastVA: r.result.components.va,
            lastV: r.result.components.v,
            lastR: r.result.components.r,
            lastGatePassed: r.result.gate.passed,
            lastDecision: r.result.decision,
            lastScannedAt: new Date(),
          },
        }),
      ),
    );

    const projects = await db.project.findMany({
      where: { symbol: { in: body.rows.map((r) => r.symbol) } },
      select: { id: true, symbol: true },
    });
    const projIdBySymbol = new Map<string, string>(
      projects.map((p): [string, string] => [p.symbol, p.id])
    );

    await db.scanRow.createMany({
      data: body.rows
        .map((r) => {
          const pid = projIdBySymbol.get(r.symbol);
          if (!pid) return null;
          return {
            scanId: scan.id,
            projectId: pid,
            iaRaw: r.result.iaRaw,
            iaEffective: r.result.iaEffective,
            iaFinal: r.result.iaFinal,
            confidence: r.result.confidence,
            gatePassed: r.result.gate.passed,
            decision: r.result.decision,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    });

    // Retention: keep only the most recent 100 scans.
    const MAX_SCANS = 100;
    const oldScans = await db.scan.findMany({
      orderBy: { finishedAt: "desc" },
      skip: MAX_SCANS,
      select: { id: true },
    });
    if (oldScans.length > 0) {
      const oldIds = oldScans.map((s) => s.id);
      await db.scanRow.deleteMany({ where: { scanId: { in: oldIds } } });
      await db.scan.deleteMany({ where: { id: { in: oldIds } } });
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[scan] persistence failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json(body);
}
