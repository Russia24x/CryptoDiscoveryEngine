"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  Rss,
  Send,
  Twitter,
  Trash2,
  RefreshCw,
  Inbox,
  ExternalLink,
  Settings as SettingsIcon,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  Rows3,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────

interface FeedSource {
  id: string;
  kind: string;
  name: string;
  address: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FeedItem {
  externalId: string;
  title: string;
  body: string | undefined;
  url: string | undefined;
  publishedAt: string;
  mediaUrls: string[] | undefined;
  hasVideo: boolean | undefined;
  authorName: string | undefined;
  sourceKind: string;
  sourceName: string;
}

// ─── Icons ──────────────────────────────────────────────────────

function SourceIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "telegram") return <Send className={className} />;
  if (kind === "x") return <Twitter className={className} />;
  return <Rss className={className} />;
}

function sourceColor(kind: string): string {
  if (kind === "telegram") return "text-sky-500 bg-sky-500/10 border-sky-500/25";
  if (kind === "x") return "text-foreground bg-foreground/10 border-foreground/25";
  return "text-amber-500 bg-amber-500/10 border-amber-500/25";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Main View ──────────────────────────────────────────────────

export function FeedsView({ onGoToSettings }: { onGoToSettings?: () => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"feed" | "grid" | "compact">("feed");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const { data: feedData } = useQuery<{ sources: FeedSource[] }>({
    queryKey: ["feeds"],
    queryFn: async () => {
      const r = await fetch("/api/feeds");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{
    items: FeedItem[];
    cached: boolean;
  }>({
    queryKey: ["feed-live"],
    queryFn: async () => {
      const r = await fetch("/api/feeds/live");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const refreshLive = useMutation({
    mutationFn: async () => {
      qc.invalidateQueries({ queryKey: ["feed-live"] });
    },
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/feeds?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      qc.invalidateQueries({ queryKey: ["feed-live"] });
      toast.success(t("settings.removed"));
    },
    onError: (e) => toast.error(`${t("settings.removeFailed")}: ${e instanceof Error ? e.message : e}`),
  });

  const sources = feedData?.sources ?? [];
  const allItems = itemsData?.items ?? [];

  const items = useMemo(() => {
    let filtered = filter === "all" ? allItems : allItems.filter((i) => i.sourceKind === filter);
    return [...filtered].sort((a, b) => {
      const aT = new Date(a.publishedAt).getTime();
      const bT = new Date(b.publishedAt).getTime();
      return sortOrder === "newest" ? bT - aT : aT - bT;
    });
  }, [allItems, filter, sortOrder]);

  const availableKinds = useMemo(() => new Set(sources.map((s) => s.kind)), [sources]);
  const kindCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of allItems) m[i.sourceKind] = (m[i.sourceKind] ?? 0) + 1;
    return m;
  }, [allItems]);

  return (
    <div className="space-y-5">
      {/* Hero — compact, modern */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 border border-primary/25 text-primary">
            <Newspaper className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("feedsView.feedsTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("feedsView.feedsSubtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {itemsData?.cached && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {t("feedsView.fetchedAt")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => refreshLive.mutate()}
            disabled={refreshLive.isPending || sources.length === 0}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshLive.isPending && "animate-spin")} />
            <span className="hidden sm:inline">{t("feedsView.refresh")}</span>
          </Button>
        </div>
      </div>

      {/* Filter bar — modern chips */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={t("feedsView.allSources")}
          count={allItems.length}
        />
        {availableKinds.has("rss") && (
          <FilterChip
            active={filter === "rss"}
            onClick={() => setFilter("rss")}
            label={t("feedsView.rss")}
            icon={<Rss className="h-3 w-3" />}
            count={kindCounts["rss"] ?? 0}
          />
        )}
        {availableKinds.has("telegram") && (
          <FilterChip
            active={filter === "telegram"}
            onClick={() => setFilter("telegram")}
            label={t("feedsView.telegram")}
            icon={<Send className="h-3 w-3" />}
            count={kindCounts["telegram"] ?? 0}
          />
        )}
        {availableKinds.has("x") && (
          <FilterChip
            active={filter === "x"}
            onClick={() => setFilter("x")}
            label={t("feedsView.x")}
            icon={<Twitter className="h-3 w-3" />}
            count={kindCounts["x"] ?? 0}
          />
        )}
        <div className="flex-1" />
        <button
          onClick={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortOrder === "newest" ? t("feedsView.sortNewest") : t("feedsView.sortOldest")}
        </button>
        <div className="inline-flex rounded-lg border border-border/40 bg-muted/40 p-0.5 gap-0.5">
          <ViewBtn active={viewMode === "feed"} onClick={() => setViewMode("feed")} icon={<ListIcon className="h-3.5 w-3.5" />} label={t("feedsView.viewList")} />
          <ViewBtn active={viewMode === "grid"} onClick={() => setViewMode("grid")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label={t("feedsView.viewGrid")} />
          <ViewBtn active={viewMode === "compact"} onClick={() => setViewMode("compact")} icon={<Rows3 className="h-3.5 w-3.5" />} label={t("feedsView.viewCompact")} />
        </div>
      </div>

      {/* Sources bar — compact pills */}
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sources.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2.5 py-0.5 text-[11px]">
              <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full border", sourceColor(s.kind))}>
                <SourceIcon kind={s.kind} className="h-2.5 w-2.5" />
              </span>
              <span className="font-medium">{s.name}</span>
            </span>
          ))}
          {onGoToSettings && (
            <button onClick={onGoToSettings} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
              <SettingsIcon className="h-3 w-3" /> {t("feedsView.manageSources")}
            </button>
          )}
        </div>
      )}

      {/* Items */}
      {itemsLoading ? (
        <div className={cn(viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-3")}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
            <Inbox className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">{t("feedsView.noItems")}</p>
          {sources.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refreshLive.mutate()} disabled={refreshLive.isPending}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshLive.isPending && "animate-spin")} />
              {t("feedsView.refresh")}
            </Button>
          )}
        </div>
      ) : (
        <div className={cn(
          viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" :
          viewMode === "compact" ? "space-y-1" :
          "space-y-3 max-w-3xl mx-auto"
        )}>
          {items.map((item) => (
            <FeedCard key={item.externalId} item={item} viewMode={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter Chip ────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  icon,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
        active
          ? "bg-primary/12 text-primary ring-1 ring-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      {icon}
      {label}
      <span className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
        active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
      )}>
        {count}
      </span>
    </button>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-1 transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

// ─── Feed Card ──────────────────────────────────────────────────

function FeedCard({ item, viewMode }: { item: FeedItem; viewMode: "feed" | "grid" | "compact" }) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const images = item.mediaUrls?.filter(Boolean) ?? [];
  const body = item.body ?? "";
  const shouldTruncate = body.length > 280 && !expanded;

  // Compact mode — single line
  if (viewMode === "compact") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/30 px-2.5 py-1.5 hover:bg-muted/30 transition-colors group">
        <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", sourceColor(item.sourceKind))}>
          <SourceIcon kind={item.sourceKind} className="h-2.5 w-2.5" />
        </span>
        <span className="text-xs font-semibold shrink-0">{item.sourceName}</span>
        <p className="text-xs text-muted-foreground truncate flex-1">{item.title}</p>
        {images.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
            <LayoutGrid className="h-2.5 w-2.5" />{images.length}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(item.publishedAt)}</span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  // Feed / Grid mode — rich card
  const isGrid = viewMode === "grid";

  return (
    <article className={cn(
      "rounded-xl border border-border/50 overflow-hidden bg-card hover-lift transition-all",
      isGrid ? "flex flex-col h-full" : "flex flex-col sm:flex-row",
    )}>
      {/* Image */}
      {images.length > 0 && (
        <div className={cn(
          "relative bg-muted overflow-hidden shrink-0",
          isGrid ? "aspect-video" : "sm:w-48 aspect-video sm:aspect-auto",
        )}>
          <img
            src={images[0]}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {images.length > 1 && (
            <span className="absolute top-2 end-2 inline-flex items-center gap-0.5 rounded-md bg-black/60 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium text-white">
              <LayoutGrid className="h-2.5 w-2.5" /> {images.length}
            </span>
          )}
          <span className={cn("absolute top-2 start-2 inline-flex items-center gap-1 rounded-md bg-black/60 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium text-white")}>
            <SourceIcon kind={item.sourceKind} className="h-2.5 w-2.5" />
            {item.sourceName}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        {/* Header (if no image) */}
        {images.length === 0 && (
          <div className="flex items-center gap-1.5">
            <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full border", sourceColor(item.sourceKind))}>
              <SourceIcon kind={item.sourceKind} className="h-2.5 w-2.5" />
            </span>
            <span className="text-xs font-semibold">{item.sourceName}</span>
            {item.authorName && item.authorName !== item.sourceName && (
              <span className="text-[10px] text-muted-foreground">· {item.authorName}</span>
            )}
            <span className="text-[10px] text-muted-foreground ms-auto">{timeAgo(item.publishedAt)}</span>
          </div>
        )}

        {/* Title */}
        <h3 className={cn("font-semibold leading-snug", isGrid ? "text-sm line-clamp-2" : "text-base line-clamp-3")}>
          {item.title}
        </h3>

        {/* Body */}
        {body && (
          <p className={cn("text-sm text-muted-foreground leading-relaxed", shouldTruncate ? "line-clamp-3" : "")}>
            {body}
          </p>
        )}

        {/* Expand toggle */}
        {body.length > 280 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline w-fit"
          >
            {expanded ? (
              <>{t("feedsView.showLess")} <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>{t("feedsView.readMore")} <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}

        {/* Extra images (when expanded) */}
        {expanded && images.length > 1 && (
          <div className="grid grid-cols-3 gap-1 mt-1">
            {images.slice(1).map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-md overflow-hidden bg-muted">
                <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          {images.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{timeAgo(item.publishedAt)}</span>
          )}
          <div className="flex-1" />
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {t("feedsView.viewOriginal")}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
