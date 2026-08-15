import { NextResponse } from "next/server";
import { runEngine } from "@/engine";
import { deriveThesis } from "@/engine/thesis";
import { demoAssets } from "@/providers/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the living investment thesis for a symbol, derived from the engine
// result. The thesis is computed on-demand (not persisted) — it reflects the
// current demo-data state. When live data lands, this will reflect live state.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const input = demoAssets.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
  );
  if (!input) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = runEngine(input);
  const thesis = deriveThesis(input, result);
  return NextResponse.json({ thesis });
}
