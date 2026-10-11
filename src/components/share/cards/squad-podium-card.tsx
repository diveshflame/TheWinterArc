"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { AvatarSilhouette } from "@/components/share/share-icons";
import { LeagueIcon } from "@/components/league-icons";
import { buildPodiumColumns, podiumYouLine, podiumBasisLabel } from "@/lib/share/podium";

/**
 * Card 6 — Squad podium.
 * Bottom panel titled "Winter Arc" with "Top 3": 1st centre and tallest with a
 * crown, 2nd left, 3rd right (blue when it is the sharer). Real profile photos
 * with a generic silhouette fallback. The "Hide other members" toggle masks
 * other members' photos and names while keeping points visible.
 */
export function SquadPodiumCard({ data, background, toggles, panelAlpha, safeZones }: ShareCardProps) {
  const columns = buildPodiumColumns(data.squadTop3 ?? [], {
    hideOthers: toggles.hideOthers,
  });
  const youLine = podiumYouLine(data.squadYouRank, toggles.rank);

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      <div
        className="absolute inset-x-3 rounded-2xl p-4"
        style={{ ...panelStyle(), bottom: "14%" }}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[12px] font-semibold tracking-wide text-white/85">Winter Arc</p>
          <p className="text-[11px] font-medium text-white/55">
            {podiumBasisLabel(data.squadBasis ?? "overall")} · Top 3
          </p>
        </div>

        <div className="flex items-end justify-center gap-3">
          {columns.map((column, index) => (
            <div key={`${column.rank}-${index}`} className="flex w-[78px] flex-col items-center">
              {/* Crown slot keeps the three columns aligned */}
              <div className="mb-0.5 h-4">
                {column.crown && <LeagueIcon type="crown" size={15} className="text-[#e8b73a]" />}
              </div>

              <div
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full"
                style={{
                  backgroundColor: "rgba(255,255,255,0.16)",
                  boxShadow: column.avatarUrl || column.isYou ? `0 0 0 2px ${column.color}` : `0 0 0 2px ${column.color}55`,
                }}
              >
                {column.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={column.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: "center" }}
                  />
                ) : (
                  <AvatarSilhouette className="h-6 w-6 text-white/70" />
                )}
              </div>

              <p className="mt-1 w-full truncate text-center text-[11px] font-semibold text-white/90">
                {column.displayName}
              </p>
              <p className="text-[12px] font-bold tabular-nums text-white">
                {column.entry.points.toLocaleString()}
              </p>

              <div
                className="mt-1 w-full rounded-t-lg"
                style={{
                  height: column.height,
                  background: `linear-gradient(180deg, ${column.color}66, ${column.color}22)`,
                }}
              />
            </div>
          ))}
        </div>

        {youLine && (
          <p className="mt-3 text-center text-[12px] font-semibold text-white/80">{youLine}</p>
        )}
      </div>
    </ShareCardFrame>
  );
}
