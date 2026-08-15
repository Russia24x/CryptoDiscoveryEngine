import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestSource } from "@/engine/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/feeds/ingest
// Fetches all enabled feed sources, ingests their items, and stores them
// as FeedItem records (deduped by externalId per source).
// Returns a summary of what was ingested.
export async function POST() {
  const summary: {
    sourceId: string;
    sourceName: string;
    kind: string;
    ingested: number;
    error?: string;
  }[] = [];

  try {
    const sources = await db.feedSource.findMany({
      where: { enabled: true },
    });

    if (sources.length === 0) {
      return NextResponse.json({
        summary: [],
        totalIngested: 0,
        message: "No enabled feed sources to ingest.",
      });
    }

    let totalIngested = 0;

    // Ingest all sources in parallel (each fetch is independent).
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        try {
          const items = await ingestSource(source.kind, source.address);
          let ingested = 0;

          for (const item of items) {
            try {
              // Upsert by (sourceId, externalId) unique constraint.
              // Only create if not already present (skip duplicates).
              const existing = await db.feedItem.findUnique({
                where: {
                  sourceId_externalId: {
                    sourceId: source.id,
                    externalId: item.externalId,
                  },
                },
                select: { id: true },
              });
              if (!existing) {
                await db.feedItem.create({
                  data: {
                    sourceId: source.id,
                    externalId: item.externalId,
                    title: item.title,
                    body: item.body ?? null,
                    url: item.url ?? null,
                    publishedAt: item.publishedAt,
                  },
                });
                ingested++;
              }
            } catch {
              // skip individual item errors (e.g. too long)
            }
          }

          return {
            sourceId: source.id,
            sourceName: source.name,
            kind: source.kind,
            ingested,
          };
        } catch (e) {
          return {
            sourceId: source.id,
            sourceName: source.name,
            kind: source.kind,
            ingested: 0,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        summary.push(r.value);
        totalIngested += r.value.ingested;
      }
    }

    return NextResponse.json({ summary, totalIngested });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        summary,
        totalIngested: 0,
      },
      { status: 500 },
    );
  }
}
