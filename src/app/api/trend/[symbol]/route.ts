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

    // Most recent N scan rows for this project. Query descending (newest
    // first) + take, then reverse so the chart renders oldest→newest.
    // (orderBy asc + take would return the OLDEST N, freezing the sparkline
    //  once >N scans accumulate — a subtle bug.)
    // Order by the parent scan's completion time — ScanRow.id is a cuid whose
    // lexicographic order is NOT chronological.
    const LIMIT = 20;
    const rows = await db.scanRow.findMany({
      where: { projectId: project.id },
      orderBy: { scan: { finishedAt: "desc" } },
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
      .reverse() // oldest-first for charting
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
    // Log details server-side only — never leak internals to clients.
    console.error("[trend] single failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "trend_fetch_failed", points: [] },
      { status: 500 },
    );
  }
}
