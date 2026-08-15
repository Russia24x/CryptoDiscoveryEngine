"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Newspaper,
  Rss,
  Send,
  Twitter,
  Trash2,
  RefreshCw,
  Inbox,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";

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
  id: string;
  externalId: string;
  title: string;
  body: string | null;
  url: string | null;
  publishedAt: string;
  source: { id: string; name: string; kind: string };
}

function FeedIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "telegram") return <Send className={className} />;
  if (kind === "x") return <Twitter className={className} />;
  return <Rss className={className} />;
}

function feedIconColor(kind: string): string {
  if (kind === "telegram")
    return "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400";
  if (kind === "x")
    return "bg-foreground/10 border-foreground/30 text-foreground";
  return "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function FeedsView({ onGoToSettings }: { onGoToSettings?: () => void }) {
  const t = useTranslations();
  const qc = useQueryClient();

  const { data: feedData, isLoading: sourcesLoading } = useQuery<{ sources: FeedSource[] }>({
    queryKey: ["feeds"],
    queryFn: async () => {
      const r = await fetch("/api/feeds");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery<{ items: FeedItem[] }>({
    queryKey: ["feed-items"],
    queryFn: async () => {
      const r = await fetch("/api/feeds/items?limit=50");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/feeds?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      toast.success(t("settings.removed"));
    },
    onError: (e) => toast.error(`${t("settings.removeFailed")}: ${e instanceof Error ? e.message : e}`),
  });

  const ingest = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/feeds/ingest", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["feed-items"] });
      const total = data.totalIngested ?? 0;
      if (total > 0) {
        toast.success(t("feedsView.ingestedCount", { count: total }));
      } else {
        toast.info(t("feedsView.ingestedNone"));
      }
    },
    onError: (e) => toast.error(`${t("feedsView.ingestFailed")}: ${e instanceof Error ? e.message : e}`),
  });

  const sources = feedData?.sources ?? [];
  const items = itemsData?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
                <Newspaper className="h-3.5 w-3.5" />
                {t("app.subtitle")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t("feedsView.title")}
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl mt-1">
                {t("feedsView.subtitle")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => ingest.mutate()}
              disabled={ingest.isPending || sources.length === 0}
            >
              <RefreshCw className={cn("h-4 w-4", ingest.isPending && "animate-spin")} />
              <span className="hidden sm:inline">{t("feedsView.refresh")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Sources */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rss className="h-4 w-4 text-primary" />
              {t("feedsView.sources")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {sources.length}
              </Badge>
              {onGoToSettings && (
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onGoToSettings}>
                  <SettingsIcon className="h-3.5 w-3.5" />
                  {t("nav.settings")}
                </Button>
              )}
            </div>
          </div>
          <CardDescription>{t("feedsView.sourcesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sourcesLoading &&
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}

          {!sourcesLoading && sources.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("feedsView.noSources")}</p>
            </div>
          )}

          {!sourcesLoading &&
            sources.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", feedIconColor(f.kind))}>
                    <FeedIcon kind={f.kind} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {f.kind}
                      </Badge>
                      {!f.enabled && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("feedsView.disabled")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                      {f.address}
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteFeed.mutate(f.id)}
                  aria-label={`${t("common.remove")} ${f.name}`}
                  className="h-8 w-8 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Recent Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            {t("feedsView.items")}
          </CardTitle>
          <CardDescription>
            {items.length > 0
              ? t("feedsView.itemsCount", { count: items.length })
              : t("feedsView.ingestionPending")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <Inbox className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-medium">{t("feedsView.noItems")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("feedsView.refreshHint")}
                </p>
                {sources.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 mt-2"
                    onClick={() => ingest.mutate()}
                    disabled={ingest.isPending}
                  >
                    <RefreshCw className={cn("h-4 w-4", ingest.isPending && "animate-spin")} />
                    {t("feedsView.refresh")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto scroll-thin pe-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/60 bg-card/60 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border mt-0.5", feedIconColor(item.source.kind))}>
                      <FeedIcon kind={item.source.kind} className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{item.source.name}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(item.publishedAt)}</span>
                      </div>
                      <p className="text-sm leading-snug line-clamp-3">{item.title}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("feedsView.openOriginal")}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
