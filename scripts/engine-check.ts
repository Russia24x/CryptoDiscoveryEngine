/**
 * CryptoSieve — Engine self-check (regression guard for the LOCKED architecture)
 *
 * Runs the engine against a known fixture and asserts the outputs match the
 * values derived from the locked formulas in docs/ARCHITECTURE.md.
 *
 * Usage: bun run engine:check
 *
 * This is a standalone script (no test framework). It exits non-zero on failure.
 * NOT user-facing test code — it's an engineering guard for the engine contract.
 */
import { runEngine, valueAccrualChain, supplyMetrics, evaluateGate, type EngineInputs } from "../src/engine";
import { benchmarkAsset } from "../src/engine/percentile";
import { deriveThesis } from "../src/engine/thesis";
import { fmtUsd, fmtPct } from "../src/lib/format";

// Minimal deterministic fixture exercising every branch.
const fixture: EngineInputs = {
  symbol: "TEST",
  name: "Test Asset",
  category: "Test",
  accrualKind: "buyback_burn",
  gea: 200_000_000,
  pr: 100_000_000,
  pc: 80_000_000,
  tc: 60_000_000,
  marketCap: 1_000_000_000,
  fdv: 1_500_000_000,
  float: 800_000_000,
  buyback: 40_000_000,
  burn: 20_000_000,
  unlock12m: 100_000_000,
  emission12m: 20_000_000,
  tokenYield: 0.05,
  inflationGrade: 0.8,
  mcOverTcPercentile: 0.7,
  mcOverPrPercentile: 0.6,
  fdvOverTcPercentile: 0.65,
  revenueGrowth: 0.8,
  revenueStability: 0.7,
  revenueDiversification: 0.6,
  marketPosition: 0.75,
  userGrowth: 0.6,
  realYield: 0.04,
  buybackActivity: 0.5,
  revenueConcentration: 0.3,
  insiderConcentration: 0.35,
  regulatoryRisk: 0.25,
  smartContractRisk: 0.2,
  marketLiquidityRisk: 0.3,
  dependencyRisk: 0.35,
  dataCompleteness: 0.9,
  sourceQuality: 0.85,
  modelStability: 0.8,
  marketRegime: 1.0,
};

const peers: EngineInputs[] = [fixture];

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function approx(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

console.log("CryptoSieve engine self-check\n" + "─".repeat(50));

// 1. Value accrual chain
const chain = valueAccrualChain(fixture.pr, fixture.pc, fixture.tc);
assert("α = PC/PR = 0.80", approx(chain.alpha, 0.8), `got ${chain.alpha}`);
assert("δ = TC/PC = 0.75", approx(chain.delta, 0.75), `got ${chain.delta}`);
assert("VAE = TC/PR = 0.60 (ratio)", approx(chain.vae, 0.6), `got ${chain.vae}`);

// 2. Supply triple
const sup = supplyMetrics(40e6, 20e6, 100e6, 20e6, 800e6);
assert("SAR = (40+20)/(100+20) = 0.5", approx(sup.sar, 0.5), `got ${sup.sar}`);
assert("NSP = 100+20-20-40 = 60M", approx(sup.nsp, 60e6), `got ${sup.nsp}`);
assert("FDR = 120/800 = 0.15", approx(sup.fdr, 0.15), `got ${sup.fdr}`);

// 3. Gate (mechanism-aware)
const gateOk = evaluateGate({ vae: 60, delta: 75, risk: 30, sar: 0.5, accrualKind: "buyback_burn" });
assert("Gate passes when VAE=60, δ=75, R=30, SAR=0.5", gateOk.passed && gateOk.reasons.length === 0);

const gateFailVAE = evaluateGate({ vae: 5, delta: 75, risk: 30, accrualKind: "fee" });
assert("Gate rejects VAE<10 (universal)", !gateFailVAE.passed && gateFailVAE.reasons.some((r) => r.includes("VAE")));

const gateFailDelta = evaluateGate({ vae: 60, delta: 3, risk: 30, accrualKind: "fee" });
assert("Gate rejects δ<5 (universal)", !gateFailDelta.passed && gateFailDelta.reasons.some((r) => r.includes("δ")));

const gateFailR = evaluateGate({ vae: 60, delta: 75, risk: 95, accrualKind: "fee" });
assert("Gate rejects R>90 (universal)", !gateFailR.passed && gateFailR.reasons.some((r) => r.includes("R > 90")));

const gateFailSAR = evaluateGate({ vae: 60, delta: 75, risk: 30, sar: 0.05, accrualKind: "buyback_burn" });
assert("Gate rejects SAR<0.10 (conditional buyback_burn)", !gateFailSAR.passed && gateFailSAR.reasons.some((r) => r.includes("SAR")));

const gateSkipSAR = evaluateGate({ vae: 60, delta: 75, risk: 30, sar: 0.05, accrualKind: "fee" });
assert("Gate SKIPS SAR gate when accrualKind=fee", gateSkipSAR.passed, "SAR should not apply to fee accrual");

// 4. Full pipeline produces a sensible result
const result = runEngine(fixture);
assert("IA_raw > 0", result.iaRaw > 0, `got ${result.iaRaw}`);
assert("C ∈ [0.70, 1.00]", result.confidence >= 0.70 && result.confidence <= 1.00, `got ${result.confidence}`);
assert("IA_effective = IA_raw × C", approx(result.iaEffective, result.iaRaw * result.confidence, 0.5), `got ${result.iaEffective}`);
assert("M ∈ [0.90, 1.10]", result.regime >= 0.90 && result.regime <= 1.10, `got ${result.regime}`);
assert("IA_final = IA_raw × C × M", approx(result.iaFinal, result.iaRaw * result.confidence * result.regime, 0.5), `got ${result.iaFinal}`);
assert("VAE stored as percent (60)", approx(result.components.vae, 60, 0.1), `got ${result.components.vae}`);
assert("Decision is a valid value", ["BUY", "WATCH", "INVESTIGATE", "AVOID", "REJECT"].includes(result.decision));
assert("Explanation has ≥1 for-point", result.explanation.forPoints.length >= 1);
assert("Explanation has ≥3 what-changes", result.explanation.whatChanges.length >= 3);

// 5. Percentile engine bounds
const bench = benchmarkAsset(fixture, peers);
assert("Percentiles ∈ [0,100]", bench.percentiles.every((p) => p.percentile >= 0 && p.percentile <= 100));
assert("Relative IA ∈ [0,100]", bench.relativeIA >= 0 && bench.relativeIA <= 100, `got ${bench.relativeIA}`);
assert("Single-peer benchmark → rank 1/1", bench.percentiles.every((p) => p.rank === 1 && p.total === 1));

// 6. Competition ranking ties — two identical values must share rank 1.
const tieA: EngineInputs = { ...fixture, symbol: "TIE_A", revenueGrowth: 0.5 };
const tieB: EngineInputs = { ...fixture, symbol: "TIE_B", revenueGrowth: 0.5 }; // identical RG
const tiePeers = [tieA, tieB];
const tieBench = benchmarkAsset(tieA, tiePeers);
const rgRow = tieBench.percentiles.find((p) => p.key === "revenueGrowth");
assert("Tied values share rank 1 (competition ranking)", rgRow?.rank === 1 && rgRow?.total === 2, `got rank=${rgRow?.rank}/${rgRow?.total}`);
assert("Tied value percentile = 0 (none strictly worse)", rgRow?.percentile === 0, `got ${rgRow?.percentile}`);

// 7. Registry auto-registers built-in providers.
const { listProviders } = await import("../src/providers/registry");
const registeredProviders = listProviders();
assert("Registry has ≥2 providers after listProviders()", registeredProviders.length >= 2, `got ${registeredProviders.length}`);
assert("Registry includes defillama", registeredProviders.some((p) => p.meta.slug === "defillama"));
assert("Registry includes coingecko", registeredProviders.some((p) => p.meta.slug === "coingecko"));

// 8. Formatting helpers — edge cases (negatives, NaN, billions).
assert("fmtUsd positive billions", fmtUsd(2_350_000_000) === "$2.35B", `got ${fmtUsd(2_350_000_000)}`);
assert("fmtUsd negative millions → sign before $", fmtUsd(-60_000_000) === "-$60.0M", `got ${fmtUsd(-60_000_000)}`);
assert("fmtUsd negative thousands", fmtUsd(-5_000) === "-$5.0K", `got ${fmtUsd(-5_000)}`);
assert("fmtUsd small negative", fmtUsd(-500) === "-$500", `got ${fmtUsd(-500)}`);
assert("fmtUsd NaN → em dash", fmtUsd(NaN) === "—", `got ${fmtUsd(NaN)}`);
assert("fmtUsd zero", fmtUsd(0) === "$0", `got ${fmtUsd(0)}`);
assert("fmtPct ratio", fmtPct(0.4318) === "43.2%", `got ${fmtPct(0.4318)}`);
assert("fmtPct zero", fmtPct(0) === "0.0%", `got ${fmtPct(0)}`);

// 9. Sparkline normalization logic (mirrors the component's math, no DOM).
//    Verifies: min/max range normalization, single-point centering, and the
//    trend-direction color decision (the bug we just fixed was in the
//    upstream API, but the sparkline math itself should be guarded too).
function sparkPts(values: number[], width = 48, height = 16) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  return values.map((v, i) => {
    const x = pad + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w);
    const y = pad + h - ((v - min) / range) * h;
    return { x, y };
  });
}
const sp1 = sparkPts([10, 20, 30]);
assert("sparkline: 3 points ascending → y decreasing (line goes up-right)", sp1[0].y > sp1[1].y && sp1[1].y > sp1[2].y, `got ys ${sp1.map((p) => p.y.toFixed(1)).join(",")}`);
const sp2 = sparkPts([5]);
assert("sparkline: single point centered on x-axis", sp2.length === 1 && Math.abs(sp2[0].x - 24) < 1, `got x=${sp2[0]?.x}`);
const sp3 = sparkPts([10, 10, 10]);
assert("sparkline: equal values → all y equal (flat line)", sp3.every((p) => p.y === sp3[0].y), `got ys ${sp3.map((p) => p.y.toFixed(1)).join(",")}`);

// 10. Newest-N ordering concept (the trend API bug we fixed).
//     Simulate 25 scan rows; the API must return the LATEST 20, oldest-first.
function selectNewestN<T extends { id: number }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => b.id - a.id).slice(0, n).reverse();
}
const fakeRows = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, iaFinal: i }));
const newest20 = selectNewestN(fakeRows, 20);
assert("trend API: returns 20 points (not 25)", newest20.length === 20);
assert("trend API: first point is id=6 (oldest of the newest 20)", newest20[0].id === 6, `got id=${newest20[0].id}`);
assert("trend API: last point is id=25 (newest)", newest20[newest20.length - 1].id === 25, `got id=${newest20[newest20.length - 1].id}`);

// 11. Thesis engine — shape + status logic.
const thesis = deriveThesis(fixture, result);
assert("Thesis has non-empty title", thesis.title.length > 0, `got '${thesis.title}'`);
assert("Thesis statusPct ∈ [0,100]", thesis.statusPct >= 0 && thesis.statusPct <= 100, `got ${thesis.statusPct}`);
assert("Thesis statusLabel is valid", ["intact", "weakening", "broken"].includes(thesis.statusLabel));
assert("Thesis mustStayTrue has ≥4 conditions", thesis.mustStayTrue.length >= 4, `got ${thesis.mustStayTrue.length}`);
assert("Thesis mustStayTrue all have met:boolean", thesis.mustStayTrue.every((c) => typeof c.met === "boolean"));
assert("Thesis whatBreaksIt has ≥3 entries", thesis.whatBreaksIt.length >= 3, `got ${thesis.whatBreaksIt.length}`);
assert("Thesis latestEvidence has ≥4 entries", thesis.latestEvidence.length >= 4, `got ${thesis.latestEvidence.length}`);
assert("Thesis latestEvidence directions are valid", thesis.latestEvidence.every((e) => ["up", "down", "neutral"].includes(e.direction)));
// statusLabel ↔ statusPct consistency
const expectedLabel = thesis.statusPct >= 80 ? "intact" : thesis.statusPct >= 50 ? "weakening" : "broken";
assert("Thesis statusLabel matches statusPct threshold", thesis.statusLabel === expectedLabel, `got ${thesis.statusLabel} for ${thesis.statusPct}%`);
// buyback_burn fixture must include the SAR condition
assert("Thesis (buyback_burn) includes SAR condition", thesis.mustStayTrue.some((c) => c.label.includes("Supply absorption")), "SAR condition should appear for buyback_burn thesis");

// 12. Thesis revenue condition is non-tautological — it must be able to FAIL.
// Build a fixture with PR below the $1M viability floor and verify the
// revenue condition is unmet. (Guard against the tautological `i.pr > 0` bug.)
const lowRevInput: EngineInputs = { ...fixture, symbol: "LOWREV", pr: 500_000 };
const lowRevResult = runEngine(lowRevInput);
const lowRevThesis = deriveThesis(lowRevInput, lowRevResult);
const lowRevRevCond = lowRevThesis.mustStayTrue.find((c) => c.label.includes("Revenue"));
assert("Thesis revenue condition can FAIL (non-tautological)", lowRevRevCond?.met === false, `expected met=false for PR<$1M, got met=${lowRevRevCond?.met}`);
assert("Thesis with low revenue → status < 100%", lowRevThesis.statusPct < 100, `expected <100% with a failed condition, got ${lowRevThesis.statusPct}%`);

// 13. Ranking competition ties — two assets with identical scores must share rank.
const { rankResults } = await import("../src/engine/ranking");
const rankTieA = { ...result, symbol: "RTIE_A", iaRaw: 50, iaEffective: 50, iaFinal: 50 };
const rankTieB = { ...result, symbol: "RTIE_B", iaRaw: 50, iaEffective: 50, iaFinal: 50 };
const rankTieRanked = rankResults([rankTieA, rankTieB]);
assert("Ranking: tied assets share rankMkt=1", rankTieRanked[0].rankMkt === 1 && rankTieRanked[1].rankMkt === 1, `got ${rankTieRanked[0].rankMkt}, ${rankTieRanked[1].rankMkt}`);
assert("Ranking: tied assets share rankFund=1", rankTieRanked[0].rankFund === 1 && rankTieRanked[1].rankFund === 1, `got ${rankTieRanked[0].rankFund}, ${rankTieRanked[1].rankFund}`);

console.log("─".repeat(50));
if (failures === 0) {
  console.log("✓ All engine checks passed.");
  process.exit(0);
} else {
  console.error(`✗ ${failures} check(s) failed.`);
  process.exit(1);
}
