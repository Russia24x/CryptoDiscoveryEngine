"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { useTranslations } from "next-intl";

interface CircuitStatus {
  name: string;
  tripped: boolean;
  cooldownMs: number;
}

interface StatusResp {
  circuits: CircuitStatus[];
  anyTripped: boolean;
  timestamp: string;
}

export function ProviderStatusBadge() {
  const t = useTranslations();
  const { data } = useQuery<StatusResp>({
    queryKey: ["provider-status"],
    queryFn: async () => {
      const r = await fetch("/api/status");
      if (!r.ok) return { circuits: [], anyTripped: false, timestamp: "" };
      return r.json();
    },
    staleTime: 30_000, // 30s — check every 30s
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  if (!data?.anyTripped) {
    // Don't render anything when all providers are healthy — clean UI
    return null;
  }

  const trippedProviders = data.circuits
    .filter((c) => c.tripped)
    .map((c) => c.name);

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
      title={t("status.rateLimitedHint", { providers: trippedProviders.join(", ") })}
    >
      <AlertCircle className="h-3 w-3 animate-pulse" />
      <span className="hidden sm:inline">{t("status.rateLimited")}</span>
      <span className="sm:hidden">⚠</span>
    </div>
  );
}
