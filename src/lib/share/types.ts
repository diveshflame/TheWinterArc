import type { LeagueIconType } from "@/lib/leagues";

/** Semantic activity glyphs available to the share cards (rendered as inline SVG). */
export type ShareIconType =
  | "run"
  | "walk"
  | "push"
  | "pull"
  | "water"
  | "sleep"
  | "food"
  | "read"
  | "shower"
  | "bed"
  | "flame"
  | "generic";

export interface ShareActivity {
  label: string;
  /** Numeric logged value for NUMBER tasks, otherwise null. */
  value: number | null;
  unit: string | null;
  points: number;
  icon: ShareIconType;
}

export interface ShareHabit {
  /** ChallengeTask id — used as the stable key for receipt selection/ordering. */
  id: string;
  label: string;
  done: boolean;
  points: number;
}

export interface ShareUser {
  firstName: string;
  lastInitial: string;
}

export interface ShareChallenge {
  name: string;
  dayNumber: number;
  totalDays: number;
}

export interface ShareToday {
  points: number;
  /**
   * Whether any task was logged today. Availability gates use this (not the
   * net total) so a penalty-heavy day that WAS logged never says "Log
   * something first".
   */
  loggedToday: boolean;
  /** The three highest-scoring logged activities (may be fewer). */
  activities: ShareActivity[];
  /**
   * Every checklist habit for today (the "habitsToday" data the receipt and
   * checklist cards consume): id, label, points and done flag, ordered by
   * points descending with ties in the order the habits appear in the app.
   */
  habits: ShareHabit[];
  habitsDone: number;
  habitsTotal: number;
}

/** One day of per-day history for the sharer (days with no logs are all zeros). */
export interface ShareDayHistory {
  dayNumber: number;
  /** ISO date (YYYY-MM-DD) of that challenge day. */
  date: string;
  points: number;
  pushups: number;
  pullups: number;
  runKm: number;
  walkKm: number;
}

export interface ShareLeague {
  name: string;
  division: string | null;
  persona: string;
  color: string;
  icon: LeagueIconType;
  totalPoints: number;
  bonusPerDay: number;
}

export interface ShareRank {
  position: number;
  total: number;
}

export interface SharePodiumEntry {
  userId: string;
  /** First name shown under the avatar (masked to "#N" when hiding others). */
  firstName: string;
  /** Full display name (first name + last initial or the profile name). */
  name: string;
  /** Initial used as layout fallback only — cards render a generic silhouette. */
  initial: string;
  /** User avatar (base64 or URL) if available. */
  avatarUrl?: string | null;
  points: number;
  isYou: boolean;
}

export type SquadBasis = "overall" | "week" | "today";

export interface SharePromotion {
  toLeague: string;
  toDivision: string | null;
  persona: string;
  newBonusPerDay: number;
}

/**
 * The single object every card consumes. Assembled once from server data.
 * Cards are pure presentational components of this object — no fetching.
 */
export interface ShareCardData {
  user: ShareUser;
  challenge: ShareChallenge;
  today: ShareToday;
  streak: number;
  league: ShareLeague;
  rank: ShareRank | null;
  squadTop3: SharePodiumEntry[];
  /** Rank of the sharer within the full roster by overall points (1-based). */
  squadYouRank: number | null;
  /** Which leaderboard the podium ranks by (server default: overall). */
  squadBasis?: SquadBasis;
  /** Per-day history for days 1..current day (points + movement metrics). */
  dayHistory: ShareDayHistory[];
  /** Invite URL from NEXT_PUBLIC_INVITE_URL, when configured. */
  inviteUrl?: string | null;
  promotion?: SharePromotion;
}

/** The raw roster entry used to build the podium (always ranked by overall). */
export interface SquadMember {
  userId: string;
  name: string;
  firstName: string;
  avatarUrl?: string | null;
  isYou: boolean;
  overall: number;
  week: number;
  today: number;
}

export type BackgroundType = "photo" | "color" | "clear";

export interface BackgroundState {
  type: BackgroundType;
  /** object URL for a user photo (same-origin, EXIF-stripped). */
  photoUrl?: string | null;
  /** preset key when type === "color". */
  colorKey?: string;
}

export interface CardToggleState {
  name: boolean;
  points: boolean;
  league: boolean;
  /** Podium "You · #N" line (defaults to off). */
  rank: boolean;
  /** Podium privacy: mask other members' photos and names. */
  hideOthers: boolean;
}

export const DEFAULT_TOGGLES: CardToggleState = {
  name: true,
  points: true,
  league: true,
  rank: false,
  hideOthers: false,
};
