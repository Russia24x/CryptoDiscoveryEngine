"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/format";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** color of the line; defaults to a neutral tone driven by trend direction */
  color?: string;
  /** optional title for the SVG (native tooltip) */
  title?: string;
  /** if true, enables interactive hover tooltip showing the value at the hovered point */
  interactive?: boolean;
  /** formatter for tooltip values (e.g. price formatting) */
  formatValue?: (v: number) => string;
}

/**
 * Inline-SVG sparkline. Minimal, no deps. Renders a polyline normalized to
 * the value range. If ≤1 point, renders a flat baseline.
 *
 * When `interactive` is true, hovering over the sparkline shows a tooltip
 * with the value at the hovered x position.
 */
export function Sparkline({
  values,
  width = 48,
  height = 16,
  className,
  color,
  title,
  interactive = false,
  formatValue = (v) => v.toFixed(2),
}: SparklineProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!interactive || values.length < 2) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const pad = 2;
      const w = width - pad * 2;
      const ratio = (mx - pad) / w;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1))));
      setHoverIdx(idx);
    },
    [interactive, values.length, width],
  );

  const onLeave = useCallback(() => setHoverIdx(null), []);

  if (!values.length) {
    return (
      <svg width={width} height={height} className={cn("inline-block", className)} aria-hidden>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="currentColor" strokeWidth={1} className="text-muted-foreground/40"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid /0 when all values equal
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = values.map((v, i) => {
    const x = pad + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w);
    const y = pad + h - ((v - min) / range) * h;
    return { x, y };
  });

  const ptsStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // trend color: up = emerald, down = red, flat = muted
  const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
  const autoColor =
    trend > 0.1 ? "#10b981" : trend < -0.1 ? "#ef4444" : "currentColor";
  const stroke = color ?? autoColor;

  return (
    <div className="relative inline-block">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={cn("inline-block", interactive && "cursor-crosshair", className)}
        aria-hidden={!interactive}
        role={interactive ? "img" : undefined}
        aria-label={interactive ? `Sparkline with ${values.length} points, range ${formatValue(min)} to ${formatValue(max)}` : undefined}
        title={title}
        onMouseMove={interactive ? onMove : undefined}
        onMouseLeave={interactive ? onLeave : undefined}
      >
        <polyline
          points={ptsStr}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* endpoint dot */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r={1.5}
          fill={stroke}
        />
        {/* hover indicator */}
        {interactive && hoverIdx !== null && (
          <>
            <line
              x1={pts[hoverIdx].x}
              y1={pad}
              x2={pts[hoverIdx].x}
              y2={height - pad}
              stroke={stroke}
              strokeWidth={0.5}
              strokeDasharray="1 1"
              opacity={0.6}
            />
            <circle
              cx={pts[hoverIdx].x}
              cy={pts[hoverIdx].y}
              r={2.5}
              fill={stroke}
              stroke="white"
              strokeWidth={1}
            />
          </>
        )}
      </svg>
      {/* HTML tooltip (positioned above the sparkline) */}
      {interactive && hoverIdx !== null && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 rounded border border-border/60 bg-popover/95 backdrop-blur px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums shadow-lg whitespace-nowrap"
        >
          {formatValue(values[hoverIdx])}
        </div>
      )}
    </div>
  );
}
