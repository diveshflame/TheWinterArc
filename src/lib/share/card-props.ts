import type {
  BackgroundState,
  CardToggleState,
  ShareCardData,
} from "@/lib/share/types";

/** Props every share-card component receives. Purely presentational. */
export interface ShareCardProps {
  data: ShareCardData;
  background: BackgroundState;
  toggles: CardToggleState;
  /** Only used by the habit checklist card. */
  missedHabit?: boolean;
  /** True while rendering for export (disables preview-only chrome). */
  forExport?: boolean;
  /** Solid translucent panel alpha (raised for very bright photos). */
  panelAlpha?: number;
  /** Dev-only overlay marking the Instagram safe zones. */
  safeZones?: boolean;
}
