import type { BackgroundState } from "@/lib/share/types";

export interface BackgroundPreset {
  key: string;
  label: string;
  /** CSS background for the 360x640 frame. */
  css: string;
  /** Whether the preset renders dark enough for default panel opacity. */
  accent?: boolean;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    key: "navy",
    label: "Midnight",
    css: "linear-gradient(160deg, #0b1020 0%, #0d1627 55%, #142239 100%)",
  },
  {
    key: "aurora",
    label: "Aurora",
    css: "linear-gradient(160deg, #0b1020 0%, #123047 55%, #0e4a5f 100%)",
    accent: true,
  },
  {
    key: "ember",
    label: "Ember",
    css: "linear-gradient(160deg, #12101f 0%, #2a1622 55%, #3a1d12 100%)",
    accent: true,
  },
];

export const DEFAULT_BACKGROUND: BackgroundState = { type: "color", colorKey: "navy", photoUrl: null };

export function getPreset(key: string | undefined): BackgroundPreset {
  return BACKGROUND_PRESETS.find((p) => p.key === key) ?? BACKGROUND_PRESETS[0];
}
