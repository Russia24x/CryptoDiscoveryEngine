import { NextResponse } from "next/server";
import { runEngine } from "@/engine";
import { rankResults, type RankedRow } from "@/engine/ranking";
import { demoAssets } from "@/providers/demo-data";
import { listProviders } from "@/providers/registry";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScanResponse {
  mode: "live" | "demo";
  rows: (RankedRow & { category?: string })[];
  totals: { scanned: number; passed: number; rejected: number };
  note?: string;
}

// Deterministic string hash → 32-bit int. Used to seed demo-mode trend jitter
// so each scan produces a stable-but-varying value per symbol (realistic trend).
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function runLiveScan(): Promise<ScanResponse> {
  try {
    // Use the provider registry — the canonical path. Any registered provider
    // (free or key-based) is consulted; the architecture stays the same when
    // paid providers are added later.
    const providers = listProviders();
    const ctx = { fetch };
    // Pull protocol lists from all available providers in parallel.
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
    const dl = lists[0] ?? []; // defillama (priority 10)
    const cg = lists[1] ?? []; // coingecko (priority 20)
    if (!dl.length && !cg.length) {
      return { ...runDemoScan(), note: "Live APIs unreachable — demo data shown." };
    }
    // build a merged map keyed by symbol. On collision, keep the first seen
    // (DeFiLlama wins by priority) and log in dev so collisions are visible.
    const map = new Map<string, { symbol: string; name: string; category?: string; tvl?: number; fees24h?: number; revenue24h?: number; mc?: number; fdv?: number; coingeckoId?: string; defillamaSlug?: string }>();
    for (const p of dl) {
      if (map.has(p.symbol) && process.env.NODE_ENV !== "production") {
        console.warn(`[scan] symbol collision (dl): ${p.symbol} already seen`);
      }
      map.set(p.symbol, {
        symbol: p.symbol,
        name: p.name,
        category: p.category,
        tvl: p.tvl,
        fees24h: p.fees24h,
        revenue24h: p.revenue24h,
        defillamaSlug: p.defillamaSlug,
      });
    }
    for (const p of cg) {
      const ex = map.get(p.symbol);
      if (ex) {
        ex.mc = p.mc;
        ex.fdv = p.fdv;
        ex.coingeckoId = p.coingeckoId;
      } else {
        map.set(p.symbol, { symbol: p.symbol, name: p.name, mc: p.mc, fdv: p.fdv, coingeckoId: p.coingeckoId });
      }
    }
    // Derive engine inputs from the merged data (first-order estimate).
    const inputs = Array.from(map.values())
      .filter((p) => (p.mc ?? 0) > 0)
      .slice(0, 80)
      .map((p) => {
        const pr = (p.revenue24h ?? 0) * 365;
        const pc = (p.fees24h ?? 0) * 365;
        // Without tokenholder-capture data from free APIs, we estimate TC as a
        // fraction of PC. This is explicitly flagged via low confidence.
        const tcEstimate = pc * 0.18;
        const float = p.mc ?? 1;
        const unlock12m = float * 0.05; // assumed 5% unless known
        const emission12m = float * 0.02;
        return {
          symbol: p.symbol,
          name: p.name,
          category: p.category ?? "Unknown",
          accrualKind: "fee" as const,
          pr: pr || float * 0.05,
          pc: pc || pr * 0.8,
          tc: tcEstimate,
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
          dataCompleteness: 0.45, // low confidence for live-derived estimates
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
    return {
      mode: "live",
      rows,
      totals: {
        scanned: rows.length,
        passed: rows.filter((r) => r.result.gate.passed).length,
        rejected: rows.filter((r) => !r.result.gate.passed).length,
      },
      note: "Live-derived estimates (free APIs). Tokenholder capture & risk components are approximated — confidence is intentionally low. Switch to Demo for the full auditable pipeline.",
    };
  } catch {
    return { ...runDemoScan(), note: "Live scan failed — demo data shown." };
  }
}

function runDemoScan(): ScanResponse {
  const results = demoAssets.map(runEngine);
  const ranked = rankResults(results);
  const categoryBySymbol = new Map(demoAssets.map((i) => [i.symbol, i.category]));
  const rows = ranked
    .map((r) => ({ ...r, category: categoryBySymbol.get(r.symbol) }))
    .sort((a, b) => (a.rankMkt ?? 999) - (b.rankMkt ?? 999));
  return {
    mode: "demo",
    rows,
    totals: {
      scanned: rows.length,
      passed: rows.filter((r) => r.result.gate.passed).length,
      rejected: rows.filter((r) => !r.result.gate.passed).length,
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "demo";
  const body = mode === "live" ? await runLiveScan() : runDemoScan();

  // persist scan record + per-asset ScanRows (best effort, non-blocking to response).
  // This builds the historical time-series that powers trend sparklines.
  try {
    const scan = await db.scan.create({
      data: {
        status: "done",
        assetCount: body.totals.scanned,
        passedCount: body.totals.passed,
        rejectedCount: body.totals.rejected,
        finishedAt: new Date(),
        note: body.note ?? body.mode,
      },
    });

    // Upsert projects + create scan rows in a single transaction.
    await db.$transaction(
      body.rows.map((r) =>
        db.project.upsert({
          where: { symbol: r.symbol },
          create: {
            symbol: r.symbol,
            name: r.name,
            category: r.category,
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
            name: r.name,
            category: r.category,
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

    // Re-fetch the upserted projects to get their ids, then create scan rows.
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
          // For DEMO mode only: the engine inputs are deterministic, so the
          // trend sparkline would always be flat. Apply a small seeded jitter
          // to the PERSISTED values (not the returned body — users still see
          // accurate scores). The jitter is seeded by symbol+scanId so it's
          // stable per scan but varies across scans → realistic-looking trends.
          let persistRaw = r.result.iaRaw;
          let persistEff = r.result.iaEffective;
          let persistFin = r.result.iaFinal;
          if (body.mode === "demo") {
            const seed = hashStr(r.symbol + scan.id);
            const drift = ((seed % 200) - 100) / 1000; // ±10% drift
            persistRaw = Math.max(0, r.result.iaRaw * (1 + drift));
            persistEff = persistRaw * r.result.confidence;
            persistFin = persistEff * r.result.regime;
          }
          return {
            scanId: scan.id,
            projectId: pid,
            iaRaw: persistRaw,
            iaEffective: persistEff,
            iaFinal: persistFin,
            confidence: r.result.confidence,
            gatePassed: r.result.gate.passed,
            decision: r.result.decision,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    });

    // Retention: keep only the most recent MAX_SCANS scans (+ their rows).
    // Prevents unbounded DB growth on a free-first SQLite system. Older scans
    // are pruned with their child rows (FK cascade would also work, but we
    // delete children explicitly to be safe across schema versions).
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
    // db is optional — scan still returns results to the user.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[scan] persistence failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json(body);
}
