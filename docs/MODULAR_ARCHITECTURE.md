# CryptoSieve — Modular System Architecture & Issue List

> Comprehensive audit of all modules, their relationships, issues, and roadmap.
> Generated: Round 40, per user request for complete modular breakdown.

---

## SYSTEM MODULES

### Module 1: Data Provider Layer
**Path:** `src/providers/`
**Role:** Fetch raw data from free APIs (Binance, DeFiLlama, CoinGecko, CoinPaprika)

| Provider | File | Auth | Data Provided | Cache |
|---|---|---|---|---|
| Binance | `binance.ts` | Free | Real-time price, volume, 24h change (10s cache) | In-memory |
| DeFiLlama | `defillama.ts` | Free | TVL, fees, revenue, category, audits | Per-scan |
| CoinGecko | `coingecko.ts` | Free | Market cap, FDV (rate-limited 429) | Per-scan |
| CoinPaprika | `coinpaprika.ts` | Free | Description, social links, GitHub, supply, events, price | Per-request |

**Relationship:** Called by scan route + coin-info route + technical route.

### Module 2: Fundamental Engine (IA Framework)
**Path:** `src/engine/index.ts`
**Role:** Implements locked formulas: Gate → PQ → TQ → VA → V → R → IA_raw → C → IA_effective → M → IA_final

**Inputs:** `EngineInputs` (30+ fields — see hardcoded list below)
**Outputs:** `EngineResult` (scores, gate, decision, explanation)
**Relationship:** Called by scan route → populates scan-cache → consumed by detail/thesis/benchmark routes.

### Module 3: Technical Engine (TAF Framework)
**Path:** `src/engine/technical.ts`
**Role:** 11-layer quantitative analysis from Binance OHLCV data

**Inputs:** `Candle[]` (365 daily candles from Binance klines)
**Outputs:** `TechnicalAnalysis` (features, factors, regime, signal, EV, risk)
**Relationship:** Called by /api/technical/[symbol]. Independent from IA engine.

### Module 4: Percentile Engine
**Path:** `src/engine/percentile.ts`
**Role:** Peer benchmarking — competition ranking, Relative IA

**Inputs:** `EngineInputs[]` (peer set from scan-cache)
**Outputs:** `PeerBenchmark` (12 metrics, percentiles, strengths, weaknesses)
**Relationship:** Called by /api/benchmark/[symbol] and /api/compare.

### Module 5: Thesis Engine
**Path:** `src/engine/thesis.ts`
**Role:** Living investment thesis — title, whyWorks, mustStayTrue, whatBreaksIt, statusPct

**Inputs:** `EngineInputs` + `EngineResult`
**Outputs:** `Thesis` (status gauge, conditions, evidence directions)
**Relationship:** Called by /api/thesis/[symbol].

### Module 6: Ranking Engine
**Path:** `src/engine/ranking.ts`
**Role:** Four-tier ranking (Fundamental / Confidence / Effective / Market)

**Inputs:** `EngineResult[]`
**Outputs:** `RankedRow[]` (with rankFund, rankConf, rankEff, rankMkt)
**Relationship:** Called by scan route.

### Module 7: Feed Ingestion Engine
**Path:** `src/engine/ingest.ts`
**Role:** Fetch + parse RSS (ArzDigital, MihanBlockchain) and Telegram feeds. Mirror-only (no storage).

**Inputs:** Feed source configs (from DB)
**Outputs:** `IngestedItem[]` (title, body, media, author)
**Relationship:** Called by /api/feeds/live.

### Module 8: Scan Cache
**Path:** `src/lib/scan-cache.ts`
**Role:** In-memory cache of engine inputs from the most recent scan. Allows detail/thesis/benchmark routes to serve ANY scanned symbol.

**Relationship:** Populated by /api/scan → consumed by /api/projects, /api/thesis, /api/benchmark, /api/compare.

### Module 9: API Routes
**Path:** `src/app/api/`

| Route | Method | Module | Purpose |
|---|---|---|---|
| `/api/scan` | GET | Providers + IA Engine + Ranking | Market-wide scan |
| `/api/projects/[symbol]` | GET | Scan Cache + IA Engine | Detail + evidence graph |
| `/api/technical/[symbol]` | GET | Binance + TAF Engine | Technical analysis |
| `/api/coin-info/[symbol]` | GET | CoinPaprika | Asset overview (image, price, social, links, events) |
| `/api/benchmark/[symbol]` | GET | Scan Cache + Percentile Engine | Peer benchmarking |
| `/api/thesis/[symbol]` | GET | Scan Cache + Thesis Engine | Investment thesis |
| `/api/compare` | POST | Scan Cache + Percentile Engine | Head-to-head comparison |
| `/api/trend` | POST/GET | DB (ScanRow) | Historical IA time-series |
| `/api/feeds` | GET/POST/DELETE | DB (FeedSource) | Feed source management |
| `/api/feeds/live` | GET | Feed Engine | Live mirror feed items |
| `/api/providers` | GET/POST/PATCH | DB (Provider) | Data provider management |

### Module 10: Frontend Views
**Path:** `src/components/`

| View | Components | Sections |
|---|---|---|
| Discovery | discovery-view, sparkline, decision-badge | Scan table, sort, sparklines |
| Detail | detail-view, coin-info-panel, benchmark-panel, thesis-panel, technical-panel | Asset Overview (merged), Four-Tier, Components, Value Chain, Supply, Gate, Evidence, Benchmark, Thesis, Technical |
| Comparison | comparison-view | Asset picker, summary cards, metric matrix |
| Feeds | feeds-view | Source list, filter tabs, view modes, live items |
| Settings | settings-view | Provider management, feed source config |

### Module 11: i18n
**Path:** `src/i18n/`, `src/messages/`
**Role:** Bilingual fa (RTL) / en (LTR). 289+ keys per locale.
**Relationship:** Consumed by all components via `useTranslations()`.

### Module 12: Database
**Path:** `prisma/schema.prisma`, `src/lib/db.ts`
**Models:** Provider, Project, Metric, Evidence, Thesis, Scan, ScanRow, FeedSource
**Role:** Persistence for scan history, project cache, provider configs, feed configs.

---

## HARDCODED VALUES IN FUNDAMENTAL ENGINE (scan route)

These 19 inputs are hardcoded because free APIs don't provide them:

| Input | Hardcoded Value | What It Should Be | Source |
|---|---|---|---|
| `revenueGrowth` | 0.5 | Revenue growth (7d vs 30d) | DeFiLlama fees (total7d, total30d) |
| `revenueStability` | 0.5 | Variance of daily revenue | DeFiLlama fees (breakdown) |
| `revenueDiversification` | 0.5 | Revenue source diversity | Manual / Token Terminal (paid) |
| `marketPosition` | 0.5 | TVL rank within category | DeFiLlama (we HAVE this data!) |
| `userGrowth` | 0.5 | User growth | Manual / on-chain APIs |
| `tokenYield` | 0 | Staking yield | Manual / protocol docs |
| `inflationGrade` | 0.6 | Token inflation rate | Token Terminal (paid) |
| `mcOverTcPercentile` | 0.5 | MC/TC percentile | Cross-sectional (we can compute!) |
| `mcOverPrPercentile` | 0.5 | MC/PR percentile | Cross-sectional (we can compute!) |
| `fdvOverTcPercentile` | 0.5 | FDV/TC percentile | Cross-sectional (we can compute!) |
| `realYield` | 0.01 | Real yield | Manual |
| `buybackActivity` | 0.05 | Buyback activity | Manual / Token Terminal (paid) |
| `revenueConcentration` | 0.4 | Revenue concentration | Manual |
| `insiderConcentration` | 0.4 | Insider concentration | Nansen (paid) |
| `regulatoryRisk` | 0.4 | Regulatory risk | Manual |
| `smartContractRisk` | 0.3 | Smart contract risk | DeFiLlama `audits` field (available!) |
| `marketLiquidityRisk` | 0.35 | Liquidity risk | Binance volume / MC (we can compute!) |
| `dependencyRisk` | 0.4 | Dependency risk | Manual |
| `marketRegime` | 1.0 | Market regime | BTC 30d momentum (we can compute!) |

**Quick wins (derivable from existing free API data):**
1. `marketPosition` — rank TVL within category
2. `revenueGrowth` — (total7d/7) vs (total30d/30) from DeFiLlama fees
3. `smartContractRisk` — DeFiLlama `audits` field
4. `marketLiquidityRisk` — Binance volume / market cap
5. `marketRegime` — BTC 30-day return from Binance klines
6. `mcOverTcPercentile` / `mcOverPrPercentile` / `fdvOverTcPercentile` — cross-sectional percentile across all scanned assets

---

## UNFINISHED WORK / ISSUES

### Architecture Issues
1. **Conformal prediction is heuristic** — not a trained ML model. Probabilities are assumed, not learned.
2. **No real-time WebSocket** — Binance price has 10s cache, not true real-time.
3. **No alternative OHLCV for non-Binance assets** — CoinGecko market_chart is rate-limited (429).

### Missing Features (from PRD)
1. Smart Money / Capital Signal evidence
2. Unlock/Tokenomics Engine
3. Catalyst Engine (CoinPaprika events available but not wired to thesis)
4. Formal Kill Conditions
5. News → Thesis Impact pipeline

### UI Issues
1. Discovery table doesn't show coin logos (text abbreviations only)
2. Comparison view asset picker doesn't show logos
3. No price chart in detail view
4. No real-time price ticker in header

### Data Quality Issues
1. CoinGecko rate-limited (429) — many assets miss market cap data
2. DeFiLlama fees API doesn't cover all protocols (2571 of 8000+)
3. Tokenholder Capture (TC) is estimated at 15% — not real
4. Unlock schedule is assumed at 5% — not real
