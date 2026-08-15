"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-auto border-t border-border/60 glass">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>{t("footer.rights")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono">{t("footer.evidenceOverNarrative")}</span>
            <span className="h-3 w-px bg-border/60" />
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {t("footer.architectureLocked")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
