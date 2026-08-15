# CryptoSieve — Crypto Investment Decision Engine

> **Discover → Verify → Evaluate → Value → Decide**
> Philosophy: **Evidence > Narrative**

CryptoSieve is a crypto investment decision engine that answers one question better than any single competitor:

> *"Of the many projects in front of me right now, which is actually worth investigating/investing in, why, what evidence proves it, and exactly what invalidates this decision?"*

It does NOT compete with CoinMarketCap, DeFiLlama, Token Terminal, Nansen, or Kaito on database size. It competes on **Data → Evidence → Decision** conversion.

---

## Quick start

```bash
# install deps
bun install

# set up the database
bun run db:push

# start the dev server (port 3000)
bun run dev

# verify the locked architecture (44 invariants)
bun run engine:check

# lint
bun run lint
```

Open `http://localhost:3000` — the app defaults to Persian (RTL). Use the
language toggle in the header to switch to English (LTR).

---

## What it does

### Discovery Scanner
Runs the locked decision engine across the market and ranks assets by four tiers:
**Fundamental / Confidence / Effective / Market**. Each row shows IA scores,
gate status, decision (BUY/WATCH/INVESTIGATE/AVOID/REJECT), and a trend sparkline
(historical IA_final over recent scans).

### Asset Detail
Click any asset to see:
- **Four-tier ranking** (Project Quality ≠ Token Quality ≠ Investment Attractiveness)
- **Component scores** (PQ, TQ, VA, V, R)
- **Value-accrual chain** (GEA → PR → PC → TC, with α, δ, VAE)
- **Supply metrics** (SAR / NSP / FDR)
- **Gate check** (mechanism-aware hard vetoes)
- **Explainable decision** (For / Against / What-changes-the-decision)
- **Evidence graph** (each metric carries source, timestamp, freshness, grade)
- **Peer benchmarking** (percentile vs peers + Relative Investment Attractiveness)

### Comparison
Select 2–5 assets to compare side-by-side across 12 metrics, with per-row
winner highlighting and an overall winner crown.

### Settings
- **Data providers**: free-first (DeFiLlama, CoinGecko — no key needed).
  Key-based providers (CoinMarketCap, Messari, Nansen) plug in via the same
  interface — only an adapter + API-key field change.
- **News & social feeds**: RSS / Telegram / X reserved for future ingestion.

---

## Architecture (LOCKED)

The decision pipeline is **frozen** (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):

```
Gate → PQ → TQ → VA → V → R → IA_raw → C → IA_effective → M → IA_final
```

```
IA_raw       = (PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35) / R_safe^0.15
IA_effective = IA_raw × C        C ∈ [0.70, 1.00]
IA_final     = IA_raw × C × M    M ∈ [0.90, 1.10]
```

The engine lives in `src/engine/` as **pure TypeScript** with zero Next.js/DOM
coupling — reusable across Web / Mobile / Desktop / CLI.

### Gate (mechanism-aware hard vetoes)
- `VAE < 10` → Reject (universal)
- `δ < 5` → Reject (universal)
- `R > 90` → Reject (universal)
- `SAR < 0.10` → Reject (**conditional** — only if accrual thesis is buyback/burn)

---

## Project structure

```
src/
  engine/          # Pure-TS decision engine (LOCKED formulas)
    index.ts       #   PQ/TQ/VA/V/R/IA/C/M pipeline + gate + explain
    ranking.ts     #   four-tier ranking
    percentile.ts  #   peer benchmarking + comparison matrix
  providers/       # Data providers (free-first, key-ready)
    types.ts       #   DataProvider interface + registry + safeJsonFetch
    defillama.ts   #   free, key-less
    coingecko.ts   #   free, key-less
    demo-data.ts   #   8 sample assets exercising every engine branch
  app/
    [locale]/      # i18n routes (fa RTL / en LTR)
    api/           # scan, projects/[symbol], benchmark, compare, trend, providers, feeds
  components/      # React UI (discovery, detail, comparison, settings, sparkline)
  i18n/            # next-intl routing + request config
  messages/        # fa.json + en.json translation dictionaries
scripts/
  engine-check.ts  # regression guard (44 invariants) — run: bun run engine:check
docs/
  ARCHITECTURE.md  # LOCKED v2 reference (formulas, gate, weights)
  PRD.md           # product requirements + roadmap
```

---

## Bilingual (fa / en)

- Persian (`fa`) is RTL, English (`en`) is LTR. The `<html dir>` attribute
  flips automatically via `next-intl`.
- Persian typography uses **Vazirmatn** (loaded via `next/font/google`).
- Every user-facing string lives in `src/messages/{fa,en}.json` — no
  hardcoded UI strings.

---

## Free-first, key-ready

- **Free, key-less**: DeFiLlama (TVL/fees/revenue), CoinGecko public (market/supply)
- **Key-based (add later)**: CoinMarketCap, Messari, Nansen — same `DataProvider`
  interface, only the adapter + an API-key field change.
- The provider registry auto-registers built-ins; paid providers flow through
  automatically with zero engine changes.

---

## Platform-agnostic core

The engine (`src/engine/`) is pure TypeScript with zero Next.js / DOM coupling,
so it can be reused in:
- **Mobile** (React Native / Expo)
- **Desktop** (Tauri / Electron)
- **CLI**

The Next.js app is the first presentation layer over this core.

---

## Engineering guards

```bash
bun run engine:check   # 44 invariants: formulas, gate, percentiles, formatting, trend ordering
bun run lint           # ESLint
```

The `engine:check` script asserts the locked architecture — any change to the
formulas, gate thresholds, or percentile logic will fail immediately.

---

## Git rules (MANDATORY)

See [`RULES.md`](RULES.md). Key rules:
- **NEVER-FORCE-PUSH**: `git push --force` is absolutely forbidden. If a normal
  push is rejected (non-fast-forward), STOP and report.
- **SESSION-START-SYNC-CHECK**: at the start of every session, `git fetch origin`
  + `git status` before any change. GitHub is the canonical source of truth.
- **GitHub is canonical**: the sandbox/container can break; the project must be
  fully recoverable from `git clone`.

---

## Roadmap

See [`docs/PRD.md`](docs/PRD.md) §12 for the full roadmap. Current status:
- **V1.1** ✅ Locked architecture, bilingual, discovery, detail, explainable decision, evidence graph
- **V1.2** ✅ Peer benchmarking + percentile engine + comparison view + historical trend sparklines
- **V1.3** 🔲 Tokenomics engine + smart-money capital-flow evidence
- **V1.4** 🔲 Thesis engine + catalyst engine + kill conditions
- **V2**   🔲 AI research copilot + continuous monitoring
