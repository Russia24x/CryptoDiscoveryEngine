import type { Decision } from "@/engine";

// Re-export cn from utils.ts (single source of truth) so app components that
// import from @/lib/format get both cn and the format helpers in one import.
// shadcn ui components import cn directly from @/lib/utils.
export { cn } from "@/lib/utils";

export function fmtUsd(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtPct(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtScore(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(1);
}

const DECISION_STYLES: Record<Decision, string> = {
  BUY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  WATCH: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  INVESTIGATE: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  AVOID: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  REJECT: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
};

export function decisionClass(d: Decision) {
  return DECISION_STYLES[d];
}

export function scoreColor01(v: number): string {
  // v in 0..1
  if (v >= 0.7) return "text-emerald-500";
  if (v >= 0.5) return "text-amber-500";
  if (v >= 0.3) return "text-orange-500";
  return "text-red-500";
}

export function barColor01(v: number): string {
  if (v >= 0.7) return "bg-emerald-500";
  if (v >= 0.5) return "bg-amber-500";
  if (v >= 0.3) return "bg-orange-500";
  return "bg-red-500";
}
