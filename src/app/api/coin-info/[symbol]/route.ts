import { NextResponse } from "next/server";
import { getFullCoinData, findCoinId, getTicker } from "@/providers/coinpaprika";
import { getCachedInput } from "@/lib/scan-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/coin-info/[symbol]
// Returns: image, website, social links, GitHub, description, price, volume,
// market_cap, supply, external links (DeFiLlama, CoinGecko, CMC).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  const ctx = { fetch };

  try {
    // Get CoinPaprika data (description, social, price, volume)
    const paprikaData = await getFullCoinData(sym, ctx);

    // Get cached scan data (has DeFiLlama category, TVL)
    const cached = getCachedInput(sym);

    // Build external links
    const links: { label: string; url: string; icon: string }[] = [];

    // DeFiLlama link (if we have the slug from cached data)
    if (cached?.category) {
      const dlSlug = sym.toLowerCase();
      links.push({
        label: "DeFiLlama",
        url: `https://defillama.com/protocol/${dlSlug}`,
        icon: "defillama",
      });
    }

    // CoinGecko link
    links.push({
      label: "CoinGecko",
      url: `https://www.coingecko.com/en/coins/${sym.toLowerCase()}`,
      icon: "coingecko",
    });

    // CoinMarketCap link
    links.push({
      label: "CoinMarketCap",
      url: `https://coinmarketcap.com/currencies/${sym.toLowerCase()}`,
      icon: "cmc",
    });

    // CoinPaprika link
    if (paprikaData?.coin?.id) {
      links.push({
        label: "CoinPaprika",
        url: `https://coinpaprika.com/coin/${paprikaData.coin.id}`,
        icon: "coinpaprika",
      });
    }

    // Binance link (if on Binance)
    links.push({
      label: "Binance",
      url: `https://www.binance.com/en/trade/${sym}_USDT`,
      icon: "binance",
    });

    // Extract social links from CoinPaprika
    const social: { label: string; url: string }[] = [];
    if (paprikaData?.coin?.links) {
      const l = paprikaData.coin.links;
      if (l.website?.[0]) social.push({ label: "Website", url: l.website[0] });
      if (l.source_code?.[0]) social.push({ label: "GitHub", url: l.source_code[0] });
      if (l.reddit?.[0]) social.push({ label: "Reddit", url: l.reddit[0] });
      if (l.youtube?.[0]) social.push({ label: "YouTube", url: l.youtube[0] });
      if (l.facebook?.[0]) social.push({ label: "Facebook", url: l.facebook[0] });
    }

    // Extract price/market data from CoinPaprika ticker
    const market = paprikaData?.ticker?.quotes?.USD
      ? {
          price: paprikaData.ticker.quotes.USD.price,
          volume24h: paprikaData.ticker.quotes.USD.volume_24h,
          marketCap: paprikaData.ticker.quotes.USD.market_cap,
          change24h: paprikaData.ticker.quotes.USD.percent_change_24h,
          change7d: paprikaData.ticker.quotes.USD.percent_change_7d,
          change30d: paprikaData.ticker.quotes.USD.percent_change_30d,
          ath: paprikaData.ticker.quotes.USD.ath_price,
          athDate: paprikaData.ticker.quotes.USD.ath_date,
          atl: paprikaData.ticker.quotes.USD.atl_price,
          atlDate: paprikaData.ticker.quotes.USD.atl_date,
        }
      : null;

    const supply = paprikaData?.ticker
      ? {
          total: paprikaData.ticker.total_supply,
          max: paprikaData.ticker.max_supply,
          beta: paprikaData.ticker.beta_value,
          rank: paprikaData.ticker.rank,
        }
      : null;

    return NextResponse.json({
      symbol: sym,
      name: paprikaData?.coin?.name ?? cached?.name ?? sym,
      description: paprikaData?.coin?.description ?? "",
      image: paprikaData?.coin?.id
        ? `https://coinpaprika.com/coin/${paprikaData.coin.id}/logo.png`
        : null,
      links,
      social,
      market,
      supply,
      events: paprikaData?.events ?? [],
      category: cached?.category ?? null,
      openSource: paprikaData?.coin?.open_source ?? null,
      parent: paprikaData?.coin?.parent ?? null,
      whitepaper: paprikaData?.coin?.whitepaper?.link ?? null,
      tvl: undefined, // available in scan data
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
