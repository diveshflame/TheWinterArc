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
  /** The three highest-scoring logged activities (may be fewer). */
  activities: ShareActivity[];
  /** Up to the full checklist; ordered done-first, then by points. */
  habits: ShareHabit[];
  habitsDone: number;
  habitsTotal: number;
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
  /** Display name (first name + last initial or full name for squad). */
  name: string;
  /** Initial used as fallback. */
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
  /** Rank of the sharer within the full roster for the selected basis (1-based). */
  squadYouRank: number | null;
  promotion?: SharePromotion;
  /** Private, same-origin Day-1 photo (object URL or base64). Never remote/third-party. */
  day1PhotoUrl?: string | null;
  /** True when a Day-1 photo exists server-side but has not been fetched yet. */
  hasDay1Photo?: boolean;
}

/** The raw roster entry used to build the podium for any basis. */
export interface SquadMember {
  name: string;
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
  rank: boolean;
}
