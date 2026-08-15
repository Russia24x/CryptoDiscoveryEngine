import { NextResponse } from "next/server";
import { compareAssets } from "@/engine/percentile";
import { demoAssets } from "@/providers/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST body: { symbols: ["HYPE","AAVE","GMX"] }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbols: string[] = Array.isArray(body.symbols) ? body.symbols : [];
  if (symbols.length < 2) {
    return NextResponse.json({ error: "need at least 2 symbols" }, { status: 400 });
  }
  if (symbols.length > 5) {
    return NextResponse.json({ error: "max 5 symbols" }, { status: 400 });
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
