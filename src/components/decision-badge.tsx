"use client";

import { useTranslations } from "next-intl";
import { cn, decisionClass } from "@/lib/format";
import type { Decision } from "@/engine";

export function DecisionBadge({ decision, size = "md" }: { decision: Decision; size?: "sm" | "md" }) {
  const t = useTranslations();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold",
        decisionClass(decision),
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {t(`decision.${decision}`)}
    </span>
  );
}
