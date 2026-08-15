import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the historical IA_final time-series for a symbol, joined with the
// scan timestamps. Powers trend sparklines in the discovery table.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  try {
    const project = await db.project.findUnique({
      where: { symbol: symbol.toUpperCase() },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "not_found", points: [] }, { status: 404 });
    }

    // Most recent N scan rows for this project, oldest-first for charting.
    const LIMIT = 20;
    const rows = await db.scanRow.findMany({
      where: { projectId: project.id },
      orderBy: { id: "asc" },
      take: LIMIT,
      select: {
        iaFinal: true,
        iaRaw: true,
        iaEffective: true,
        confidence: true,
        decision: true,
        scan: { select: { finishedAt: true } },
      },
    });

    const points = rows
      .filter((r) => r.iaFinal !== null)
      .map((r) => ({
        t: r.scan?.finishedAt ?? null,
        iaFinal: r.iaFinal as number,
        iaRaw: r.iaRaw as number,
        iaEffective: r.iaEffective as number,
        confidence: r.confidence as number,
        decision: r.decision,
      }));

    return NextResponse.json({ symbol, points });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), points: [] },
      { status: 500 },
    );
  }
}
