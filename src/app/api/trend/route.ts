import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Batch trend endpoint — accepts { symbols: ["HYPE","AAVE",...] } and returns
// { [symbol]: TrendPoint[] }. Eliminates the N+1 fetch-per-row pattern in the
// discovery table (8 rows = 1 request instead of 8).
interface TrendPoint {
  t: string | null;
  iaFinal: number;
  iaRaw: number;
  iaEffective: number;
  confidence: number;
  decision: string | null;
}

// Max symbols per batch request. The scan endpoint returns up to 100 rows,
// so the trend batch must accept the full set (was 50, which caused a 400
// whenever a scan returned > 50 assets — see discovery-view.tsx trendSymbols).
const MAX_SYMBOLS = 100;
const LIMIT = 20;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbols: string[] = Array.isArray(body.symbols) ? body.symbols : [];
  if (!symbols.length) {
    return NextResponse.json({ trends: {} });
  }
  if (symbols.length > MAX_SYMBOLS) {
    return NextResponse.json({ error: `max ${MAX_SYMBOLS} symbols` }, { status: 400 });
  }

  try {
    const upper = symbols.map((s) => s.toUpperCase());
    const projects = await db.project.findMany({
      where: { symbol: { in: upper } },
      select: { id: true, symbol: true },
    });
    const pidBySymbol = new Map(projects.map((p) => [p.symbol, p.id]));

    // Fetch all scan rows for these projects in one query.
    const projectIds = Array.from(pidBySymbol.values());
    const rows = projectIds.length
      ? await db.scanRow.findMany({
          where: { projectId: { in: projectIds } },
          orderBy: { id: "desc" },
          // take more than LIMIT per project, then group+slice in JS. The
          // max we'd fetch is MAX_SYMBOLS projects × 20 = 2000 rows, acceptable.
          take: MAX_SYMBOLS * LIMIT,
          select: {
            projectId: true,
            iaFinal: true,
            iaRaw: true,
            iaEffective: true,
            confidence: true,
            decision: true,
            scan: { select: { finishedAt: true } },
          },
        })
      : [];

    // Group by projectId, take newest LIMIT, reverse to oldest-first.
    const byProject = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byProject.get(r.projectId) ?? [];
      if (arr.length < LIMIT) arr.push(r);
      byProject.set(r.projectId, arr);
    }

    const trends: Record<string, TrendPoint[]> = {};
    for (const sym of upper) {
      const pid = pidBySymbol.get(sym);
      if (!pid) {
        trends[sym] = [];
        continue;
      }
      const projRows = (byProject.get(pid) ?? [])
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
      trends[sym] = projRows;
    }

    return NextResponse.json({ trends });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), trends: {} },
      { status: 500 },
    );
  }
}
