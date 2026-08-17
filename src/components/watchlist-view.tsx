"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Trash2,
  Compass,
  X,
} from "lucide-react";
import { cn, fmtUsd, fmtScore } from "@/lib/format";
import { useLocalStorage } from "@/lib/use-local-storage";
import { DecisionBadge } from "./decision-badge";
import { Sparkline } from "./sparkline";

interface WatchlistAsset {
  symbol: string;
  name: string;
  category?: string;
  iaFinal?: number;
  decision?: string;
  changePct?: number;
  closes?: number[];
  price?: number;
}

interface ScanResp {
  rows: Array<{
    symbol: string;
    name: string;
    category?: string;
    result: {
      iaFinal: number;
      decision: string;
      gate: { passed: boolean };
    };
  }>;
}

interface PriceBatchResp {
  sparklines: Record<string, { changePct: number; closes: number[] } | null>;
}

export function WatchlistView({
  onSelectAsset,
  onGoToDiscovery,
}: {
  onSelectAsset?: (symbol: string) => void;
  onGoToDiscovery?: () => void;
}) {
  const t = useTranslations();
  const [watchlist, setWatchlist] = useLocalStorage<string[]>("watchlist", []);

  // Fetch scan data to get IA scores + decisions for watchlist assets
  const { data: scanData } = useQuery<ScanResp>({
    queryKey: ["scan"],
    queryFn: async () => {
      const r = await fetch("/api/scan");
      if (!r.ok) throw new Error("scan failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  // Fetch 7d price history for watchlist assets (max 20)
  const priceSymbols = watchlist.slice(0, 20);
  const priceCacheKey = [...priceSymbols].sort().join(",");
  const { data: priceData } = useQuery<PriceBatchResp>({
    queryKey: ["price-batch", priceCacheKey],
    queryFn: async () => {
      if (!priceSymbols.length) return { sparklines: {} };
      const r = await fetch("/api/price-history-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: priceSymbols, days: 7 }),
      });
      if (!r.ok) return { sparklines: {} };
      return r.json();
    },
    enabled: priceSymbols.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Build the watchlist asset list by merging scan + price data
  const assets: WatchlistAsset[] = watchlist.map((sym) => {
    const scanRow = scanData?.rows.find(
      (r) => r.symbol.toUpperCase() === sym.toUpperCase(),
    );
    const price = priceData?.sparklines[sym];
    return {
      symbol: sym,
      name: scanRow?.name ?? sym,
      category: scanRow?.category,
      iaFinal: scanRow?.result.iaFinal,
      decision: scanRow?.result.decision,
      changePct: price?.changePct,
      closes: price?.closes,
    };
  });

  const removeFromWatchlist = (sym: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== sym));
  };

  if (watchlist.length === 0) {
    return (
      <div className="space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute -top-24 -end-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl animate-pulse pointer-events-none" />
          <div className="relative p-5 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 backdrop-blur-sm">
              <Star className="h-3.5 w-3.5" />
              {t("discovery.watchlist")}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient mt-2">
              {t("watchlist.title")}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              {t("watchlist.subtitle")}
            </p>
          </div>
        </div>

        {/* Empty state */}
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
              <div className="rounded-full bg-amber-500/10 p-4">
                <Star className="h-8 w-8 text-amber-500" />
              </div>
              <div className="space-y-1">
                <div className="text-base font-semibold">
                  {t("watchlist.empty")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("watchlist.emptyHint")}
                </div>
              </div>
              {onGoToDiscovery && (
                <Button variant="outline" size="sm" className="gap-2 mt-2" onClick={onGoToDiscovery}>
                  <Compass className="h-4 w-4" />
                  {t("watchlist.goToDiscovery")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -end-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl animate-pulse pointer-events-none" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 backdrop-blur-sm">
                <Star className="h-3.5 w-3.5 fill-current" />
                {watchlist.length} {t("watchlist.assets")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient">
                {t("watchlist.title")}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t("watchlist.subtitle")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setWatchlist([])}
            >
              <Trash2 className="h-4 w-4" />
              {t("settings.clear")}
            </Button>
          </div>
        </div>
      </div>

      {/* Asset grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => {
          const isUp = (asset.changePct ?? 0) >= 0;
          const hasPrice = asset.closes && asset.closes.length >= 2;
          return (
            <Card
              key={asset.symbol}
              className="hover-lift cursor-pointer group"
              onClick={() => onSelectAsset?.(asset.symbol)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold shrink-0">
                      {asset.symbol.slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{asset.symbol}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {asset.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {asset.decision && <DecisionBadge decision={asset.decision as never} />}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(asset.symbol);
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title={t("discovery.removeFromWatchlist")}
                      aria-label={t("discovery.removeFromWatchlist")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Price + change */}
                {hasPrice ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkline
                        values={asset.closes!}
                        width={60}
                        height={20}
                        interactive
                        formatValue={(v) => fmtUsd(v)}
                      />
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold tabular-nums inline-flex items-center gap-0.5",
                          isUp ? "text-emerald-500" : "text-red-500",
                        )}
                      >
                        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isUp ? "+" : ""}{(asset.changePct ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground/50">
                    {t("discovery.sparklineEmpty")}
                  </div>
                )}

                {/* IA score + category */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  {asset.iaFinal !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase text-muted-foreground">IA</span>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {fmtScore(asset.iaFinal)}
                      </span>
                    </div>
                  )}
                  {asset.category && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {asset.category}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
