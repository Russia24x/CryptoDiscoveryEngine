"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "./app-header";
import { AppFooter } from "./app-footer";
import { DiscoveryView } from "./discovery-view";
import { DetailView } from "./detail-view";
import { ComparisonView } from "./comparison-view";
import { FeedsView } from "./feeds-view";
import { SettingsView } from "./settings-view";
import { CommandPalette } from "./command-palette";
import type { RankedRow } from "@/engine/ranking";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Settings as SettingsIcon, FileText } from "lucide-react";

export type View = "discovery" | "compare" | "feeds" | "settings";

interface CachedAsset {
  symbol: string;
  name: string;
  category: string;
  marketCap: number;
}

export function AppShell() {
  const t = useTranslations();
  const [view, setView] = useState<View>("discovery");
  const [selected, setSelected] = useState<RankedRow | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Fetch the cached assets list for the command palette.
  const { data: assetsData } = useQuery<{ count: number; assets: CachedAsset[] }>({
    queryKey: ["assets"],
    queryFn: async () => {
      const r = await fetch("/api/assets");
      if (!r.ok) return { count: 0, assets: [] };
      return r.json();
    },
    staleTime: 30_000,
  });
  const paletteAssets = (assetsData?.assets ?? []).slice(0, 50);

  // Global Cmd+K / Ctrl+K keyboard shortcut to open the command palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // When an asset is selected from the command palette, we need to find its
  // RankedRow in the scan cache. The simplest path: navigate to discovery
  // and let the detail view fetch it via /api/projects/[symbol].
  // But DetailView requires a RankedRow prop — we construct a minimal stub
  // and let the detail view's own useQuery fill in the real data.
  const handlePaletteAsset = useCallback((symbol: string) => {
    // Find the asset in the cached scan data to build a RankedRow stub.
    // If not found, we create a minimal stub that DetailView can enrich.
    const stub: RankedRow = {
      symbol,
      name: symbol,
      result: {
        iaRaw: 0,
        iaEffective: 0,
        iaFinal: 0,
        confidence: 0,
        regime: 0,
        decision: "WATCH",
        components: { pq: 0, tq: 0, va: 0, v: 0, r: 0, alpha: 0, delta: 0, vae: 0, sar: 0, nsp: 0, fdr: 0 },
        gate: { passed: false, reasons: [] },
        explanation: { forPoints: [], againstPoints: [], whatChanges: [], statusLine: "" },
      },
      rankFund: 0,
      rankConf: 0,
      rankEff: 0,
      rankMkt: 0,
    };
    setSelected(stub);
    setView("discovery");
  }, []);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <AppHeader view={view} setView={setView} onOpenCommand={() => setCmdOpen(true)} />
      <main className="flex-1 w-full">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <AnimatePresence mode="wait">
            {view === "discovery" && (
              <motion.div
                key="discovery"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {selected ? (
                  <DetailView
                    row={selected}
                    onBack={() => setSelected(null)}
                    onAddToCompare={() => {
                      // Switch to compare view so the user can see the added asset.
                      setView("compare");
                    }}
                  />
                ) : (
                  <DiscoveryView onSelect={setSelected} />
                )}
              </motion.div>
            )}
            {view === "compare" && (
              <motion.div
                key="compare"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <ComparisonView onGoToDiscovery={() => setView("discovery")} />
              </motion.div>
            )}
            {view === "feeds" && (
              <motion.div
                key="feeds"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <FeedsView onGoToSettings={() => setView("settings")} />
              </motion.div>
            )}
            {view === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <SettingsView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <AppFooter />
      {/* Command palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onNavigate={setView}
        onSelectAsset={handlePaletteAsset}
        assets={paletteAssets}
      />
      {/* keep icons referenced for i18n-aware tree-shaking clarity */}
      <span className="hidden">
        <Compass /> <SettingsIcon /> <FileText /> {t("nav.discovery")}
      </span>
    </div>
  );
}
