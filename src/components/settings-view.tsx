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
import { Plus, KeyRound, Server, Rss, Send, Twitter, Trash2 } from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";

interface ProviderRow {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  authMode: string;
  keyHeader: string | null;
  keyQuery: string | null;
  apiKey: string | null;
  freeTier: boolean;
  tier: string;
  priority: number;
  categories: string;
  enabled: boolean;
  notes: string | null;
}

interface FeedRow {
  id: string;
  kind: string;
  name: string;
  address: string;
  enabled: boolean;
}

export function SettingsView() {
  const t = useTranslations();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: provData, isLoading: provLoading } = useQuery<{ providers: ProviderRow[] }>({
    queryKey: ["providers"],
    queryFn: async () => {
      const r = await fetch("/api/providers");
      return r.json();
    },
  });
  const { data: feedData } = useQuery<{ sources: FeedRow[] }>({
    queryKey: ["feeds"],
    queryFn: async () => {
      const r = await fetch("/api/feeds");
      return r.json();
    },
  });

  const toggleProv = useMutation({
    mutationFn: async (p: ProviderRow) => {
      const r = await fetch("/api/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: p.slug, enabled: !p.enabled }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Provider updated");
    },
    onError: (e) => toast.error(`Failed: ${e instanceof Error ? e.message : e}`),
  });

  const saveKey = useMutation({
    mutationFn: async ({ slug, key }: { slug: string; key: string }) => {
      const r = await fetch("/api/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, apiKey: key }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("API key saved");
    },
    onError: (e) => toast.error(`Failed: ${e instanceof Error ? e.message : e}`),
  });

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
      toast.success("Feed source added");
    },
    onError: (e) => toast.error(`Failed: ${e instanceof Error ? e.message : e}`),
  });

  const deleteFeed = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/feeds?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      toast.success("Removed");
    },
    onError: (e) => toast.error(`Failed: ${e instanceof Error ? e.message : e}`),
  });

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 grid-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-5 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            {t("settings.subtitle")}
          </p>
        </div>
      </div>

      {/* Providers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                {t("settings.title")}
              </CardTitle>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setShowAdd((s) => !s)}>
              <Plus className="h-4 w-4" />
              {t("settings.addProvider")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAdd && <AddProviderForm onDone={() => setShowAdd(false)} />}
          {provLoading &&
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          {!provLoading &&
            provData?.providers.map((p) => (
              <ProviderCard
                key={p.slug}
                p={p}
                onToggle={() => toggleProv.mutate(p)}
                onSaveKey={(key) => saveKey.mutate({ slug: p.slug, key })}
              />
            ))}
          {!provLoading && provData?.providers.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {t("settings.noProviders")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feeds (reserved) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rss className="h-4 w-4 text-primary" />
            {t("settings.feeds")}
          </CardTitle>
          <CardDescription>{t("settings.feedsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeedForm onAdd={(b) => addFeed.mutate(b)} />
          {feedData?.sources.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3"
            >
              <div className="flex items-center gap-3">
                <FeedIcon kind={f.kind} />
                <div>
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{f.address}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {f.kind}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteFeed.mutate(f.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(!feedData?.sources || feedData.sources.length === 0) && (
            <div className="text-xs text-muted-foreground italic">
              {t("common.reserved")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderCard({
  p,
  onToggle,
  onSaveKey,
}: {
  p: ProviderRow;
  onToggle: () => void;
  onSaveKey: (key: string) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");

  const needsKey = p.authMode !== "none";
  const cats = p.categories ? p.categories.split(",").filter(Boolean) : [];

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              p.tier === "free"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
            )}
          >
            {needsKey ? <KeyRound className="h-4 w-4" /> : <Server className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{p.name}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {p.tier === "free" ? t("settings.tierFree") : t("settings.tierPaid")}
              </Badge>
              {needsKey && (
                <Badge variant="secondary" className="text-[10px]">
                  {p.authMode}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
              {p.baseUrl}
            </div>
            {cats.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {cats.map((c) => (
                  <span
                    key={c}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
            {p.notes && (
              <div className="text-[11px] text-muted-foreground italic mt-1">{p.notes}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {needsKey && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => setEditing((s) => !s)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {p.apiKey ? "••••" : t("settings.apiKey")}
            </Button>
          )}
          <Switch checked={p.enabled} onCheckedChange={onToggle} />
        </div>
      </div>
      {editing && needsKey && (
        <div className="mt-3 flex gap-2">
          <Input
            type="password"
            placeholder={t("settings.apiKey")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-8"
          />
          <Button
            size="sm"
            disabled={!key.trim()}
            onClick={() => {
              onSaveKey(key.trim());
              setKey("");
              setEditing(false);
            }}
            className="h-8"
          >
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}

function AddProviderForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    authMode: "none",
    tier: "free",
    categories: "",
    priority: "100",
  });

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug: form.name.toLowerCase().replace(/\s+/g, "-") }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Provider added");
      onDone();
    },
  });

  return (
    <div className="rounded-lg border border-dashed border-border/70 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.providerName")}</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.baseUrl")}</Label>
          <Input
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            className="h-8"
            placeholder="https://api.example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.authMode")}</Label>
          <Select value={form.authMode} onValueChange={(v) => setForm({ ...form, authMode: v })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("settings.authNone")}</SelectItem>
              <SelectItem value="header">{t("settings.authHeader")}</SelectItem>
              <SelectItem value="query">{t("settings.authQuery")}</SelectItem>
              <SelectItem value="bearer">{t("settings.authBearer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.tier")}</Label>
          <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">{t("settings.tierFree")}</SelectItem>
              <SelectItem value="paid">{t("settings.tierPaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.categories")}</Label>
          <Input
            value={form.categories}
            onChange={(e) => setForm({ ...form, categories: e.target.value })}
            placeholder="tvl,fees,revenue"
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settings.priority")}</Label>
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="h-8"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={() => submit.mutate()} disabled={!form.name || submit.isPending}>
          {t("common.save")}
        </Button>
      </div>
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

function FeedIcon({ kind }: { kind: string }) {
  if (kind === "telegram") return <Send className="h-4 w-4 text-sky-500" />;
  if (kind === "x") return <Twitter className="h-4 w-4 text-foreground" />;
  return <Rss className="h-4 w-4 text-amber-500" />;
}
