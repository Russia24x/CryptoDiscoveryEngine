# CryptoSieve — Product Requirements Document (PRD v2)

## Product Identity

**CryptoSieve** is a **Crypto Investment Decision Engine** — not a screener,
not a dashboard, not a news reader.

> Discover → Verify → Evaluate → Value → Decide

The single question it must win:

> *"Among the many projects in front of me today, which one is actually
> worth investigating/investing in, why, what evidence proves it, and
> exactly what would invalidate this decision?"*

Philosophy: **Evidence > Narrative.**

---

## Differentiation

CryptoSieve does NOT compete on database size (Token Terminal), wallet-label
count (Nansen), or social-source count (Kaito). It competes on **Data →
Evidence → Decision** conversion.

---

## V1.1 Scope (this build)

### Must-have (P0)

1. **Evidence Engine** — every metric carries source, timestamp, freshness,
   confidence, contradictions, and an evidence grade. Organised as an
   Evidence Graph per project.

2. **Project Quality ≠ Token Quality ≠ Investment Attractiveness** — three
   independent scores shown side by side, plus Valuation. Never collapsed
   into one "overall score."

3. **Explainable Decision Engine** — outputs a plain-language decision
   (BUY / WATCH / INVESTIGATE / AVOID / REJECT) with For/Against bullets
   and explicit "what changes the decision" conditions.

### Core engine (locked — see ARCHITECTURE.md)

- Gate (mechanism-aware hard vetoes)
- PQ, TQ, VA, V, R component scoring
- IA_raw → IA_effective (× C) → IA_final (× M)
- Four-tier ranking (Fundamental / Confidence / Effective / Market)
- Triple supply metrics (SAR / NSP / FDR)
- Value-accrual chain (GEA → PR → PC → TC)

### Market-wide discovery scan

A scanning section that runs the entire engine across the live market
(pulled from free providers) and ranks assets by each of the four ranks.

### Data layer (free-first, key-ready)

- DeFiLlama (free, no key)
- CoinGecko public (free, no key)
- Provider registry: any new provider (incl. paid/keyed) plugs into the
  same `DataProvider` interface — only the adapter + an API-key field change.

### Bilingual (fa / en)

- Full i18n. Persian RTL, English LTR. No hardcoded UI strings.

### Future hooks (UI reserved, not built)

- News / RSS reader slot
- Social feed slot (Telegram / X) via link/address
- These are scaffolded in the data model and UI nav, but not the focus of V1.1.

---

## Out of scope for V1.1

- Peer benchmarking percentile engine (V1.2)
- Smart-money / capital-flow evidence (V1.3)
- Thesis engine + kill conditions (V1.4)
- AI copilot (V2)
- Portfolio tracking, advanced charting, trading terminal

These are documented in ARCHITECTURE.md §12 as the roadmap.

---

## Platform-agnostic core

The engine (`src/engine`) is pure TypeScript with zero Next.js / DOM coupling,
so it can be reused in:

- Mobile (React Native / Expo)
- Desktop (Tauri / Electron)
- CLI tool

The Next.js app is the first presentation layer over this core.

---

## Free-first operating model

Everything runs on free, key-less APIs. The provider registry is designed so
key-based providers (CoinMarketCap, Messari, Nansen) can be added later with
zero changes to the engine — only a new adapter + an API-key field in settings.
