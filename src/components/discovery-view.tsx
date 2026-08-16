"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
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
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Info,
  ArrowUpDown,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  Layers,
  Activity,
  Database,
  Clock,
  ChevronRight,
  Star,
} from "lucide-react";
import type { RankedRow } from "@/engine/ranking";
import { cn, decisionClass, fmtScore } from "@/lib/format";
import { useLocalStorage } from "@/lib/use-local-storage";
import { DecisionBadge } from "./decision-badge";
import { Sparkline } from "./sparkline";

interface TrendPoint {
  t: string | null;
  iaFinal: number;
}

type ScanResp = {
  rows: (RankedRow & { category?: string })[];
  totals: { scanned: number; passed: number; rejected: number };
  note?: string;
};

type SortKey = "rankMkt" | "rankFund" | "rankEff" | "rankConf" | "iaFinal" | "iaRaw";
type GateFilter = "all" | "passed" | "failed";
type DecisionFilter = "all" | "BUY" | "WATCH" | "INVESTIGATE" | "AVOID" | "REJECT";

// Decision bucket ordering used for visual chips.
const DECISION_ORDER: DecisionFilter[] = ["all", "BUY", "WATCH", "INVESTIGATE", "AVOID", "REJECT"];

const DECISION_COLOR: Record<Exclude<DecisionFilter, "all">, string> = {
  BUY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  WATCH: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  INVESTIGATE: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  AVOID: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  REJECT: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
};

export function DiscoveryView({
  onSelect,
}: {
  onSelect: (row: RankedRow) => void;
}) {
  const t = useTranslations();
  const [sortKey, setSortKey] = useState<SortKey>("rankMkt");
  const [search, setSearch] = useState("");
  const [gateFilter, setGateFilter] = useState<GateFilter>("all");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  // Watchlist: persisted to localStorage, shared with detail view.
  const [watchlist, setWatchlist] = useLocalStorage<string[]>("watchlist", []);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  // Keyboard navigation: tracks which row is "focused" via arrow keys.
  // -1 = no keyboard focus. Enter opens the detail view for the focused row.
  const [kbdIdx, setKbdIdx] = useState<number>(-1);
  const tableRef = useRef<HTMLTableElement | null>(null);

  const { data, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useQuery<ScanResp>({
    queryKey: ["scan"],
    queryFn: async () => {
      const res = await fetch(`/api/scan`);
      if (!res.ok) throw new Error("scan failed");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  // Fetch logos for all scanned symbols (batch, cached 1h)
  const logoSymbols = (data?.rows ?? []).map((r) => r.symbol);
  const { data: logosData } = useQuery<{ logos: Record<string, string | null> }>({
    queryKey: ["logos", logoSymbols.slice(0, 20).join(",")],
    queryFn: async () => {
      if (!logoSymbols.length) return { logos: {} };
      const r = await fetch(`/api/logos?symbols=${logoSymbols.slice(0, 20).join(",")}`);
      if (!r.ok) return { logos: {} };
      return r.json();
    },
    enabled: logoSymbols.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
  const logoBySymbol = logosData?.logos ?? {};

  // ---- Sorting -------------------------------------------------------------
  const sortedRows = useMemo(() => {
    const rows = (data?.rows ?? []).slice();
    rows.sort((a, b) => {
      const getValue = (r: RankedRow): number => {
        switch (sortKey) {
          case "rankMkt": return r.rankMkt;
          case "rankFund": return r.rankFund;
          case "rankEff": return r.rankEff;
          case "rankConf": return r.rankConf;
          case "iaFinal": return r.result.iaFinal;
          case "iaRaw": return r.result.iaRaw;
        }
      };
      const av = getValue(a) ?? 999;
      const bv = getValue(b) ?? 999;
      return av - bv;
    });
    return rows;
  }, [data?.rows, sortKey]);

  // ---- Categories (for the category filter dropdown) -----------------------
  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const r of sortedRows) if (r.category) s.add(r.category);
    return Array.from(s).sort();
  }, [sortedRows]);

  // ---- Filtering -----------------------------------------------------------
  const filteredRows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return sortedRows.filter((r) => {
      if (gateFilter !== "all") {
        const wantPassed = gateFilter === "passed";
        if (r.result.gate.passed !== wantPassed) return false;
      }
      if (decisionFilter !== "all" && r.result.decision !== decisionFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (watchlistOnly && !watchlist.includes(r.symbol)) return false;
      if (q) {
        const sym = r.symbol.toUpperCase();
        const name = (r.name ?? "").toUpperCase();
        const cat = (r.category ?? "").toUpperCase();
        if (!sym.includes(q) && !name.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [sortedRows, search, gateFilter, decisionFilter, categoryFilter, watchlistOnly, watchlist]);

  // max IA final for relative bar scaling
  const maxIAFinal = Math.max(...sortedRows.map((r) => r.result.iaFinal), 1);

  // Batch-fetch trends for filtered rows in one request. The trend API now
  // accepts up to 100 symbols (matches scan's max). Previously we passed all
  // rows including 100+ symbols which hit the 50-symbol cap and returned 400,
  // leaving the Trend column silently empty.
  const trendSymbols = filteredRows.map((r) => r.symbol);
  const cacheKey = [...trendSymbols].sort().join(",");
  const { data: trendData } = useQuery<{ trends: Record<string, TrendPoint[]> }>({
    queryKey: ["trends-batch", cacheKey],
    queryFn: async () => {
      if (!trendSymbols.length) return { trends: {} };
      const r = await fetch("/api/trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: trendSymbols }),
      });
      if (!r.ok) return { trends: {} };
      return r.json();
    },
    enabled: trendSymbols.length > 0,
    staleTime: 60_000,
  });
  const trendBySymbol = trendData?.trends ?? {};

  // Live counts for filter chips
  const counts = useMemo(() => {
    const c = {
      all: sortedRows.length,
      passed: 0,
      failed: 0,
      BUY: 0, WATCH: 0, INVESTIGATE: 0, AVOID: 0, REJECT: 0,
    };
    for (const r of sortedRows) {
      if (r.result.gate.passed) c.passed++; else c.failed++;
      c[r.result.decision as keyof typeof c]++;
    }
    return c;
  }, [sortedRows]);

  const lastScanLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  // Keyboard navigation handler: ArrowDown/ArrowUp moves focus between rows,
  // Enter opens the detail view, Escape clears focus.
  // Only active when the table is in the viewport (avoids hijacking keys
  // when the user is typing in the search box).
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't interfere with form inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKbdIdx((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, filteredRows.length - 1);
        // Scroll the focused row into view
        requestAnimationFrame(() => {
          const row = tableRef.current?.querySelector(`tbody tr:nth-child(${next + 1})`);
          row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKbdIdx((prev) => {
        const next = prev <= 0 ? 0 : prev - 1;
        requestAnimationFrame(() => {
          const row = tableRef.current?.querySelector(`tbody tr:nth-child(${next + 1})`);
          row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
        return next;
      });
    } else if (e.key === "Enter" && kbdIdx >= 0 && kbdIdx < filteredRows.length) {
      e.preventDefault();
      onSelect(filteredRows[kbdIdx]);
    } else if (e.key === "Escape") {
      setKbdIdx(-1);
    }
  }, [filteredRows, kbdIdx, onSelect]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Clamp keyboard index when filteredRows changes (avoids out-of-bounds
  // when filters reduce the result set). Derived, not effect-based.
  const safeKbdIdx = kbdIdx >= filteredRows.length ? -1 : kbdIdx;

  // Watchlist toggle: add/remove a symbol from the localStorage watchlist.
  const toggleWatchlist = useCallback((symbol: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setWatchlist((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol],
    );
  }, [setWatchlist]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        {/* Animated gradient glow background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -end-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-32 -start-32 h-72 w-72 rounded-full bg-chart-2/5 blur-3xl pointer-events-none" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary backdrop-blur-sm">
                <Radar className="h-3.5 w-3.5" />
                {t("app.subtitle")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient">
                {t("discovery.title")}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t("discovery.subtitle")}
              </p>
              {lastScanLabel && (
                <div className="inline-flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{t("discovery.lastScanAt", { time: lastScanLabel })}</span>
                  {isFetching && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      {t("discovery.scanning")}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2 h-9"
              >
                {isFetching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isFetching ? t("discovery.scanning") : t("discovery.runScan")}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill
              icon={<Database className="h-4 w-4" />}
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
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              }
              label={t("common.live")}
              value="LIVE"
            />
          </div>

          {data?.note && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
              <span>{data.note}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="overflow-hidden">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Search + sort */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("discovery.searchPlaceholder")}
                className="ps-9 h-9"
                aria-label={t("common.search")}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                  aria-label={t("common.cancel")}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="sm:w-[180px] h-9 text-xs gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-[160px] h-9 text-xs gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("discovery.filterCategory")} — {t("discovery.filterAll")}
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gate filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground me-1">
              <Filter className="h-3 w-3" />
              {t("discovery.filterGate")}:
            </span>
            <FilterChip
              active={gateFilter === "all"}
              onClick={() => setGateFilter("all")}
              count={counts.all}
              label={t("discovery.filterAll")}
            />
            <FilterChip
              active={gateFilter === "passed"}
              onClick={() => setGateFilter("passed")}
              count={counts.passed}
              label={t("discovery.gatePassed")}
              tone="ok"
            />
            <FilterChip
              active={gateFilter === "failed"}
              onClick={() => setGateFilter("failed")}
              count={counts.failed}
              label={t("discovery.gateFailed")}
              tone="bad"
            />
            {/* Watchlist filter chip — toggles showing only starred assets */}
            <button
              onClick={() => setWatchlistOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ms-2",
                watchlistOnly
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              title={t("discovery.watchlistHint")}
            >
              <Star className={cn("h-3 w-3", watchlistOnly && "fill-current")} />
              <span>{t("discovery.watchlist")}</span>
              {watchlist.length > 0 && (
                <span className="text-[10px] font-bold tabular-nums opacity-80">{watchlist.length}</span>
              )}
            </button>
          </div>

          {/* Decision filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground me-1">
              <Activity className="h-3 w-3" />
              {t("discovery.filterDecision")}:
            </span>
            {DECISION_ORDER.map((d) => {
              const isActive = decisionFilter === d;
              const label = d === "all" ? t("discovery.filterAll") : t(`decision.${d}` as never);
              const count = d === "all" ? counts.all : counts[d as Exclude<DecisionFilter, "all">];
              return (
                <button
                  key={d}
                  onClick={() => setDecisionFilter(d)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                    isActive
                      ? d === "all"
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : DECISION_COLOR[d as Exclude<DecisionFilter, "all">]
                      : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span>{label}</span>
                  <span className="text-[10px] font-bold tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Result count */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("discovery.resultsCount", { count: filteredRows.length })}
            </span>
            {(gateFilter !== "all" || decisionFilter !== "all" || categoryFilter !== "all" || search || watchlistOnly) && (
              <button
                onClick={() => {
                  setGateFilter("all");
                  setDecisionFilter("all");
                  setCategoryFilter("all");
                  setSearch("");
                  setWatchlistOnly(false);
                }}
                className="text-xs text-primary hover:underline"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                {t("discovery.colSymbol")}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                <span>{t("discovery.clickHint")}</span>
                <kbd className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {t("discovery.kbdHint")}
                </kbd>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scroll-thin max-h-[70vh]">
            <table ref={tableRef} className="w-full text-sm">
              <caption className="sr-only">
                {t("discovery.title")} — {t("discovery.subtitle")}
              </caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/95 backdrop-blur text-xs text-muted-foreground shadow-sm">
                  <th className="py-2.5 px-2 text-start font-medium hidden sm:table-cell">#</th>
                  <th className="py-2.5 px-3 text-start font-medium">{t("discovery.colSymbol")}</th>
                  <th className="py-2.5 px-3 text-start font-medium hidden md:table-cell">{t("discovery.colCategory")}</th>
                  <th className="py-2.5 px-3 text-center font-medium hidden sm:table-cell">{t("discovery.colFund")}</th>
                  <th className="py-2.5 px-3 text-center font-medium hidden sm:table-cell">{t("discovery.colConf")}</th>
                  <th className="py-2.5 px-3 text-center font-medium hidden sm:table-cell">{t("discovery.colEff")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colMkt")}</th>
                  <th className="py-2.5 px-3 text-center font-medium hidden sm:table-cell">{t("discovery.colIAFinal")}</th>
                  {/* Trend now visible on md+ (was lg only — effectively hidden on tablets) */}
                  <th className="py-2.5 px-3 text-center font-medium hidden md:table-cell">{t("discovery.colTrend")}</th>
                  <th className="py-2.5 px-2 text-center font-medium">{t("discovery.colGate")}</th>
                  <th className="py-2.5 px-3 text-center font-medium">{t("discovery.colDecision")}</th>
                  <th className="py-2.5 px-1 text-center font-medium hidden sm:table-cell" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={12} className="py-3.5 px-3">
                        <Skeleton className="h-9 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading &&
                  filteredRows.map((r, idx) => {
                    const passed = r.result.gate.passed;
                    const trend = trendBySymbol[r.symbol] ?? [];
                    const isKbdFocused = safeKbdIdx === idx;
                    return (
                      <tr
                        key={r.symbol}
                        onClick={() => onSelect(r)}
                        tabIndex={0}
                        aria-label={`Row ${idx + 1} of ${filteredRows.length}, ${r.symbol} ${r.name}, rank ${r.rankMkt}, decision ${r.result.decision}`}
                        className={cn(
                          "border-b border-border/30 last:border-0 cursor-pointer transition-all group outline-none",
                          idx % 2 === 1 ? "bg-foreground/[0.06]" : "",
                          isKbdFocused
                            ? "bg-primary/15 ring-1 ring-inset ring-primary/40 shadow-sm"
                            : "hover:bg-primary/10 hover:shadow-md",
                        )}
                      >
                        <td className="py-3.5 px-2 text-muted-foreground font-mono text-xs hidden sm:table-cell">
                          {r.rankMkt}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            {logoBySymbol[r.symbol] ? (
                              <img
                                src={logoBySymbol[r.symbol]!}
                                alt={r.symbol}
                                className="h-8 w-8 rounded-lg border border-border/40 bg-muted shrink-0"
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.onerror = null;
                                  img.src = '';
                                  img.className = 'hidden';
                                  const fallback = img.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'inline-flex';
                                }}
                              />
                            ) : null}
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold shrink-0"
                              style={{ display: logoBySymbol[r.symbol] ? 'none' : 'inline-flex' }}
                            >
                              {r.symbol.slice(0, 3)}
                            </span>
                            <div className="flex flex-col leading-tight min-w-0">
                              <span className="font-semibold truncate">{r.symbol}</span>
                              <span className="text-[11px] text-muted-foreground max-w-[140px] truncate">
                                {r.name}
                              </span>
                            </div>
                            {/* Watchlist star toggle */}
                            <button
                              onClick={(e) => toggleWatchlist(r.symbol, e)}
                              className={cn(
                                "inline-flex h-6 w-6 items-center justify-center rounded-md transition-all shrink-0",
                                watchlist.includes(r.symbol)
                                  ? "text-amber-500 hover:bg-amber-500/10"
                                  : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100",
                              )}
                              title={watchlist.includes(r.symbol) ? t("discovery.removeFromWatchlist") : t("discovery.addToWatchlist")}
                              aria-label={watchlist.includes(r.symbol) ? t("discovery.removeFromWatchlist") : t("discovery.addToWatchlist")}
                            >
                              <Star className={cn("h-3.5 w-3.5", watchlist.includes(r.symbol) && "fill-current")} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 hidden md:table-cell">
                          <Badge variant="outline" className="font-normal text-[11px]">
                            {r.category ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono hidden sm:table-cell">{r.rankFund}</td>
                        <td className="py-3.5 px-3 text-center font-mono hidden sm:table-cell">{r.rankConf}</td>
                        <td className="py-3.5 px-3 text-center font-mono hidden sm:table-cell">{r.rankEff}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary/15 px-1.5 text-xs font-bold text-primary">
                            {r.rankMkt}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center hidden sm:table-cell">
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
                        <td className="py-3.5 px-3 text-center hidden md:table-cell">
                          <div className="flex flex-col items-center gap-0.5">
                            <Sparkline
                              values={trend.map((p) => p.iaFinal)}
                              width={48}
                              height={16}
                            />
                            {trend.length === 0 && (
                              <span className="text-[9px] text-muted-foreground/60">
                                {t("discovery.sparklineEmpty")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          {passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 inline" />
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                              decisionClass(r.result.decision),
                            )}
                          >
                            {t(`decision.${r.result.decision}`)}
                          </span>
                        </td>
                        <td className="py-3.5 px-1 text-center hidden sm:table-cell" aria-hidden>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all inline" />
                        </td>
                      </tr>
                    );
                  })}
                {!isLoading && isError && (
                  <tr>
                    <td colSpan={12} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-sm">
                        <div className="rounded-full bg-red-500/10 p-3">
                          <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <div className="text-center space-y-1">
                          <span className="block text-red-600 dark:text-red-400 font-medium">
                            {t("discovery.error")}
                          </span>
                          <span className="block text-xs text-muted-foreground max-w-sm">
                            {t("discovery.errorHint")}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => refetch()}>
                          <RotateCw className="h-3.5 w-3.5" />
                          {t("discovery.retry")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-12">
                      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                        <div className="rounded-full bg-muted p-3">
                          <Search className="h-5 w-5" />
                        </div>
                        <span>{t("discovery.noResults")}</span>
                        <span className="text-xs max-w-sm text-center">{t("discovery.noResultsHint")}</span>
                      </div>
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
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-3 hover-lift hover:border-border">
      {/* Subtle gradient accent on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity hover:opacity-100 pointer-events-none" />
      <div className="relative flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs truncate">{label}</span>
      </div>
      <div
        className={cn(
          "relative mt-1 text-xl font-bold tabular-nums",
          tone === "ok" && "text-emerald-500",
          tone === "bad" && "text-red-500",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  label: string;
  tone?: "ok" | "bad";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        active
          ? tone === "ok"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : tone === "bad"
              ? "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400"
              : "border-primary/40 bg-primary/15 text-primary"
          : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-[10px] font-bold tabular-nums opacity-80">{count}</span>
    </button>
  );
}
