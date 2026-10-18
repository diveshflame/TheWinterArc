// Config flags for the "Log yesterday" (backfill) feature. Kept in a leaf
// module (no imports) so both scoring math and server actions can share them
// without circular dependencies. Flip these to change product behavior.

/** Positive points on a backfilled day are worth this fraction, floored per task. */
export const BACKFILL_PENALTY_FACTOR = 0.7;

/** Streak bonus (+15 every 7th streak day) is NOT awarded for a backfilled day. */
export const BACKFILL_AWARDS_STREAK_BONUS = false;

/** Daily-completion bonus tiers (+5 / +15) are NOT awarded for a backfilled day. */
export const BACKFILL_AWARDS_DAILY_BONUS = false;

/** A backfilled day DOES count as a logged day toward weekly targets (Gym, etc). */
export const BACKFILL_COUNTS_TOWARD_WEEKLY = true;

/** The daily league bonus is NOT awarded for a backfilled day. */
export const BACKFILL_AWARDS_LEAGUE_BONUS = false;
