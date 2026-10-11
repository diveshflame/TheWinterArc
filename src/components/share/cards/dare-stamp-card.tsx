"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { signedPoints } from "@/lib/share/format";

/**
 * Card 2 — Dare stamp + Join button.
 *
 * The "Join Winter Arc →" button on the image is VISUAL ONLY: a shared story
 * is a flat PNG and cannot contain a working link. The invite URL lives in the
 * share text instead (see the registry caption). In the share sheet preview
 * only, an invisible overlay in front of this button copies the invite link —
 * that overlay is rendered outside the export node, so it never appears in the
 * exported PNG.
 */
export function DareStampCard({
  data,
  background,
  toggles,
  panelAlpha,
  safeZones,
}: ShareCardProps) {
  const points = data.today.points;

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      {/* Rubber stamp — rotated, dashed border, translucent dark fill */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center rounded-lg border-2 border-dashed px-6 py-3"
        style={{
          ...panelStyle(),
          bottom: "calc(14% + 48px)",
          borderColor: "#ff5f3a",
          transform: "translateX(-50%) rotate(-6deg)",
        }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#ff5f3a]">
          Beat me
        </span>
        {toggles.points && (
          <p className="mt-1 flex items-baseline gap-1.5 text-white">
            <span className="font-display text-[30px] font-medium leading-none">{signedPoints(points)}</span>
            <span className="text-[12px] font-semibold text-white/75">pts today</span>
          </p>
        )}
      </div>

      {/* Visual-only call to action — see the comment at the top of this file. */}
      <div
        className="absolute inset-x-5 flex items-center justify-center rounded-lg bg-[#f1f5f9] text-[13px] font-bold text-[#0b1020]"
        style={{
          bottom: "14%",
          height: 34,
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
      >
        Join Winter Arc →
      </div>
    </ShareCardFrame>
  );
}
