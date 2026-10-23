"use client";

/**
 * Risk rating visualizations for the Business Loan Risk Assessor report.
 *
 * Form: meters — a single ratio against an ordinal Low→High scale, so the
 * fill carries severity and the unfilled track is a neutral one-step-off-
 * surface gray. Each rating is always accompanied by its text label and a
 * position on the labeled scale, so identity never rests on color alone.
 */
import { useEffect, useState } from "react";
import { spacing } from "@leafygreen-ui/tokens";

export const RATING_LEVELS = ["Low", "Moderate", "Elevated", "High"];

export const RATING_COLORS = {
  Low: "#00684A",       // success green (matches --success)
  Moderate: "#d97706",  // amber (matches --hitl-amber)
  Elevated: "#ea5806",  // orange
  High: "#DB3030",      // red (matches --danger)
};

const ratingColor = (r) => RATING_COLORS[r] || RATING_COLORS.Moderate;
const ratingPct = (r) => {
  const i = RATING_LEVELS.indexOf(r);
  return i >= 0 ? (i + 1) / RATING_LEVELS.length : 0;
};

const TRACK = "#E3E8EB"; // one-step-off-surface gray, recessive

/** Animate from 0 to a target once on mount (CSS transition does the work). */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);
  return mounted;
}

/**
 * Semicircular gauge for the overall risk rating.
 * Arc fill grows from "Low" (left) toward "High" (right); tick labels
 * name every stop so the rating is readable without color.
 */
export function RiskGauge({ rating, size = 220 }) {
  const mounted = useMounted();
  const pct = mounted ? ratingPct(rating) : 0;
  const color = ratingColor(rating);

  const R = 76;
  const CX = 90; // center x
  const CY = 90; // center y
  const arcLen = Math.PI * R; // semicircle path length

  // Semicircle from left (180°) to right (0°); drawn with a dash so the
  // fill length maps directly to the rating position.
  const describeArc = (r) => {
    const sx = CX - r, sy = CY, ex = CX + r;
    return `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${sy}`;
  };
  const pointAt = (frac) => {
    // frac 0 = left end (Low), 1 = right end (High)
    const angle = Math.PI * (1 - frac);
    return [CX + Math.cos(angle) * R, CY - Math.sin(angle) * R];
  };

  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 180 110"
      role="img"
      aria-label={`Overall risk rating: ${rating} on a scale of Low to High`}
    >
      {/* track */}
      <path d={describeArc(R)} fill="none" stroke={TRACK} strokeWidth="9"
        strokeLinecap="round" />
      {/* fill — animated by dash length */}
      <path d={describeArc(R)} fill="none" stroke={color} strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${arcLen * pct} ${arcLen}`}
        style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.33, 1, 0.68, 1)" }}
      />
      {/* ticks + labels: Low · Moderate · Elevated · High */}
      {RATING_LEVELS.map((level, i) => {
        const frac = i / RATING_LEVELS.length;
        const [x, y] = pointAt(frac);
        const [lx, ly] = pointAt(frac);
        return (
          <g key={level}>
            <line x1={x} y1={y} x2={CX + (x - CX) * 0.88} y2={CY - (CY - y) * 0.88}
              stroke="#B7C1C8" strokeWidth="1" />
            <text x={lx} y={ly + 6.5} textAnchor="middle" fontSize="5"
              fill="var(--text-secondary)" fontFamily="var(--font-display)">
              {level}
            </text>
          </g>
        );
      })}
      {/* rating value, in text ink — never the data color alone */}
      <text x={CX} y={CY - 24} textAnchor="middle" fontSize="17"
        fontWeight="700" fill="var(--text-primary)" fontFamily="var(--font-display)">
        {rating}
      </text>
      <text x={CX} y={CY - 14} textAnchor="middle" fontSize="5.5"
        fill="var(--text-secondary)" fontFamily="var(--font-display)">
        OVERALL RISK
      </text>
    </svg>
  );
}

/**
 * Horizontal rating bar for one risk dimension (Local Market, Environmental,
 * Business Plan). Thin mark, square at the baseline, 4px rounded data end;
 * the rating text rides the tip in text ink.
 */
export function RiskBar({ label, rating }) {
  const mounted = useMounted();
  const pct = mounted ? ratingPct(rating) : 0;
  const color = rating ? ratingColor(rating) : "#B7C1C8";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr 86px",
        alignItems: "center",
        gap: spacing[3],
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
        {label}
      </div>
      <div
        role="meter"
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuetext={rating ? `${rating} risk` : "not rated"}
        aria-label={label}
        style={{
          height: 12,
          background: TRACK,
          borderRadius: "2px 4px 4px 2px", // square at baseline, rounded data end
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            borderRadius: "2px 4px 4px 2px",
            transition: "width 900ms cubic-bezier(0.33, 1, 0.68, 1)",
          }}
        />
      </div>
      <div style={{
        fontSize: 11,
        color: "var(--text-secondary)",
        fontFamily: "var(--font-display)",
        textAlign: "right",
      }}>
        {rating ? `${rating} risk` : "—"}
      </div>
    </div>
  );
}
