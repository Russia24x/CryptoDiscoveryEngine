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
import { BarChart3, TrendingUp, TrendingDown, Trophy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/format";

interface PeerPercentile {
  key: string;
  label: string;
  value: number;
  percentile: number;
  rank: number;
  total: number;
  better: boolean;
}
interface Benchmark {
  symbol: string;
  name: string;
  category?: string;
  percentiles: PeerPercentile[];
  relativeIA: number;
  peerCount: number;
  strengths: string[];
  weaknesses: string[];
}

function pctColor(p: number): string {
  if (p >= 75) return "bg-emerald-500";
  if (p >= 50) return "bg-lime-500";
  if (p >= 25) return "bg-amber-500";
  return "bg-red-500";
}
function pctTextColor(p: number): string {
  if (p >= 75) return "text-emerald-500";
  if (p >= 50) return "text-lime-500";
  if (p >= 25) return "text-amber-500";
  return "text-red-500";
}

export function BenchmarkPanel({ symbol }: { symbol: string }) {
  const t = useTranslations();
  const { data, isLoading, isError } = useQuery<{ benchmark: Benchmark }>({
    queryKey: ["benchmark", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/benchmark/${symbol}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const b = data?.benchmark;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError || !b) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t("benchmark.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t("benchmark.loadError")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // relative IA gauge
  const relIA = b.relativeIA;
  const gaugeColor = relIA >= 70 ? "text-emerald-500" : relIA >= 50 ? "text-amber-500" : "text-red-500";
  const gaugeStroke = relIA >= 70 ? "#10b981" : relIA >= 50 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 34; // r=34 — must match the <circle r="34">

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {t("benchmark.title")}
        </CardTitle>
        <CardDescription>
          {t("benchmark.subtitle", { count: b.peerCount })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Relative IA gauge */}
        <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
              <circle
                cx="40" cy="40" r="34" fill="none" stroke={gaugeStroke} strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(relIA / 100) * circumference} ${circumference}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-xl font-bold tabular-nums", gaugeColor)}>{relIA}</span>
              <span className="text-[9px] text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t("benchmark.relativeIA")}</div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              {t("benchmark.relativeIAHint")}
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("benchmark.legendHigh")}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>{t("benchmark.peerCount", { count: b.peerCount })}</span>
            </div>
          </div>
        </div>

        {/* Strengths / Weaknesses chips */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> {t("benchmark.strengths")}
            </div>
            <div className="flex flex-wrap gap-1">
              {b.strengths.map((s) => (
                <span key={s} className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> {t("benchmark.weaknesses")}
            </div>
            <div className="flex flex-wrap gap-1">
              {b.weaknesses.map((s) => (
                <span key={s} className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Percentile bars */}
        <div className="space-y-1.5">
          {b.percentiles.map((p) => (
            <div key={p.key} className="flex items-center gap-3 text-sm">
              <div className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={p.label}>
                {p.label}
              </div>
              <div className="relative flex-1 h-6 rounded-md bg-muted/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-md transition-all duration-500", pctColor(p.percentile))}
                  style={{ width: `${Math.max(3, p.percentile)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <span className="text-[10px] font-mono font-semibold text-white drop-shadow">
                    {p.percentile}th
                  </span>
                  {p.rank === 1 && (
                    <Trophy className="h-3 w-3 text-yellow-300 drop-shadow" />
                  )}
                </div>
              </div>
              <div className="w-14 shrink-0 text-end">
                <span className={cn("text-[11px] font-mono font-semibold", pctTextColor(p.percentile))}>
                  {p.rank}/{p.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
