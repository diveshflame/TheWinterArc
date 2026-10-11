"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame } from "@/components/share/share-card-frame";
import { ShareIcon } from "@/components/share/share-icons";
import { daysLeft } from "@/lib/share/format";

/**
 * Card 3 — Day progress strip.
 * Top strip with DAY N / days-left + progress bar; big faint day number
 * bottom-left; streak pill with flame bottom-right.
 */
export function DayProgressCard({ data, background, toggles, panelAlpha, safeZones }: ShareCardProps) {
  const { challenge, streak } = data;
  const left = daysLeft(challenge.dayNumber, challenge.totalDays);
  const pct = Math.max(0, Math.min(100, Math.round((challenge.dayNumber / challenge.totalDays) * 100)));

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Top strip */}
      <div className="absolute inset-x-5" style={{ top: "13%" }}>
        <div className="flex items-end justify-between text-white">
          <span className="font-display text-[22px] font-bold tracking-wide">DAY {challenge.dayNumber}</span>
          <span className="text-[12px] font-medium text-white/80">{left} days left</span>
        </div>
        <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#38bdf8]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Big faint outlined day number */}
      <span
        className="absolute select-none font-display font-bold leading-none"
        style={{
          left: 20,
          bottom: "15%",
          fontSize: 150,
          color: "rgba(255,255,255,0.16)",
          WebkitTextStroke: "2px rgba(255,255,255,0.30)",
        }}
      >
        {challenge.dayNumber}
      </span>

      {/* Streak pill */}
      <div
        className="absolute flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-white"
        style={{ right: 18, bottom: "15%" }}
      >
        <ShareIcon type="flame" className="h-4 w-4 text-[#ff8a3d]" />
        <span className="text-[13px] font-bold">{streak}</span>
        <span className="text-[11px] font-medium text-white/70">day streak</span>
      </div>
    </ShareCardFrame>
  );
}
