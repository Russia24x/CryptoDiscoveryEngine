import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_FEED_SOURCES = [
  { kind: "rss", name: "ArzDigital — Breaking News", address: "https://arzdigital.com/breaking/feed/", enabled: true },
  { kind: "rss", name: "ArzDigital — Blog", address: "https://arzdigital.com/blog/feed/", enabled: true },
  { kind: "rss", name: "MihanBlockchain — Markets", address: "https://mihanblockchain.com/category/markets/feed/", enabled: true },
  { kind: "rss", name: "MihanBlockchain — News", address: "https://mihanblockchain.com/category/news/feed/", enabled: true },
];

async function ensureSeedFeeds() {
  const count = await db.feedSource.count();
  if (count === 0) {
    await db.feedSource.createMany({ data: DEFAULT_FEED_SOURCES });
  }
}

export async function GET() {
  try {
    await ensureSeedFeeds();
    const sources = await db.feedSource.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ sources });
  } catch {
    return NextResponse.json({ sources: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const created = await db.feedSource.create({
      data: {
        kind: body.kind || "rss",
        name: body.name || "Untitled",
        address: body.address || "",
        enabled: body.enabled !== false,
      },
    });
    return NextResponse.json({ source: created });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await db.feedSource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
