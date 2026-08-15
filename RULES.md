# CryptoSieve — Project Rules

> **Source of truth for every agent and human contributor working on this repository.**
> These rules are **non-negotiable**. If any rule conflicts with a later instruction, the later instruction must explicitly cite and override the rule by name.

---

## Rule 1 — NEVER-FORCE-PUSH

`git push --force`, `git push -f`, `git push --force-with-lease`, and any variant are **absolutely forbidden**.

- If a normal `git push` is rejected (non-fast-forward):
  1. **STOP immediately.** Do not attempt any force push.
  2. **Report** the rejection to the user (show the exact error).
  3. **Wait** for the user's decision before taking any further git action.
- Never run `git rebase` that rewrites already-pushed history without explicit user approval.
- Rationale: this repository is the canonical backup of the project. Force-pushing destroys history and can permanently lose verified commits.

---

## Rule 2 — SESSION-START-SYNC-CHECK

At the **start of every session** (and after any meaningful time gap), **before** making any new change to the repository:

1. Run `git fetch origin`
2. Run `git status` (and `git status -sb`)
3. Check the result:
   - If local is **"behind"** `origin/main` → **STOP immediately**, report, and wait.
   - If local is **"diverged"** from `origin/main` → **STOP immediately**, report, and wait.
   - If local is **"ahead"** (clean, up-to-date, or ahead-only) → safe to proceed.
4. Only after confirming the local tree matches (or is ahead of) the last verified commit on GitHub may you continue with new work.

This guarantees that the local container and GitHub never silently drift apart — GitHub is the durable source of truth, not the local sandbox.

---

## Rule 3 — GitHub is Canonical

The sandbox/container environment can break or be reset at any time. Therefore:

- **Commit early, commit often.** Every meaningful unit of work → a commit.
- **Push after each commit** (normal push only — see Rule 1).
- If the container is lost, the project must be fully recoverable from `git clone`.
- The opening/founding document (`docs/PRD.md`) and these `RULES.md` must always be present in the repo.

---

## Rule 4 — Architecture is Locked

The decision-engine architecture defined in `docs/PRD.md` (Section: Locked Formula) is **architecturally locked**:

```
Gate → PQ → TQ → VA → V → R → IA_raw → C → IA_effective → M → IA_final
```

The formulas (`IA_raw`, `IA_effective`, `IA_final`, `VAE = α × δ`, the four ranks) must not be silently changed. Any change to the math requires:

1. An explicit proposal documenting *why*.
2. User approval.
3. A versioned update to `docs/PRD.md` with the old and new formula.

---

## Rule 5 — Free-First, Key-Ready

- All integrations default to **free, no-key APIs** (CoinGecko public, DeFiLlama public).
- The provider abstraction (`src/lib/providers/`) must support **optional API keys** so paid providers (CoinMarketCap, Messari, etc.) can be added later without refactoring.
- Never hardcode a paid API key. Keys are stored in the DB / env and managed via the Settings UI.

---

## Rule 6 — Bilingual by Design (FA-RTL / EN-LTR)

- Every user-facing string must go through `next-intl` message catalogs (`fa.json`, `en.json`).
- Persian (default) renders RTL; English renders LTR. The `<html dir>` attribute must reflect the active locale.
- No hardcoded English or Persian strings in components.

---

## Rule 7 — Evidence > Narrative

The product philosophy: every score, every decision, every thesis statement must be backed by **traceable evidence** (source, timestamp, freshness, confidence, grade). Narrative without evidence is explicitly rejected by the engine.

---

## Rule 8 — Future-Portable Architecture

The core engine (`src/lib/engine/`) and types must be framework-agnostic pure TypeScript so the same logic can later power:

- A mobile app (React Native / Expo)
- A desktop app (Tauri / Electron)
- A CLI tool
- A different web framework

UI code stays in `src/app/` and `src/components/`; engine code stays in `src/lib/engine/` and must not import React or Next.js.

---

## Quick Reference

| # | Rule | One-liner |
|---|------|-----------|
| 1 | NEVER-FORCE-PUSH | Never `--force`. Rejected push → STOP & report. |
| 2 | SESSION-START-SYNC-CHECK | `git fetch` + `git status` before any new work. |
| 3 | GitHub is Canonical | Commit + push every unit of work. |
| 4 | Architecture is Locked | Formula changes need explicit approval. |
| 5 | Free-First, Key-Ready | Free APIs default; keys optional & pluggable. |
| 6 | Bilingual by Design | All strings via `next-intl`; FA-RTL / EN-LTR. |
| 7 | Evidence > Narrative | Every score backed by traceable evidence. |
| 8 | Future-Portable | Engine = pure TS, no React/Next imports. |
