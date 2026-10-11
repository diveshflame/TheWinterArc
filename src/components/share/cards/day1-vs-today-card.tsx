"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { ShareIcon } from "@/components/share/share-icons";
import { useGrayscale } from "@/components/share/use-grayscale";

function handleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#04202e]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
    </svg>
  );
}

/**
 * Card 4 — Day 1 vs Today.
 * Left half is the grayscale Day-1 photo, right half today's photo, split by a
 * draggable-look divider. Bottom panel shows cumulative points and streak.
 */
export function Day1VsTodayCard({ data, background, toggles, panelAlpha, safeZones }: ShareCardProps) {
  const { challenge, league, streak, today } = data;
  const gray = useGrayscale(data.day1PhotoUrl);
  const todaySrc = background.type === "photo" ? background.photoUrl : null;

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Left: Day 1 (grayscale) */}
      <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
        {data.day1PhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gray ?? data.day1PhotoUrl}
            alt=""
            className="h-full w-full object-cover"
            style={gray ? undefined : { filter: "grayscale(1)" }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/10 text-center">
            <span className="px-4 text-[11px] font-semibold text-white/70">
              {data.hasDay1Photo ? "Loading…" : "Add your Day-1 photo"}
            </span>
          </div>
        )}
      </div>

      {/* Right: Today */}
      <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
        {todaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={todaySrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-[#123047] to-[#0b1020]" />
        )}
      </div>

      {/* Divider + handle */}
      <div aria-hidden className="absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
        <div className="h-full w-[2px] bg-white/85" />
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
          {handleIcon()}
        </div>
      </div>

      {/* Day pills */}
      <div className="absolute left-3 z-10 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white" style={{ top: "13%" }}>
        DAY 1
      </div>
      <div className="absolute right-3 z-10 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white" style={{ top: "13%" }}>
        DAY {challenge.dayNumber}
      </div>

      {/* Bottom panel */}
      <div className="absolute inset-x-3 z-10 flex items-center justify-between rounded-2xl px-4 py-3" style={{ ...panelStyle(), bottom: "14%" }}>
        {toggles.points && (
          <div>
            <p className="font-display text-[26px] font-bold leading-none text-white">{league.totalPoints.toLocaleString()}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">total points</p>
          </div>
        )}
        {toggles.points && (
          <div className="text-right">
            <p className="font-display text-[26px] font-bold leading-none text-white">+{today.points}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">today</p>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-white">
          <ShareIcon type="flame" className="h-4 w-4 text-[#ff8a3d]" />
          <span className="text-[13px] font-bold">{streak}</span>
        </div>
      </div>
    </ShareCardFrame>
  );
}
