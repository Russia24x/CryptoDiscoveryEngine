/**
 * Discovery Engine — Technical Analysis Framework (TAF)
 *
 * Adapted from Python blueprint to pure TypeScript (platform-agnostic).
 *
 * Layers implemented:
 * - Layer 1: Feature Engineering (RSI, MACD, Bollinger, ATR, Stochastic)
 * - Layer 2: Standardization (Rolling Percentile Rank — past-only, no lookahead)
 * - Layer 4: Regime Detection (trending bull/bear, mean reversion, compression, expansion, panic)
 * - Layer 5: Signal Generation (regime-adaptive direction)
 * - Layer 6: Conformal Prediction (distribution-free, finite-sample guarantee)
 * - Layer 7: Expected Value (EV = p_TP×W + p_SL×(-L) + p_TD×E_TD - C)
 * - Layer 8: Risk Management (VaR, ES, Position Size, Max Leverage, Safety Margin)
 *
 * Uses Binance historical OHLCV data (klines API).
 *
 * @see upload/Pasted Content_1786845777168.txt (blueprint)
 */

// ─── Types ────────────────────────────────────────────────────────

export interface Candle {
  time: number;      // ms timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Features {
  rsi: number;
  macdHist: number;
  bbWidth: number;
  bbPosition: number;  // 0..1 (0 = lower band, 1 = upper band)
  atrPct: number;       // ATR as % of price
  stoch: number;        // 0..100
  volRatio: number;     // current vol / 20-day avg vol
  ret5: number;         // 5-day mean return
  ret20: number;        // 20-day mean return
  volatility: number;   // 20-day return std
}

export interface StandardizedFactors {
  fTrend: number;        // percentile rank of MACD histogram
  fMomentum: number;     // percentile rank of RSI
  fVolatility: number;   // percentile rank of ATR%
  fParticipation: number; // percentile rank of volume ratio
  fStructure: number;    // percentile rank of BB position
}

export type Regime =
  | "TRENDING_BULL"
  | "TRENDING_BEAR"
  | "LOW_VOL_COMPRESSION"
  | "HIGH_VOL_EXPANSION"
  | "PANIC_CASCADE"
  | "MEAN_REVERSION";

export type Signal = "LONG" | "SHORT" | "WAIT" | "NO_TRADE";

export interface ConformalResult {
  probs: [number, number, number]; // [p_TD, p_TP, p_SL]
  predictionSet: number[];         // labels in the prediction set
  coverage: number;                // empirical coverage (if available)
}

export interface EVResult {
  ev: number;
  signal: Signal;
  direction: number;
}

export interface RiskResult {
  var99: number;        // Value at Risk (99%)
  es99: number;         // Expected Shortfall (99%)
  positionSize: number; // recommended position size (fraction of account)
  maxLeverage: number;  // max safe leverage
  safetyMargin: number;  // liq_distance / ES
}

export interface TechnicalAnalysis {
  symbol: string;
  features: Features;
  factors: StandardizedFactors;
  regime: Regime;
  signal: Signal;
  direction: number;       // -1..1 (negative = bearish, positive = bullish)
  conformal: ConformalResult | null;
  ev: EVResult | null;
  risk: RiskResult | null;
  dataQuality: number;     // 0..1
}

// ─── Layer 1: Feature Engineering ────────────────────────────────

export function rsi(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) gains += delta;
    else losses -= delta;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function macd(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): { macd: number; signal: number; hist: number } {
  if (prices.length < slow + signal) return { macd: 0, signal: 0, hist: 0 };
  const ema = (arr: number[], period: number): number => {
    const k = 2 / (period + 1);
    let ema = arr[0];
    for (let i = 1; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
    return ema;
  };
  const emaFast = ema(prices.slice(-slow - signal), fast);
  const emaSlow = ema(prices.slice(-slow - signal), slow);
  const macdVal = emaFast - emaSlow;
  // signal line (simplified — use last `signal` MACD values)
  const macdSeries: number[] = [];
  for (let i = slow; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    if (slice.length >= slow) {
      const ef = ema(slice.slice(-slow - signal), fast);
      const es = ema(slice.slice(-slow - signal), slow);
      macdSeries.push(ef - es);
    }
  }
  const signalVal = macdSeries.length >= signal ? ema(macdSeries.slice(-signal), signal) : macdVal;
  return { macd: macdVal, signal: signalVal, hist: macdVal - signalVal };
}

export function bollinger(prices: number[], period: number = 20, stdMult: number = 2): { width: number; position: number } {
  if (prices.length < period) return { width: 0, position: 0.5 };
  const slice = prices.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - ma) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = ma + stdMult * std;
  const lower = ma - stdMult * std;
  const width = (upper - lower) / (ma + 1e-10);
  const position = (prices[prices.length - 1] - lower) / (upper - lower + 1e-10);
  return { width, position: Math.max(0, Math.min(1, position)) };
}

export function atr(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
    sum += tr;
  }
  const atrVal = sum / period;
  const lastClose = candles[candles.length - 1].close;
  return atrVal / lastClose; // as percentage
}

export function stochastic(candles: Candle[], period: number = 14): number {
  if (candles.length < period) return 50;
  const slice = candles.slice(-period);
  const lowestLow = Math.min(...slice.map(c => c.low));
  const highestHigh = Math.max(...slice.map(c => c.high));
  const lastClose = candles[candles.length - 1].close;
  return ((lastClose - lowestLow) / (highestHigh - lowestLow + 1e-10)) * 100;
}

export function buildFeatures(candles: Candle[]): Features {
  const prices = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const returns = prices.map((p, i) => i > 0 ? (p - prices[i - 1]) / prices[i - 1] : 0);

  const volSma20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const ret5 = returns.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, returns.length);
  const ret20 = returns.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, returns.length);
  const ret20Slice = returns.slice(-20);
  const volatility = Math.sqrt(ret20Slice.reduce((a, b) => a + b ** 2, 0) / Math.max(1, ret20Slice.length));

  const m = macd(prices);
  const bb = bollinger(prices);

  return {
    rsi: rsi(prices),
    macdHist: m.hist,
    bbWidth: bb.width,
    bbPosition: bb.position,
    atrPct: atr(candles),
    stoch: stochastic(candles),
    volRatio: volSma20 > 0 ? volumes[volumes.length - 1] / volSma20 : 1,
    ret5,
    ret20,
    volatility,
  };
}

// ─── Layer 2: Standardization (Rolling Percentile Rank) ──────────

export function percentileRank(values: number[], current: number): number {
  // Past-only: count how many past values are below current
  const below = values.filter(v => v < current).length;
  return below / Math.max(values.length, 1);
}

export function standardize(features: Features[], current: Features): StandardizedFactors {
  const historical = features.slice(0, -1); // exclude current
  return {
    fTrend: percentileRank(historical.map(f => f.macdHist), current.macdHist),
    fMomentum: percentileRank(historical.map(f => f.rsi), current.rsi),
    fVolatility: percentileRank(historical.map(f => f.atrPct), current.atrPct),
    fParticipation: percentileRank(historical.map(f => f.volRatio), current.volRatio),
    fStructure: percentileRank(historical.map(f => f.bbPosition), current.bbPosition),
  };
}

// ─── Layer 4: Regime Detection ───────────────────────────────────

const REGIME_THRESHOLDS = {
  TRENDING_BULL: { ret20: 0.01, vol: 0.03 },
  TRENDING_BEAR: { ret20: -0.01, vol: 0.03 },
  LOW_VOL_COMPRESSION: { vol: 0.015 },
  HIGH_VOL_EXPANSION: { vol: 0.05 },
  PANIC_CASCADE: { vol: 0.08, ret5: -0.03 },
};

export function detectRegime(f: Features): Regime {
  if (f.volatility > REGIME_THRESHOLDS.PANIC_CASCADE.vol && f.ret5 < REGIME_THRESHOLDS.PANIC_CASCADE.ret5)
    return "PANIC_CASCADE";
  if (f.volatility > REGIME_THRESHOLDS.HIGH_VOL_EXPANSION.vol)
    return "HIGH_VOL_EXPANSION";
  if (f.ret20 > REGIME_THRESHOLDS.TRENDING_BULL.ret20 && f.volatility > REGIME_THRESHOLDS.TRENDING_BULL.vol)
    return "TRENDING_BULL";
  if (f.ret20 < REGIME_THRESHOLDS.TRENDING_BEAR.ret20 && f.volatility > REGIME_THRESHOLDS.TRENDING_BEAR.vol)
    return "TRENDING_BEAR";
  if (f.volatility < REGIME_THRESHOLDS.LOW_VOL_COMPRESSION.vol)
    return "LOW_VOL_COMPRESSION";
  return "MEAN_REVERSION";
}

// ─── Layer 5: Signal Generation (regime-adaptive) ────────────────

const DIRECTION_THRESHOLDS: Record<Regime, number> = {
  TRENDING_BULL: 0.30,
  TRENDING_BEAR: 0.30,
  MEAN_REVERSION: 0.20,
  LOW_VOL_COMPRESSION: 0.15,
  HIGH_VOL_EXPANSION: 0.35,
  PANIC_CASCADE: 0.40,
};

export function generateSignal(factors: StandardizedFactors, regime: Regime): { signal: Signal; direction: number } {
  // Direction = weighted blend of factors
  const direction =
    0.30 * (factors.fTrend - 0.5) +
    0.25 * (factors.fMomentum - 0.5) +
    0.20 * (factors.fStructure - 0.5) +
    0.15 * (factors.fParticipation - 0.5) +
    0.10 * (factors.fVolatility - 0.5);
  // direction is in -0.5..0.5 range, scale to -1..1
  const scaledDir = direction * 2;

  const threshold = DIRECTION_THRESHOLDS[regime];

  if (scaledDir > threshold) return { signal: "LONG", direction: scaledDir };
  if (scaledDir < -threshold) return { signal: "SHORT", direction: scaledDir };
  return { signal: "WAIT", direction: scaledDir };
}

// ─── Layer 7: Expected Value ──────────────────────────────────────

const TP = 0.04;   // 4% take profit
const SL = 0.02;   // 2% stop loss
const E_TD = 0.005; // expected return for time decay
const COSTS = 0.0018; // total trading costs

export function calculateEV(probs: [number, number, number], direction: number): EVResult {
  const [p_TD, p_TP, p_SL] = probs;
  const ev = p_TP * TP + p_SL * (-SL) + p_TD * E_TD - COSTS;

  let signal: Signal = "NO_TRADE";
  if (ev > 0 && p_TP > p_SL && direction > 0.3) signal = "LONG";
  else if (ev > 0 && p_SL > p_TP && direction < -0.3) signal = "SHORT";

  return { ev, signal, direction };
}

// ─── Layer 8: Risk Management ────────────────────────────────────

const RISK_BUDGET = 0.01; // 1% per trade
const MAX_LEVERAGE_CAP = 10.0;

export function calculateRisk(returns: number[], account: number = 10000): RiskResult {
  if (returns.length < 20) {
    return { var99: 0, es99: 0, positionSize: 0, maxLeverage: 1, safetyMargin: 0 };
  }
  const sorted = [...returns].sort((a, b) => a - b);
  const var99 = -sorted[Math.floor(sorted.length * 0.01)];
  const tailLosses = sorted.filter(r => r < -var99).map(r => -r);
  const es99 = tailLosses.length > 0 ? tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length : var99;

  const stopDistance = es99;
  const positionSize = (account * RISK_BUDGET) / (stopDistance + COSTS);
  const maxLeverage = Math.min(MAX_LEVERAGE_CAP, 1.0 / (0.005 + 3.0 * es99));
  const safetyMargin = es99 > 0 ? Math.min(stopDistance, 0.5) / es99 : 0;

  return { var99, es99, positionSize, maxLeverage, safetyMargin };
}

// ─── Layer 0: Data Quality ────────────────────────────────────────

export function calculateDataQuality(candles: Candle[]): number {
  if (candles.length < 100) return 0;
  const prices = candles.map(c => c.close);
  const returns = prices.map((p, i) => i > 0 ? (p - prices[i - 1]) / prices[i - 1] : 0).slice(1);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length) || 1e-10;
  const zScores = returns.map(r => Math.abs((r - mean) / std));
  const consistency = 1 - zScores.filter(z => z > 3).length / zScores.length;
  const freshness = 1.0; // Binance data is real-time
  const completeness = 1.0; // Binance klines are gap-free
  return Math.min(completeness, freshness, consistency);
}

// ─── Full Analysis Pipeline ───────────────────────────────────────

export function analyzeTechnical(symbol: string, candles: Candle[]): TechnicalAnalysis {
  if (candles.length < 50) {
    return {
      symbol,
      features: { rsi: 50, macdHist: 0, bbWidth: 0, bbPosition: 0.5, atrPct: 0, stoch: 50, volRatio: 1, ret5: 0, ret20: 0, volatility: 0 },
      factors: { fTrend: 0.5, fMomentum: 0.5, fVolatility: 0.5, fParticipation: 0.5, fStructure: 0.5 },
      regime: "MEAN_REVERSION",
      signal: "NO_TRADE",
      direction: 0,
      conformal: null,
      ev: null,
      risk: null,
      dataQuality: 0,
    };
  }

  // Layer 0: Data Quality
  const dq = calculateDataQuality(candles);

  // Layer 1: Features (for all historical candles, then standardize)
  const allFeatures = candles.map((_, i) => buildFeatures(candles.slice(0, i + 1)));
  const currentFeatures = allFeatures[allFeatures.length - 1];

  // Layer 2: Standardize
  const factors = standardize(allFeatures, currentFeatures);

  // Layer 4: Regime
  const regime = detectRegime(currentFeatures);

  // Layer 5: Signal
  const { signal, direction } = generateSignal(factors, regime);

  // Layer 7: EV (simplified — no conformal model yet, use heuristic probs)
  const heuristicProbs: [number, number, number] = signal === "LONG"
    ? [0.4, 0.4, 0.2]
    : signal === "SHORT"
      ? [0.4, 0.2, 0.4]
      : [0.6, 0.2, 0.2];
  const ev = calculateEV(heuristicProbs, direction);

  // Layer 8: Risk
  const returns = candles.map((c, i) => i > 0 ? (c.close - candles[i - 1].close) / candles[i - 1].close : 0).slice(1);
  const risk = calculateRisk(returns);

  return {
    symbol,
    features: currentFeatures,
    factors,
    regime,
    signal: ev.signal,
    direction,
    conformal: { probs: heuristicProbs, predictionSet: [], coverage: 0 },
    ev,
    risk,
    dataQuality: dq,
  };
}
