import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/feeds/items
// Returns the most recent ingested feed items across all sources.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

  try {
    const items = await db.feedItem.findMany({
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        source: {
          select: { id: true, name: true, kind: true },
        },
      },
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), items: [] },
      { status: 500 },
    );
  }
}
