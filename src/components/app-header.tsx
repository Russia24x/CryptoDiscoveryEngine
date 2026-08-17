"use client";

import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { Button } from "@/components/ui/button";
import { Compass, Settings as SettingsIcon, Sparkles, GitCompare, Newspaper, Command, Star } from "lucide-react";
import { cn } from "@/lib/format";
import type { View } from "./app-shell";
import { ProviderStatusBadge } from "./provider-status-badge";

const NAV_ITEMS: { key: View; icon: typeof Compass; labelKey: string }[] = [
  { key: "discovery", icon: Compass, labelKey: "nav.discovery" },
  { key: "watchlist", icon: Star, labelKey: "watchlist.title" },
  { key: "compare", icon: GitCompare, labelKey: "compare.title" },
  { key: "feeds", icon: Newspaper, labelKey: "feedsView.feedsTitle" },
  { key: "settings", icon: SettingsIcon, labelKey: "nav.settings" },
];

export function AppHeader({
  view,
  setView,
  onOpenCommand,
}: {
  view: View;
  setView: (v: View) => void;
  onOpenCommand?: () => void;
}) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2">
          {/* Brand — compact, modern */}
          <button
            onClick={() => setView("discovery")}
            className="flex items-center gap-2 group shrink-0"
          >
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 border border-primary/25 text-primary transition-transform group-hover:scale-105">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-sm font-bold tracking-tight">
                {t("app.name")}
              </span>
              <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {t("app.tagline")}
              </span>
            </span>
          </button>

          {/* Nav — icon-first on mobile, icon+label on desktop */}
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  view === key
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
                title={t(labelKey as never)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">{t(labelKey as never)}</span>
              </button>
            ))}
            <div className="mx-1 h-5 w-px bg-border/40" />
            <ProviderStatusBadge />
            {/* Command palette trigger — shows the Cmd+K shortcut */}
            <button
              onClick={() => onOpenCommand?.()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              title={t("discovery.cmdkHint")}
            >
              <Command className="h-3.5 w-3.5" />
              <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1 py-0.5 text-[9px] font-mono">
                ⌘K
              </kbd>
            </button>
            <LanguageToggle />
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
