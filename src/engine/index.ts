/**
 * CryptoSieve — Core Decision Engine (LOCKED architecture v2)
 *
 * Pure TypeScript. Zero Next.js / DOM coupling.
 * Reusable across Web / Mobile / Desktop / CLI.
 *
 * Pipeline: Gate → PQ → TQ → VA → V → R → IA_raw → C → IA_effective → M → IA_final
 *
 * @see docs/ARCHITECTURE.md (canonical, LOCKED reference)
 */

// ─── Types ────────────────────────────────────────────────────────

/** Raw normalized inputs fed into the engine for one asset. */
export interface EngineInputs {
  // identity
  symbol: string;
  name: string;
  category?: string;
  accrualKind: "fee" | "buyback_burn" | "staking" | "revenue_share";

  // Value-accrual chain (usd unless noted)
  gea?: number; // Gross Economic Activity
  pr: number; // Protocol Revenue (annualised usd)
  pc: number; // Protocol Capture (annualised usd)
  tc: number; // Tokenholder Capture (annualised usd)

  // Valuation
  marketCap: number; // MC
  fdv: number; // FDV
  float: number; // circulating supply value (usd) — current float
  tokenYield?: number; // TY 0..1
  inflationGrade?: number; // IG 0..1 (1 = low inflation)
  // percentile inputs 0..1 (higher = cheaper)
  mcOverTcPercentile?: number; // for (1 - MC/TC_n)
  mcOverPrPercentile?: number; // for (1 - MC/PR_n)
  fdvOverTcPercentile?: number; // for (1 - FDV/TC_n)

  // Supply metrics (usd)
  buyback: number; // annualised
  burn: number; // annualised
  unlock12m: number; // next 12m unlock usd
  emission12m: number; // next 12m emission usd
  tokenUtility?: number; // TU 0..1
  governanceQuality?: number; // GQ 0..1

  // PQ sub-components 0..1
  revenueGrowth?: number; // RG
  revenueStability?: number; // RS
  revenueDiversification?: number; // RD
  marketPosition?: number; // MP
  userGrowth?: number; // UG

  // VA extras
  realYield?: number; // τ 0..1
  buybackActivity?: number; // BA 0..1

  // Risk sub-components 0..1 (higher = more risk)
  revenueConcentration?: number; // RC
  insiderConcentration?: number; // IC
  regulatoryRisk?: number; // REG
  smartContractRisk?: number; // SC
  marketLiquidityRisk?: number; // ML
  dependencyRisk?: number; // DR

  // Confidence & regime
  dataCompleteness?: number; // 0..1
  sourceQuality?: number; // 0..1
  modelStability?: number; // 0..1
  marketRegime?: number; // M multiplier, clamped 0.90..1.10
}

export interface GateInputs {
  vae: number;
  delta: number; // δ distribution rate (percent)
  risk: number; // R
  sar?: number;
  accrualKind: EngineInputs["accrualKind"];
}

export interface GateResult {
  passed: boolean;
  reasons: string[];
}

export interface ComponentScores {
  pq: number;
  tq: number;
  va: number;
  v: number;
  r: number;
  vae: number;
  alpha: number;
  delta: number;
  sar: number;
  nsp: number;
  fdr: number;
}

export interface EngineResult {
  symbol: string;
  name: string;
  gate: GateResult;
  components: ComponentScores;
  iaRaw: number;
  confidence: number;
  iaEffective: number;
  regime: number;
  iaFinal: number;
  decision: Decision;
  explanation: DecisionExplanation;
}

export type Decision = "BUY" | "WATCH" | "INVESTIGATE" | "AVOID" | "REJECT";

export interface DecisionExplanation {
  decision: Decision;
  forPoints: { key: string; value?: string }[];
  againstPoints: { key: string; value?: string }[];
  whatChanges: { key: string }[];
  statusLine: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

const norm01 = (x: number | undefined, fallback = 0.5) =>
  x === undefined || Number.isNaN(x) ? fallback : clamp(x, 0, 1);

const num = (x: number | undefined, fallback = 0) =>
  x === undefined || Number.isNaN(x) ? fallback : x;

// ─── Value Accrual Chain ──────────────────────────────────────────

export function valueAccrualChain(pr: number, pc: number, tc: number) {
  const alpha = pc / Math.max(pr, 1); // Protocol Capture Rate
  const delta = tc / Math.max(pc, 1); // Distribution Rate
  const vae = tc / Math.max(pr, 1); // = alpha * delta
  return { alpha, delta, vae };
}

// ─── Supply Metrics (Triple) ─────────────────────────────────────

export function supplyMetrics(
  buyback: number,
  burn: number,
  unlock12m: number,
  emission12m: number,
  float: number,
) {
  const sar = (buyback + burn) / Math.max(unlock12m + emission12m, 1);
  const nsp = unlock12m + emission12m - burn - buyback; // net pressure (usd)
  const fdr = (unlock12m + emission12m) / Math.max(float, 1); // future dilution
  return { sar, nsp, fdr };
}

// ─── Gate (mechanism-aware hard vetoes) ───────────────────────────

export function evaluateGate(g: GateInputs): GateResult {
  const reasons: string[] = [];
  // Universal gates
  if (g.vae < 10) reasons.push("VAE < 10 (universal floor)");
  if (g.delta < 5) reasons.push("δ < 5% (universal floor)");
  if (g.risk > 90) reasons.push("R > 90 (universal ceiling)");
  // Conditional gate — only if buyback/burn is part of the accrual thesis
  if (g.accrualKind === "buyback_burn" && g.sar !== undefined && g.sar < 0.1) {
    reasons.push("SAR < 0.10 (conditional: buyback/burn thesis)");
  }
  return { passed: reasons.length === 0, reasons };
}

// ─── Component scoring ────────────────────────────────────────────

export function scorePQ(i: EngineInputs): number {
  const rg = norm01(i.revenueGrowth);
  const rs = norm01(i.revenueStability);
  const rd = norm01(i.revenueDiversification);
  const mp = norm01(i.marketPosition);
  const ug = norm01(i.userGrowth);
  return 0.3 * rg + 0.25 * rs + 0.2 * rd + 0.15 * mp + 0.1 * ug; // 0..1
}

export function scoreVA(i: EngineInputs, chain: { alpha: number; delta: number }): number {
  const alpha = clamp(chain.alpha, 0, 1);
  const delta = clamp(chain.delta, 0, 1);
  const tau = norm01(i.realYield);
  const ba = norm01(i.buybackActivity);
  return 0.3 * alpha + 0.3 * delta + 0.25 * tau + 0.15 * ba; // 0..1
}

export function scoreV(i: EngineInputs): number {
  const mcTc = norm01(i.mcOverTcPercentile); // higher = cheaper
  const mcPr = norm01(i.mcOverPrPercentile);
  const ty = norm01(i.tokenYield);
  const fdvTc = norm01(i.fdvOverTcPercentile);
  const ig = norm01(i.inflationGrade);
  return 0.25 * mcTc + 0.25 * mcPr + 0.2 * ty + 0.15 * fdvTc + 0.15 * ig; // 0..1
}

export function scoreR(i: EngineInputs): number {
  const rc = norm01(i.revenueConcentration);
  const ic = norm01(i.insiderConcentration);
  const reg = norm01(i.regulatoryRisk);
  const sc = norm01(i.smartContractRisk);
  const ml = norm01(i.marketLiquidityRisk);
  const dr = norm01(i.dependencyRisk);
  return 0.25 * rc + 0.2 * ic + 0.2 * reg + 0.15 * sc + 0.1 * ml + 0.1 * dr; // 0..1
}

export function scoreTQ(
  i: EngineInputs,
  vae: number,
  sar: number,
  fdr: number,
): number {
  const vaeN = clamp(vae / 100, 0, 1); // normalise VAE onto 0..1 (100%+ = 1)
  const sarN = clamp(sar, 0, 1);
  const fdrInv = 1 - clamp(fdr, 0, 1);
  const tu = norm01(i.tokenUtility);
  const gq = norm01(i.governanceQuality);
  return 0.3 * vaeN + 0.2 * sarN + 0.2 * fdrInv + 0.2 * tu + 0.1 * gq; // 0..1
}

// ─── Confidence Factor C ──────────────────────────────────────────

export function confidence(i: EngineInputs): number {
  const dc = norm01(i.dataCompleteness, 0.7);
  const sq = norm01(i.sourceQuality, 0.7);
  const ms = norm01(i.modelStability, 0.7);
  const raw = 0.4 * dc + 0.35 * sq + 0.25 * ms;
  return clamp(raw, 0.7, 1.0); // C ∈ [0.70, 1.00]
}

// ─── Master pipeline ──────────────────────────────────────────────

export function runEngine(i: EngineInputs): EngineResult {
  const chain = valueAccrualChain(i.pr, i.pc, i.tc);
  const sup = supplyMetrics(
    i.buyback,
    i.burn,
    i.unlock12m,
    i.emission12m,
    i.float,
  );

  // VAE is expressed as a PERCENT throughout (matches the locked gate "VAE < 10").
  const vaePct = chain.vae * 100;

  const pq = scorePQ(i);
  const va = scoreVA(i, chain);
  const v = scoreV(i);
  const r = scoreR(i);
  const tq = scoreTQ(i, vaePct, sup.sar, sup.fdr);

  const gate = evaluateGate({
    vae: vaePct,
    delta: chain.delta * 100, // to percent
    risk: r * 100,
    sar: sup.sar,
    accrualKind: i.accrualKind,
  });

  // IA_raw = (PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35) / R_safe^0.15
  // Components are 0..1 → product is tiny. Scale to a 0..100 readability band
  // by scaling each component to 0..100 first (architecture-neutral scaling).
  const PQ = pq * 100;
  const TQ = tq * 100;
  const VA = va * 100;
  const Vv = v * 100;
  const R_safe = Math.max(r * 100, 1);

  const iaRaw =
    (Math.pow(PQ, 0.2) * Math.pow(TQ, 0.25) * Math.pow(VA, 0.2) * Math.pow(Vv, 0.35)) /
    Math.pow(R_safe, 0.15);

  const c = confidence(i);
  const iaEffective = iaRaw * c;
  const m = clamp(num(i.marketRegime, 1.0), 0.9, 1.1);
  const iaFinal = iaEffective * m;

  const components: ComponentScores = {
    pq,
    tq,
    va,
    v,
    r,
    vae: vaePct,
    alpha: chain.alpha,
    delta: chain.delta,
    sar: sup.sar,
    nsp: sup.nsp,
    fdr: sup.fdr,
  };

  const decision = decide(gate.passed, iaFinal, c, r);
  const explanation = explain(i, {
    gate,
    components,
    iaRaw,
    confidence: c,
    iaEffective,
    regime: m,
    iaFinal,
    decision,
  });

  return {
    symbol: i.symbol,
    name: i.name,
    gate,
    components,
    iaRaw,
    confidence: c,
    iaEffective,
    regime: m,
    iaFinal,
    decision,
    explanation,
  };
}

// ─── Decision logic ───────────────────────────────────────────────

function decide(
  gatePassed: boolean,
  iaFinal: number,
  c: number,
  r: number,
): Decision {
  if (!gatePassed) return "REJECT";
  if (iaFinal >= 35 && c >= 0.85 && r <= 0.55) return "BUY";
  if (iaFinal >= 30) return "WATCH";
  if (iaFinal >= 22) return "INVESTIGATE";
  return "AVOID";
}

// ─── Explanation (plain-language, explainable) ────────────────────

function explain(i: EngineInputs, r: EngineResult): DecisionExplanation {
  const forPoints: { key: string; value?: string }[] = [];
  const againstPoints: { key: string; value?: string }[] = [];
  const whatChanges: { key: string }[] = [];

  const { components: c, confidence: conf, iaRaw, iaFinal } = r;

  // For — structured keys, frontend translates to user's language
  if (c.vae >= 40) forPoints.push({ key: "vae_strong", value: c.vae.toFixed(1) + "%" });
  if (c.delta >= 0.5) forPoints.push({ key: "delta_good", value: (c.delta * 100).toFixed(0) + "%" });
  if (c.pq >= 0.7) forPoints.push({ key: "pq_strong", value: (c.pq * 100).toFixed(0) });
  if (c.sar >= 0.5) forPoints.push({ key: "sar_healthy", value: c.sar.toFixed(2) });
  if (c.fdr <= 0.15) forPoints.push({ key: "fdr_low", value: (c.fdr * 100).toFixed(0) + "%" });

  // Against
  if (c.vae < 25) againstPoints.push({ key: "vae_weak", value: c.vae.toFixed(1) + "%" });
  if (c.fdr >= 0.25) againstPoints.push({ key: "fdr_high", value: (c.fdr * 100).toFixed(0) + "%" });
  if (c.r >= 0.6) againstPoints.push({ key: "risk_elevated", value: (c.r * 100).toFixed(0) });
  if (c.delta < 0.2) againstPoints.push({ key: "delta_low", value: (c.delta * 100).toFixed(0) + "%" });
  if (i.unlock12m > 0 && i.float > 0 && i.unlock12m / i.float >= 0.15)
    againstPoints.push({ key: "unlock_high", value: ((i.unlock12m / i.float) * 100).toFixed(0) + "%" });

  // What changes the decision
  whatChanges.push({ key: "change_unlock" });
  whatChanges.push({ key: "change_revenue_drawdown" });
  whatChanges.push({ key: "change_tvl_drawdown" });
  if (i.accrualKind === "buyback_burn")
    whatChanges.push({ key: "change_sar_drop" });

  const statusLine = `${i.symbol}  IA_raw=${iaRaw.toFixed(1)}  C=${conf.toFixed(2)}  Eff=${r.iaEffective.toFixed(1)}  M=${r.regime.toFixed(2)}  Final=${iaFinal.toFixed(1)}`;

  return {
    decision: r.decision,
    forPoints,
    againstPoints,
    whatChanges,
    statusLine,
  };
}
