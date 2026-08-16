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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Gauge,
  Shield,
  AlertTriangle,
  Target,
  BarChart3,
  RotateCw,
  CandlestickChart,
} from "lucide-react";
import { cn } from "@/lib/format";

interface Features {
  rsi: number;
  macdHist: number;
  bbWidth: number;
  bbPosition: number;
  atrPct: number;
  stoch: number;
  volRatio: number;
  ret5: number;
  ret20: number;
  volatility: number;
}
interface Factors {
  fTrend: number;
  fMomentum: number;
  fVolatility: number;
  fParticipation: number;
  fStructure: number;
}
interface ConformalResult {
  probs: [number, number, number];
  predictionSet: number[];
  coverage: number;
}
interface EVResult {
  ev: number;
  signal: string;
  direction: number;
}
interface RiskResult {
  var99: number;
  es99: number;
  positionSize: number;
  maxLeverage: number;
  safetyMargin: number;
}
interface TechnicalAnalysis {
  symbol: string;
  features: Features;
  factors: Factors;
  regime: string;
  signal: string;
  direction: number;
  conformal: ConformalResult | null;
  ev: EVResult | null;
  risk: RiskResult | null;
  dataQuality: number;
}

const REGIME_COLORS: Record<string, string> = {
  TRENDING_BULL: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  TRENDING_BEAR: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  LOW_VOL_COMPRESSION: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  HIGH_VOL_EXPANSION: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  PANIC_CASCADE: "bg-red-600/20 text-red-700 dark:text-red-300 border-red-600/40",
  MEAN_REVERSION: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
};

const SIGNAL_COLORS: Record<string, string> = {
  LONG: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  SHORT: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  WAIT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  NO_TRADE: "bg-muted text-muted-foreground border-border",
};

export function TechnicalPanel({ symbol }: { symbol: string }) {
  const t = useTranslations();
  const { data, isLoading, isError, error, refetch } = useQuery<{
    analysis?: TechnicalAnalysis;
    error?: string;
    message?: string;
  }>({
    queryKey: ["technical", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/technical/${symbol}?interval=1d&limit=365`);
      const json = await r.json();
      if (!r.ok) {
        // Attach status so the error handler can distinguish 404/422.
        const e = new Error(json.message || json.error || "failed") as Error & { status?: number };
        e.status = r.status;
        throw e;
      }
      return json;
    },
    // CRITICAL: retry: false for ALL errors. The previous retry function
    // returned `true` for non-404 errors, which in react-query v5 means
    // "retry indefinitely" — there's no implicit maxRetries cap when retry
    // is a function. This caused an infinite refetch loop (~8 req/s) for
    // any asset that returned a non-404 error (e.g. network blips, 500s).
    // 404s (asset not on Binance) are the common case and should never retry.
    // 500s (Binance API down) should also not retry-spam.
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min — don't refetch on re-mount
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data?.analysis) {
    let errorMsg = t("technical.fetchError");
    // react-query error can be an Error (with optional status) or a string
    const errStr = error instanceof Error
      ? error.message
      : typeof error === "string" ? error : "";
    const errStatus = (error as { status?: number })?.status;
    const isNotOnBinance = errStatus === 404 || errStr.includes("not listed on Binance") || errStr.includes("not_on_binance");
    const isInsufficient = errStr.includes("Not enough") || errStr.includes("insufficient");
    if (isNotOnBinance) {
      errorMsg = t("technical.notOnBinance", { symbol });
    } else if (isInsufficient) {
      errorMsg = t("technical.insufficientData");
    } else if (errStr && errStr !== "failed") {
      errorMsg = errStr;
    }
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {t("technical.title")}
          </CardTitle>
          <CardDescription>{t("technical.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {/* Only show retry for non-404 errors (404 = asset not on Binance, retrying won't help) */}
            {!isNotOnBinance && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => refetch()}
              >
                <RotateCw className="h-3 w-3" />
                {t("discovery.retry")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const a = data.analysis;
  const dirPct = (a.direction * 100).toFixed(0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {t("technical.title")}
        </CardTitle>
        <CardDescription>{t("technical.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signal + Regime + Direction */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">{t("technical.signal")}</div>
            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold", SIGNAL_COLORS[a.signal] ?? SIGNAL_COLORS.NO_TRADE)}>
              {a.signal === "LONG" && <TrendingUp className="h-3 w-3 me-1" />}
              {a.signal === "SHORT" && <TrendingDown className="h-3 w-3 me-1" />}
              {t(`technical.${a.signal === "NO_TRADE" ? "notrade" : a.signal.toLowerCase()}`)}
            </span>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">{t("technical.regime")}</div>
            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold", REGIME_COLORS[a.regime] ?? REGIME_COLORS.MEAN_REVERSION)}>
              {a.regime.replace(/_/g, " ")}
            </span>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-center">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">{t("technical.direction")}</div>
            <span className={cn("font-mono text-lg font-bold", a.direction > 0 ? "text-emerald-500" : a.direction < 0 ? "text-red-500" : "text-muted-foreground")}>
              {dirPct > 0 ? "+" : ""}{dirPct}%
            </span>
          </div>
        </div>

        {/* Features */}
        <div>
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            {t("technical.features")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FeatureRow label={t("technical.rsi")} value={a.features.rsi.toFixed(1)} hint="0-100" />
            <FeatureRow label={t("technical.macd")} value={a.features.macdHist.toFixed(4)} />
            <FeatureRow label={t("technical.bbPos")} value={(a.features.bbPosition * 100).toFixed(0) + "%"} hint="0-100" />
            <FeatureRow label={t("technical.atr")} value={(a.features.atrPct * 100).toFixed(2) + "%"} />
            <FeatureRow label={t("technical.stoch")} value={a.features.stoch.toFixed(1)} hint="0-100" />
            <FeatureRow label={t("technical.volRatio")} value={a.features.volRatio.toFixed(2) + "×"} />
            <FeatureRow label={t("technical.ret5")} value={(a.features.ret5 * 100).toFixed(2) + "%"} />
            <FeatureRow label={t("technical.ret20")} value={(a.features.ret20 * 100).toFixed(2) + "%"} />
          </div>
        </div>

        {/* Standardized Factors */}
        <div>
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            {t("technical.factors")}
          </div>
          <div className="space-y-1.5">
            <FactorBar label={t("technical.fTrend")} value={a.factors.fTrend} />
            <FactorBar label={t("technical.fMomentum")} value={a.factors.fMomentum} />
            <FactorBar label={t("technical.fVolatility")} value={a.factors.fVolatility} />
            <FactorBar label={t("technical.fParticipation")} value={a.factors.fParticipation} />
            <FactorBar label={t("technical.fStructure")} value={a.factors.fStructure} />
          </div>
        </div>

        {/* EV */}
        {a.ev && (
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" />
              {t("technical.ev")}
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">EV</span>
                <span className={cn("font-mono font-bold", a.ev.ev > 0 ? "text-emerald-500" : "text-red-500")}>
                  {(a.ev.ev * 100).toFixed(3)}%
                </span>
              </div>
              {a.conformal && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("technical.probs")}</span>
                  <span className="font-mono">
                    [{(a.conformal.probs[0] * 100).toFixed(0)}/{(a.conformal.probs[1] * 100).toFixed(0)}/{(a.conformal.probs[2] * 100).toFixed(0)}]
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk */}
        {a.risk && (
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              {t("technical.risk")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FeatureRow label={t("technical.var99")} value={(a.risk.var99 * 100).toFixed(2) + "%"} />
              <FeatureRow label={t("technical.es99")} value={(a.risk.es99 * 100).toFixed(2) + "%"} />
              <FeatureRow label={t("technical.positionSize")} value={"$" + a.risk.positionSize.toFixed(0)} />
              <FeatureRow label={t("technical.maxLeverage")} value={a.risk.maxLeverage.toFixed(1) + "×"} />
              <FeatureRow label={t("technical.safetyMargin")} value={a.risk.safetyMargin.toFixed(1) + "×"} />
              <FeatureRow label={t("technical.dataQuality")} value={(a.dataQuality * 100).toFixed(0) + "%"} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold">{value}</span>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] text-muted-foreground text-end">{label}</span>
      <div className="flex-1 h-5 rounded-md bg-muted/50 overflow-hidden">
        <div className={cn("h-full rounded-md transition-all", color)} style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <span className="w-8 text-end font-mono text-[11px] font-semibold">{pct}</span>
    </div>
  );
}
