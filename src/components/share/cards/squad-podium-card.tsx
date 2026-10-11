"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";

const BLOCK_HEIGHTS = [74, 56, 44];

/**
 * Card 5 — Squad podium.
 * Bottom panel with a 1st/2nd/3rd podium (your entry highlighted). If you are
 * outside the top three, a "You · #N" line is shown beneath the podium.
 */
export function SquadPodiumCard({ data, background, panelAlpha, safeZones }: ShareCardProps) {
  const { league, squadTop3, squadYouRank } = data;
  // Display order left→right: 2nd, 1st, 3rd.
  const order = [squadTop3[1], squadTop3[0], squadTop3[2]];
  const heights = [BLOCK_HEIGHTS[1], BLOCK_HEIGHTS[0], BLOCK_HEIGHTS[2]];

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      <div className="absolute inset-x-3 rounded-2xl p-4" style={{ ...panelStyle(), bottom: "14%" }}>
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-white/70">The Boys</p>

        <div className="flex items-end justify-center gap-3">
          {order.map((entry, i) => {
            if (!entry) return <div key={i} className="w-[64px]" />;
            const ring = entry.isYou ? `0 0 0 2px ${league.color}` : "none";
            return (
              <div key={i} className="flex w-[64px] flex-col items-center">
                <span className="mb-1 text-[12px] font-bold text-white">{entry.points.toLocaleString()}</span>
                <div
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.18)",
                    boxShadow: ring,
                  }}
                >
                  {entry.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[14px] font-bold text-white">{entry.initial}</span>
                  )}
                </div>
                <p className="mt-1 w-full truncate text-center text-[9px] font-semibold text-white/85" title={entry.name}>
                  {entry.name}
                </p>
                <div
                  className="mt-1 w-full rounded-t-lg"
                  style={{
                    height: heights[i],
                    background:
                      i === 1
                        ? "linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.16))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))",
                  }}
                />
              </div>
            );
          })}
        </div>

        {squadYouRank && squadYouRank > 3 && (
          <p className="mt-3 text-center text-[12px] font-semibold text-white/80">You · #{squadYouRank}</p>
        )}
      </div>
    </ShareCardFrame>
  );
}
