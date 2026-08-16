"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-auto border-t border-border/40">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-primary" />
            <span>{t("footer.rights")}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px]">{t("footer.evidenceOverNarrative")}</span>
            <span className="h-2.5 w-px bg-border/40" />
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse" />
              {t("footer.architectureLocked")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
