"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Compass,
  GitCompare,
  Newspaper,
  Settings,
  TrendingUp,
  CornerDownLeft,
  Star,
} from "lucide-react";
import type { View } from "./app-shell";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: View) => void;
  onSelectAsset?: (symbol: string) => void;
  assets?: Array<{ symbol: string; name: string; category?: string }>;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onSelectAsset,
  assets = [],
}: CommandPaletteProps) {
  const t = useTranslations();
  // Key changes when the dialog opens/closes → remounts the inner component,
  // resetting the query without a setState-in-effect.
  const remountKey = open ? "open" : "closed";

  // Read ?q= URL param for pre-filled search (shared deep links).
  // Only read once per open — uses a ref-like pattern via useMemo with open dep.
  const initialQuery = open ? readUrlQueryParam("q") : "";

  const handleSelectView = useCallback(
    (view: View) => {
      onNavigate(view);
      onOpenChange(false);
    },
    [onNavigate, onOpenChange],
  );

  const handleSelectAsset = useCallback(
    (symbol: string) => {
      onSelectAsset?.(symbol);
      onOpenChange(false);
    },
    [onSelectAsset, onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandPaletteInner
        key={remountKey}
        assets={assets}
        t={t}
        initialQuery={initialQuery}
        onSelectView={handleSelectView}
        onSelectAsset={handleSelectAsset}
      />
    </CommandDialog>
  );
}

/** Safely read a URL query param (SSR-safe). */
function readUrlQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get(name) ?? "";
}

function CommandPaletteInner({
  assets,
  t,
  initialQuery = "",
  onSelectView,
  onSelectAsset,
}: {
  assets: Array<{ symbol: string; name: string; category?: string }>;
  t: ReturnType<typeof useTranslations>;
  initialQuery?: string;
  onSelectView: (view: View) => void;
  onSelectAsset: (symbol: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);

  // Filter assets by query (case-insensitive on symbol + name + category)
  const filteredAssets = query.trim()
    ? assets
        .filter((a) => {
          const q = query.trim().toUpperCase();
          return (
            a.symbol.toUpperCase().includes(q) ||
            a.name.toUpperCase().includes(q) ||
            (a.category ?? "").toUpperCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  return (
    <>
      <CommandInput value={query} onValueChange={setQuery} placeholder={"Search asset or open view…"} />
      <CommandList>
        <CommandEmpty>{t("common.none")}</CommandEmpty>

        {/* Navigation group */}
        <CommandGroup heading={t("common.search")}>
          <CommandItem onSelect={() => onSelectView("discovery")} className="gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <span>{t("nav.discovery")}</span>
          </CommandItem>
          <CommandItem onSelect={() => onSelectView("watchlist")} className="gap-2">
            <Star className="h-4 w-4 text-primary" />
            <span>{t("watchlist.title")}</span>
          </CommandItem>
          <CommandItem onSelect={() => onSelectView("compare")} className="gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <span>{t("compare.title")}</span>
          </CommandItem>
          <CommandItem onSelect={() => onSelectView("feeds")} className="gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <span>{t("feedsView.feedsTitle")}</span>
          </CommandItem>
          <CommandItem onSelect={() => onSelectView("settings")} className="gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <span>{t("nav.settings")}</span>
          </CommandItem>
        </CommandGroup>

        {filteredAssets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("discovery.colSymbol")}>
              {filteredAssets.map((a) => (
                <CommandItem
                  key={a.symbol}
                  onSelect={() => onSelectAsset(a.symbol)}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{a.symbol}</span>
                  <span className="text-muted-foreground text-xs truncate">{a.name}</span>
                  {a.category && (
                    <span className="ms-auto text-[10px] text-muted-foreground/70">
                      {a.category}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup>
          <CommandItem disabled className="gap-2 text-muted-foreground text-xs">
            <CornerDownLeft className="h-3 w-3" />
            <span>{t("discovery.kbdHint")}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}
