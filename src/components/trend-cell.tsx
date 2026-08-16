"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkline } from "./sparkline";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendPoint {
  t: string | null;
  iaFinal: number;
  iaRaw: number;
  iaEffective: number;
  confidence: number;
  decision: string | null;
}

/**
 * Fetches the historical IA_final series for a symbol and renders a sparkline.
 * Shows a skeleton while loading, a flat line if no history yet (first scan).
 */
export function TrendCell({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery<{ points: TrendPoint[] }>({
    queryKey: ["trend", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/trend/${symbol}`);
      if (!r.ok) return { points: [] };
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-4 w-12" />;
  }

  const values = (data?.points ?? []).map((p) => p.iaFinal);
  return <Sparkline values={values} width={48} height={16} />;
}
