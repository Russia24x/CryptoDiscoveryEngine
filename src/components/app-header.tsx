"use client";

import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { Button } from "@/components/ui/button";
import { Compass, Settings as SettingsIcon, Sparkles, GitCompare } from "lucide-react";
import { cn } from "@/lib/format";
import type { View } from "./app-shell";

export function AppHeader({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Brand */}
          <button
            onClick={() => setView("discovery")}
            className="flex items-center gap-2.5 group"
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary glow-primary">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-base font-bold tracking-tight">
                {t("app.name")}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("app.tagline")}
              </span>
            </span>
          </button>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Button
              variant={view === "discovery" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("discovery")}
              className={cn("gap-2", view === "discovery" && "shadow-sm")}
            >
              <Compass className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.discovery")}</span>
            </Button>
            <Button
              variant={view === "compare" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("compare")}
              className={cn("gap-2", view === "compare" && "shadow-sm")}
            >
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">{t("compare.title")}</span>
            </Button>
            <Button
              variant={view === "settings" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("settings")}
              className={cn("gap-2", view === "settings" && "shadow-sm")}
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.settings")}</span>
            </Button>
            <div className="mx-1 h-6 w-px bg-border/60" />
            <LanguageToggle />
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
