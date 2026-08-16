import { NextResponse } from "next/server";
import { runEngine } from "@/engine";
import { demoAssets } from "@/providers/demo-data";
import { getCachedInput } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Evidence graph derived deterministically from the engine inputs so the
// detail view always has structured, explainable evidence per ARCHITECTURE.md.
function buildEvidence(input: typeof demoAssets[number], result: ReturnType<typeof runEngine>) {
  const c = result.components;
  const now = new Date();
  const items = [
    {
      kind: "metric",
      label: "Protocol Revenue (annualised)",
      value: `$${Math.round(input.pr / 1e6)}M`,
      source: "DeFiLlama Fees",
      grade: "B",
      sentiment: input.pr > 100e6 ? "positive" : "neutral",
      confidence: 0.85,
    },
    {
      kind: "metric",
      label: "Tokenholder Capture",
      value: `$${Math.round(input.tc / 1e6)}M`,
      source: "DeFiLlama Fees",
      grade: c.vae >= 40 ? "A" : c.vae >= 20 ? "B" : "C",
      sentiment: c.delta >= 0.4 ? "positive" : c.delta < 0.15 ? "negative" : "neutral",
      confidence: 0.75,
    },
    {
      kind: "metric",
      label: "VAE — Value Accrual Efficiency",
      value: `${c.vae.toFixed(1)}%`,
      source: "Derived (α×δ)",
      grade: c.vae >= 40 ? "A" : c.vae >= 20 ? "B" : "C",
      sentiment: c.vae >= 30 ? "positive" : "negative",
      confidence: 0.8,
    },
    {
      kind: "metric",
      label: "Supply Absorption Ratio",
      value: c.sar.toFixed(2),
      source: "Tokenomics",
      grade: c.sar >= 0.5 ? "A" : c.sar >= 0.2 ? "B" : "D",
      sentiment: c.sar >= 0.4 ? "positive" : c.sar < 0.1 ? "negative" : "neutral",
      confidence: 0.7,
    },
    {
      kind: "metric",
      label: "Future Dilution Risk (12m)",
      value: `${(c.fdr * 100).toFixed(1)}%`,
      source: "Tokenomics",
      grade: c.fdr <= 0.1 ? "A" : c.fdr <= 0.25 ? "B" : "D",
      sentiment: c.fdr <= 0.15 ? "positive" : "negative",
      confidence: 0.7,
    },
    {
      kind: "risk",
      label: "Revenue Concentration",
      value: `${Math.round((input.revenueConcentration ?? 0.4) * 100)}%`,
      source: "Heuristic",
      grade: (input.revenueConcentration ?? 0.4) < 0.4 ? "A" : "C",
      sentiment: (input.revenueConcentration ?? 0.4) < 0.4 ? "positive" : "negative",
      confidence: 0.6,
    },
    {
      kind: "risk",
      label: "Insider / Governance Concentration",
      value: `${Math.round((input.insiderConcentration ?? 0.4) * 100)}%`,
      source: "Heuristic",
      grade: (input.insiderConcentration ?? 0.4) < 0.4 ? "A" : "C",
      sentiment: (input.insiderConcentration ?? 0.4) < 0.4 ? "positive" : "negative",
      confidence: 0.55,
    },
    {
      kind: "claim",
      label: "Market Position",
      value: `${Math.round((input.marketPosition ?? 0.5) * 100)}/100`,
      source: "Heuristic",
      grade: (input.marketPosition ?? 0.5) >= 0.75 ? "A" : "B",
      sentiment: (input.marketPosition ?? 0.5) >= 0.7 ? "positive" : "neutral",
      confidence: 0.65,
    },
  ].map((it, idx) => ({
    id: `ev-${idx}`,
    timestamp: now.toISOString(),
    freshnessH: idx * 2 + 1,
    ...it,
  }));
  return items;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  // Look up from cache first (populated by /api/scan), then fall back to demo.
  const input = getCachedInput(symbol) ?? demoAssets.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
  ) ?? null;
  if (!input) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = runEngine(input);
  const evidence = buildEvidence(input, result);
  return NextResponse.json({ input, result, evidence });
}
