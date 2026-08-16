/**
 * In-memory cache of the most recent scan's engine inputs.
 * This allows detail/thesis/benchmark routes to serve ANY symbol that was
 * in the most recent scan — not just the 8 hardcoded demoAssets.
 *
 * The cache is populated by /api/scan on every scan request (demo or live).
 * It's process-scoped (in-memory), so it survives across API calls within
 * the same Next.js dev server process.
 */

import type { EngineInputs } from "@/engine";

const CACHE = new Map<string, EngineInputs>();
let lastScanMode: "demo" | "live" = "demo";
let lastScanAt: number = 0;

/** Store engine inputs from a scan result. */
export function cacheScanInputs(inputs: EngineInputs[], mode: "demo" | "live") {
  CACHE.clear();
  for (const input of inputs) {
    CACHE.set(input.symbol.toUpperCase(), input);
  }
  lastScanMode = mode;
  lastScanAt = Date.now();
}

/** Look up a cached engine input by symbol (case-insensitive). */
export function getCachedInput(symbol: string): EngineInputs | null {
  return CACHE.get(symbol.toUpperCase()) ?? null;
}

/** What mode was the most recent scan? */
export function getLastScanMode(): "demo" | "live" {
  return lastScanMode;
}

/** When was the cache last updated? */
export function getLastScanAt(): number {
  return lastScanAt;
}

/** How many assets are cached? */
export function getCachedCount(): number {
  return CACHE.size;
}

/** Return all cached inputs (for benchmark peer set). */
export function getAllCachedInputs(): EngineInputs[] {
  return Array.from(CACHE.values());
}
