/**
 * CryptoSieve — Percentile Engine (V1.2)
 *
 * Computes how each asset ranks vs its peers on every key metric.
 * Produces a "Relative Investment Attractiveness" score that turns
 * raw scores into decision-relevant peer context.
 *
 * Pure TypeScript. Zero Next.js / DOM coupling.
 *
 * @see docs/PRD.md §4 (Dynamic Peer Benchmarking)
 */
import type { EngineInputs } from "./index";
import { runEngine } from "./index";

// Safe number coercion — same as num() in engine/index.ts but local
// to avoid circular imports. undefined → 0 for arithmetic.
const num = (x: number | undefined, fallback = 0): number =>
  x === undefined || Number.isNaN(x) ? fallback : x;

export interface PeerPercentile {
  key: string;          // metric key
  label: string;        // human label
  value: number;        // raw value for this asset
  percentile: number;   // 0..100 (higher = better than X% of peers)
  rank: number;         // 1 = best
  total: number;        // peer count
  better: boolean;      // value where higher-is-better
}

export interface PeerBenchmark {
  symbol: string;
  name: string;
  category?: string;
  percentiles: PeerPercentile[];
  relativeIA: number;        // 0..100 — Relative Investment Attractiveness
  peerCount: number;
  strengths: string[];       // top 3 percentile metrics
  weaknesses: string[];      // bottom 3 percentile metrics
}

// Metrics to benchmark. `higherBetter` indicates direction.
// For risk metrics, lower is better so we invert the percentile.
interface MetricDef {
  key: string;
  label: string;
  extract: (i: EngineInputs) => number;
  higherBetter: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  { key: "revenueGrowth", label: "Revenue Growth", extract: (i) => i.revenueGrowth ?? 0, higherBetter: true },
  { key: "marketPosition", label: "Protocol Moat", extract: (i) => i.marketPosition ?? 0, higherBetter: true },
  { key: "userGrowth", label: "User Growth", extract: (i) => i.userGrowth ?? 0, higherBetter: true },
  { key: "revenueStability", label: "Revenue Stability", extract: (i) => i.revenueStability ?? 0, higherBetter: true },
  { key: "vae", label: "Value Accrual Eff.", extract: (i) => i.tc / Math.max(i.pr, 1) * 100, higherBetter: true },
  { key: "delta", label: "Distribution Rate", extract: (i) => i.tc / Math.max(i.pc, 1), higherBetter: true },
  { key: "sar", label: "Supply Absorption", extract: (i) => (num(i.buyback) + num(i.burn)) / Math.max(num(i.unlock12m) + num(i.emission12m), 1), higherBetter: true },
  { key: "fdrInv", label: "Dilution Safety", extract: (i) => {
    const supplyMissing = i.unlock12m === undefined && i.emission12m === undefined;
    return supplyMissing ? 0.3 : (1 - (num(i.unlock12m) + num(i.emission12m)) / Math.max(num(i.float), 1));
  }, higherBetter: true },
  { key: "realYield", label: "Real Yield", extract: (i) => i.realYield ?? 0, higherBetter: true },
  { key: "mcOverPr", label: "P/R (cheapness)", extract: (i) => i.pr / Math.max(i.marketCap, 1), higherBetter: true },
  { key: "riskInv", label: "Risk (low)", extract: (i) => 1 - (i.revenueConcentration ?? 0.4) * 0.25 - (i.insiderConcentration ?? 0.4) * 0.2 - (i.regulatoryRisk ?? 0.4) * 0.2 - (i.smartContractRisk ?? 0.3) * 0.15 - (i.marketLiquidityRisk ?? 0.35) * 0.1 - (i.dependencyRisk ?? 0.4) * 0.1, higherBetter: true },
  { key: "confidence", label: "Data Confidence", extract: (i) => (i.dataCompleteness ?? 0.7) * 0.4 + (i.sourceQuality ?? 0.7) * 0.35 + (i.modelStability ?? 0.7) * 0.25, higherBetter: true },
];

/**
 * Compute percentiles for one asset against a peer set.
 * @param target the asset to benchmark
 * @param peers  the full peer set ( INCLUDING the target )
 */
export function benchmarkAsset(
  target: EngineInputs,
  peers: EngineInputs[],
): PeerBenchmark {
  const results = peers.map(runEngine);
  void results; // engine results available for callers if needed

  const percentiles: PeerPercentile[] = METRIC_DEFS.map((def) => {
    const values = peers.map((p) => def.extract(p));
    const myValue = def.extract(target);
    // Standard percentile rank: (# strictly worse) / (n - 1) × 100
    // For higherBetter: worse = smaller. For lowerBetter: worse = larger.
    let below = 0;
    let strictlyBetter = 0; // for competition ranking (ties share the better rank)
    for (const v of values) {
      if (def.higherBetter) {
        if (v < myValue) below++;
        else if (v > myValue) strictlyBetter++;
      } else {
        if (v > myValue) below++;
        else if (v < myValue) strictlyBetter++;
      }
    }
    const pct = values.length > 1 ? (below / (values.length - 1)) * 100 : 50;
    // Competition ranking: 1 + number of strictly-better values.
    // Ties share the same rank (not the indexOf-based first-match bug).
    const rank = strictlyBetter + 1;
    return {
      key: def.key,
      label: def.label,
      value: myValue,
      percentile: Math.round(pct),
      rank,
      total: values.length,
      better: def.higherBetter,
    };
  });

  // Relative IA = weighted blend of top percentiles (decision-relevant)
  // Emphasizes the metrics that actually move investment decisions.
  const weightMap: Record<string, number> = {
    vae: 0.18,
    revenueGrowth: 0.14,
    marketPosition: 0.12,
    sar: 0.1,
    fdrInv: 0.1,
    delta: 0.1,
    mcOverPr: 0.1,
    riskInv: 0.08,
    realYield: 0.04,
    userGrowth: 0.04,
  };
  let relIA = 0;
  for (const p of percentiles) {
    relIA += p.percentile * (weightMap[p.key] ?? 0);
  }
  relIA = Math.round(relIA);

  // strengths = top 3 by percentile
  const sorted = [...percentiles].sort((a, b) => b.percentile - a.percentile);
  const strengths = sorted.slice(0, 3).map((p) => `${p.label} ${p.percentile}th pct`);
  const weaknesses = sorted.slice(-3).reverse().map((p) => `${p.label} ${p.percentile}th pct`);

  return {
    symbol: target.symbol,
    name: target.name,
    category: target.category,
    percentiles,
    relativeIA: relIA,
    peerCount: peers.length,
    strengths,
    weaknesses,
  };
}

/**
 * Benchmark ALL assets in a set against each other.
 */
export function benchmarkAll(peers: EngineInputs[]): PeerBenchmark[] {
  return peers.map((p) => benchmarkAsset(p, peers));
}

/**
 * Compare two or more assets head-to-head.
 * Returns a matrix: metric → { symbol → { value, percentile } }
 */
export interface ComparisonCell {
  symbol: string;
  value: number;
  percentile: number;
  rank: number;
}
export interface ComparisonRow {
  metric: string;
  label: string;
  cells: ComparisonCell[];
  higherBetter: boolean;
}
export interface ComparisonResult {
  symbols: string[];
  rows: ComparisonRow[];
  iaRaw: Record<string, number>;
  iaFinal: Record<string, number>;
  relativeIA: Record<string, number>;
}

export function compareAssets(
  targets: EngineInputs[],
  allPeers: EngineInputs[],
): ComparisonResult {
  const benchmarks = benchmarkAll(allPeers);
  const bmMap = new Map(benchmarks.map((b) => [b.symbol, b]));
  const symbols = targets.map((t) => t.symbol);
  const results = targets.map(runEngine);

  const rows: ComparisonRow[] = METRIC_DEFS.map((def) => {
    const allValues = allPeers.map((p) => def.extract(p));
    const cells: ComparisonCell[] = targets.map((t) => {
      const value = def.extract(t);
      let below = 0;
      let strictlyBetter = 0;
      for (const v of allValues) {
        if (def.higherBetter) {
          if (v < value) below++;
          else if (v > value) strictlyBetter++;
        } else {
          if (v > value) below++;
          else if (v < value) strictlyBetter++;
        }
      }
      const pct = allValues.length > 1 ? (below / (allValues.length - 1)) * 100 : 50;
      return {
        symbol: t.symbol,
        value,
        percentile: Math.round(pct),
        rank: strictlyBetter + 1,
      };
    });
    return { metric: def.key, label: def.label, cells, higherBetter: def.higherBetter };
  });

  const iaRaw: Record<string, number> = {};
  const iaFinal: Record<string, number> = {};
  const relativeIA: Record<string, number> = {};
  for (let i = 0; i < targets.length; i++) {
    iaRaw[symbols[i]] = results[i].iaRaw;
    iaFinal[symbols[i]] = results[i].iaFinal;
    relativeIA[symbols[i]] = bmMap.get(symbols[i])?.relativeIA ?? 0;
  }

  return { symbols, rows, iaRaw, iaFinal, relativeIA };
}
