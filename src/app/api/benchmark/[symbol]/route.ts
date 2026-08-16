import { NextResponse } from "next/server";
import { benchmarkAsset } from "@/engine/percentile";
import { getCachedInput, getAllCachedInputs } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const target = getCachedInput(symbol);
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const peers = getAllCachedInputs();
  if (peers.length === 0) {
    return NextResponse.json({ error: "no_scan_data" }, { status: 404 });
  }
  const benchmark = benchmarkAsset(target, peers);
  return NextResponse.json({ benchmark });
}
