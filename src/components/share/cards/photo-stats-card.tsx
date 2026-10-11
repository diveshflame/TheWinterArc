"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { CameraGlyph, ShareIcon, SnowflakeGlyph } from "@/components/share/share-icons";
import { LeagueIcon } from "@/components/league-icons";
import { formatValue, signedPoints } from "@/lib/share/format";

/**
 * Card 1 — Photo + stats.
 * Top-left "Day N" pill, bottom translucent panel with league + name, big points,
 * up to three activity lines and the WINTER ARC mark.
 */
export function PhotoStatsCard({
  data,
  background,
  toggles,
  forExport = false,
  panelAlpha,
  safeZones,
}: ShareCardProps) {
  const { user, league, today, rank } = data;
  const name = `${user.firstName} ${user.lastInitial}`.trim();

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Day pill (kept below the top safe zone) */}
      <div
        className="absolute left-4 rounded-full border border-white/20 bg-black/45 px-3 py-1 text-[11px] font-bold tracking-wide text-white"
        style={{ top: "13%" }}
      >
        Day {data.challenge.dayNumber}
      </div>

      {/* Camera chip — preview only, never exported */}
      {!forExport && (
        <div className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/90" style={{ top: "13%" }}>
          <CameraGlyph className="h-4 w-4" />
        </div>
      )}

      {/* Bottom panel */}
      <div
        className="absolute inset-x-3 rounded-2xl p-4 backdrop-blur-none"
        style={{ ...panelStyle(), bottom: "14%" }}
      >
        {toggles.league && (
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: league.color }}>
            <LeagueIcon type={league.icon} size={13} />
            <span>
              {league.name}
              {league.division ? ` ${league.division}` : ""}
            </span>
          </div>
        )}

        {toggles.name && (
          <p className="text-[15px] font-bold leading-tight text-white">{name}</p>
        )}

        {toggles.points && (
          <p className="mt-0.5 font-display text-[34px] font-bold leading-none text-white">
            {signedPoints(today.points)}
            <span className="ml-1 text-[15px] font-semibold text-white/70">pts today</span>
          </p>
        )}

        {today.activities.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {today.activities.map((a) => (
              <div key={a.label} className="flex items-center gap-2 text-[12px] text-white/85">
                <ShareIcon type={a.icon} className="h-3.5 w-3.5 shrink-0 text-white/70" />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-white">
                  {formatValue(a.value) ?? `+${a.points}`}
                  {a.value !== null && a.unit ? <span className="ml-0.5 text-white/60">{a.unit}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
          <span className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold tracking-[0.28em] text-white/80">
            <SnowflakeGlyph className="h-3.5 w-3.5" />
            WINTER ARC
          </span>
          {toggles.rank && rank && (
            <span className="rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[11px] font-bold text-white/85">
              #{rank.position}/{rank.total}
            </span>
          )}
        </div>
      </div>
    </ShareCardFrame>
  );
}
