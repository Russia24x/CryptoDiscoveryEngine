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
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/format";

interface ThesisCondition {
  label: string;
  met: boolean;
  value?: string;
  threshold?: string;
}
interface ThesisEvidence {
  direction: "up" | "down" | "neutral";
  label: string;
}
interface Thesis {
  symbol: string;
  name: string;
  title: string;
  whyWorks: string[];
  mustStayTrue: ThesisCondition[];
  whatBreaksIt: string[];
  latestEvidence: ThesisEvidence[];
  statusPct: number;
  statusLabel: "intact" | "weakening" | "broken";
}

function statusColor(label: Thesis["statusLabel"]): string {
  if (label === "intact") return "#10b981";
  if (label === "weakening") return "#f59e0b";
  return "#ef4444";
}
function statusBadgeClass(label: Thesis["statusLabel"]): string {
  if (label === "intact") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (label === "weakening") return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
}

export function ThesisPanel({ symbol }: { symbol: string }) {
  const t = useTranslations();
  const { data, isLoading, isError } = useQuery<{ thesis: Thesis }>({
    queryKey: ["thesis", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/thesis/${symbol}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
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

  const th = data?.thesis;
  if (isError || !th) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {t("thesis.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertOctagon className="h-4 w-4 shrink-0" />
            <span>{t("thesis.loadError")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stroke = statusColor(th.statusLabel);
  const circumference = 2 * Math.PI * 34; // r=34

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {t("thesis.title")}
        </CardTitle>
        <CardDescription>{t("thesis.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thesis title + status gauge */}
        <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
              <circle
                cx="40" cy="40" r="34" fill="none" stroke={stroke} strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(th.statusPct / 100) * circumference} ${circumference}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular-nums" style={{ color: stroke }}>
                {th.statusPct}%
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight">{th.title}</div>
            <Badge
              variant="outline"
              className={cn("mt-1.5 text-[10px] font-semibold uppercase", statusBadgeClass(th.statusLabel))}
            >
              {t(`thesis.${th.statusLabel}`)}
            </Badge>
          </div>
        </div>

        {/* Why it works */}
        {th.whyWorks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
              {t("thesis.whyWorks")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {th.whyWorks.map((w) => (
                <span key={w} className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Must stay true */}
        <div>
          <div className="text-xs font-semibold mb-2">{t("thesis.mustStayTrue")}</div>
          <div className="space-y-1.5">
            {th.mustStayTrue.map((c) => (
              <div key={c.label} className="flex items-start gap-2 text-sm">
                {c.met ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <span className="flex-1">{c.label}</span>
                {c.value && (
                  <span className={cn("font-mono text-[11px]", c.met ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {c.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* What breaks it */}
        <div>
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
            <AlertOctagon className="h-3.5 w-3.5" />
            {t("thesis.whatBreaks")}
          </div>
          <ul className="space-y-1">
            {th.whatBreaksIt.map((b) => (
              <li key={b} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-red-500 mt-0.5">✕</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Latest evidence */}
        <div>
          <div className="text-xs font-semibold mb-2">{t("thesis.latestEvidence")}</div>
          <div className="flex flex-wrap gap-2">
            {th.latestEvidence.map((e) => {
              const Icon = e.direction === "up" ? TrendingUp : e.direction === "down" ? TrendingDown : Minus;
              const color = e.direction === "up" ? "text-emerald-500" : e.direction === "down" ? "text-red-500" : "text-muted-foreground";
              return (
                <span key={e.label} className={cn("inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px]", color)}>
                  <Icon className="h-3 w-3" />
                  {e.label}
                </span>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
