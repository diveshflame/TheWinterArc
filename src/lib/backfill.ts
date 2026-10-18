// "Log yesterday" (backfill) domain logic: config flags, penalty math, and
// date-key helpers. Calendar keys follow the app-wide convention of
// formatDateKey (YYYY-MM-DD of the *local* calendar day, stored at UTC
// midnight), so server and client agree once the client's claimed date has
// been staleness-checked (see isWithinDays).
//
// Rules enforced here and on the server (see actions.saveBackfillLogs):
// 1. Only the immediately previous calendar day can be backfilled.
// 2. Eligible only with zero logs for that day and membership on that day.
//    One backfill save per day; the day is locked afterwards.
// 3. Positive points are multiplied by BACKFILL_PENALTY_FACTOR and floored
//    per task: final = floor(normalPoints × 0.7).
// 4. Penalty tasks (negative points) apply at full value — never discounted.
// 5. Logs store originalPoints, awardedPoints, isBackfill, and loggedAt while
//    `date` remains the backfilled day.

import {
  numberTaskPoints,
  earnedBlocks,
  type ChallengeTask,
} from "@/lib/scoring";
import { BACKFILL_PENALTY_FACTOR } from "@/lib/backfill-config";

// --- Config flags (defaults for open product decisions; easy to flip) ------
// Defined in backfill-config.ts (a leaf module) and re-exported here.

export {
  BACKFILL_PENALTY_FACTOR,
  BACKFILL_AWARDS_STREAK_BONUS,
  BACKFILL_AWARDS_DAILY_BONUS,
  BACKFILL_COUNTS_TOWARD_WEEKLY,
  BACKFILL_AWARDS_LEAGUE_BONUS,
} from "@/lib/backfill-config";

// --- Points math ------------------------------------------------------------

/**
 * Applies the backfill factor to an on-time point value. Negative points
 * (penalties) pass through untouched (rule 4); positives are floored (rule 3).
 */
export function applyBackfillFactor(points: number): number {
  if (points <= 0) return points;
  return Math.floor(points * BACKFILL_PENALTY_FACTOR);
}

/**
 * The points a task entry would have been worth ON TIME (no backfill factor,
 * no streak/daily/league bonuses — those are day-level). Mirrors
 * dailyTaskPoints for DAILY tasks and numberTaskPoints for NUMBER tasks.
 */
export function onTimeTaskPoints(
  task: ChallengeTask,
  entry: { completed: boolean; value: number; bonusPoints?: number }
): number {
  if (task.inputType === "NUMBER") {
    if (!entry.value || entry.value <= 0) return 0;
    // Include distance/rep threshold bonuses before the 0.7 factor (rule 3).
    return numberTaskPoints(entry.value, task);
  }
  if (task.type !== "DAILY") return 0;
  const earnsPoints = task.isRuleBreaker ? !entry.completed : entry.completed;
  return earnsPoints ? task.points : 0;
}

/** Awarded points for a backfilled entry: discounted if positive, full if penalty. */
export function backfillAwardedPoints(
  task: ChallengeTask,
  entry: { completed: boolean; value: number; bonusPoints?: number }
): number {
  return applyBackfillFactor(onTimeTaskPoints(task, entry));
}

// --- Date-key helpers -------------------------------------------------------

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Parses a YYYY-MM-DD key into a UTC-midnight Date (the app's stored form). */
export function dateKeyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The canonical "today" key: the user's LOCAL calendar day (YYYY-MM-DD),
 * matching the app's startOfDay storage convention. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The canonical "yesterday" key (user's local calendar day). */
export function yesterdayKey(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysToKey(key: string, days: number): string {
  const d = dateKeyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Whole days from key a to key b (positive when b is later). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round(
    (dateKeyToUtcDate(b).getTime() - dateKeyToUtcDate(a).getTime()) / (24 * 60 * 60 * 1000)
  );
}

/**
 * Staleness bound for client-claimed dates: user timezones span UTC−12..+14,
 * so a client's local date can only ever be within one day of the server's.
 * Anything further is a stale or forged request (midnight rollover race).
 */
export function isWithinDays(
  clientKey: string,
  serverKey: string,
  maxDays = 1
): boolean {
  return Math.abs(daysBetweenKeys(serverKey, clientKey)) <= maxDays;
}

// --- Display formatting (weekday/date derived from the KEY, not the server TZ)

export function keyWeekdayLong(key: string): string {
  return dateKeyToUtcDate(key).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** e.g. "Sun 10/18" */
export function keyWeekdayShort(key: string): string {
  return dateKeyToUtcDate(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** e.g. "10/18/2026" */
export function keyNumericDate(key: string): string {
  return dateKeyToUtcDate(key).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** e.g. "Sun 10/18" for the confirm sheet title companion. */
export function keyShortNumeric(key: string): string {
  return dateKeyToUtcDate(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

// --- Eligibility ------------------------------------------------------------

export type BackfillIneligibleReason =
  | "already_logged"
  | "not_in_challenge_yet"
  | "challenge_starts_later";

/**
 * Server-side eligibility (rule 2): zero logs for the day, and the user was
 * in the challenge that day (joined on/before it, challenge already started).
 * Date keys are compared lexicographically (YYYY-MM-DD).
 */
export function evaluateBackfillEligibility(input: {
  targetKey: string;
  existingLogCount: number;
  memberJoinedKey: string;
  challengeStartKey: string;
}): { eligible: boolean; reason?: BackfillIneligibleReason } {
  if (input.existingLogCount > 0) {
    return { eligible: false, reason: "already_logged" };
  }
  if (input.memberJoinedKey > input.targetKey) {
    return { eligible: false, reason: "not_in_challenge_yet" };
  }
  if (input.challengeStartKey > input.targetKey) {
    return { eligible: false, reason: "challenge_starts_later" };
  }
  return { eligible: true };
}

// --- Movement points (used by the backfill UI and server save) --------------

/**
 * On-time points for a NUMBER task including its threshold bonus, then the
 * backfill factor. Used for movement rows in the backfill UI and by the
 * server when persisting a backfill entry.
 */
export function backfillNumberTaskPoints(
  value: number,
  task: ChallengeTask
): { original: number; awarded: number } {
  const original = value > 0 ? numberTaskPoints(value, task) : 0;
  return { original, awarded: applyBackfillFactor(original) };
}

/** The on-time bonus a NUMBER task would grant at this value (stored on the log). */
export function thresholdBonusFor(value: number, task: ChallengeTask): number {
  const threshold = task.bonusThreshold;
  const bonus = task.bonusPoints;
  if (threshold && threshold > 0 && bonus && value >= threshold) return bonus;
  return 0;
}

/** Blocks-based (pre-bonus) points, exposed for server-side recomputation. */
export function blockPointsFor(value: number, task: ChallengeTask): number {
  return earnedBlocks(value, task) * task.points;
}
