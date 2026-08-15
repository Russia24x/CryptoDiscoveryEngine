import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
