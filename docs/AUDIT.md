# CryptoSieve — Full Audit & Status Report

> Generated: Round 28 (comprehensive codebase audit per user request)
> Method: Audited every file against PRD v2 + original user requirements
>
> **⚠️ STATUS UPDATE (post-audit fix rounds):** The P0/P1 issues identified in this
> audit have been resolved across multiple subsequent commits. The "demo data"
> issues are largely addressed — the engine now runs against live market data
> (100 assets via the 3-tier CoinPaprika → CoinGecko → Binance provider chain).
> See [`worklog.md`](../worklog.md) for the current verified state and
> [`docs/ARCHITECTURE_REPORT.md`](ARCHITECTURE_REPORT.md) for the post-fix
> architecture review. The matrix below is preserved as historical context.

---

## Executive Summary

**Current state:** The engine architecture (locked formulas, decision pipeline, thesis) is
**solid and complete**. The UI is **modern and functional**. But the system is
**demonstration-grade, not production-grade** — it runs on 8 hardcoded demo assets,
live data providers are wired but fall back to demo, feeds store content in DB (user
wants mirror-only), and several PRD features are missing entirely.

**Root issue:** The build started correctly but stopped at "demo works" and never
transitioned to "live data flows through the engine."

---

## Audit Matrix: PRD Feature → Status → Gap

### P0 — Must Build (Core Product)

| # | Feature | Status | What's Built | What's Missing |
|---|---|---|---|---|
| 2.1 | Evidence Engine/Graph | ⚠️ Half | `buildEvidence()` generates 8 evidence nodes from engine result | Evidence is **static from demo data** — not from live sources. No real source/timestamp/freshness. No contradiction detection. |
| 2.2 | Three-Quality Separation | ✅ Done | PQ/TQ/VA/V/R shown separately in detail view + comparison | — |
| 2.3 | Explainable Decision | ✅ Done | `explain()` outputs For/Against/What-Changes | — |

### P1 — Differentiators

| # | Feature | Status | What's Built | What's Missing |
|---|---|---|---|---|
| 3.1 | Dynamic Peer Benchmarking | ⚠️ Half | Percentile engine, 12 metrics, Relative IA, comparison view | Uses **demo data only** — percentiles computed against 8 hardcoded assets, not the real market |
| 3.2 | Capital Signal (Smart Money) | 🔲 Missing | — | Not built at all. No Smart Money / Whale / Exchange Flow / Insider Concentration evidence. |
| 3.3 | Info Layer → Thesis Impact | ⚠️ Wrong | Feed ingestion works (Telegram + RSS), items stored in DB | **User wants mirror-only** (fetch + display, no storage). Thesis impact pipeline **not wired** (news doesn't change thesis status). |

### Killer Feature

| # | Feature | Status | What's Built | What's Missing |
|---|---|---|---|---|
| 4 | Thesis Engine | ⚠️ Half | `deriveThesis()` generates title/whyWorks/mustStayTrue/whatBreaks/statusPct | Uses **demo data** (static thesis, doesn't update when data changes). No Catalyst Engine. No formal Kill Conditions. No live monitoring. |

### V1.3

| # | Feature | Status |
|---|---|---|
| | Unlock/Tokenomics Engine | 🔲 NOT built |
| | Capital Flow / Smart Money | 🔲 NOT built |

### Data Layer

| Provider | Auth | Status | Issue |
|---|---|---|---|
| DeFiLlama | free | ⚠️ Wired but fails | `api.llama.fi/protocols` returns HTTP 200 but `overview/fees` endpoint returns non-array → scan falls back to demo |
| CoinGecko | free | ⚠️ Wired but rate-limited | HTTP 429 (free tier rate limit) |
| CMC/Messari/Nansen/Kaito | key | 🔲 Stubs | DB rows exist, UI shows them, but no adapter code |

### Architecture

| Principle | Status | Issue |
|---|---|---|
| Engine pure TS | ✅ | Zero React/Next imports — truly portable |
| Bilingual fa/en RTL | ✅ | Vazirmatn font loaded, all strings i18n'd |
| DB persistence | ⚠️ | Feeds stored in DB — **user wants mirror-only** |
| Platform-agnostic | ✅ | Engine can be lifted to mobile/desktop/CLI |
| Free-first | ✅ | No paid APIs required to run |
| Key-ready | ✅ | Provider registry + settings UI for keys |

---

## Critical Issues (User-Reported)

### 1. Feeds Should Be Mirror-Only (NOT Stored)
**Current:** `POST /api/feeds/ingest` fetches from sources → stores `FeedItem` records in DB → `/api/feeds/items` reads from DB.
**User wants:** Fetch from source → display directly (like a mirror/proxy). No DB storage. Content belongs to the source.
**Fix:** Remove `FeedItem` model + ingest route. Replace with a live-fetch API that fetches on-demand and returns items directly (with caching for rate-limiting, but no persistence).

### 2. Many Parts Don't Work / Are Half-Done
- **Live scan** falls back to demo (DeFiLlama fees endpoint issue)
- **Evidence graph** uses static demo data (not live)
- **Peer benchmarking** uses 8 demo assets (not real market)
- **Thesis engine** doesn't update when data changes
- **Smart Money / Capital Signal** — completely missing
- **Tokenomics Engine** — completely missing
- **Catalyst Engine** — completely missing
- **News → thesis impact pipeline** — not wired

### 3. Missing Features from Original Doc
- P1 §3.2 Capital Signal (Smart Money lite) — not built
- V1.3 Unlock/Tokenomics Engine — not built
- V1.4 Catalyst Engine — not built
- V1.4 Kill Conditions (formal) — not built
- V2 AI Research Copilot — not built
- News → Evidence → Thesis impact pipeline — not wired

---

## Phased Plan

### Phase 1 — Backend: Feed Mirror (no storage)
**Goal:** Feeds fetch + display on-demand, no DB persistence.

- [ ] Remove `FeedItem` model from Prisma schema
- [ ] Remove `POST /api/feeds/ingest` route
- [ ] Remove `GET /api/feeds/items` route (reads from DB)
- [ ] Create `GET /api/feeds/live` — fetches all enabled sources on-demand, returns items directly
- [ ] Add in-memory cache (5-min TTL) to avoid hammering sources on every render
- [ ] Update `FeedsView` to fetch from `/api/feeds/live` instead of `/api/feeds/items`
- [ ] Remove "Refresh" button (auto-fetch on view + 5-min cache refresh)
- [ ] Keep `FeedSource` model (source configs need persistence — addresses, types, enabled)

### Phase 2 — Backend: Fix Live Data Pipeline
**Goal:** Live scan actually uses DeFiLlama/CoinGecko data, not demo fallback.

- [ ] Debug DeFiLlama `overview/fees?all=true` response (returns non-array)
- [ ] Add rate-limit handling for CoinGecko (HTTP 429 → backoff + retry)
- [ ] Fix the live scan path so it produces real engine inputs (currently estimates TC=0.18×PC)
- [ ] Add a "hybrid" mode: if live data available, use it; otherwise fall back to demo per-asset (not global)
- [ ] Persist `Project` records from live data (so detail view works)

### Phase 3 — Backend: Evidence Graph from Live Data
**Goal:** Evidence nodes carry real source/timestamp/freshness, not static demo.

- [ ] `buildEvidence()` should accept live provider data (not just `EngineInputs`)
- [ ] Each evidence node links to the actual provider that supplied the metric
- [ ] Freshness computed from when the data was fetched
- [ ] Contradiction detection: if two providers disagree, flag it

### Phase 4 — Frontend/UX: Complete Half-Done Views
**Goal:** Every view is production-quality, no stubs or "coming soon".

- [ ] Audit each view for stub elements
- [ ] Settings: ensure provider key management actually connects to live providers
- [ ] Detail view: ensure all 9 sections work with live data
- [ ] Discovery: ensure live mode produces real results
- [ ] Comparison: ensure it works with live (not just demo) assets
- [ ] Feeds: mirror mode (Phase 1) + filter tabs + view modes

### Phase 5 — Missing Features (V1.3+)
**Goal:** Build the features that are in the PRD but not yet implemented.

- [ ] P1 §3.2: Capital Signal evidence (Smart Money / Whale / Exchange Flow)
- [ ] V1.3: Unlock/Tokenomics Engine (detailed unlock schedule, emission tracking)
- [ ] V1.4: Catalyst Engine (upcoming events that could change thesis)
- [ ] V1.4: Formal Kill Conditions (automated thesis invalidation)
- [ ] News → Evidence → Thesis impact pipeline

---

## Codebase Metrics

| Layer | Files | Lines |
|---|---|---|
| Engine (pure TS) | 5 | 1,033 |
| Providers | 5 | 652 |
| API routes | 11 | 980 |
| Components | 17 | 3,429 |
| **Total src** | **92** | **11,918** |
| Engine-check assertions | — | 59 |
| i18n keys (en) | — | ~210 |

---

## What's Actually Working (Don't Break These)

1. ✅ Engine math (locked formulas, gate, IA pipeline) — 59 regression tests
2. ✅ Bilingual fa/en with RTL (Vazirmatn font)
3. ✅ Theme toggle (light/dark/system)
4. ✅ Discovery scan (demo mode — 8 assets, ranks, decisions)
5. ✅ Asset detail (9 sections: ranks, components, value chain, supply, gate, explanation, evidence, benchmark, thesis)
6. ✅ Comparison view (2-5 assets, 12 metrics, winner highlighting)
7. ✅ Feeds (Telegram ingestion + images + view modes)
8. ✅ Settings (provider management, feed source config)
9. ✅ Trend sparklines (historical IA_final)
10. ✅ Thesis engine (status gauge, conditions, evidence directions)
11. ✅ Peer benchmarking (percentile bars, Relative IA)
