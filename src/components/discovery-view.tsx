"use client";

import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Radar,
  Play,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Info,
  ArrowUpDown,
} from "lucide-react";
import type { RankedRow } from "@/engine/ranking";
import { cn, decisionClass, fmtScore } from "@/lib/format";
import { DecisionBadge } from "./decision-badge";

type ScanResp = {
  mode: "live" | "demo";
  rows: (RankedRow & { category?: string })[];
  totals: { scanned: number; passed: number; rejected: number };
  note?: string;
};

type SortKey = "rankMkt" | "rankFund" | "rankEff" | "rankConf" | "iaFinal" | "iaRaw";

export function DiscoveryView({
  onSelect,
}: {
  onSelect: (row: RankedRow) => void;
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [sortKey, setSortKey] = useState<SortKey>("rankMkt");

  const { data, isLoading, isFetching, refetch } = useQuery<ScanResp>({
    queryKey: ["scan", mode],
    queryFn: async () => {
      const res = await fetch(`/api/scan?mode=${mode}`);
      if (!res.ok) throw new Error("scan failed");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const rows = (data?.rows ?? []).slice().sort((a, b) => {
    const av = (a as any)[sortKey] ?? 999;
    const bv = (b as any)[sortKey] ?? 999;
    return av - bv;
  });

  // max IA final for relative bar scaling
  const maxIAFinal = Math.max(...rows.map((r) => r.result.iaFinal), 1);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Radar className="h-3.5 w-3.5" />
                {t("app.subtitle")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t("discovery.title")}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t("discovery.subtitle")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("discovery.scanMode")}
                </label>
                <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {t("discovery.demoData")}
                      </span>
                    </SelectItem>
                    <SelectItem value="live">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {t("discovery.liveData")}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2 h-9"
              >
                <Play className="h-4 w-4" />
                {isFetching ? t("discovery.scanning") : t("discovery.runScan")}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill
              icon={<TrendingUp className="h-4 w-4" />}
              label={t("discovery.scannedAssets", { count: data?.totals.scanned ?? 0 })}
              value={String(data?.totals.scanned ?? "—")}
            />
            <StatPill
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              label={t("discovery.passed", { count: data?.totals.passed ?? 0 })}
              value={String(data?.totals.passed ?? "—")}
              tone="ok"
            />
            <StatPill
              icon={<XCircle className="h-4 w-4 text-red-500" />}
              label={t("discovery.rejected", { count: data?.totals.rejected ?? 0 })}
              value={String(data?.totals.rejected ?? "—")}
              tone="bad"
            />
            <StatPill
              icon={
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    data?.mode === "live" ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
              }
              label={data?.mode === "live" ? t("common.live") : t("common.demo")}
              value={data?.mode?.toUpperCase() ?? "—"}
            />
          </div>

          {data?.note && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{data.note}</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                {t("discovery.colSymbol")}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("discovery.clickHint")}
              </CardDescription>
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rankMkt">{t("discovery.colMkt")}</SelectItem>
                <SelectItem value="rankFund">{t("discovery.colFund")}</SelectItem>
                <SelectItem value="rankEff">{t("discovery.colEff")}</SelectItem>
                <SelectItem value="rankConf">{t("discovery.colConf")}</SelectItem>
                <SelectItem value="iaFinal">{t("discovery.colIAFinal")}</SelectItem>
                <SelectItem value="iaRaw">{t("discovery.colIARaw")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 text-start font-medium">#</th>
                  <th className="py-2.5 px-3 text-start font-medium">{t("discovery.colSymbol")}</th>
                  <th className="py-2.5 px-3 text-start font-medium hidden md:table-cell">{t("discovery.colCategory")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colFund")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colConf")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colEff")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colMkt")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colIAFinal")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colGate")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colDecision")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={10} className="py-3 px-3">
                        <Skeleton className="h-9 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading &&
                  rows.map((r) => {
                    const passed = r.result.gate.passed;
                    return (
                      <tr
                        key={r.symbol}
                        onClick={() => onSelect(r)}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-3 text-muted-foreground font-mono text-xs">
                          {r.rankMkt}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                              {r.symbol.slice(0, 3)}
                            </span>
                            <div className="flex flex-col leading-tight">
                              <span className="font-semibold">{r.symbol}</span>
                              <span className="text-[11px] text-muted-foreground max-w-[140px] truncate">
                                {r.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <Badge variant="outline" className="font-normal text-[11px]">
                            {r.category ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{r.rankFund}</td>
                        <td className="py-3 px-3 text-center font-mono">{r.rankConf}</td>
                        <td className="py-3 px-3 text-center font-mono">{r.rankEff}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary/15 px-1.5 text-xs font-bold text-primary">
                            {r.rankMkt}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono font-semibold text-sm tabular-nums">
                              {fmtScore(r.result.iaFinal)}
                            </span>
                            <div className="h-1 w-14 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  r.result.iaFinal >= 28
                                    ? "bg-emerald-500"
                                    : r.result.iaFinal >= 20
                                      ? "bg-amber-500"
                                      : "bg-red-500",
                                )}
                                style={{ width: `${Math.max(4, (r.result.iaFinal / maxIAFinal) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 inline" />
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                              decisionClass(r.result.decision),
                            )}
                          >
                            {t(`decision.${r.result.decision}`)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted-foreground text-sm">
                      {t("discovery.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "ok" && "text-emerald-500",
          tone === "bad" && "text-red-500",
        )}
      >
        {value}
      </div>
    </div>
  );
}
