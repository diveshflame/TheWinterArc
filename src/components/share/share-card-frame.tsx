"use client";

import type { CSSProperties, ReactNode } from "react";
import type { BackgroundState } from "@/lib/share/types";
import { getPreset } from "@/lib/share/background";
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/share/export";

/** Instagram Story UI covers the top 12% and bottom 14% of a 9:16 card. */
export const SAFE_TOP_PCT = 12;
export const SAFE_BOTTOM_PCT = 14;
export const DEFAULT_PANEL_ALPHA = 0.72;

interface ShareCardFrameProps {
  background: BackgroundState;
  children: ReactNode;
  /** Dev-only overlay marking the IG safe zones. */
  safeZones?: boolean;
  /** Solid translucent panel alpha (raised when the photo is very bright). */
  panelAlpha?: number;
  className?: string;
  style?: CSSProperties;
}

export function ShareCardFrame({
  background,
  children,
  safeZones = false,
  panelAlpha = DEFAULT_PANEL_ALPHA,
  className = "",
  style,
}: ShareCardFrameProps) {
  const isClear = background.type === "clear";
  const preset = getPreset(background.colorKey);

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: isClear
          ? undefined
          : background.type === "color"
            ? preset.css
            : "#0b1020",
        ["--share-panel-alpha" as string]: String(panelAlpha),
        ...style,
      }}
    >
      {background.type === "photo" && background.photoUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={background.photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            crossOrigin="anonymous"
          />
          {/* A gentle scrim keeps overlay text legible without a full veil. */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
        </>
      )}

      {children}

      {safeZones && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-50">
          <div
            className="absolute inset-x-0 top-0 border-b border-dashed border-fuchsia-400/70 bg-fuchsia-500/10"
            style={{ height: `${SAFE_TOP_PCT}%` }}
          >
            <span className="absolute left-1 top-1 rounded bg-fuchsia-500/80 px-1 text-[7px] font-bold text-white">
              SAFE · TOP 12%
            </span>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 border-t border-dashed border-fuchsia-400/70 bg-fuchsia-500/10"
            style={{ height: `${SAFE_BOTTOM_PCT}%` }}
          >
            <span className="absolute bottom-1 left-1 rounded bg-fuchsia-500/80 px-1 text-[7px] font-bold text-white">
              SAFE · BOTTOM 14%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Panel background that respects the brightness-adjusted alpha variable. */
export function panelStyle(extra?: CSSProperties): CSSProperties {
  return {
    backgroundColor: "rgba(3, 8, 20, var(--share-panel-alpha, 0.72))",
    ...extra,
  };
}
