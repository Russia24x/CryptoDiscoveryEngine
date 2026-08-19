import { NextResponse } from "next/server";
import { isTripped, getCooldownMs } from "@/lib/circuit-breaker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/status
// Returns the current status of provider circuit breakers + price cache.
// Used by the frontend to show a "rate-limited" badge when providers are
// temporarily unavailable.
export async function GET() {
  const providers = ["coinpaprika", "coingecko"];
  const circuits = providers.map((name) => ({
    name,
    tripped: isTripped(name),
    cooldownMs: getCooldownMs(name),
  }));

  const anyTripped = circuits.some((c) => c.tripped);

  return NextResponse.json({
    circuits,
    anyTripped,
    timestamp: new Date().toISOString(),
  });
}
