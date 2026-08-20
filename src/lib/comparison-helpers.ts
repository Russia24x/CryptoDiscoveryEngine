import { demoAssets } from "@/providers/demo-data";
import { getAllCachedInputs } from "@/lib/scan-cache";
import type { EngineInputs } from "@/engine";

/** Get the list of assets available for comparison. Uses scan cache (live data). */
export function getComparisonAssets(): EngineInputs[] {
  const cached = getAllCachedInputs();
  return cached.length > 0 ? cached : demoAssets;
}

/** Get the peer count for comparison display. */
export function getComparisonPeerCount(): number {
  const cached = getAllCachedInputs();
  return cached.length > 0 ? cached.length : demoAssets.length;
}
