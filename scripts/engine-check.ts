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

console.log("─".repeat(50));
if (failures === 0) {
  console.log("✓ All engine checks passed.");
  process.exit(0);
} else {
  console.error(`✗ ${failures} check(s) failed.`);
  process.exit(1);
}
