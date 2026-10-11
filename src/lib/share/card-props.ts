import type {
  BackgroundState,
  CardToggleState,
  ShareCardData,
} from "@/lib/share/types";

/** Session UI state for the Then → Now card (selected days). */
export interface ThenNowSelection {
  thenDay: number;
  nowDay: number;
}

/** Session UI state for the Paper receipt card (selected rows + missed toggle). */
export interface ReceiptSelection {
  selected: string[];
  showMissed: boolean;
}

/** Props every share-card component receives. Purely presentational. */
export interface ShareCardProps {
  data: ShareCardData;
  background: BackgroundState;
  toggles: CardToggleState;
  /** Selected days for the Then → Now card (defaults to Day 1 → today). */
  thenNow?: ThenNowSelection;
  /** Selected habits for the Paper receipt card (defaults to top 5 by points). */
  receipt?: ReceiptSelection;
  /** True while rendering for export (disables preview-only chrome). */
  forExport?: boolean;
  /** Solid translucent panel alpha (raised for very bright photos). */
  panelAlpha?: number;
  /** Dev-only overlay marking the Instagram safe zones. */
  safeZones?: boolean;
}
