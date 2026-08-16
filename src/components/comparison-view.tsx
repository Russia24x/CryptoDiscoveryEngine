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
  GitCompare,
  Trophy,
  X,
  Plus,
  Sparkles,
  Crown,
  AlertTriangle,
  RotateCw,
  Database,
  Compass,
  Share2,
  Check,
} from "lucide-react";
import { cn, fmtScore } from "@/lib/format";
import { useLocalStorage } from "@/lib/use-local-storage";
import { toast } from "sonner";

interface CachedAsset {
  symbol: string;
  name: string;
  category: string;
  marketCap: number;
}

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

export function ComparisonView({ onGoToDiscovery }: { onGoToDiscovery?: () => void }) {
  const t = useTranslations();
  // Compare-set is shared with the detail view via localStorage. When the
  // user clicks "Add to Compare" on any asset, this view re-renders and the
  // newly-added symbol appears in `selected`.
  const [lsCompareSet, setLsCompareSet] = useLocalStorage<string[]>("compare-set", []);
  // On first mount, check the URL for ?compare=SYM1,SYM2 (shared deep link).
  // This runs once; subsequent toggles go through the normal flow.
  const [manualSelected, setManualSelected] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("compare");
    if (!raw) return [];
    const syms = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    return syms.slice(0, 5);
  });

  // Fetch the list of available assets from the server-side scan cache.
  // (The client can't read the in-memory cache directly — this endpoint
  // returns the cached symbols so the asset picker can render them, and
  // so we can fall back to sensible defaults when the user hasn't picked 2+.)
  const { data: assetsData } = useQuery<{ count: number; assets: CachedAsset[] }>({
    queryKey: ["assets"],
    queryFn: async () => {
      const r = await fetch("/api/assets");
      if (!r.ok) return { count: 0, assets: [] };
      return r.json();
    },
    staleTime: 30_000, // 30s — the cache is process-scoped and stable
  });
  const cachedAssets = assetsData?.assets ?? [];
  const cachedCount = assetsData?.count ?? 0;

  // Selection priority:
  // 1. localStorage compare-set (if ≥ 2 entries) — user explicitly added these
  // 2. manual picks via the asset picker UI (if ≥ 2)
  // 3. top 3 cached assets by market cap — sensible default so the view is
  //    never empty on first load (after a scan has run)
  //
  // `excluded` tracks symbols the user has removed via the X button on
  // summary cards. It applies to ALL sources so removed symbols stay gone
  // even when falling back to the top-cached default.
  const [excluded, setExcluded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("exclude");
    if (!raw) return new Set();
    return new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
  });
  const topCached = cachedAssets
    .slice()
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .map((a) => a.symbol)
    .filter((s) => !excluded.has(s))
    .slice(0, 3);
  const lsFiltered = lsCompareSet.filter((s) => !excluded.has(s));
  const manualFiltered = manualSelected.filter((s) => !excluded.has(s));
  const selected = lsFiltered.length >= 2
    ? lsFiltered.slice(0, 5)
    : manualFiltered.length >= 2
      ? manualFiltered
      : topCached;
  const isUsingLS = lsFiltered.length >= 2;

  const { data, isFetching, isError, refetch } = useQuery<{ comparison: ComparisonResult }>({
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
    // When operating from localStorage source, the manual toggle still works:
    // we copy the LS set into manual and remove/add from there, so the user
    // can refine their selection without losing the LS-pushed entries.
    const base = isUsingLS ? lsCompareSet.slice(0, 5) : manualSelected;
    if (base.includes(sym)) {
      setManualSelected(base.filter((s) => s !== sym));
      return;
    }
    if (base.length >= 5) {
      toast.error(t("compare.maxHint"));
      return;
    }
    setManualSelected([...base, sym]);
  };

  const clear = () => {
    setManualSelected([]);
    setExcluded(new Set());
    // Also clear the localStorage compare-set so it doesn't re-populate.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("compare-set");
        window.dispatchEvent(new Event("ls:compare-set"));
      } catch {
        // ignore
      }
    }
  };

  // Remove a single symbol from the compare set. Adds it to `excluded` so
  // it stays removed regardless of which source (LS / manual / default) is
  // currently active. Also updates LS + manual for consistency.
  const removeFromCompare = (sym: string) => {
    setExcluded((prev) => new Set(prev).add(sym));
    if (lsCompareSet.includes(sym)) {
      setLsCompareSet((prev) => prev.filter((s) => s !== sym));
    }
    if (manualSelected.includes(sym)) {
      setManualSelected((prev) => prev.filter((s) => s !== sym));
    }
  };

  // Share the current comparison as a URL deep link. Copies to clipboard
  // and shows a toast. The URL uses ?compare=SYM1,SYM2,... so it can be
  // parsed on load to pre-seed the selection.
  const [shareCopied, setShareCopied] = useState(false);
  const shareCompare = async () => {
    if (typeof window === "undefined" || selected.length < 2) return;
    const url = new URL(window.location.href);
    url.searchParams.set("compare", selected.join(","));
    url.hash = ""; // clean fragment
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareCopied(true);
      toast.success(t("compare.shareCopied"));
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Fallback: select the URL in the address bar
      toast.error(t("compare.shareCompare"));
    }
  };

  // determine winners per row — best WITHIN the selected set (head-to-head),
  // not the global rank-1 across all peers. Ties share the win.
  const winners = (row: ComparisonRow): Set<string> => {
    const bestRank = row.cells.reduce((m, c) => Math.min(m, c.rank), Infinity);
    return new Set(row.cells.filter((c) => c.rank === bestRank).map((c) => c.symbol));
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
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scroll-thin pe-1">
              {cachedAssets.map((a) => {
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
      {cachedCount === 0 ? (
        // Scan cache empty — the compare endpoint will 404 without cached inputs.
        // Show a clear CTA instead of a confusing error.
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center max-w-md mx-auto">
              <div className="rounded-full bg-amber-500/10 p-3">
                <Database className="h-6 w-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {t("compare.needScanTitle")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("compare.needScanHint")}
                </div>
              </div>
              {onGoToDiscovery && (
                <Button variant="outline" size="sm" className="gap-2 h-8 mt-1" onClick={onGoToDiscovery}>
                  <Compass className="h-3.5 w-3.5" />
                  {t("compare.goToDiscovery")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : selected.length < 2 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="rounded-full bg-muted p-3">
                <GitCompare className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-medium">{t("compare.emptyTitle")}</div>
              <div className="text-xs text-muted-foreground max-w-sm">
                {t("compare.emptyHint")}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center gap-2 text-sm">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-600 dark:text-red-400 font-medium">
                {t("compare.error")}
              </span>
              <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => refetch()}>
                <RotateCw className="h-3.5 w-3.5" />
                {t("discovery.retry")}
              </Button>
            </div>
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
                    "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 group",
                    palette,
                    isOverall && "ring-2 ring-primary/50",
                  )}
                >
                  {/* Remove-from-compare button (top-end corner) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromCompare(sym);
                    }}
                    className="absolute top-1.5 end-1.5 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/60 hover:bg-background/90 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm border border-border/40"
                    title={t("compare.removeAsset", { symbol: sym })}
                    aria-label={t("compare.removeAsset", { symbol: sym })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {isOverall && (
                    <div className="absolute top-2 start-2">
                      <Crown className="h-4 w-4 text-yellow-400" />
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wide opacity-80 pe-7">
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
                {t("benchmark.peerCount", { count: cachedCount })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    {t("compare.title")} — {t("compare.subtitle")}
                  </caption>
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
                      const winSet = winners(row);
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
                            const isWin = winSet.has(cell.symbol);
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

          {/* Actions: Refresh + Share */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <GitCompare className="h-4 w-4" />
              {t("compare.runCompare")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shareCompare}
              disabled={selected.length < 2}
              className="gap-2"
            >
              {shareCopied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  {t("compare.shareCopied")}
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  {t("compare.shareCompare")}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
