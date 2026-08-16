/**
 * CryptoSieve — Thesis Engine (V1.4 — first cut)
 *
 * Derives a living investment thesis from engine inputs + result.
 * Pure TypeScript. Zero Next.js / DOM coupling.
 *
 * A thesis has 5 parts (per PRD §7):
 *   1. Title       — the one-line investment narrative
 *   2. WhyItWorks  — what currently supports the thesis
 *   3. MustStayTrue — conditions that must hold for the thesis to survive
 *   4. WhatBreaksIt — conditions that would invalidate the thesis
 *   5. StatusPct   — % intact (how much of "must stay true" currently holds)
 *
 * @see docs/PRD.md §7 (Thesis Engine — the killer feature)
 */
import type { EngineInputs, EngineResult } from "./index";

export interface ThesisCondition {
  label: string;
  met: boolean;       // currently holds (true) or broken (false)
  value?: string;     // human-readable current value
  threshold?: string; // the threshold being tested
}

export interface ThesisEvidence {
  direction: "up" | "down" | "neutral"; // positive / negative / neutral
  label: string;
}

export interface Thesis {
  symbol: string;
  name: string;
  title: string;                    // one-line narrative
  whyWorks: string[];               // supporting factors
  mustStayTrue: ThesisCondition[];  // conditions + whether currently met
  whatBreaksIt: string[];           // invalidation triggers
  latestEvidence: ThesisEvidence[]; // recent evidence directions
  statusPct: number;                // 0..100 — % of mustStayTrue currently met
  statusLabel: "intact" | "weakening" | "broken";
}

/** Derive a one-line thesis title from the asset's category + accrual kind. */
function deriveTitle(i: EngineInputs): string {
  const cat = i.category ?? "Protocol";
  const kind =
    i.accrualKind === "buyback_burn" ? "buyback-and-burn"
    : i.accrualKind === "staking" ? "staking-yield"
    : i.accrualKind === "revenue_share" ? "revenue-sharing"
    : "fee-accrual";
  return `${cat} ${kind} thesis`;
}

/** Build the "Why it works" list from strong component scores. */
function deriveWhyWorks(r: EngineResult): string[] {
  const c = r.components;
  const out: string[] = [];
  if (c.vae >= 40) out.push(`Value accrual — VAE ${c.vae.toFixed(0)}%`);
  if (c.pq >= 0.65) out.push(`Project quality — ${(c.pq * 100).toFixed(0)}/100`);
  if (c.delta >= 0.4) out.push(`Tokenholder capture — δ ${(c.delta * 100).toFixed(0)}%`);
  if (c.sar >= 0.4) out.push(`Supply absorption — SAR ${c.sar.toFixed(2)}`);
  if (c.fdr <= 0.15) out.push(`Low dilution — FDR ${(c.fdr * 100).toFixed(0)}%`);
  if (c.va >= 0.55) out.push(`Value accrual architecture — ${(c.va * 100).toFixed(0)}/100`);
  return out.slice(0, 5); // keep concise
}

/** Build "Must stay true" conditions with current met/broken status. */
function deriveMustStayTrue(i: EngineInputs, r: EngineResult): ThesisCondition[] {
  const c = r.components;
  const conds: ThesisCondition[] = [];

  // Revenue must stay above a viability floor ($1M annualised). Below this,
  // the revenue is too thin to support the investment thesis.
  // (Was `i.pr > 0` — a tautology that always passed, inflating statusPct.)
  const REVENUE_FLOOR = 1_000_000; // $1M annualised
  conds.push({
    label: "Revenue > $1M (viability floor)",
    met: i.pr >= REVENUE_FLOOR,
    value: `$${(i.pr / 1e6).toFixed(1)}M`,
    threshold: `> $${(REVENUE_FLOOR / 1e6).toFixed(1)}M`,
  });

  // Distribution rate must stay meaningful (δ > 20%)
  conds.push({
    label: "Tokenholder distribution rate > 20%",
    met: c.delta >= 0.2,
    value: `${(c.delta * 100).toFixed(0)}%`,
    threshold: "> 20%",
  });

  // VAE must stay above the universal gate floor (10%)
  conds.push({
    label: "Value accrual efficiency > 10% (gate floor)",
    met: c.vae >= 10,
    value: `${c.vae.toFixed(0)}%`,
    threshold: "> 10%",
  });

  // Future dilution must stay manageable (FDR < 25%)
  conds.push({
    label: "Future dilution risk < 25%",
    met: c.fdr < 0.25,
    value: `${(c.fdr * 100).toFixed(0)}%`,
    threshold: "< 25%",
  });

  // Risk score must stay below the universal gate ceiling (R < 90)
  conds.push({
    label: "Risk score < 90 (gate ceiling)",
    met: c.r * 100 < 90,
    value: `${(c.r * 100).toFixed(0)}/100`,
    threshold: "< 90",
  });

  // For buyback/burn thesis: SAR must stay above 0.10
  if (i.accrualKind === "buyback_burn") {
    conds.push({
      label: "Supply absorption > 0.10 (buyback thesis)",
      met: c.sar >= 0.1,
      value: c.sar.toFixed(2),
      threshold: "> 0.10",
    });
  }

  return conds;
}

/** Build "What breaks it" — invalidation triggers. */
function deriveWhatBreaks(i: EngineInputs): string[] {
  const out: string[] = [
    "Revenue drawdown > 50% / 90d",
    "TVL drawdown > 25% / 90d",
    "Unlock acceleration beyond current schedule",
  ];
  if (i.accrualKind === "buyback_burn") {
    out.push("SAR drops below 0.10 (buyback absorption fails)");
  }
  if (i.accrualKind === "staking" || i.accrualKind === "revenue_share") {
    out.push("Yield cut or staking/revenue-share pause");
  }
  out.push("Governance failure or insider concentration spike");
  return out;
}

/** Build latest-evidence directions from component scores. */
function deriveEvidence(r: EngineResult): ThesisEvidence[] {
  const c = r.components;
  return [
    { direction: c.vae >= 30 ? "up" : c.vae >= 15 ? "neutral" : "down", label: "Value accrual" },
    { direction: c.delta >= 0.4 ? "up" : c.delta >= 0.2 ? "neutral" : "down", label: "Distribution" },
    { direction: c.sar >= 0.4 ? "up" : c.sar >= 0.15 ? "neutral" : "down", label: "Supply absorption" },
    { direction: c.fdr <= 0.15 ? "up" : c.fdr <= 0.25 ? "neutral" : "down", label: "Dilution safety" },
    { direction: c.r < 0.4 ? "up" : c.r < 0.6 ? "neutral" : "down", label: "Risk profile" },
  ];
}

/** Derive the thesis from engine inputs + result. */
export function deriveThesis(i: EngineInputs, r: EngineResult): Thesis {
  const mustStayTrue = deriveMustStayTrue(i, r);
  const metCount = mustStayTrue.filter((c) => c.met).length;
  const statusPct = Math.round((metCount / mustStayTrue.length) * 100);
  const statusLabel: Thesis["statusLabel"] =
    statusPct >= 80 ? "intact" : statusPct >= 50 ? "weakening" : "broken";

  return {
    symbol: i.symbol,
    name: i.name,
    title: deriveTitle(i),
    whyWorks: deriveWhyWorks(r),
    mustStayTrue,
    whatBreaksIt: deriveWhatBreaks(i),
    latestEvidence: deriveEvidence(r),
    statusPct,
    statusLabel,
  };
}
