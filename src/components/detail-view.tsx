"use client";

import { useTranslations, useLocale } from "next-intl";
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
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  GitBranch,
  Layers,
  ShieldAlert,
  Sparkles,
  Scale,
  AlertTriangle,
} from "lucide-react";
import type { RankedRow } from "@/engine/ranking";
import type { EngineInputs, EngineResult } from "@/engine";
import { cn, fmtUsd, fmtPct, fmtScore, barColor01, scoreColor01 } from "@/lib/format";
import { DecisionBadge } from "./decision-badge";
import { BenchmarkPanel } from "./benchmark-panel";

interface DetailResp {
  input: EngineInputs;
  result: EngineResult;
  evidence: Array<{
    id: string;
    kind: string;
    label: string;
    value: string;
    source: string;
    grade: string;
    sentiment: string;
    confidence: number;
    freshnessH: number;
    timestamp: string;
  }>;
}

export function DetailView({
  row,
  onBack,
}: {
  row: RankedRow;
  onBack: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const isRtl = locale === "fa";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const { data, isLoading, isError } = useQuery<DetailResp>({
    queryKey: ["project", row.symbol],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${row.symbol}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const result = data?.result ?? row.result;
  const c = result.components;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <BackIcon className="h-4 w-4" />
          {t("detail.back")}
        </Button>
        <DecisionBadge decision={result.decision} />
      </div>

      {/* Title block */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary text-lg font-bold glow-primary">
              {row.symbol.slice(0, 3)}
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{row.symbol}</h1>
              <p className="text-sm text-muted-foreground">{row.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-[11px]">
                  {data?.input.category ?? "—"}
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  {data?.input.accrualKind}
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <KV label={t("discovery.colIARaw")} value={fmtScore(result.iaRaw)} />
            <KV label="C" value={result.confidence.toFixed(2)} />
            <KV label={t("discovery.colIAEff")} value={fmtScore(result.iaEffective)} />
            <KV label="M" value={result.regime.toFixed(2)} />
          </div>
        </div>
      </div>

      {isError && !isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t("detail.dataError")}</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          {/* Four-tier ranking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("detail.fourRanks")}
              </CardTitle>
              <CardDescription>{t("detail.separationHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <RankCard
                  label={t("detail.fundamentalRank")}
                  rank={row.rankFund}
                  value={result.iaRaw}
                  tone="violet"
                />
                <RankCard
                  label={t("detail.confidenceRank")}
                  rank={row.rankConf}
                  value={result.confidence * 100}
                  tone="amber"
                  suffix=""
                />
                <RankCard
                  label={t("detail.effectiveRank")}
                  rank={row.rankEff}
                  value={result.iaEffective}
                  tone="emerald"
                />
                <RankCard
                  label={t("detail.marketRank")}
                  rank={row.rankMkt}
                  value={result.iaFinal}
                  tone="primary"
                  highlight
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Component scores */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  {t("detail.components")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ComponentBar label={t("detail.PQ")} value={c.pq} />
                <ComponentBar label={t("detail.TQ")} value={c.tq} />
                <ComponentBar label={t("detail.VA")} value={c.va} />
                <ComponentBar label={t("detail.V")} value={c.v} />
                <ComponentBar label={t("detail.R")} value={c.r} invert />
              </CardContent>
            </Card>

            {/* Value accrual chain */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  {t("detail.valueChain")}
                </CardTitle>
                <CardDescription>
                  VAE = α × δ = TC / PR
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <KV label={t("detail.GEA")} value={fmtUsd(data?.input.gea ?? 0)} />
                  <KV label={t("detail.PR")} value={fmtUsd(data?.input.pr ?? 0)} />
                  <KV label={t("detail.PC")} value={fmtUsd(data?.input.pc ?? 0)} />
                  <KV label={t("detail.TC")} value={fmtUsd(data?.input.tc ?? 0)} />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("detail.alpha")}</span>
                    <span className={cn("font-mono font-semibold", scoreColor01(c.alpha))}>
                      {fmtPct(c.alpha)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("detail.delta")}</span>
                    <span className={cn("font-mono font-semibold", scoreColor01(c.delta))}>
                      {fmtPct(c.delta)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="font-medium">{t("detail.VAE")}</span>
                    <span className={cn("font-mono font-bold text-base", scoreColor01(c.vae / 100))}>
                      {c.vae.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* chain visualization */}
                <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                  <Node label="GEA" />
                  <Arrow label="α" />
                  <Node label="PR" />
                  <Arrow label="αc" />
                  <Node label="PC" />
                  <Arrow label="δ" />
                  <Node label="TC" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Supply metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  {t("detail.supply")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SupplyRow label={t("detail.SAR")} value={c.sar.toFixed(3)} hint="(Buyback+Burn)/(Unlock+Emission)" good={c.sar >= 0.5} bad={c.sar < 0.1} />
                <SupplyRow label={t("detail.NSP")} value={fmtUsd(c.nsp)} hint="Unlock+Emission−Burn−Buyback" neutral />
                <SupplyRow label={t("detail.FDR")} value={fmtPct(c.fdr)} hint="(12m Unlock+Emission)/Float" good={c.fdr <= 0.15} bad={c.fdr >= 0.25} />
              </CardContent>
            </Card>

            {/* Gate */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  {t("detail.gate")}
                </CardTitle>
                <CardDescription>Mechanism-aware hard vetoes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3",
                    result.gate.passed
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-red-500/30 bg-red-500/10",
                  )}
                >
                  {result.gate.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-semibold text-sm">
                    {result.gate.passed ? t("detail.gatePassed") : t("detail.gateFailed")}
                  </span>
                </div>
                {result.gate.reasons.length > 0 && (
                  <ul className="space-y-1.5 text-xs">
                    {result.gate.reasons.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  SAR gate is conditional — applied only when the token's accrual thesis is Buyback/Burn.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Explainable decision */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("detail.explanation")}
              </CardTitle>
              <CardDescription>
                DECISION: <span className="font-bold">{result.decision}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    {t("detail.forPoints")}
                  </div>
                  <ul className="space-y-1.5">
                    {result.explanation.forPoints.length ? (
                      result.explanation.forPoints.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm">
                          <span className="text-emerald-500 mt-0.5">+</span>
                          <span>{p}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-muted-foreground">—</li>
                    )}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    <TrendingDown className="h-4 w-4" />
                    {t("detail.againstPoints")}
                  </div>
                  <ul className="space-y-1.5">
                    {result.explanation.againstPoints.length ? (
                      result.explanation.againstPoints.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm">
                          <span className="text-red-500 mt-0.5">−</span>
                          <span>{p}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-muted-foreground">—</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t">
                <div className="text-sm font-semibold">{t("detail.whatChanges")}</div>
                <ul className="space-y-1">
                  {result.explanation.whatChanges.map((p) => (
                    <li key={p} className="text-xs text-muted-foreground font-mono">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-muted/40 border p-3 font-mono text-xs">
                {result.explanation.statusLine}
              </div>
            </CardContent>
          </Card>

          {/* Evidence graph */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                {t("detail.evidence")}
              </CardTitle>
              <CardDescription>{t("detail.evidenceHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 max-h-96 overflow-y-auto scroll-thin pe-1">
                {data?.evidence.map((e) => (
                  <EvidenceCard key={e.id} e={e} t={t} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Peer Benchmarking (V1.2) */}
          <BenchmarkPanel symbol={row.symbol} />
        </>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function RankCard({
  label,
  rank,
  value,
  tone,
  highlight,
}: {
  label: string;
  rank: number;
  value: number;
  tone: "violet" | "amber" | "emerald" | "primary";
  highlight?: boolean;
}) {
  const tones: Record<string, string> = {
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-600 dark:text-violet-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    primary: "from-primary/25 to-primary/5 border-primary/40 text-primary",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
        tones[tone],
        highlight && "ring-1 ring-primary/40",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-3xl font-bold tabular-nums">#{rank}</span>
        <span className="text-sm font-mono opacity-80">{fmtScore(value)}</span>
      </div>
    </div>
  );
}

function ComponentBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const v = invert ? 1 - value : value;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("font-mono text-xs font-semibold", scoreColor01(v))}>
          {Math.round(v * 100)}/100
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor01(v))}
          style={{ width: `${Math.max(2, v * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Node({ label }: { label: string }) {
  return (
    <div className="flex-1 rounded-md border border-border/60 bg-card/70 px-1.5 py-1 text-center font-mono font-semibold">
      {label}
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center text-primary">
      <span className="text-[8px] opacity-70">{label}</span>
      <span>→</span>
    </div>
  );
}

function SupplyRow({
  label,
  value,
  hint,
  good,
  bad,
  neutral,
}: {
  label: string;
  value: string;
  hint: string;
  good?: boolean;
  bad?: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{hint}</div>
      </div>
      <span
        className={cn(
          "font-mono font-semibold text-sm",
          good && "text-emerald-500",
          bad && "text-red-500",
          neutral && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EvidenceCard({
  e,
  t,
}: {
  e: DetailResp["evidence"][number];
  t: ReturnType<typeof useTranslations>;
}) {
  const gradeColor: Record<string, string> = {
    A: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    B: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    C: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    D: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  };
  const sentIcon =
    e.sentiment === "positive" ? (
      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
    ) : e.sentiment === "negative" ? (
      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
    ) : null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] uppercase">
            {e.kind}
          </Badge>
          {sentIcon}
        </div>
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 text-[10px] font-bold",
            gradeColor[e.grade] ?? gradeColor.B,
          )}
        >
          {e.grade}
        </span>
      </div>
      <div className="mt-1.5 text-sm font-medium leading-tight">{e.label}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">{e.value}</span>
        <span className="text-[10px] text-muted-foreground">{e.source}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>conf {(e.confidence * 100).toFixed(0)}%</span>
        <span>{e.freshnessH?.toFixed(0)}h old</span>
      </div>
    </div>
  );
}
