import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_FEED_SOURCES = [
  { kind: "rss", name: "ArzDigital — Breaking News", address: "https://arzdigital.com/breaking/feed/", enabled: true },
  { kind: "rss", name: "ArzDigital — Blog", address: "https://arzdigital.com/blog/feed/", enabled: true },
  { kind: "rss", name: "MihanBlockchain — Markets", address: "https://mihanblockchain.com/category/markets/feed/", enabled: true },
  { kind: "rss", name: "MihanBlockchain — News", address: "https://mihanblockchain.com/category/news/feed/", enabled: true },
  { kind: "telegram", name: "Mastersharkcrypto", address: "https://t.me/Mastersharkcrypto", enabled: true },
];

/**
 * SSRF protection: validate that a URL is safe to fetch server-side.
 * Blocks: localhost, private IPs, link-local, metadata endpoints.
 */
function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Block localhost and common local hostnames
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    // Block private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x)
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return false;
    // Block IPv6 loopback and link-local
    if (host === "::1" || host === "[::1]") return false;
    // Block metadata endpoints
    if (host === "169.254.169.254" || host === "metadata.google.internal") return false;
    return true;
  } catch {
    return false;
  }
}

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
  // SSRF protection: validate URL before storing
  if (body.address && !isUrlSafe(body.address)) {
    return NextResponse.json(
      { error: "Address must be a valid http(s) URL pointing to a public host" },
      { status: 400 },
    );
  }
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
