import { NextResponse } from "next/server";
import { getAllCachedInputs, getLastScanAt, getCachedCount } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/assets
// Returns the list of symbols + names currently in the in-memory scan cache.
// Used by the comparison view's asset picker (which runs client-side and
// can't read the server-side cache directly).
export async function GET() {
  const inputs = getAllCachedInputs();
  const count = getCachedCount();
  const lastScanAt = getLastScanAt();

  return NextResponse.json({
    count,
    lastScanAt: lastScanAt > 0 ? new Date(lastScanAt).toISOString() : null,
    assets: inputs.map((i) => ({
      symbol: i.symbol,
      name: i.name,
      category: i.category,
      marketCap: i.marketCap,
    })),
  });
}
