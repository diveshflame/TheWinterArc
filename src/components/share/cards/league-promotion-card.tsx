"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { LeagueIcon } from "@/components/league-icons";

/**
 * Card 8 — League promotion.
 * Without a photo background: a full celebration design (concentric rings,
 * PROMOTED, emblem, division, persona, unlocked bonus chip, total points).
 * With a photo background: a compact top ribbon + bottom nameplate so the
 * subject stays visible.
 */
export function LeaguePromotionCard({ data, background, toggles, panelAlpha, safeZones }: ShareCardProps) {
  const { league, user } = data;
  const promotion = data.promotion;
  const name = `${user.firstName} ${user.lastInitial}`.trim();
  const leagueName = promotion?.toLeague ?? league.name;
  const division = promotion?.toDivision ?? league.division;
  const persona = promotion?.persona ?? league.persona;
  const bonus = promotion?.newBonusPerDay ?? league.bonusPerDay;
  // Always show the full celebration layout; photo background is handled by
  // the frame (object-fit + scrim). This avoids changing the card's design.
  const withPhoto = false;

  if (withPhoto) {
    return (
      <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
        {/* Ribbon (below top safe zone) */}
        <div className="absolute inset-x-4" style={{ top: "13%" }}>
          <div
            className="flex items-center justify-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: league.color, color: "#04121f" }}
          >
            <span className="font-display text-[16px] font-bold tracking-[0.2em]">PROMOTED</span>
          </div>
        </div>

        {/* Bottom nameplate */}
        <div className="absolute inset-x-3 rounded-2xl px-4 py-3" style={{ ...panelStyle(), bottom: "14%" }}>
          <div className="flex items-center gap-2" style={{ color: league.color }}>
            <LeagueIcon type={league.icon} size={16} />
            <span className="text-[14px] font-bold">
              {leagueName}
              {division ? ` ${division}` : ""}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            {toggles.name && <span className="text-[12px] text-white/70">{name}</span>}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/85">
              +{bonus} pt/day
            </span>
          </div>
        </div>
      </ShareCardFrame>
    );
  }

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Concentric rings */}
      <div aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ top: "26%" }}>
        {[210, 156, 106].map((s) => (
          <div
            key={s}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: s, height: s, border: `1.5px solid ${league.color}`, opacity: 0.35 }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: "18%" }}>
        <span className="font-display text-[30px] font-bold tracking-[0.24em]" style={{ color: league.color }}>
          PROMOTED
        </span>
      </div>

      {/* Emblem */}
      <div
        className="absolute left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full"
        style={{ top: "31%", backgroundColor: "rgba(3,8,20,0.6)", boxShadow: `0 0 0 3px ${league.color}` }}
      >
        <LeagueIcon type={league.icon} size={38} style={{ color: league.color }} />
      </div>

      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: "49%" }}>
        <span className="text-[18px] font-bold text-white">
          {leagueName}
          {division ? ` ${division}` : ""}
        </span>
        <span className="mt-0.5 text-[13px] font-medium text-white/80">{persona}</span>
        <span
          className="mt-3 rounded-full px-3 py-1 text-[12px] font-bold"
          style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}
        >
          +{bonus} pt/day unlocked
        </span>
      </div>

      {/* Bottom nameplate */}
      <div className="absolute inset-x-0 flex flex-col items-center" style={{ bottom: "14%" }}>
        {toggles.name && <span className="text-[13px] font-semibold text-white/80">{name}</span>}
        {toggles.points && (
          <span className="font-display text-[20px] font-bold text-white">{league.totalPoints.toLocaleString()} pts</span>
        )}
      </div>
    </ShareCardFrame>
  );
}
