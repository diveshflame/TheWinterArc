"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { SnowflakeGlyph } from "@/components/share/share-icons";
import { LeagueIcon } from "@/components/league-icons";

/**
 * Card 2 — Challenge bubble.
 * A #38bdf8 speech bubble with an upward-left tail (toward the subject), placed
 * lower-right so it never covers the face. Name pill + brand mark at the bottom.
 */
export function ChallengeBubbleCard({ data, background, toggles, panelAlpha, safeZones }: ShareCardProps) {
  const { user, league, today } = data;
  const name = `${user.firstName} ${user.lastInitial}`.trim();

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Speech bubble */}
      <div className="absolute" style={{ right: 18, bottom: "27%", width: 230 }}>
        {/* tail pointing up-left toward the subject */}
        <div
          aria-hidden
          className="absolute h-5 w-5 rotate-45 rounded-[3px] bg-[#38bdf8]"
          style={{ left: 22, top: -7 }}
        />
        <div className="relative rounded-3xl bg-[#38bdf8] px-4 py-3.5 shadow-lg">
          <p className="font-display text-[19px] font-bold leading-snug text-[#04202e]">
            Can you beat my <span className="whitespace-nowrap">+{today.points} pts</span> today?
          </p>
        </div>
      </div>

      {/* Bottom row: name pill + brand mark */}
      <div className="absolute inset-x-4 flex items-center justify-between" style={{ bottom: "14%" }}>
        {(toggles.name || toggles.league) && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white"
            style={{ ...panelStyle(), backgroundColor: "rgba(3,8,20,0.78)" }}
          >
            {toggles.league && <LeagueIcon type={league.icon} size={13} style={{ color: league.color }} />}
            {toggles.name && <span>{name}</span>}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold tracking-[0.28em] text-white/80">
          <SnowflakeGlyph className="h-3.5 w-3.5" />
          WINTER ARC
        </span>
      </div>
    </ShareCardFrame>
  );
}
