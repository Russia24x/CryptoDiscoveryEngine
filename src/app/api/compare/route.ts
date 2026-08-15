import { NextResponse } from "next/server";
import { compareAssets } from "@/engine/percentile";
import { demoAssets } from "@/providers/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST body: { symbols: ["HYPE","AAVE","GMX"] }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw: string[] = Array.isArray(body.symbols) ? body.symbols : [];
  if (raw.length < 2) {
    return NextResponse.json({ error: "need at least 2 symbols" }, { status: 400 });
  }
  // Dedupe case-insensitively (HYPE == hype) — prevents duplicate columns
  // in the comparison matrix if the caller sends the same symbol twice.
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const s of raw) {
    const up = String(s).toUpperCase();
    if (!seen.has(up)) {
      seen.add(up);
      symbols.push(s);
    }
  }
  if (symbols.length > 5) {
    return NextResponse.json({ error: "max 5 symbols" }, { status: 400 });
  }
  if (symbols.length < 2) {
    return NextResponse.json(
      { error: "need at least 2 distinct symbols" },
      { status: 400 },
    );
  }
  const targets = symbols
    .map((s) => demoAssets.find((a) => a.symbol.toUpperCase() === s.toUpperCase()))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (targets.length < 2) {
    return NextResponse.json({ error: "not enough known symbols" }, { status: 404 });
  }
  const comparison = compareAssets(targets, demoAssets);
  return NextResponse.json({ comparison });
}
