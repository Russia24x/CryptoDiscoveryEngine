"use client";

import { cn } from "@/lib/format";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** color of the line; defaults to a neutral tone driven by trend direction */
  color?: string;
}

/**
 * Inline-SVG sparkline. Minimal, no deps. Renders a polyline normalized to
 * the value range. If ≤1 point, renders a flat baseline.
 */
export function Sparkline({
  values,
  width = 48,
  height = 16,
  className,
  color,
}: SparklineProps) {
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
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // trend color: up = emerald, down = red, flat = muted
  const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
  const autoColor =
    trend > 0.1 ? "#10b981" : trend < -0.1 ? "#ef4444" : "currentColor";
  const stroke = color ?? autoColor;

  return (
    <svg width={width} height={height} className={cn("inline-block", className)} aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* endpoint dot */}
      <circle
        cx={pad + (values.length === 1 ? w / 2 : w)}
        cy={pad + h - ((values[values.length - 1] - min) / range) * h}
        r={1.5}
        fill={stroke}
      />
    </svg>
  );
}
