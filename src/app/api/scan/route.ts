import { NextResponse } from "next/server";
import { runEngine } from "@/engine";
import { rankResults, type RankedRow } from "@/engine/ranking";
import { demoAssets } from "@/providers/demo-data";
import { ensureProvidersRegistered } from "@/providers/registry";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScanResponse {
  mode: "live" | "demo";
  rows: (RankedRow & { category?: string })[];
  totals: { scanned: number; passed: number; rejected: number };
  note?: string;
}

async function runLiveScan(): Promise<ScanResponse> {
  ensureProvidersRegistered();
  // Pull DeFiLlama + CoinGecko (best-effort). In sandbox these may be rate-limited;
  // we gracefully fall back to demo if both fail.
  try {
    const { defillamaProvider } = await import("@/providers/defillama");
    const { coingeckoProvider } = await import("@/providers/coingecko");
    const ctx = { fetch };
    const [dl, cg] = await Promise.all([
      defillamaProvider.listProtocols(ctx).catch(() => []),
      coingeckoProvider.listProtocols(ctx).catch(() => []),
    ]);
    if (!dl.length && !cg.length) {
      return { ...runDemoScan(), note: "Live APIs unreachable — demo data shown." };
    }
    // build a merged map keyed by symbol
    const map = new Map<string, { symbol: string; name: string; category?: string; tvl?: number; fees24h?: number; revenue24h?: number; mc?: number; fdv?: number; coingeckoId?: string; defillamaSlug?: string }>();
    for (const p of dl) {
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
    const rows = ranked
      .map((r) => ({ ...r, category: inputs.find((i) => i.symbol === r.symbol)?.category }))
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
  const rows = ranked
    .map((r) => ({ ...r, category: demoAssets.find((i) => i.symbol === r.symbol)?.category }))
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

  // persist scan record (best effort)
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
    void scan;
  } catch {
    // db optional
  }

  return NextResponse.json(body);
}
