"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { SnowflakeGlyph } from "@/components/share/share-icons";
import { LeagueIcon } from "@/components/league-icons";

const PARTICLES = [
  { top: "16%", left: "8%", size: 16, o: 0.5 },
  { top: "24%", right: "10%", size: 12, o: 0.4 },
  { top: "46%", left: "5%", size: 10, o: 0.35 },
  { top: "58%", right: "7%", size: 18, o: 0.45 },
  { top: "36%", right: "16%", size: 9, o: 0.3 },
  { top: "70%", left: "12%", size: 13, o: 0.4 },
];

/**
 * Card 7 — League aura.
 * League-colored inner edge glow + snow particles around the frame, with a
 * centered nameplate (persona + league + division).
 */
export function LeagueAuraCard({ data, background, toggles, panelAlpha, safeZones }: ShareCardProps) {
  const { league, user } = data;
  const name = `${user.firstName} ${user.lastInitial}`.trim();

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Inner edge glow in the league color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 64px 12px ${league.color}` }}
      />

      {/* Snow particles around the frame */}
      {PARTICLES.map((p, i) => (
        <SnowflakeGlyph
          key={i}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            top: p.top,
            left: p.left,
            right: p.right,
            color: "#ffffff",
            opacity: p.o,
          }}
        />
      ))}

      {/* Nameplate */}
      <div className="absolute inset-x-3 rounded-2xl px-4 py-3 text-center" style={{ ...panelStyle(), bottom: "14%" }}>
        <div className="flex items-center justify-center gap-1.5" style={{ color: league.color }}>
          <LeagueIcon type={league.icon} size={15} />
          <span className="text-[13px] font-bold uppercase tracking-wide">
            {league.name}
            {league.division ? ` ${league.division}` : ""}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] font-medium text-white/85">{league.persona}</p>
        {toggles.name && <p className="mt-0.5 text-[11px] text-white/55">{name}</p>}
      </div>
    </ShareCardFrame>
  );
}
