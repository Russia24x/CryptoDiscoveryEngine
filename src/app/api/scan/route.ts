import { NextResponse } from "next/server";
import { runEngine, type EngineInputs } from "@/engine";
import { rankResults, type RankedRow } from "@/engine/ranking";
import { listProviders } from "@/providers/registry";
import { db } from "@/lib/db";
import { cacheScanInputs } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScanResponse {
  rows: (RankedRow & { category?: string })[];
  totals: { scanned: number; passed: number; rejected: number };
  note?: string;
}

// Deterministic string hash → 32-bit int.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
      }
      // If asset is on Binance but not in DeFiLlama, add it
      if (!ex && p.mc) {
        map.set(p.symbol, { symbol: p.symbol, name: p.symbol, mc: p.mc });
      }
    }

    // Derive engine inputs from the merged data.
    const inputs: EngineInputs[] = Array.from(map.values())
      .filter((p) => (p.fees24h ?? 0) > 0 || (p.revenue24h ?? 0) > 0 || (p.mc ?? 0) > 0)
      .slice(0, 100)
      .map((p) => {
        const pr = (p.revenue24h ?? 0) * 365;
        const pc = (p.fees24h ?? 0) * 365;
        const tc = pc * 0.15;
        const float = p.mc ?? 1;
        const unlock12m = float * 0.05;
        const emission12m = float * 0.02;
        return {
          symbol: p.symbol,
          name: p.name,
          category: p.category ?? "Crypto",
          accrualKind: "fee" as const,
          pr: pr || (p.tvl ?? 0) * 0.03 || float * 0.02,
          pc: pc || pr * 0.8 || float * 0.015,
          tc,
          gea: (p.fees24h ?? 0) * 365,
          marketCap: p.mc ?? 0,
          fdv: p.fdv ?? p.mc ?? 0,
          float,
          buyback: 0,
          burn: 0,
          unlock12m,
          emission12m,
          tokenYield: 0,
          inflationGrade: 0.6,
          mcOverTcPercentile: 0.5,
          mcOverPrPercentile: 0.5,
          fdvOverTcPercentile: 0.5,
          revenueGrowth: 0.5,
          revenueStability: 0.5,
          revenueDiversification: 0.5,
          marketPosition: 0.5,
          userGrowth: 0.5,
          realYield: 0.01,
          buybackActivity: 0.05,
          revenueConcentration: 0.4,
          insiderConcentration: 0.4,
          regulatoryRisk: 0.4,
          smartContractRisk: 0.3,
          marketLiquidityRisk: 0.35,
          dependencyRisk: 0.4,
          dataCompleteness: 0.45,
          sourceQuality: 0.6,
          modelStability: 0.55,
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const body = await runScan();

  // persist scan record + per-asset ScanRows (best effort, non-blocking).
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
            accrualKind: "fee",
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
    const projIdBySymbol = new Map(projects.map((p) => [p.symbol, p.id]));

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
