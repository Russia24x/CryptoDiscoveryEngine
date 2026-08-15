# CryptoSieve — Product Requirements Document (PRD v2)

> **Status:** Architecturally Locked
> **Tagline:** *Crypto Investment Decision Engine — Discover → Verify → Evaluate → Value → Decide*
> **Philosophy:** Evidence > Narrative

---

## 0. What CryptoSieve Is (and Is Not)

### CryptoSieve IS

A **Crypto Investment Decision Engine**. Given a set of projects in the crypto market, it answers one question better than any single competitor:

> *"Of the many projects in front of me right now, which is actually worth investigating / investing in, **why**, **what evidence proves it**, and **what exactly invalidates this decision**?"*

### CryptoSieve is NOT

- ❌ A crypto screener (CMC / CoinGecko already do this)
- ❌ A crypto dashboard
- ❌ An AI crypto research tool (wrapper)
- ❌ A crypto news aggregator

### Competitive Position

CryptoSieve does **not** compete with any single product. It competes with the **stack** a serious investor currently assembles manually:

```
CoinMarketCap  +  DeFiLlama  +  Token Terminal  +  Nansen  +  Kaito  +  Messari
```

The opportunity: the user should not need to keep six windows open.

### Where CryptoSieve Wins (locked differentiation)

| Capability | CryptoSieve | Best competitor |
|---|---|---|
| Fundamental Scoring | 5 | Artemis / Token Terminal (4) |
| Token Quality | 5 | Token Terminal / Nansen (4) |
| Cross-verification | 5 | Artemis / DeFiLlama (4) |
| Hard Veto / Risk Gates | 5 | Artemis (3) |
| Investment Decision | 5 | Messari / Artemis (4) |
| Thesis / Kill Conditions | 5 | Messari (4) |
| Bias / Self-correction | 5 | (all competitors ≤ 2) |
| Explain why a project passes/fails | 5 | Artemis (4) |

Where competitors are stronger (Data, On-chain, Smart Money) we integrate rather than rebuild.

---

## 1. Locked Architecture

### 1.1 The Decision Pipeline

```
Gate  →  PQ  →  TQ  →  VA  →  V  →  R  →  IA_raw  →  C  →  IA_effective  →  M  →  IA_final
```

| Stage | Symbol | Name | Role |
|---|---|---|---|
| 0 | Gate | Hard Veto | Universal + conditional rejection gates |
| 1 | PQ | Project Quality | Intrinsic quality of the protocol/product |
| 2 | TQ | Token Quality | Quality of the token as an asset |
| 3 | VA | Value Accrual | How well value flows to tokenholders |
| 4 | V | Valuation | Is the token cheap or expensive |
| 5 | R | Risk | Aggregate risk score |
| 6 | IA_raw | Investment Attractiveness (raw) | Fundamental score, pre-adjustments |
| 7 | C | Confidence | Data quality multiplier |
| 8 | IA_effective | Investment Attractiveness (effective) | Quality × Confidence |
| 9 | M | Market Regime | Market-context multiplier |
| 10 | IA_final | Investment Attractiveness (final) | Actionable score |

### 1.2 Locked Formulas

#### IA — three layers

```
IA_raw        = ( PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35 ) / ( R_safe^0.15 )

IA_effective  = IA_raw · C

IA_final      = IA_raw · C · M
```

With constraints:

```
C ∈ [0.70, 1.00]        // confidence floor; below 0.70 → reject
M ∈ [0.90, 1.10]        // market regime bounded ±10%
R_safe = max(R, 1)      // avoid divide-by-zero / amplification
```

#### Gate — mechanism-aware

```
VAE  < 10      →  Reject   (Universal)
δ    < 5       →  Reject   (Universal)
R    > 90      →  Reject   (Universal)
SAR  < 0.1     →  Reject   (Conditional — only if buyback/burn is part of thesis)
```

> **SAR is a gate only when value accrual is via Buyback/Burn.** If accrual is via staking or fee-sharing, SAR gate is not applied.

### 1.3 Value Accrual Efficiency (VAE) — clean definition

The value-transfer chain:

```
GEA  ──α──▶  PR  ──α_c──▶  PC  ──δ──▶  TC
```

| Symbol | Definition | Formula |
|---|---|---|
| GEA | Gross Economic Activity | — |
| PR  | Protocol Revenue | — |
| PC  | Protocol Capture | — |
| TC  | Tokenholder Capture | — |
| α   | Protocol Capture Rate | PC / PR |
| δ   | Distribution Rate | TC / PC |
| **VAE** | **Value Accrual Efficiency** | **TC / PR = α · δ** |

Every variable has exactly one meaning. The model is auditable.

### 1.4 Component Formulas (locked)

#### PQ — Project Quality

```
PQ = 0.30·RG + 0.25·RS + 0.20·RD + 0.15·MP + 0.10·UG
```
RG = Revenue Growth · RS = Revenue Stability · RD = Revenue Diversification · MP = Market Position (moat) · UG = User Growth

#### TQ — Token Quality

```
TQ = 0.30·VAE + 0.20·SAR + 0.20·(1 − FDR_n) + 0.20·TU + 0.10·GQ
```
VAE = Value Accrual Efficiency · SAR = Supply Absorption Ratio · FDR = Future Dilution Rate · TU = Token Utility · GQ = Governance Quality

#### VA — Value Accrual

```
VA = 0.30·α + 0.30·δ + 0.25·τ + 0.15·BA
```
α = Capture Rate · δ = Distribution Rate · τ = Trend (direction of accrual) · BA = Buyback Activity

#### V — Valuation

```
V = 0.25·(1 − MC/TC_n) + 0.25·(1 − MC/PR_n) + 0.20·TY + 0.15·(1 − FDV/TC_n) + 0.15·IG
```
MC = Market Cap · TC = Tokenholder Capture · PR = Protocol Revenue · TY = Token Yield · FDV = Fully Diluted Valuation · IG = Investor Growth

> **Momentum is no longer part of Valuation.** It is absorbed by M (max ±10%).

#### R — Risk

```
R = 0.25·RC + 0.20·IC + 0.20·REG + 0.15·SC + 0.10·ML + 0.10·DR
```
RC = Revenue Concentration · IC = Insider/Concentration risk · REG = Regulatory risk · SC = Smart Contract risk · ML = Multiplier/Leverage risk · DR = Dependency Risk

### 1.5 Supply Metrics — the triple

| Metric | Formula | Role |
|---|---|---|
| SAR | (Buyback + Burn) / (Unlock + Emission) | Pressure-absorption ratio |
| NSP | Unlock + Emission − Burn − Buyback | Real net pressure (amount) |
| FDR | (12m Unlock + Emission) / Current Float | Future dilution risk |

### 1.6 Confidence Factor (C)

```
C = f(Data Completeness, Source Quality, Model Stability)
```

| Data Level | C |
|---|---|
| Complete & audited | 1.00 |
| Complete but estimated | 0.85 |
| Incomplete but usable | 0.70 |
| Very incomplete | REJECT |

### 1.7 Market Regime Modifier (M)

```
M ∈ [0.90, 1.10]
```

Bounded. Cannot make an expensive asset look cheap. Encodes overall market momentum/risk-appetite context only.

### 1.8 The Four Ranks

| Rank | Basis | Use |
|---|---|---|
| **Fundamental Rank** | `IA_raw` | Intrinsic quality of the asset |
| **Confidence Rank** | `C` | Data quality |
| **Effective Rank** | `IA_effective` | Quality + Confidence |
| **Market Rank** | `IA_final` | Actionable, market-aware |

Interpretation example:

> *"AAVE currently holds the highest score with high data confidence. HYPE has the highest raw IA but its data uncertainty is high."*

We never say "AAVE is better than HYPE." We say *why* one ranks higher under a given lens.

---

## 2. Core Product Modules (P0 — must build)

### 2.1 Evidence Engine / Evidence Graph

Every claim is a node in a graph, not a flat field:

```
Project
 ├── Claim
 │    ├── Source
 │    ├── Timestamp
 │    ├── Freshness
 │    ├── Confidence
 │    ├── Contradictions
 │    └── Evidence Grade
 ├── Metric
 │    ├── Current
 │    ├── Historical
 │    ├── Peer percentile
 │    └── Trend
 └── Risk
      ├── Evidence
      ├── Severity
      └── Status
```

Aligns with the project philosophy: **Evidence > Narrative**.

### 2.2 Three-Quality Separation

A locked identity pillar of the product:

```
Project Quality       ≠   Token Quality       ≠   Investment Attractiveness

Example:
  Project Quality       86 / 100
  Token Quality          58 / 100
  Valuation              41 / 100
  Investment Attract.    72 / 100
```

Because: *great project + bad token = bad investment* (and vice versa). This separation already exists in the architecture and must be surfaced in the UI.

### 2.3 Explainable Decision Engine

Output is never just `Score = 82`. Output is:

```
DECISION: INVESTIGATE

Why:
  + Revenue +41% / 90d
  + TVL +27%
  + Strong product-market fit
  + Token supply improving

Against:
  - 18% unlock next 12m
  - Revenue concentration = high
  - Governance concentration = high

What changes the decision:
  → unlock acceleration
  → revenue < X
  → TVL drawdown > Y
```

This is where CryptoSieve separates from a Screener.

---

## 3. P1 — Differentiators

### 3.1 Dynamic Peer Benchmarking (Percentile Engine)

For a project (e.g. HYPE), do not just show `Revenue = $X, P/R = Y`. Show:

```
HYPE
  Revenue Growth        91st percentile
  P/R                   63rd percentile
  Revenue/TVL           89th percentile
  Token Unlock Risk     18th percentile
  User Growth           78th percentile
  Protocol Moat         86th percentile

  Relative Investment Attractiveness: 84 / 100
```

Token Terminal and Artemis have strong fundamental comparisons; CryptoSieve must turn comparison into **decision**, not just another comps table.

### 3.2 Capital Signal (Smart Money, lite)

Nansen is a serious threat here. We do not copy Nansen. We add one more **Evidence type**:

```
Capital Signal
  Smart Money Flow      +++
  Whale Accumulation    ++
  Exchange Flow         -
  Insider Concentration -
  Long-term Holder      ++
```

This is just one Evidence among many — not the whole product.

### 3.3 Information Layer → Thesis Impact

Current: 4 English RSS, 2 Persian sources, Telegram feed. Sufficient for MVP, but Kaito is far ahead (Search, Sentiment, Smart Alerts, Mindshare, Catalyst Calendar).

**Goal is NOT a better RSS reader.** Goal is **news → thesis impact**:

```
NEWS
  ↓
New token unlock
  ↓
Evidence changed
  ↓
Token Quality −7
  ↓
Investment Attractiveness 78 → 69
  ↓
Decision changed: BUY → WATCH
```

---

## 4. Killer Feature — Thesis Engine

For each project, maintain a **living thesis**:

```
HYPE

THESIS
────────────────────────
Perp DEX tollbooth thesis

WHY IT WORKS
  ✓ Revenue
  ✓ Market share
  ✓ Liquidity
  ✓ Product moat

WHAT MUST STAY TRUE
  ✓ Revenue > $X
  ✓ Market share > Y%
  ✓ Buyback > Z
  ✓ Unlock absorption > ...

WHAT BREAKS IT
  ✕ Revenue −40%
  ✕ Market share < X%
  ✕ Governance failure
  ✕ Unlock > absorption

LATEST EVIDENCE
  ↑ Positive
  ↑ Positive
  → Neutral
  ↓ Negative

THESIS STATUS
  73% intact
```

Each time new data arrives, the system asks: *did the thesis strengthen, weaken, or invalidate?*

This is what separates CryptoSieve from a "Crypto Analytics Dashboard."

---

## 5. Roadmap

> Status legend: ✅ shipped · 🔲 planned

```
V1.1  ✅ Evidence Graph                       (SHIPPED)
      + Project / Token / Investment separation
      + Explainable Decision
            ↓
V1.2  ✅ Peer Benchmarking                     (SHIPPED)
      + Percentile Engine (12 metrics, competition ranking, Relative IA)
      + Comparison view (2–5 assets side-by-side)
      + Historical Score tracking (ScanRow time-series + trend sparklines)
      + Batch trend API (N+1 → 1 request)
            ↓
V1.3  🔲 Unlock / Tokenomics Engine
      + Capital Flow / Smart Money (lite)
            ↓
V1.4  🔲 Thesis Engine
      + Catalyst Engine
      + Kill Conditions
            ↓
V2    🔲 AI Research Copilot
      + Continuous Monitoring
      + Automatic Thesis Updates
```

Side features (Portfolio, Trading Terminal, advanced charting) are explicitly **out of scope** for now.

---

## 6. Data Layer — Free-First, Key-Ready

### 6.1 Providers (pluggable)

| Provider | Auth | Status | Role |
|---|---|---|---|
| CoinGecko (public) | none | ✅ default | Market data, prices |
| DeFiLlama (public) | none | ✅ default | TVL, Fees, Revenue, P/F, P/S |
| CoinMarketCap | API key (future) | 🔜 planned | Broad market data |
| Messari | API key (future) | 🔜 planned | Research / fundamentals |
| Token Terminal | API key (future) | 🔜 planned | Standardized financials |
| Nansen | API key (future) | 🔜 planned | Smart money / wallet |
| Kaito | API key (future) | 🔜 planned | Search / sentiment |

### 6.2 Provider Abstraction

```
src/lib/providers/
  ├── types.ts           // Provider interface, normalized types
  ├── registry.ts        // provider registry, enable/disable, key store
  ├── coingecko.ts       // free public impl
  ├── defillama.ts       // free public impl
  ├── coingecko-pro.ts   // key-based (stub for future)
  └── normalize.ts       // raw → normalized ProjectData
```

Keys are stored per-provider (DB / env) and managed via Settings UI. **Never hardcoded.**

### 6.3 Information Layer (placeholder, future-expandable)

Designed to accept:

- RSS feeds (English + Persian)
- Telegram channel URL → content fetch
- X (Twitter) handle / list → content fetch

For V1 these are **configurable endpoints** in Settings; the engine wiring for `news → thesis impact` is scaffolded but full aggregation lands in V1.4.

---

## 7. Architecture Principles

### 7.1 Engine is Pure TypeScript

`src/lib/engine/` contains the formula engine, types, and scoring logic. It:

- Has **zero** imports from `react`, `next`, or any UI library.
- Can be lifted into a CLI, a React Native app, or a Tauri desktop app unchanged.
- Is the canonical IP of the product.

### 7.2 UI is Replaceable

`src/app/` and `src/components/` hold the Next.js web UI. They consume the engine via plain function calls / API routes. If the web UI is replaced by a mobile app, the engine is untouched.

### 7.3 Bilingual (FA-RTL / EN-LTR)

- `next-intl` message catalogs (`fa.json`, `en.json`).
- Persian is default and renders RTL.
- English renders LTR.
- No hardcoded UI strings.

### 7.4 Database (SQLite, local)

Prisma + SQLite for local persistence of: projects cache, evidence records, theses, scan runs, provider configs, news sources. Portable to Postgres later by changing the datasource.

---

## 8. Reference Card (locked)

```
IA_raw        = ( PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35 ) / ( R_safe^0.15 )
IA_effective  = IA_raw · C
IA_final      = IA_raw · C · M

Rank_Fundamental = Rank(IA_raw)
Rank_Actionable  = Rank(IA_final)

VAE = α · δ = TC / PR

C ∈ [0.70, 1.00]
M ∈ [0.90, 1.10]
R_safe = max(R, 1)
```

---

## 9. Lock Status

This document is **architecturally locked**. Formula changes require an explicit versioned proposal + user approval (see `RULES.md` Rule 4).

> ⚠️ Sample numbers used in examples (HYPE / AAVE / SKY) are illustrative only. For real execution, every model component must be recomputed from live, auditable primary sources. This framework is an **architecture**, not a final output.
