# CryptoSieve — Deep Audit Round 2 (Code / Performance / Architecture)

> Generated: 2026-08-27 — Senior Developer session 2
> Scope: full-repo deep audit — code quality & security, performance, architecture &
> infrastructure, plus bug/typo/wrong-path/wrong-engineering sweep.
> Method: fresh clone at `16ff5c2`, all quality gates re-verified green
> (engine:check 59/59, tsc 0 errors, eslint 0 errors/23 warnings, `next build` pass),
> then line-by-line review of engine, providers, lib, all 17 API routes, and
> representative UI, plus automated i18n-parity and dependency-usage analysis.

---

## Executive Summary

The **core is healthy**: locked engine math (59 regression invariants), pure-TS
engine/providers (Rule 8 clean), perfect i18n parity (449 = 449 keys fa/en),
working build. However this round found **30 issues (5 P1 security/bug, 25 P2)**
that keep the project below production grade. The dominant themes:

1. **SSRF defense is one-sided** — validation happens on *write* (feed source
   creation) but the *fetch path* never re-validates, and two inconsistent
   validators exist.
2. **Input validation gaps** on query params cause 500s with leaked internals.
3. **API-budget waste** — the logos endpoint makes up to 40 CoinPaprika calls
   per request (60/hour budget!) where 1 call/hour suffices.
4. **Carry weight from the shadcn template** — ~15 unused npm deps, 30+
   unused UI components, template test scripts (Python runtime!), template
   package name.
5. **Refetch storm** — discovery table re-queries trend/price APIs on every
   search keystroke.

---

## A. Code Audit — Security & Correctness

### A1. [P1 · SECURITY] SSRF: fetch path never validates the initial URL
`src/engine/ingest.ts` — `fetchText()` calls `fetch(url)` on any address stored
in the DB. `isUrlSafeForFetch()` is only applied to **redirect targets**, never
to the original URL. `POST /api/feeds` validates on write, but `GET
/api/feeds/live` re-fetches stored addresses with **no read-time check**.
Defense-in-depth is violated: any path that writes the DB directly (seeding,
import, future admin UI) becomes instant SSRF.
**Fix:** validate the initial URL inside `fetchText()` before fetching.

### A2. [P1 · BUG] Broken redirect status check
`src/engine/ingest.ts:55` — `if (!redirectRes.ok && redirectRes.status < 300)
return null;` The condition is almost never true (non-ok means ≥400, which is
not <300), so error pages (500) are returned as feed content and further
redirects are followed one extra hop as text. **Fix:** `if (!redirectRes.ok)
return null;`.

### A3. [P1 · BUG] Unvalidated query params → 500s with leaked internals
- `technical/[symbol]` — `interval` is interpolated into the Binance URL
  **unencoded** (parameter injection: `interval=1d%26limit=3D99999`); `limit`
  becomes `NaN` and is sent as-is; Binance 400s are misreported as
  `404 not_on_binance`.
- `price-history/[symbol]` — `days=abc` → `NaN` passes the clamp →
  `new Date(NaN).toISOString()` throws → 500 leaks `"Invalid time value"`.
- `trend` (POST) — non-string symbol entries crash `s.toUpperCase()` → 500
  leaks the TypeError.
**Fix:** whitelist/`Number.isFinite` validation + `encodeURIComponent`.

### A4. [P2 · SECURITY] Error internals leaked to clients
Five routes return raw `e.message`/`String(e)` in 500 bodies (trend,
technical, coin-info, price-history, feeds). Prisma errors can expose file
paths and SQL. **Fix:** shared error envelope, log details server-side.

### A5. [P2 · BUG] Trend "latest N" ordered by cuid string
`trend/route.ts`, `trend/[symbol]/route.ts` order by `id: "desc"` — cuid
lexicographic order is **not chronological**. The scan route itself correctly
uses `finishedAt`. **Fix:** `orderBy: { scan: { finishedAt: "desc" } }`.

### A6. [P2 · BUG] detail-view infinite skeleton
`detail-view.tsx` — `isStub` stays true when the projects query errors (symbol
not in scan cache after restart), so `showLoading` is permanently true and the
error banner can never render. **Fix:** `showLoading = isLoading || (isStub &&
!isError)`.

### A7. [P2 · BUG] coin-info ignores `defillamaSlug`
`Project.defillamaSlug` exists in the Prisma schema but is never read; the
route fabricates the protocol link from the ticker (`sym.toLowerCase()`),
producing broken external links (HYPE → `hype` instead of `hyperliquid`).

### A8. [P2 · BUG] Race condition in rate-limit side-channel
`src/providers/types.ts` — `safeJsonFetch.lastRateLimitStatus` is a mutable
static shared by all providers and all concurrent requests: a 429 from
CoinGecko can trip the CoinPaprika breaker of a parallel scan. Should be
returned per-call.

### A9. [P2 · BUG] settings-view queries skip `r.ok`
`providers`/`feeds` queries don't check response status (mutations in the same
file do), so API failures silently render empty lists.

### A10. [P2 · BUG] FeedForm clears inputs before mutation resolves
User input is lost when `addFeed` fails. Clear in `onSuccess` instead.

---

## B. Performance Audit

### B1. [P1 · API-BUDGET] Logos route N+1 — 40 calls where 1 suffices
`logos/route.ts` makes **two sequential CoinPaprika calls per symbol**
(search + coin detail) → up to 40 calls/request against a **60/hour** free
tier, with no circuit-breaker integration. `/v1/coins` returns the full
symbol→logo list in **one** call (cacheable for 1h). Also: unbounded cache
(two parallel Maps, no eviction), and symbols beyond 20 silently get `null`.
**Fix:** single `/v1/coins` fetch + 1h symbol→logo map; drop the per-symbol
search/detail chain.

### B2. [P1 · UX] Discovery refetch storm per keystroke
`discovery-view.tsx` derives `trendSymbols`/`priceTopSymbols` from
`filteredRows` (changes on every keystroke) → query keys change per keypress →
one `POST /api/trend` (up to 100 symbols, DB `take: 2000`) + one
`POST /api/price-history-batch` per keypress. **Fix:** key the batch queries
off `data.rows` (stable) and filter client-side.

### B3. [P2] Unbounded in-memory caches
- `price-cache.ts` — expired entries only evicted lazily on read; never-read
  keys accumulate forever (symbol is an unvalidated path param → attacker can
  grow the key space). Add a sweep on `setCached` + size cap.
- `coinpaprika.ts` `idCache` — no TTL, no cap; a wrong mapping persists
  forever.

### B4. [P2] Install/bundle bloat — unused dependencies
Verified unused (no imports anywhere in src/scripts/configs):
`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`,
`@hookform/resolvers`, `@mdxeditor/editor`, `@reactuses/core`,
`@tanstack/react-table`, `date-fns`, `embla-carousel-react`, `next-auth`,
`react-markdown`, `react-syntax-highlighter`, `uuid`, `z-ai-web-dev-sdk`,
`zod`, `zustand` (+ `sharp` if `next/image` is unused). Each is install time,
audit surface, and CVE exposure for zero value. `prisma` (CLI) belongs in
`devDependencies` — only `@prisma/client` is runtime.

### B5. [P2] 30+ unused shadcn UI components
accordion, alert-dialog, alert, aspect-ratio, avatar, breadcrumb, calendar,
chart, checkbox, collapsible, context-menu, drawer, form, hover-card,
input-otp, menubar, navigation-menu, pagination, popover, progress,
radio-group, resizable, scroll-area, sidebar, slider, table, tabs, textarea,
toggle-group — never imported by app code (some only by each other). Deleting
them transitively frees more radix deps.

---

## C. Architecture & Infrastructure Audit

### C1. [P1 · WRONG PATHS] RULES.md references directories that don't exist
The project's "source of truth" (`RULES.md` Rule 5/Rule 8) says
`src/lib/providers/` and `src/lib/engine/` — the real paths are
`src/providers/` and `src/engine/`. Every future agent reading RULES.md first
will look in the wrong place. **Fix:** correct RULES.md (or move the code —
docs fix is cheaper and the engine path is already load-bearing).

### C2. [P1 · DEAD CODE in route file] `providers/route.ts` exports non-route functions
`getProviderApiKey`/`buildProviderAuth` are exported from a Next.js route
module — an invalid location for App Router route files (only HTTP handlers +
config are valid). Nobody imports them (verified). They are useful for the
key-ready architecture, so **move to `src/lib/provider-auth.ts`** and import
from there when needed.

### C3. [P2] scan route positional coupling
`scan/route.ts` assumes `lists[0]=binance, lists[1]=defillama,
lists[2]=coingecko` by array position. Correct today (registry sorts by
priority), but adding any provider with priority <20 silently corrupts the
merge. **Fix:** look up by slug.

### C4. [P2] Template leftovers (wrong engineering provenance)
- `tests/python-runtime-*.sh`, `tests/database-runtime-build.sh` — Python
  container build scripts from the original template; this project has no
  Python runtime. Misleading "tests" that never run.
- `examples/websocket/` — template example, not wired to anything.
- `download/README.md` — template artifact.
- `package.json` `name: "nextjs_tailwind_shadcn_ts"` — still the template
  name, not the project.

### C5. [P2] Missing `.env.example`
`.env*` is gitignored but no example file documents required vars
(`DATABASE_URL`, optional `ENCRYPTION_KEY`). A fresh clone cannot run without
tribal knowledge. **Fix:** add `.env.example` + README section.

### C6. [P2] Divergent API error shapes
Five different error envelope shapes across routes (see A4). Adopt one
`{ error: code, message? }` envelope via a shared helper.

### C7. [P2] Duplication
- Trend row→point mapping duplicated in `trend` and `trend/[symbol]`.
- `deleteFeed` mutation duplicated (feeds-view / settings-view);
  `FeedIcon` ≡ `SourceIcon`; watchlist toggle duplicated
  (discovery-view / detail-view).
- Two different SSRF validators (`feeds/route.ts` `isUrlSafe` is weaker —
  misses hex/octal IP encodings and IPv4-mapped IPv6; `ingest.ts`
  `isUrlSafeForFetch` is thorough). Extract one shared `lib/url-safety.ts`.

### C8. [P2] eslint — 23 unused-vars warnings
Leftover variables in engine/providers/components. Zero errors, but warnings
hide future signal; clean them and tighten the config later.

### C9. [P2] Minor smells
- `crypto.ts` `isEncrypted()` — `Buffer.from(v, "base64")` never throws, so
  the heuristic accepts nearly any ≥29-char string (documented, acceptable).
- `discovery-view` logo `onError` mutates DOM imperatively; use state.
- Logos cache uses two parallel Maps instead of one entry object.

---

## Verified clean (do not re-litigate)

- Engine math & 59 invariants; percentile edge cases; ranking tie-handling.
- Rule 8 (engine/providers import zero React/Next) — verified by grep.
- i18n: 449 keys in both catalogs, zero missing, only 3 identical values
  (brand name + "RSS") — legitimate.
- `status`, `assets`, `command-palette` routes — clean.
- Scan persistence transaction + 100-scan retention — correct.
- `feeds/live` mirror mode (no storage) — matches the product decision.
- `price-history-batch` cache + parallel fallback chain — well designed.

---

## Fix Plan (this session)

| # | Fix | Files | Risk |
|---|-----|-------|------|
| 1 | SSRF: validate initial URL in `fetchText` + fix redirect check; extract shared validator | `engine/ingest.ts`, `api/feeds/route.ts` | low |
| 2 | Validate `interval`/`limit`/`days`/`symbols`; encode URL parts | `technical`, `price-history`, `trend` routes | low |
| 3 | detail-view loading fix | `detail-view.tsx` | low |
| 4 | Move dead exports → `src/lib/provider-auth.ts` | `api/providers/route.ts` | low |
| 5 | Logos: single `/v1/coins` fetch + 1h map cache + breaker | `api/logos/route.ts` | med |
| 6 | Trend: type-check symbols + `orderBy scan.finishedAt` | `trend` routes | low |
| 7 | Discovery: stable batch query keys | `discovery-view.tsx` | low |
| 8 | RULES.md path fix, package.json rename, `.env.example` | docs/config | low |
| 9 | Delete template leftovers + unused UI components (transitive) + unused deps | many | low |
| 10 | coinpaprika idCache TTL+cap; settings r.ok; FeedForm onSuccess | providers/UI | low |
| 11 | eslint unused-vars cleanup | 6 files | low |

Deferred (proposal needed): unified error envelope (C6), UI dedup hooks (C7),
coin-info defillamaSlug data flow (A7), `safeJsonFetch` side-channel rework
(A8) — each is a small refactor but touches many routes; do them as follow-up
commits, not mixed into the stabilization pass.
