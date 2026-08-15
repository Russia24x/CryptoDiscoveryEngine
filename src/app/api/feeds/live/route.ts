import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestSource, type IngestedItem } from "@/engine/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/feeds/live
// MIRROR MODE — fetches all enabled feed sources on-demand and returns items
// directly. NO DB STORAGE. Content belongs to the source; we only display it.
// Uses a 5-minute in-memory cache to avoid hammering sources on every render.

interface CachedResult {
  items: Array<IngestedItem & { sourceKind: string; sourceName: string }>;
  fetchedAt: number;
}

const CACHE: Map<string, CachedResult> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const cacheKey = "live";
  const cached = CACHE.get(cacheKey);
  const now = Date.now();

  // Return cached if fresh
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      items: cached.items,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
    });
  }

  try {
    const sources = await db.feedSource.findMany({
      where: { enabled: true },
    });

    if (sources.length === 0) {
      return NextResponse.json({ items: [], cached: false, message: "No enabled sources" });
    }

    // Fetch all sources in parallel (each is independent)
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const items = await ingestSource(source.kind, source.address);
        return items.map((item) => ({
          ...item,
          sourceKind: source.kind,
          sourceName: source.name,
        }));
      }),
    );

    // Flatten + sort by publishedAt (newest first)
    const allItems: Array<IngestedItem & { sourceKind: string; sourceName: string }> = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        allItems.push(...r.value);
      }
    }
    allItems.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    // Cache the result
    CACHE.set(cacheKey, { items: allItems, fetchedAt: now });

    return NextResponse.json({
      items: allItems,
      cached: false,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), items: [] },
      { status: 500 },
    );
  }
}
