import { NextResponse } from "next/server";
import { runEngine } from "@/engine";
import { deriveThesis } from "@/engine/thesis";
import { getCachedInput } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the living investment thesis for a symbol, derived from the engine
// result. Looks up from scan cache (populated by /api/scan on-demand).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const input = getCachedInput(symbol);
  if (!input) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = runEngine(input);
  const thesis = deriveThesis(input, result);
  return NextResponse.json({ thesis });
}
