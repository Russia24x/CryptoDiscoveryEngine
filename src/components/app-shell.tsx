"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppHeader } from "./app-header";
import { AppFooter } from "./app-footer";
import { DiscoveryView } from "./discovery-view";
import { DetailView } from "./detail-view";
import { ComparisonView } from "./comparison-view";
import { FeedsView } from "./feeds-view";
import { SettingsView } from "./settings-view";
import type { RankedRow } from "@/engine/ranking";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Settings as SettingsIcon, FileText } from "lucide-react";

export type View = "discovery" | "compare" | "feeds" | "settings";

export function AppShell() {
  const t = useTranslations();
  const [view, setView] = useState<View>("discovery");
  const [selected, setSelected] = useState<RankedRow | null>(null);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <AppHeader view={view} setView={setView} />
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
      {/* keep icons referenced for i18n-aware tree-shaking clarity */}
      <span className="hidden">
        <Compass /> <SettingsIcon /> <FileText /> {t("nav.discovery")}
      </span>
    </div>
  );
}
