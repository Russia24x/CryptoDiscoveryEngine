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

# verify the locked architecture (59 invariants)
bun run engine:check

# lint
bun run lint
```

Open `http://localhost:3000` — the app defaults to Persian (RTL). Use the
language toggle in the header to switch to English (LTR).

---

## Features

### 1. Discovery Scanner (اسکنر کشف بازار)
Runs the locked decision engine across the market and ranks assets by four tiers:
**Fundamental / Confidence / Effective / Market**. Each row shows IA scores,
gate status, decision (BUY/WATCH/INVESTIGATE/AVOID/REJECT), and a trend sparkline
(historical IA_final over recent scans).

**Key features:**
- **Filters**: Search (symbol/name/category), Gate (All/Passed/Failed), Decision (BUY/WATCH/INVESTIGATE/AVOID/REJECT), Category dropdown
- **7d price sparklines**: Mini charts with interactive hover tooltips (keyboard accessible via Arrow Left/Right)
- **Keyboard navigation**: Arrow Up/Down to move between rows, Enter to open detail, Escape to clear focus
- **Watchlist star**: Click the star on any row to add/remove from your watchlist (persisted to localStorage)
- **Sticky table header** with zebra striping
- **Last scan timestamp** with live "Scanning…" indicator
- **Sortable** by Market rank, Fundamental rank, Confidence rank, Effective rank, IA Final, IA Raw

### 2. Asset Detail (جزئیات دارایی)
Click any asset to see:
- **Asset overview panel**: Logo, price, market cap, 24h/7d/30d changes, supply, social links, events
- **Four-tier ranking** (Project Quality ≠ Token Quality ≠ Investment Attractiveness)
- **Component scores** (PQ, TQ, VA, V, R)
- **Value-accrual chain** (GEA → PR → PC → TC, with α, δ, VAE)
- **Supply metrics** (SAR / NSP / FDR)
- **Gate check** (mechanism-aware hard vetoes)
- **Explainable decision** (For / Against / What-changes-the-decision)
- **Evidence graph** (each metric carries source, timestamp, freshness, grade)
- **Peer benchmarking** (percentile vs peers + Relative Investment Attractiveness)
- **Investment thesis** (why it works, what must stay true, what breaks it)
- **Interactive price chart** (SVG area chart with 7d/30d/90d/1y timeframes, hover crosshair + tooltip)
- **Technical analysis** (RSI, MACD, Bollinger Bands, ATR, Stochastic, volume ratio, regime, signal, EV, conformal prediction, risk metrics)
- **Add to Compare** and **Add to Watchlist** buttons

### 3. Comparison (مقایسه دارایی‌ها)
Select 2–5 assets to compare side-by-side across 12+ metrics.

**Key features:**
- **Winner callout banner**: Trophy icon + mini bar chart showing which asset wins the most metric rows
- **Summary cards**: Relative IA scores with remove (X) buttons
- **Comparison matrix**: Percentile cells with color-coding (emerald/lime/amber/red), winner highlighting with trophy
- **Comparison insights**: Auto-generated strength/weakness summary per asset
- **Share comparison**: Deep-link URL with `?compare=` and `?exclude=` params (copies to clipboard + updates address bar)
- **Remove from compare**: X button on each summary card

### 4. Watchlist (فهرست نظارت)
Dedicated view for starred assets.

**Key features:**
- **Compact card layout** (responsive grid: 1/2/3 columns)
- **Smart alerts**: Toast notification when an asset's 7d change exceeds ±5%
- **Sort dropdown**: By added order, name (A-Z), IA score, biggest change, or decision (persisted to localStorage)
- **Export**: CSV and JSON download buttons
- **Interactive sparklines**: With price tooltips
- **Clear all** button
- **Empty state** with "Go to Discovery Scanner" CTA

### 5. Feeds (اخبار و شبکه‌های اجتماعی)
Mirror-mode feed reader — no storage, content belongs to sources.

**Key features:**
- **3 view modes**: Feed (full-width cards), Grid (masonry), Compact (dense rows)
- **Filter chips**: All / RSS / Telegram with live counts
- **Sort**: Newest / Oldest
- **Rich cards**: Full-bleed images, source badges, image count badges, expandable body text
- **RSS sources**: ArzDigital, MihanBlockchain (Persian crypto news)
- **Telegram sources**: Mastersharkcrypto channel
- **HTML entity decoding**: Properly handles `&rlm;` and other RTL entities from Telegram

### 6. Settings (تنظیمات)
- **Data providers**: Free-first (Binance, DeFiLlama, CoinGecko — no key needed)
- **News feeds**: Add/manage RSS + Telegram sources
- **Data management**: Clear watchlist + compare set with two-step confirm
- **Theme**: Light / Dark / System

### 7. Command Palette (Cmd+K / Ctrl+K)
Global quick-search & navigation dialog:
- Search assets by symbol/name/category
- Navigate to any view (Discovery, Watchlist, Compare, Feeds, Settings)
- Reads `?q=` URL param for pre-filled search (deep links)
- Keyboard-driven (arrow keys + Enter)

### 8. Provider Status Badge
- Amber badge in header when data providers (CoinPaprika/CoinGecko) are rate-limited
- Auto-refreshes every 30s
- Hidden when all providers are healthy (clean UI)

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
  engine/              # Pure-TS decision engine (LOCKED formulas)
    index.ts           #   PQ/TQ/VA/V/R/IA/C/M pipeline + gate + explain (17 exports)
    ranking.ts         #   four-tier ranking
    percentile.ts      #   peer benchmarking + comparison matrix
    technical.ts       #   RSI, MACD, BB, ATR, Stochastic, EV, conformal, risk (23 exports)
    thesis.ts          #   investment thesis engine
    ingest.ts          #   RSS + Telegram feed parser

  providers/           # Data providers (3-tier price chain)
    types.ts           #   DataProvider interface + safeJsonFetch with rate-limit detection
    binance.ts         #   REAL-TIME prices + klines (1200 weight/min) + getBinanceHistorical
    defillama.ts       #   free, key-less (TVL, fees, revenue, category)
    coingecko.ts       #   free, key-less (MC, FDV) + getCoingeckoHistorical fallback
    coinpaprika.ts     #   metadata + price history (60 req/hr) + circuit breaker
    demo-data.ts       #   8 sample assets exercising every engine branch
    registry.ts        #   provider registry

  lib/                 # Shared infrastructure
    circuit-breaker.ts #   rate-limit detection + 5-min cooldown
    price-cache.ts     #   TTL-based in-memory cache (10 min, shared across users)
    scan-cache.ts      #   in-memory scan result cache
    use-local-storage.ts # SSR-safe localStorage hook (useSyncExternalStore)
    comparison-helpers.ts
    format.ts          #   fmtUsd, fmtPct, fmtScore, barColor, decisionClass
    export.ts          #   CSV/JSON export utilities
    db.ts              #   Prisma client
    utils.ts

  app/
    [locale]/          # i18n routes (fa RTL / en LTR)
    api/               # 15 endpoints:
      scan/            #   run full market scan (100 assets)
      assets/          #   list cached assets (for compare picker + command palette)
      status/          #   circuit breaker status (for provider badge)
      trend/           #   batch IA_final trend (sparklines)
      price-history/   #   single-asset price history
      price-history-batch/ # batch 7d prices (provider chain: Paprika→Gecko→Binance)
      compare/          #   comparison matrix
      technical/       #   RSI/MACD/signal/risk (Binance klines)
      projects/        #   asset detail data
      thesis/          #   investment thesis
      benchmark/       #   peer benchmarking
      coin-info/       #   metadata + social + events
      logos/           #   asset logos
      feeds/           #   feed sources CRUD
      feeds/live/      #   live feed ingestion (5-min cache)
      providers/       #   data provider management

  components/          # 22 React components
    discovery-view.tsx #   main scanner table with filters, search, keyboard nav
    detail-view.tsx    #   asset detail with all panels
    comparison-view.tsx #  comparison matrix + insights + winner callout
    watchlist-view.tsx #   dedicated watchlist with sort + export + alerts
    feeds-view.tsx     #   3-mode feed reader
    settings-view.tsx  #   provider + feed + data management
    command-palette.tsx #  Cmd+K dialog
    price-chart-card.tsx # interactive SVG area chart
    sparkline.tsx      #   mini chart with interactive tooltips
    provider-status-badge.tsx # rate-limit indicator
    app-header.tsx     #   sticky nav with 5 views + Cmd+K
    app-footer.tsx
    app-shell.tsx      #   view router + command palette
    ... (11 more)

  i18n/                # next-intl routing + request config
  messages/            # fa.json + en.json (370+ keys each)

scripts/
  engine-check.ts      # regression guard (59 invariants)

docs/
  ARCHITECTURE.md     # LOCKED v2 reference (formulas, gate, weights)
  PRD.md              # product requirements + roadmap

prisma/
  schema.prisma       # 8 models: Provider, Project, Metric, Evidence, Thesis, Scan, ScanRow, FeedSource
```

---

## Provider chain (3-tier fallback)

Price data flows through a resilient 3-tier provider chain:

```
CoinPaprika (primary)
  ↓ on rate-limit (402) or not found
CoinGecko (fallback 1)
  ↓ on rate-limit (429) or not found
Binance (fallback 2, Binance-listed only)
```

**Circuit breaker**: When a provider returns 429/402, it's "tripped" for 5 minutes — subsequent calls skip it entirely and go directly to the next provider. This prevents wasted API calls during rate-limit periods.

**Server-side cache**: Price history is cached for 10 minutes in-memory (shared across all users/requests). Both successful results and nulls (asset not found) are cached to prevent retries.

**Rate limits**:
- CoinPaprika: 60 requests/hour (free tier)
- CoinGecko: ~50 requests/minute (free tier)
- Binance: 1200 weight/minute (effectively unlimited for our use case)

---

## Bilingual (fa / en)

- Persian (`fa`) is RTL, English (`en`) is LTR. The `<html dir>` attribute
  flips automatically via `next-intl`.
- Persian typography uses **Vazirmatn** (loaded via `next/font/google`).
- Every user-facing string lives in `src/messages/{fa,en}.json` — no
  hardcoded UI strings. 370+ keys per language.

---

## Accessibility

- **`prefers-reduced-motion`**: Disables all CSS animations and transitions for users who prefer reduced motion
- **Keyboard navigation**: Arrow keys in discovery table, Cmd+K command palette, Arrow Left/Right on sparklines
- **ARIA labels**: Table rows, sparklines, buttons all have descriptive aria-labels
- **Screen reader support**: Semantic HTML, sr-only captions, focus indicators
- **Tab navigation**: All interactive elements are keyboard-accessible

---

## Free-first, key-ready

- **Free, key-less**: Binance (real-time prices + klines), DeFiLlama (TVL/fees/revenue), CoinGecko (market/supply), CoinPaprika (metadata + price history)
- **Key-based (add later)**: CoinMarketCap, Messari, Nansen — same `DataProvider` interface, only the adapter + an API-key field change.
- The provider registry auto-registers built-ins; paid providers flow through automatically with zero engine changes.

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
bun run engine:check   # 59 invariants: formulas, gate, percentiles, formatting, trend ordering, thesis
bun run lint           # ESLint (0 errors expected)
npx tsc --noEmit       # TypeScript strict-mode type check (0 errors expected)
bun run build          # Next.js production build (verifies everything end-to-end)
```

The `engine:check` script asserts the locked architecture — any change to the
formulas, gate thresholds, or percentile logic will fail immediately.

### Quality gates (all green)
- `tsc --noEmit` → 0 errors
- `bun run lint` → 0 errors, 23 warnings (all benign: unused `_` params, unused imports)
- `bun run engine:check` → 59/59 invariants pass
- `bun run build` → exit 0, clean compile

---

## Handover & worklog

See [`worklog.md`](worklog.md) for the living handover document — current project
status, completed modifications, verification results, and next-phase
recommendations. Append-only; newest entries at the bottom.

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
- **V1.3** ✅ Feeds (RSS + Telegram), command palette, watchlist, price charts, technical analysis
- **V1.4** ✅ Thesis Engine + Catalyst + smart alerts + export + keyboard nav
- **V2**   🔲 AI research copilot + continuous monitoring + auto-refresh
