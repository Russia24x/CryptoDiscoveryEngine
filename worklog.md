# CryptoSieve — Project Worklog

> Source of truth for development continuity. Every agent reads this before
> working and appends a new section after finishing.

---
Task ID: 1
Agent: main (orchestrator)
Task: Build the CryptoSieve Crypto Investment Decision Engine v1.1 — locked architecture, bilingual fa/en RTL, free-first/key-ready providers, market-wide discovery scan, four-tier ranking, explainable decision, evidence graph.

Work Log:
- SESSION-START-SYNC-CHECK: ran `git fetch origin` + `git status`. Remote was empty (fresh repo), local had 1 initial commit — no divergence. Proceeded.
- Configured git remote with provided PAT (stored in `.git/config` only, never committed).
- Created `RULES.md` with the two mandatory rules (NEVER-FORCE-PUSH, SESSION-START-SYNC-CHECK) + free-first, bilingual, platform-agnostic rules.
- Created `docs/ARCHITECTURE.md` — the LOCKED v2 reference (formulas, gate, VAE chain, component weights, supply triple, confidence, regime, four-tier ranking, decision contract, roadmap).
- Created `docs/PRD.md` — product positioning as "Crypto Investment Decision Engine".
- Prisma schema (`prisma/schema.prisma`): Provider, Project, Metric, Evidence, Thesis, Scan, ScanRow, FeedSource, FeedItem. Pushed to SQLite.
- Core engine (`src/engine/index.ts`) — pure TypeScript, platform-agnostic. Implements the locked pipeline: Gate → PQ → TQ → VA → V → R → IA_raw → C → IA_effective → M → IA_final. Includes valueAccrualChain (GEA→PR→PC→TC, α, δ, VAE), supplyMetrics (SAR/NSP/FDR), evaluateGate (mechanism-aware: VAE<10, δ<5, R>90 universal + SAR<0.1 conditional on buyback_burn), confidence [0.70,1.00], regime [0.90,1.10], explain() plain-language decision output.
- Ranking utility (`src/engine/ranking.ts`) — four-tier ranking (Fundamental/Confidence/Effective/Market).
- Data providers (`src/providers/`): `types.ts` (DataProvider interface, registry, safeJsonFetch), `defillama.ts` (free, key-less), `coingecko.ts` (free, key-less), `registry.ts`, `demo-data.ts` (8 sample assets following the locked architecture, exercises every branch).
- i18n: `src/i18n/routing.ts` (fa default + en, as-needed prefix), `src/i18n/request.ts` (v4 API with requestLocale), `src/proxy.ts` (Next 16 proxy convention, replaces deprecated middleware), messages `en.json` + `fa.json`.
- Modern design system in `globals.css`: emerald accent (no indigo/blue), glass morphism, grid-bg, glow, shimmer, custom scrollbar, RTL font stack.
- API routes: `/api/scan` (demo + live modes, runs engine, ranks, persists Scan record), `/api/projects/[symbol]` (full detail + evidence graph), `/api/providers` (CRUD, seeds DeFiLlama/CoinGecko/CMC/Messari), `/api/feeds` (CRUD for RSS/Telegram/X future hooks).
- UI components: app-shell (view switching with framer-motion), app-header (sticky glass, nav, language + theme toggles), app-footer (sticky bottom), discovery-view (scan controls + sortable ranked table), detail-view (four rank cards, component bars, value-accrual chain viz, supply metrics, gate check, explainable decision for/against/what-changes, evidence graph), settings-view (provider cards with key management + add-provider form + feeds form), decision-badge, theme-toggle, language-toggle, query-provider.
- Layout (`src/app/[locale]/layout.tsx`): RTL/LTR per locale, ThemeProvider (next-themes, dark default), NextIntlClientProvider, QueryProvider, Sonner toaster.
- Fixed: next-intl v4 plugin in next.config.ts (was causing "Couldn't find next-intl config file"), renamed middleware→proxy (Next 16 convention), added allowedDevOrigins, fixed VAE unit bug (was comparing ratio vs percent threshold, rejected everything — now VAE is percent throughout), fixed missing i18n keys (detail.colIARaw → discovery.colIARaw).

Stage Summary:
- Dev server runs on port 3000 (Next 16 Turbopack), HTTP 200, no runtime/console errors.
- Lint passes clean (`bun run lint` — zero errors).
- agent-browser verified: discovery table renders 8 ranked assets (AAVE #1 market rank, INVESTIGATE; UNI REJECT — correctly gated because TC=0→VAE=0%), detail view shows all sections (four ranks, components, value chain, supply, gate, explainable decision, evidence graph), language toggle switches fa↔en with correct RTL/LTR dir, settings shows providers + feeds.
- Architecture is LOCKED per docs/ARCHITECTURE.md. Engine is pure TypeScript (reusable on mobile/desktop/CLI).
- Free-first: DeFiLlama + CoinGecko work key-less. Provider registry supports key-based (CMC/Messari) via same interface — only adapter + API-key field change.
- Feeds (RSS/Telegram/X) are scaffolded in schema + settings UI but ingestion is reserved for future versions per PRD.
- Next: commit to GitHub, then create the 15-min recurring webDevReview cron task.
