# CryptoSieve — Locked Architecture (v2 — FROZEN)

> **Status: LOCKED.** This document is the canonical reference for the
> CryptoSieve Investment Decision Engine. Exponents, weights, and gate
> thresholds MUST NOT change without explicit user sign-off.
>
> Positioning: **Crypto Investment Decision Engine**
> Tagline: **Discover → Verify → Evaluate → Value → Decide**
> Philosophy: **Evidence > Narrative**

---

## 1. Decision Pipeline

```
Gate  →  PQ  →  TQ  →  VA  →  V  →  R  →  IA_raw  →  C  →  IA_effective  →  M  →  IA_final
```

| Stage | Symbol | Meaning |
|---|---|---|
| 0 | Gate | Mechanism-aware hard vetoes (reject before scoring) |
| 1 | PQ | Project Quality |
| 2 | TQ | Token Quality |
| 3 | VA | Value Accrual |
| 4 | V  | Valuation |
| 5 | R  | Risk |
| 6 | IA_raw | Fundamental investment attractiveness |
| 7 | C | Confidence factor (data quality) |
| 8 | IA_effective | Quality × confidence |
| 9 | M | Market regime modifier |
| 10 | IA_final | Actionable, regime-adjusted score |

---

## 2. Master Formulas (LOCKED)

### 2.1 IA raw (fundamental)

```
IA_raw = ( PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35 ) / R_safe^0.15
```

### 2.2 IA effective (with confidence)

```
IA_effective = IA_raw × C
```

### 2.3 IA final (with market regime)

```
IA_final = IA_raw × C × M
```

### 2.4 Bounds

```
C      ∈ [0.70, 1.00]
M      ∈ [0.90, 1.10]
R_safe = max(R, 1)
```

> Momentum no longer lives inside Valuation. M has at most a ±10% effect
> and can never make an expensive asset look cheap.

---

## 3. Gate — Mechanism-Aware Hard Vetoes

```
VAE < 10        ⇒  Reject   (Universal)
δ   < 5         ⇒  Reject   (Universal)
R   > 90        ⇒  Reject   (Universal)
SAR < 0.1       ⇒  Reject   (Conditional — only if Buyback/Burn is part of the token's value-accrual thesis)
```

If value accrual is via staking or fee-sharing, the SAR gate does NOT apply.

---

## 4. Value Accrual Chain (clean VAE definition)

```
GEA  ──α──▶  PR  ──α_c──▶  PC  ──δ──▶  TC
```

| Symbol | Name | Formula |
|---|---|---|
| GEA | Gross Economic Activity | — |
| PR  | Protocol Revenue | — |
| PC  | Protocol Capture | — |
| TC  | Tokenholder Capture | — |
| α   | Protocol Capture Rate | α = PC / PR |
| δ   | Distribution Rate | δ = TC / PC |
| VAE | Value Accrual Efficiency | VAE = TC / PR = α × δ |

Every variable has exactly one meaning. The model is auditable.

---

## 5. Component Formulas (LOCKED)

### 5.1 PQ — Project Quality

```
PQ = 0.30·RG + 0.25·RS + 0.20·RD + 0.15·MP + 0.10·UG
```

| W | Component |
|---|---|
| 0.30 | RG — Revenue Growth |
| 0.25 | RS — Revenue Stability |
| 0.20 | RD — Revenue Diversification |
| 0.15 | MP — Market Position |
| 0.10 | UG — User Growth |

### 5.2 TQ — Token Quality

```
TQ = 0.30·VAE + 0.20·SAR + 0.20·(1 − FDR_n) + 0.20·TU + 0.10·GQ
```

| W | Component |
|---|---|
| 0.30 | VAE (normalized) |
| 0.20 | SAR — Supply Absorption Ratio |
| 0.20 | (1 − FDR_n) — inverse future dilution risk |
| 0.20 | TU — Token Utility |
| 0.10 | GQ — Governance Quality |

### 5.3 VA — Value Accrual

```
VA = 0.30·α + 0.30·δ + 0.25·τ + 0.15·BA
```

| W | Component |
|---|---|
| 0.30 | α — Protocol Capture Rate |
| 0.30 | δ — Distribution Rate |
| 0.25 | τ — Real yield / staking yield |
| 0.15 | BA — Buyback activity |

### 5.4 V — Valuation

```
V = 0.25·(1 − MC/TC_n) + 0.25·(1 − MC/PR_n) + 0.20·TY + 0.15·(1 − FDV/TC_n) + 0.15·IG
```

| W | Component |
|---|---|
| 0.25 | (1 − MC/TC_n) — market-cap vs total-capture percentile |
| 0.25 | (1 − MC/PR_n) — market-cap vs protocol-revenue percentile |
| 0.20 | TY — Token yield |
| 0.15 | (1 − FDV/TC_n) — inverse FDV/total-capture percentile |
| 0.15 | IG — Inflation grade |

### 5.5 R — Risk

```
R = 0.25·RC + 0.20·IC + 0.20·REG + 0.15·SC + 0.10·ML + 0.10·DR
```

| W | Component |
|---|---|
| 0.25 | RC — Revenue concentration |
| 0.20 | IC — Insider/governance concentration |
| 0.20 | REG — Regulatory risk |
| 0.15 | SC — Smart-contract risk |
| 0.10 | ML — Market liquidity |
| 0.10 | DR — Dependency risk |

---

## 6. Supply Metrics (Triple)

| Metric | Formula | Role |
|---|---|---|
| SAR | (Buyback + Burn) / (Unlock + Emission) | Pressure-absorption ratio |
| NSP | Unlock + Emission − Burn − Buyback | Real net pressure (absolute) |
| FDR | (12m Unlock + Emission) / Current Float | Future dilution risk |

---

## 7. Confidence Factor C

```
C = f(Data Completeness, Source Quality, Model Stability)
```

| Data level | C |
|---|---|
| Complete & audited | 1.00 |
| Complete but estimated | 0.85 |
| Incomplete but usable | 0.70 |
| Very incomplete | REJECT |

Clamped to `[0.70, 1.00]`.

---

## 8. Market Regime Modifier M

```
M ∈ [0.90, 1.10]
```

A momentum/regime multiplier with a hard ceiling of +10% and floor of −10%.
It cannot rescue an overvalued asset; it only nudges an already-solid thesis.

---

## 9. Four-Tier Ranking

| Rank | Basis | Use |
|---|---|---|
| **Fundamental Rank** | `IA_raw` | Intrinsic quality of the asset |
| **Confidence Rank** | `C` | Data quality |
| **Effective Rank** | `IA_effective` | Quality × confidence |
| **Market Rank** | `IA_final` | Actionable under current market regime |

> Interpretation rule: we never say "AAVE is better than HYPE."
> We say: *"AAVE currently holds the highest score with high data confidence.
> HYPE has the highest raw IA but high data uncertainty."*

---

## 10. Reference Card

```
IA_raw       = (PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35) / R_safe^0.15
IA_effective = IA_raw × C
IA_final     = IA_raw × C × M
Rank_Fund    = Rank(IA_raw)
Rank_Action  = Rank(IA_final)
VAE          = α × δ = TC / PR
```

---

## 11. Decision Output Contract (Explainable)

For every scored asset the engine MUST emit:

```
DECISION: INVESTIGATE   (or BUY / WATCH / AVOID / REJECT)

For:
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

Status:  HYPE  IA_raw=41.7  C=0.61  Eff=25.4  M=1.05  Final=26.7
         Promising / Data-Limited
```

---

## 12. Roadmap (future versions, not in scope of current build)

- **V1.1** Evidence Graph · Project/Token/Investment separation · Explainable Decision  ← (this build)
- **V1.2** Peer Benchmarking · Percentile Engine · Historical Score
- **V1.3** Unlock/Tokenomics Engine · Capital Flow / Smart Money
- **V1.4** Thesis Engine · Catalyst Engine · Kill Conditions
- **V2**   AI Research Copilot · Continuous Monitoring · Automatic Thesis Updates

---

## 13. Critical Note

HYPE / SKY / AAVE numbers in the design examples are **sample data**.
For real execution every component must be recomputed from live, auditable,
primary-source data. This framework is an **architecture**, not a final output.
