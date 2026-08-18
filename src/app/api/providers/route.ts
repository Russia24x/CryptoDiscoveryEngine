import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

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

/**
 * SECURITY: Strip apiKey from provider records before sending to the client.
 * Returns `hasKey: boolean` instead of the raw key value.
 */
function sanitizeProvider(p: {
  id: string; slug: string; name: string; baseUrl: string;
  authMode: string; keyHeader: string | null; keyQuery: string | null;
  apiKey: string | null; freeTier: boolean; tier: string;
  priority: number; categories: string; notes: string | null;
  enabled: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    baseUrl: p.baseUrl,
    authMode: p.authMode,
    keyHeader: p.keyHeader,
    keyQuery: p.keyQuery,
    hasKey: Boolean(p.apiKey), // boolean flag — never expose the raw key
    freeTier: p.freeTier,
    tier: p.tier,
    priority: p.priority,
    categories: p.categories,
    notes: p.notes,
    enabled: p.enabled,
  };
}

export async function GET() {
  try {
    await ensureSeed();
    const providers = await db.provider.findMany({ orderBy: { priority: "asc" } });
    // SECURITY: never return apiKey to the client
    return NextResponse.json({ providers: providers.map(sanitizeProvider) });
  } catch {
    return NextResponse.json({ providers: DEFAULT_PROVIDERS });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    await ensureSeed();
    const baseSlug =
      body.slug ||
      (body.name || "provider")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
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
        apiKey: body.apiKey ? encrypt(body.apiKey) : null, // ENCRYPTED at rest with AES-256-GCM
        freeTier: body.tier === "free",
        tier: body.tier || "free",
        priority: Number(body.priority) || 100,
        categories: body.categories || "",
        notes: body.notes || null,
        enabled: body.enabled !== false,
      },
    });
    // SECURITY: sanitize before returning
    return NextResponse.json({ provider: sanitizeProvider(created) });
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
    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.apiKey !== undefined && body.apiKey !== "") data.apiKey = encrypt(body.apiKey); // ENCRYPT before storing
    if (body.priority !== undefined) data.priority = Number(body.priority);

    const updated = await db.provider.update({
      where: { slug: body.slug },
      data,
    });
    // SECURITY: sanitize before returning
    return NextResponse.json({ provider: sanitizeProvider(updated) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
