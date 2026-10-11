import type { SharePodiumEntry, SquadBasis } from "@/lib/share/types";

/** Short label for the chosen leaderboard basis, shown on the card header. */
export function podiumBasisLabel(basis: SquadBasis): string {
  return basis === "today" ? "Today" : basis === "week" ? "This week" : "All time";
}

export const PODIUM_COLORS = {
  gold: "#e8b73a",
  silver: "#cbd5e1",
  blue: "#38bdf8",
  slate: "#94a3b8",
} as const;

/** Block heights by rank — 1st is always the tallest. */
export const PODIUM_HEIGHTS: Record<number, number> = { 1: 74, 2: 56, 3: 44 };

export interface PodiumColumn {
  rank: number;
  entry: SharePodiumEntry;
  /** First name, or "#N" for masked members when hiding others. */
  displayName: string;
  /** Avatar URL, or null for masked members / missing photos. */
  avatarUrl: string | null;
  /** Ring/block accent colour for this rank. */
  color: string;
  height: number;
  isYou: boolean;
  /** True when the 1st-place crown icon should render above the avatar. */
  crown: boolean;
}

/**
 * Build the three podium columns in display order (2nd, 1st, 3rd).
 *
 * Privacy: with `hideOthers`, every member who is not the sharer has their
 * photo replaced by the generic silhouette and their name replaced by their
 * rank ("#1", "#2", "#3"). The sharer's own photo and name are unaffected.
 */
export function buildPodiumColumns(
  top3: SharePodiumEntry[],
  opts: { hideOthers: boolean }
): PodiumColumn[] {
  const byRank = [top3[1], top3[0], top3[2]]; // display order: 2nd, 1st, 3rd
  return byRank.map((entry, index) => {
    if (!entry) {
      // Placeholder column keeps the layout stable with fewer than three.
      return {
        rank: index === 0 ? 2 : index === 1 ? 1 : 3,
        entry: {
          userId: "",
          firstName: "",
          name: "",
          initial: "?",
          avatarUrl: null,
          points: 0,
          isYou: false,
        },
        displayName: "",
        avatarUrl: null,
        color: PODIUM_COLORS.slate,
        height: 0,
        isYou: false,
        crown: false,
      };
    }
    const rank = top3.indexOf(entry) + 1;
    const masked = opts.hideOthers && !entry.isYou;
    const color =
      rank === 1
        ? PODIUM_COLORS.gold
        : rank === 2
          ? PODIUM_COLORS.silver
          : entry.isYou
            ? PODIUM_COLORS.blue
            : PODIUM_COLORS.slate;
    return {
      rank,
      entry,
      displayName: masked ? `#${rank}` : entry.firstName || entry.name,
      avatarUrl: masked ? null : entry.avatarUrl ?? null,
      color,
      height: PODIUM_HEIGHTS[rank] ?? 44,
      isYou: entry.isYou,
      crown: rank === 1,
    };
  });
}

/** "You · #N" line under the podium, only when enabled and outside the top 3. */
export function podiumYouLine(
  squadYouRank: number | null,
  showRank: boolean
): string | null {
  if (!showRank || !squadYouRank || squadYouRank <= 3) return null;
  return `You · #${squadYouRank}`;
}

/** Availability rule for the Squad podium template. */
export function podiumAvailability(top3: SharePodiumEntry[]): {
  available: boolean;
  reason?: string;
} {
  if (top3.length < 3) return { available: false, reason: "Needs at least 3 players" };
  return { available: true };
}
