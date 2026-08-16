import { NextResponse } from "next/server";
import { benchmarkAsset } from "@/engine/percentile";
import { demoAssets } from "@/providers/demo-data";
import { getCachedInput, getAllCachedInputs } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  // Look up from cache first (supports live assets), then demo.
  const target = getCachedInput(symbol) ?? demoAssets.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
  ) ?? null;
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Use cached peers (live scan set) if available, otherwise demo.
  const peers = getAllCachedInputs();
  const peerSet = peers.length > 0 ? peers : demoAssets;
  const benchmark = benchmarkAsset(target, peerSet);
  return NextResponse.json({ benchmark });
}
