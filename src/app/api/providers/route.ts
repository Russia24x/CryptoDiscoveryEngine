import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PROVIDERS = [
  {
    slug: "defillama",
    name: "DeFiLlama",
    baseUrl: "https://api.llama.fi",
    authMode: "none",
    freeTier: true,
    tier: "free",
    priority: 10,
    categories: "tvl,fees,revenue",
  },
  {
    slug: "coingecko",
    name: "CoinGecko (Public)",
    baseUrl: "https://api.coingecko.com",
    authMode: "none",
    freeTier: true,
    tier: "free",
    priority: 20,
    categories: "market,supply",
  },
  {
    slug: "coinmarketcap",
    name: "CoinMarketCap",
    baseUrl: "https://pro-api.coinmarketcap.com",
    authMode: "header",
    keyHeader: "X-CMC-Pro-API-Key",
    freeTier: false,
    tier: "paid",
    priority: 30,
    categories: "market,supply",
    notes: "Paid — add your API key in Settings to enable.",
  },
  {
    slug: "messari",
    name: "Messari",
    baseUrl: "https://data.messari.io",
    authMode: "bearer",
    freeTier: false,
    tier: "paid",
    priority: 35,
    categories: "market,research",
    notes: "Paid — add your API key in Settings to enable.",
  },
];

async function ensureSeed() {
  const count = await db.provider.count();
  if (count === 0) {
    await db.provider.createMany({ data: DEFAULT_PROVIDERS });
  }
}

export async function GET() {
  try {
    await ensureSeed();
    const providers = await db.provider.findMany({ orderBy: { priority: "asc" } });
    return NextResponse.json({ providers });
  } catch {
    return NextResponse.json({ providers: DEFAULT_PROVIDERS });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    await ensureSeed();
    // Generate a slug if not provided. Ensure uniqueness: if the slug already
    // exists, append a numeric suffix (provider-name-2, -3, …).
    const baseSlug =
      body.slug ||
      (body.name || "provider")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") // strip non-ascii (persian chars etc.)
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || `provider`;
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const exists = await db.provider.findUnique({ where: { slug } });
      if (!exists) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const created = await db.provider.create({
      data: {
        slug,
        name: body.name || "Custom Provider",
        baseUrl: body.baseUrl || "",
        authMode: body.authMode || "none",
        keyHeader: body.keyHeader || null,
        keyQuery: body.keyQuery || null,
        apiKey: body.apiKey || null,
        freeTier: body.tier === "free",
        tier: body.tier || "free",
        priority: Number(body.priority) || 100,
        categories: body.categories || "",
        notes: body.notes || null,
        enabled: body.enabled !== false,
      },
    });
    return NextResponse.json({ provider: created });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  try {
    // Only update fields that are explicitly provided.
    // apiKey: "" is treated as no-op (guard against wiping a key with an
    // empty-string payload). Use null to intentionally clear.
    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.apiKey !== undefined && body.apiKey !== "") data.apiKey = body.apiKey;
    if (body.priority !== undefined) data.priority = Number(body.priority);

    const updated = await db.provider.update({
      where: { slug: body.slug },
      data,
    });
    return NextResponse.json({ provider: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
