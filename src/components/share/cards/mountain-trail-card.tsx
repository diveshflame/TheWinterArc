"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { SUMMIT, TRAIL_POINTS, trailState } from "@/lib/share/trail";

/** Normalized SVG space (0..1) → the card's 312×160 drawing box. */
const VB_W = 312;
const VB_H = 160;
const sx = (x: number) => Math.round(x * VB_W * 10) / 10;
const sy = (y: number) => Math.round(y * VB_H * 10) / 10;

const MOUNTAIN_POINTS = [
  { x: 0.02, y: 0.98 },
  { x: 0.62, y: 0.14 },
  { x: 0.76, y: 0.44 },
  { x: 0.84, y: 0.34 },
  { x: 1.0, y: 0.98 },
];

const SNOW_CAP_POINTS = [
  { x: 0.55, y: 0.3 },
  { x: 0.585, y: 0.222 },
  { x: 0.62, y: 0.14 },
  { x: 0.655, y: 0.225 },
  { x: 0.685, y: 0.315 },
];

const toPoints = (points: { x: number; y: number }[]) =>
  points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");

/**
 * Card 3 — Mountain trail.
 * Bottom translucent panel: DAY n / days-to-go header, an SVG mountain with a
 * dashed switchback trail, the user's marker, two checkpoints and a summit
 * flag, then the checkpoint/summit summary line.
 */
export function MountainTrailCard({ data, background, panelAlpha, safeZones }: ShareCardProps) {
  const { dayNumber, totalDays } = data.challenge;
  const state = trailState(dayNumber, totalDays);

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      <div
        className="absolute inset-x-3 rounded-2xl px-4 pb-3.5 pt-3"
        style={{ ...panelStyle(), bottom: "14%" }}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between text-white">
          <span className="text-[13px] font-medium tracking-wide">DAY {dayNumber}</span>
          <span className="text-[13px] font-medium text-white/75">{state.headerRight}</span>
        </div>

        {/* Mountain, trail, checkpoints, marker and flag */}
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`Day ${dayNumber} of ${totalDays} on the trail`}
        >
          {/* Mountain body + snow cap */}
          <polygon points={toPoints(MOUNTAIN_POINTS)} fill="#1d3a5f" />
          <polygon points={toPoints(SNOW_CAP_POINTS)} fill="#e8f1ff" />
          {/* Ground line */}
          <line x1="0" y1={VB_H - 3} x2={VB_W} y2={VB_H - 3} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

          {/* Dashed trail */}
          <polyline
            points={toPoints(TRAIL_POINTS)}
            fill="none"
            stroke="#cfe3ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 5"
          />

          {/* Summit flag — outline until the summit is reached, then raised */}
          <line
            x1={sx(SUMMIT.x)}
            y1={sy(SUMMIT.y)}
            x2={sx(SUMMIT.x)}
            y2={sy(SUMMIT.y) - 26}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="2"
          />
          <polygon
            points={`${sx(SUMMIT.x)},${sy(SUMMIT.y) - 26} ${sx(SUMMIT.x) + 22},${sy(SUMMIT.y) - 19} ${sx(SUMMIT.x)},${sy(SUMMIT.y) - 12}`}
            fill={state.summitReached ? "#ff5f3a" : "none"}
            stroke="#ff5f3a"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Checkpoints — solid white once passed */}
          {state.checkpoints.map((cp) => (
            <circle
              key={cp.day}
              cx={sx(cp.x)}
              cy={sy(cp.y)}
              r="5.5"
              fill={cp.passed ? "#ffffff" : "none"}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          {/* Current position — filled blue marker with a white outline */}
          <circle cx={sx(state.marker.x)} cy={sy(state.marker.y)} r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="2.5" />
        </svg>

        {/* Summary line */}
        <p className="mt-1 text-[11px] font-medium text-white/60">{state.footerLine}</p>
      </div>
    </ShareCardFrame>
  );
}
