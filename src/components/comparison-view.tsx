"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  GitCompare,
  Trophy,
  X,
  Plus,
  Sparkles,
  Crown,
} from "lucide-react";
import { demoAssets } from "@/providers/demo-data";
import { cn, fmtScore, fmtUsd } from "@/lib/format";
import { toast } from "sonner";

interface ComparisonCell {
  symbol: string;
  value: number;
  percentile: number;
  rank: number;
}
interface ComparisonRow {
  metric: string;
  label: string;
  cells: ComparisonCell[];
  higherBetter: boolean;
}
interface ComparisonResult {
  symbols: string[];
  rows: ComparisonRow[];
  iaRaw: Record<string, number>;
  iaFinal: Record<string, number>;
  relativeIA: Record<string, number>;
}

const PALETTE = [
  "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  "from-violet-500/20 to-violet-500/5 border-violet-500/40 text-violet-600 dark:text-violet-400",
  "from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-600 dark:text-amber-400",
  "from-rose-500/20 to-rose-500/5 border-rose-500/40 text-rose-600 dark:text-rose-400",
  "from-cyan-500/20 to-cyan-500/5 border-cyan-500/40 text-cyan-600 dark:text-cyan-400",
];

function cellColor(pct: number): string {
  if (pct >= 75) return "text-emerald-500";
  if (pct >= 50) return "text-lime-500";
  if (pct >= 25) return "text-amber-500";
  return "text-red-500";
}
function cellBg(pct: number): string {
  if (pct >= 75) return "bg-emerald-500/15 border-emerald-500/40";
  if (pct >= 50) return "bg-lime-500/15 border-lime-500/40";
  if (pct >= 25) return "bg-amber-500/15 border-amber-500/40";
  return "bg-red-500/15 border-red-500/40";
}

export function ComparisonView() {
  const t = useTranslations();
  const [selected, setSelected] = useState<string[]>(["HYPE", "AAVE", "GMX"]);

  const { data, isFetching, refetch } = useQuery<{ comparison: ComparisonResult }>({
    queryKey: ["compare", selected.join(",")],
    queryFn: async () => {
      const r = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: selected }),
      });
      if (!r.ok) throw new Error("compare failed");
      return r.json();
    },
    enabled: selected.length >= 2,
  });

  const comp = data?.comparison;

  const toggle = (sym: string) => {
    setSelected((cur) => {
      if (cur.includes(sym)) return cur.filter((s) => s !== sym);
      if (cur.length >= 5) {
        toast.error(t("compare.maxHint"));
        return cur;
      }
      return [...cur, sym];
    });
  };

  const clear = () => setSelected([]);

  // determine winner per row (best rank = 1)
  const winner = (row: ComparisonRow): string | null => {
    const best = row.cells.find((c) => c.rank === 1);
    return best?.symbol ?? null;
  };

  // overall winner by relativeIA
  const overallWinner = comp
    ? Object.entries(comp.relativeIA).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <GitCompare className="h-3.5 w-3.5" />
                {t("app.subtitle")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t("compare.title")}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t("compare.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {t("compare.selected", { count: selected.length })}
              </Badge>
              {selected.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={clear}>
                  <X className="h-3.5 w-3.5" />
                  {t("compare.clear")}
                </Button>
              )}
            </div>
          </div>

          {/* Asset picker */}
          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {t("compare.selectAssets")}
            </div>
            <div className="flex flex-wrap gap-2">
              {demoAssets.map((a, idx) => {
                const isSel = selected.includes(a.symbol);
                const palette = PALETTE[selected.indexOf(a.symbol) % PALETTE.length];
                return (
                  <button
                    key={a.symbol}
                    onClick={() => toggle(a.symbol)}
                    className={cn(
                      "group inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                      isSel
                        ? cn("bg-gradient-to-br", palette)
                        : "border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded text-[10px] font-bold",
                        isSel ? "bg-background/40" : "bg-muted",
                      )}
                    >
                      {isSel ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </span>
                    <span className="font-semibold">{a.symbol}</span>
                    <span className="text-muted-foreground max-w-[100px] truncate hidden sm:inline">
                      {a.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {selected.length < 2 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                {t("compare.minHint")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {selected.length < 2 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("compare.noData")}
          </CardContent>
        </Card>
      ) : isFetching || !comp ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary header cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {comp.symbols.map((sym, idx) => {
              const palette = PALETTE[idx % PALETTE.length];
              const isOverall = sym === overallWinner;
              return (
                <div
                  key={sym}
                  className={cn(
                    "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
                    palette,
                    isOverall && "ring-2 ring-primary/50",
                  )}
                >
                  {isOverall && (
                    <div className="absolute top-2 end-2">
                      <Crown className="h-4 w-4 text-yellow-400" />
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wide opacity-80">
                    {sym}
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {comp.relativeIA[sym]}/100
                  </div>
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {t("compare.relativeIA")}
                  </div>
                  <div className="mt-2 pt-2 border-t border-current/15 grid grid-cols-2 gap-1 text-[10px] opacity-80">
                    <div>
                      <div className="uppercase">{t("compare.iaRaw")}</div>
                      <div className="font-mono font-semibold">{fmtScore(comp.iaRaw[sym])}</div>
                    </div>
                    <div>
                      <div className="uppercase">{t("compare.iaFinal")}</div>
                      <div className="font-mono font-semibold">{fmtScore(comp.iaFinal[sym])}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison matrix */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("compare.metric")}
              </CardTitle>
              <CardDescription>
                {t("benchmark.peerCount", { count: demoAssets.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs">
                      <th className="py-2.5 px-3 text-start font-medium text-muted-foreground sticky start-0 bg-muted/40 backdrop-blur z-10">
                        {t("compare.metric")}
                      </th>
                      {comp.symbols.map((sym, idx) => (
                        <th key={sym} className="py-2.5 px-3 text-center font-medium">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 bg-gradient-to-br",
                              PALETTE[idx % PALETTE.length],
                            )}
                          >
                            <span className="font-bold">{sym}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comp.rows.map((row) => {
                      const win = winner(row);
                      return (
                        <tr key={row.metric} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 text-xs font-medium sticky start-0 bg-card/80 backdrop-blur z-10">
                            <div>{row.label}</div>
                            {!row.higherBetter && (
                              <div className="text-[9px] text-muted-foreground">
                                {t("benchmark.legendLow")}
                              </div>
                            )}
                          </td>
                          {row.cells.map((cell) => {
                            const isWin = cell.symbol === win;
                            return (
                              <td key={cell.symbol} className="py-2.5 px-3 text-center">
                                <div
                                  className={cn(
                                    "inline-flex flex-col items-center justify-center rounded-md border px-2.5 py-1.5 min-w-[78px]",
                                    cellBg(cell.percentile),
                                    isWin && "ring-1 ring-yellow-400/50",
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={cn("font-mono text-sm font-bold", cellColor(cell.percentile))}>
                                      {cell.percentile}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">th</span>
                                    {isWin && <Trophy className="h-3 w-3 text-yellow-400" />}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                                    #{cell.rank}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Refresh */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <GitCompare className="h-4 w-4" />
              {t("compare.runCompare")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
