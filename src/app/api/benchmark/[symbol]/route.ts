import { NextResponse } from "next/server";
import { benchmarkAsset } from "@/engine/percentile";
import { demoAssets } from "@/providers/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const target = demoAssets.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
  );
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const benchmark = benchmarkAsset(target, demoAssets);
  return NextResponse.json({ benchmark });
}
