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
    const created = await db.provider.create({
      data: {
        slug: body.slug || `provider-${Date.now()}`,
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
  try {
    const updated = await db.provider.update({
      where: { slug: body.slug },
      data: {
        enabled: body.enabled,
        apiKey: body.apiKey,
        priority: body.priority !== undefined ? Number(body.priority) : undefined,
      },
    });
    return NextResponse.json({ provider: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
