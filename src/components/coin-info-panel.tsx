"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Github,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { cn, fmtUsd, fmtPct } from "@/lib/format";

interface CoinInfo {
  symbol: string;
  name: string;
  description: string;
  image: string | null;
  links: { label: string; url: string; icon: string }[];
  social: { label: string; url: string }[];
  market: {
    price: number;
    volume24h: number;
    marketCap: number;
    change24h: number;
    change7d: number;
    change30d: number;
    ath: number;
    athDate: string;
    atl: number;
    atlDate: string;
  } | null;
  supply: {
    total: number;
    max: number;
    beta: number;
    rank: number;
  } | null;
  events: { id: string; date: string; name: string; description: string; link: string }[];
  category: string | null;
  openSource: boolean | null;
  parent: string | null;
  whitepaper: string | null;
  // Engine scores (from scan cache, passed by parent or fetched separately)
  iaScores?: {
    iaRaw: number;
    confidence: number;
    iaEffective: number;
    regime: number;
    decision: string;
  } | null;
}

function SocialIcon({ label }: { label: string }) {
  if (label === "GitHub") return <Github className="h-3.5 w-3.5" />;
  if (label === "Website") return <Globe className="h-3.5 w-3.5" />;
  return <ExternalLink className="h-3.5 w-3.5" />;
}

function changeIcon(v: number) {
  if (v > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (v < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function CoinInfoPanel({ symbol, iaScores }: { symbol: string; iaScores?: CoinInfo["iaScores"] }) {
  const t = useTranslations();
  const { data, isLoading } = useQuery<CoinInfo>({
    queryKey: ["coin-info", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/coin-info/${symbol}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-8" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          {t("coinInfo.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header: logo + name + symbol + price */}
        <div className="flex items-start gap-3">
          {data.image ? (
            <img
              src={data.image}
              alt={data.symbol}
              className="h-12 w-12 rounded-xl border border-border/60 bg-muted shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold shrink-0">
              {data.symbol.slice(0, 3)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold tracking-tight">{data.symbol}</span>
              <span className="text-sm text-muted-foreground">{data.name}</span>
              {data.category && (
                <Badge variant="outline" className="text-[10px]">{data.category}</Badge>
              )}
              {data.openSource !== null && (
                <Badge variant="secondary" className="text-[10px]">
                  {data.openSource ? t("coinInfo.openSource") : t("coinInfo.closedSource")}
                </Badge>
              )}
            </div>
            {data.market && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xl font-bold tabular-nums">{fmtUsd(data.market.price)}</span>
                <span className={cn("inline-flex items-center gap-0.5 text-sm font-semibold", data.market.change24h > 0 ? "text-emerald-500" : data.market.change24h < 0 ? "text-red-500" : "text-muted-foreground")}>
                  {changeIcon(data.market.change24h)}
                  {data.market.change24h > 0 ? "+" : ""}{fmtPct(data.market.change24h / 100)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* IA Engine Scores (merged from old title block) */}
        {iaScores && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
              <div className="text-[10px] uppercase text-muted-foreground">IA Raw</div>
              <div className="font-mono text-sm font-semibold">{iaScores.iaRaw.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
              <div className="text-[10px] uppercase text-muted-foreground">C</div>
              <div className="font-mono text-sm font-semibold">{iaScores.confidence.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
              <div className="text-[10px] uppercase text-muted-foreground">IA Eff</div>
              <div className="font-mono text-sm font-semibold">{iaScores.iaEffective.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
              <div className="text-[10px] uppercase text-muted-foreground">M</div>
              <div className="font-mono text-sm font-semibold">{iaScores.regime.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Description */}
        {data.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {data.description}
          </p>
        )}

        {/* Market data grid */}
        {data.market && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat
              icon={<DollarSign className="h-3 w-3" />}
              label={t("coinInfo.price")}
              value={fmtUsd(data.market.price)}
            />
            <Stat
              icon={<BarChart3 className="h-3 w-3" />}
              label={t("coinInfo.marketCap")}
              value={fmtUsd(data.market.marketCap)}
            />
            <Stat
              icon={<TrendingUp className="h-3 w-3" />}
              label={t("coinInfo.volume24h")}
              value={fmtUsd(data.market.volume24h)}
            />
            <ChangeStat
              label={t("coinInfo.change24h")}
              value={data.market.change24h}
            />
            <ChangeStat
              label={t("coinInfo.change7d")}
              value={data.market.change7d}
            />
            <ChangeStat
              label={t("coinInfo.change30d")}
              value={data.market.change30d}
            />
          </div>
        )}

        {/* Supply */}
        {data.supply && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.supply.rank > 0 && (
              <Stat label={t("coinInfo.rank")} value={`#${data.supply.rank}`} />
            )}
            {data.supply.total > 0 && (
              <Stat
                label={t("coinInfo.totalSupply")}
                value={data.supply.total.toLocaleString(undefined, { notation: "compact" })}
              />
            )}
            {data.supply.max > 0 && (
              <Stat
                label={t("coinInfo.maxSupply")}
                value={data.supply.max.toLocaleString(undefined, { notation: "compact" })}
              />
            )}
            {data.supply.beta > 0 && (
              <Stat label={t("coinInfo.beta")} value={data.supply.beta.toFixed(2)} />
            )}
          </div>
        )}

        {/* Social links */}
        {data.social.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.social.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <SocialIcon label={s.label} />
                {s.label}
              </a>
            ))}
          </div>
        )}

        {/* External links */}
        <div className="flex flex-wrap gap-1.5">
          {data.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {l.label}
            </a>
          ))}
        </div>

        {/* Events / Catalysts */}
        {data.events.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              {t("coinInfo.events")}
            </div>
            <div className="space-y-1">
              {data.events.slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className="rounded-md border border-border/40 bg-muted/20 p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(e.date).toLocaleDateString()}
                    </span>
                  </div>
                  {e.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {e.description}
                    </p>
                  )}
                  {e.link && (
                    <a
                      href={e.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline mt-0.5"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {t("coinInfo.viewEvent")}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-mono text-xs font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ChangeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {changeIcon(value)}
        {label}
      </div>
      <div className={cn("font-mono text-xs font-semibold mt-0.5", value > 0 ? "text-emerald-500" : value < 0 ? "text-red-500" : "text-muted-foreground")}>
        {value > 0 ? "+" : ""}{fmtPct(value / 100)}
      </div>
    </div>
  );
}
