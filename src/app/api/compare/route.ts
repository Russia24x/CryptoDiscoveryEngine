import { NextResponse } from "next/server";
import { compareAssets } from "@/engine/percentile";
import { getCachedInput, getAllCachedInputs } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST body: { symbols: ["HYPE","AAVE","GMX"] }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw: string[] = Array.isArray(body.symbols) ? body.symbols : [];
  if (raw.length < 2) {
    return NextResponse.json({ error: "need at least 2 symbols" }, { status: 400 });
  }
  // Dedupe case-insensitively.
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
  // Look up from scan cache.
  const targets = symbols
    .map((s) => getCachedInput(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (targets.length < 2) {
    return NextResponse.json({ error: "not enough cached symbols — run a scan first" }, { status: 404 });
  }
  const peers = getAllCachedInputs();
  const peerSet = peers.length > 0 ? peers : targets;
  const comparison = compareAssets(targets, peerSet);
  return NextResponse.json({ comparison });
}
