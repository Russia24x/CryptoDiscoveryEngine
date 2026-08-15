"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Newspaper,
  Rss,
  Send,
  Twitter,
  Plus,
  Trash2,
  Clock,
  Inbox,
  AlertCircle,
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

function FeedIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "telegram") return <Send className={className} />;
  if (kind === "x") return <Twitter className={className} />;
  return <Rss className={className} />;
}

export function FeedsView() {
  const t = useTranslations();
  const qc = useQueryClient();

  const { data: feedData, isLoading } = useQuery<{ sources: FeedSource[] }>({
    queryKey: ["feeds"],
    queryFn: async () => {
      const r = await fetch("/api/feeds");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const sources = feedData?.sources ?? [];

  const addFeed = useMutation({
    mutationFn: async (body: { kind: string; name: string; address: string }) => {
      const r = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      toast.success(t("settings.feedAdded"));
    },
    onError: (e) => toast.error(`${t("settings.addFailed")}: ${e instanceof Error ? e.message : e}`),
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/feeds?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      toast.success(t("settings.removed"));
    },
    onError: (e) => toast.error(`${t("settings.removeFailed")}: ${e instanceof Error ? e.message : e}`),
  });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-5 sm:p-6">
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
      </div>

      {/* Sources */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rss className="h-4 w-4 text-primary" />
              {t("feedsView.sources")}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {sources.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeedForm onAdd={(b) => addFeed.mutate(b)} />

          {isLoading &&
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}

          {!isLoading && sources.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("feedsView.noSources")}</p>
            </div>
          )}

          {!isLoading &&
            sources.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                      f.kind === "telegram"
                        ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400"
                        : f.kind === "x"
                          ? "bg-foreground/10 border-foreground/30 text-foreground"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    <FeedIcon kind={f.kind} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {t(`settings.feed${f.kind.charAt(0).toUpperCase() + f.kind.slice(1)}` as any)}
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

      {/* Recent items — ingestion pending */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            {t("feedsView.items")}
          </CardTitle>
          <CardDescription>{t("feedsView.ingestionPending")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="relative">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="absolute -top-1 -end-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
              </span>
            </div>
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-medium">{t("feedsView.noItems")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("feedsView.subtitle")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeedForm({ onAdd }: { onAdd: (b: { kind: string; name: string; address: string }) => void }) {
  const t = useTranslations();
  const [kind, setKind] = useState("rss");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div className="rounded-lg border border-dashed border-border/70 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.feedKind")}</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rss">{t("settings.feedRss")}</SelectItem>
              <SelectItem value="telegram">{t("settings.feedTelegram")}</SelectItem>
              <SelectItem value="x">{t("settings.feedX")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.feedName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{t("settings.feedAddress")}</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-8"
            placeholder="https://t.me/... or @handle or https://rss.url"
          />
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <Button
          size="sm"
          className="gap-2"
          disabled={!name || !address}
          onClick={() => {
            onAdd({ kind, name, address });
            setName("");
            setAddress("");
          }}
        >
          <Plus className="h-4 w-4" />
          {t("settings.addFeed")}
        </Button>
      </div>
    </div>
  );
}
