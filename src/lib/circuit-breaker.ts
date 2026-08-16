/**
 * Circuit breaker for rate-limited API providers.
 *
 * When a provider returns 429 (Too Many Requests) or 402 (Payment Required),
 * we "trip" the circuit — subsequent calls to that provider are short-circuited
 * for a cooldown period (default 5 min) instead of making wasted requests.
 *
 * This is especially important for CoinPaprika (60 req/hour free tier) and
 * CoinGecko (~10-50 req/min free tier). Without a circuit breaker, every
 * batch request would make 10+ failed calls before falling back.
 *
 * Usage:
 *   if (!isTripped("coinpaprika")) {
 *     try { ... } catch (e) {
 *       if (isRateLimitError(e)) trip("coinpaprika", 5 * 60 * 1000);
 *     }
 *   }
 */

interface CircuitState {
  trippedUntil: number; // epoch ms — don't call the provider until this time
  tripCount: number;    // how many times the circuit has tripped (for debugging)
}

const circuits = new Map<string, CircuitState>();

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 min

/**
 * Check if a provider's circuit is currently tripped (should be skipped).
 * Returns true if the provider should NOT be called.
 */
export function isTripped(provider: string): boolean {
  const state = circuits.get(provider);
  if (!state) return false;
  if (Date.now() >= state.trippedUntil) {
    // Cooldown expired — allow calls again
    circuits.delete(provider);
    return false;
  }
  return true;
}

/**
 * Trip a provider's circuit — subsequent isTripped() calls return true
 * until the cooldown expires.
 */
export function trip(provider: string, cooldownMs = DEFAULT_COOLDOWN_MS): void {
  const prev = circuits.get(provider);
  circuits.set(provider, {
    trippedUntil: Date.now() + cooldownMs,
    tripCount: (prev?.tripCount ?? 0) + 1,
  });
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[circuit-breaker] ${provider} tripped for ${Math.round(cooldownMs / 1000)}s ` +
      `(trip #${(prev?.tripCount ?? 0) + 1})`,
    );
  }
}

/**
 * Check if an HTTP status code indicates rate-limiting (429 or 402).
 * Used to decide whether to trip the circuit.
 */
export function isRateLimitStatus(status: number): boolean {
  return status === 429 || status === 402;
}

/**
 * Get the remaining cooldown time in ms (for debugging / UI display).
 * Returns 0 if not tripped.
 */
export function getCooldownMs(provider: string): number {
  const state = circuits.get(provider);
  if (!state) return 0;
  return Math.max(0, state.trippedUntil - Date.now());
}

/**
 * Reset a specific provider's circuit (for manual retry).
 */
export function reset(provider: string): void {
  circuits.delete(provider);
}

/**
 * Reset all circuits (for testing).
 */
export function resetAll(): void {
  circuits.clear();
}
