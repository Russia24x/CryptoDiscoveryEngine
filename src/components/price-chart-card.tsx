"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CandlestickChart,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { cn, fmtUsd, fmtPct } from "@/lib/format";

interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface PriceHistoryResp {
  symbol: string;
  days: number;
  candles: Candle[];
  summary?: {
    high: number;
    low: number;
    first: number;
    last: number;
    changePct: number;
    count: number;
  };
  error?: string;
  message?: string;
}

type Timeframe = 7 | 30 | 90 | 365;

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1y" },
];

export function PriceChartCard({ symbol }: { symbol: string }) {
  const t = useTranslations();
  const [days, setDays] = useState<Timeframe>(30);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { data, isLoading, isError } = useQuery<PriceHistoryResp>({
    queryKey: ["price-history", symbol, days],
    queryFn: async () => {
      const r = await fetch(`/api/price-history/${symbol}?days=${days}`);
      const json = await r.json();
      if (!r.ok) {
        const e = new Error(json.message || json.error || "failed") as Error & { status?: number };
        e.status = r.status;
        throw e;
      }
      return json;
    },
    staleTime: 5 * 60 * 1000, // 5 min
    retry: (err: unknown) => {
      const status = (err as { status?: number })?.status;
      if (status === 404) return false;
      return true;
    },
  });

  const candles = data?.candles ?? [];
  const summary = data?.summary;

  // Chart geometry
  const W = 800;
  const H = 260;
  const PAD_T = 16;
  const PAD_B = 28; // x-axis labels
  const PAD_L = 8;
  const PAD_R = 8;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  // Build path data + scales
  const chart = useMemo(() => {
    if (candles.length < 2) return null;
    const closes = candles.map((c) => c.c);
    const highs = candles.map((c) => c.h);
    const lows = candles.map((c) => c.l);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    // Add 5% padding top/bottom for visual breathing room
    const pad = range * 0.08;
    const yMax = max + pad;
    const yMin = Math.max(0, min - pad);
    const yRange = yMax - yMin || 1;

    const x = (i: number) => PAD_L + (i / (candles.length - 1)) * plotW;
    const y = (v: number) => PAD_T + plotH - ((v - yMin) / yRange) * plotH;

    // Build line path
    const linePath = closes
      .map((c, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(c).toFixed(2)}`)
      .join(" ");

    // Build area path (line + close to bottom)
    const areaPath =
      linePath +
      ` L ${x(closes.length - 1).toFixed(2)} ${(PAD_T + plotH).toFixed(2)}` +
      ` L ${x(0).toFixed(2)} ${(PAD_T + plotH).toFixed(2)} Z`;

    // Sample ~6 x-axis date labels
    const labelCount = 6;
    const labels: { x: number; text: string }[] = [];
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (candles.length - 1));
      const d = new Date(candles[idx].t);
      const text =
        days <= 7
          ? d.toLocaleDateString(undefined, { weekday: "short" })
          : days <= 90
            ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      labels.push({ x: x(idx), text });
    }

    // Y-axis reference lines (4 horizontal gridlines)
    const gridlines: { y: number; value: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (yRange * i) / 4;
      gridlines.push({ y: y(v), value: v });
    }

    return { x, y, linePath, areaPath, labels, gridlines, yMin, yMax };
  }, [candles, days, plotW, plotH]);

  // Hover handler: map mouse X to candle index
  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!chart || candles.length === 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = W / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      // Invert x → index
      const ratio = (mx - PAD_L) / plotW;
      const idx = Math.max(0, Math.min(candles.length - 1, Math.round(ratio * (candles.length - 1))));
      setHoverIdx(idx);
    },
    [chart, candles.length, plotW],
  );

  const onLeave = useCallback(() => setHoverIdx(null), []);

  const hovered = hoverIdx !== null ? candles[hoverIdx] : null;
  const isUp = (summary?.changePct ?? 0) >= 0;
  const changeColor = isUp ? "text-emerald-500" : "text-red-500";
  const strokeColor = isUp ? "rgb(16 185 129)" : "rgb(244 63 94)"; // emerald-500 / red-500
  const fillColor = isUp ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <CandlestickChart className="h-4 w-4 text-primary" />
              {t("priceChart.title")}
            </CardTitle>
            <CardDescription>{t("priceChart.subtitle")}</CardDescription>
          </div>
          {/* Timeframe selector */}
          <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setDays(tf.value)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                  days === tf.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[260px] w-full" />
          </div>
        ) : isError || !chart ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{t("priceChart.notAvailable", { symbol })}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Price + change badge row */}
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-bold tabular-nums">
                  {fmtUsd(hovered?.c ?? summary?.last ?? 0)}
                </span>
                {hovered ? (
                  <span className="text-xs text-muted-foreground">
                    {new Date(hovered.t).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("priceChart.current")}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-xs font-bold",
                    isUp
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {isUp ? "+" : ""}
                  {fmtPct((summary?.changePct ?? 0) / 100)}
                </span>
                <Badge2
                  label={t("priceChart.high")}
                  value={fmtUsd(summary?.high ?? 0)}
                  icon={<ArrowUp className="h-3 w-3 text-emerald-500" />}
                />
                <Badge2
                  label={t("priceChart.low")}
                  value={fmtUsd(summary?.low ?? 0)}
                  icon={<ArrowDown className="h-3 w-3 text-red-500" />}
                />
              </div>
            </div>

            {/* The chart */}
            <div className="relative w-full">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-[260px] block touch-none"
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                role="img"
                aria-label={`${symbol} price chart, ${candles.length} candles, ${isUp ? "up" : "down"} ${Math.abs(summary?.changePct ?? 0).toFixed(1)}%`}
              >
                <defs>
                  <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Gridlines + y-axis labels */}
                {chart.gridlines.map((g, i) => (
                  <g key={i}>
                    <line
                      x1={PAD_L}
                      y1={g.y}
                      x2={W - PAD_R}
                      y2={g.y}
                      stroke="currentColor"
                      strokeWidth={0.5}
                      className="text-border/40"
                      strokeDasharray="2 4"
                    />
                    <text
                      x={W - PAD_R + 2}
                      y={g.y + 3}
                      fontSize="9"
                      fill="currentColor"
                      className="text-muted-foreground/60"
                      textAnchor="end"
                    >
                      {fmtUsd(g.value)}
                    </text>
                  </g>
                ))}

                {/* Area fill */}
                <path d={chart.areaPath} fill={`url(#grad-${symbol})`} />

                {/* Line */}
                <path
                  d={chart.linePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* X-axis labels */}
                {chart.labels.map((l, i) => (
                  <text
                    key={i}
                    x={l.x}
                    y={H - 8}
                    fontSize="9"
                    fill="currentColor"
                    className="text-muted-foreground/70"
                    textAnchor="middle"
                  >
                    {l.text}
                  </text>
                ))}

                {/* Hover crosshair + dot */}
                {hovered && hoverIdx !== null && (
                  <g>
                    <line
                      x1={chart.x(hoverIdx)}
                      y1={PAD_T}
                      x2={chart.x(hoverIdx)}
                      y2={PAD_T + plotH}
                      stroke="currentColor"
                      strokeWidth={1}
                      className="text-primary/60"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={chart.x(hoverIdx)}
                      cy={chart.y(hovered.c)}
                      r={4}
                      fill={strokeColor}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  </g>
                )}
              </svg>

              {/* Hover tooltip (HTML, positioned) */}
              {hovered && hoverIdx !== null && (
                <div
                  className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border/60 bg-popover/95 backdrop-blur px-2.5 py-1.5 text-xs shadow-lg"
                  style={{
                    // Position relative to the chart width. Clamp to bounds.
                    left: `${Math.min(85, Math.max(2, (chart.x(hoverIdx) / W) * 100))}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="font-mono font-bold tabular-nums">{fmtUsd(hovered.c)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(hovered.t).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                    <span className="text-muted-foreground">O:</span>
                    <span className="font-mono">{fmtUsd(hovered.o)}</span>
                    <span className="text-muted-foreground ms-1">H:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmtUsd(hovered.h)}</span>
                    <span className="text-muted-foreground ms-1">L:</span>
                    <span className="font-mono text-red-600 dark:text-red-400">{fmtUsd(hovered.l)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {isUp ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                {t("priceChart.periodLabel", { days })}
              </span>
              <span className="font-mono">{candles.length} {t("priceChart.points")}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Badge2({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 px-1.5 py-0.5 text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
      {icon}
    </span>
  );
}
