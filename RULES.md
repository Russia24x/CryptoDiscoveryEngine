# CryptoSieve — Engineering Rules (MANDATORY)

These rules are non-negotiable. Every session MUST follow them before any change.

---

## RULE 1 — NEVER-FORCE-PUSH

`git push --force` (and `--force-with-lease`) is **absolutely forbidden**.

- If a normal `git push` is rejected (non-fast-forward):
  1. **STOP immediately.**
  2. Report the rejection to the user.
  3. **Wait for the user's decision.** Do NOT force.
  4. The only acceptable resolution is to `git fetch` + `git pull --rebase` (or merge) and then push again normally — and even that requires user confirmation if divergence is non-trivial.

Rationale: force-push destroys history on the shared remote and breaks the soft-lock contract that GitHub is the source of truth.

---

## RULE 2 — SESSION-START-SYNC-CHECK

At the **start of every session** (and after any time gap / new message), BEFORE making any new change:

```
a. git fetch origin
b. git status
```

- If the output shows **"behind"** or **"diverged"** from `origin/main`:
  1. **STOP immediately.**
  2. Report the exact divergence to the user.
  3. Do NOT proceed with new work until reconciled.

- If the output is **clean / up-to-date** with `origin/main`:
  - Proceed with new work normally.

Rationale: the sandbox/container filesystem can drift from GitHub. GitHub is the canonical source of truth, so every session must begin by confirming local == origin/main.

---

## RULE 3 — COMMIT DISCIPLINE

- Commit **everything** you build through this key. GitHub is the future-proof backup.
- Never commit secrets (`.env`, PAT tokens). The PAT lives only in `.git/config` remote URL.
- Write clear, conventional commit messages.
- Prefer many small commits over one giant commit.

---

## RULE 4 — FREE-FIRST, KEY-READY

- The system currently runs on **free, key-less APIs** (DeFiLlama, CoinGecko public, etc.).
- All data-provider code MUST be written so that **key-based providers** (CoinMarketCap, Messari, Nansen, etc.) can be added later via the same provider interface — only the adapter + an API-key field change.
- Never hard-code a paid endpoint as if it were the only path.

---

## RULE 5 — BILINGUAL BY DESIGN

- Every user-facing string lives in the i18n dictionaries (`fa` + `en`).
- Persian (`fa`) is RTL, English (`en`) is LTR. The document `<dir>` attribute MUST flip accordingly.
- No hardcoded UI strings in components.

---

## RULE 6 — PLATFORM-AGNOSTIC ARCHITECTURE

- The core engine (formulas, data providers, scoring) MUST be pure TypeScript with zero DOM/Next.js coupling, so it can be reused in:
  - Mobile (React Native / Expo)
  - Desktop (Tauri / Electron)
  - CLI
- UI is a thin presentation layer over the engine.

---

## Locked Architecture Reminder

The Investment Attractiveness framework is **LOCKED** (see `docs/ARCHITECTURE.md`).

```
Gate → PQ → TQ → VA → V → R → IA_raw → C → IA_effective → M → IA_final
```

```
IA_raw       = (PQ^0.20 · TQ^0.25 · VA^0.20 · V^0.35) / R_safe^0.15
IA_effective = IA_raw × C
IA_final     = IA_raw × C × M
C ∈ [0.70, 1.00]   M ∈ [0.90, 1.10]   R_safe = max(R, 1)
```

Do not change the exponents, weights, or gate thresholds without explicit user sign-off.
