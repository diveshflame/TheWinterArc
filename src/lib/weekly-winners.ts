// Weekly winners + personal best records for the Ranks page's "Winners" and
// "Your Records" sections.
//
// The modal lists the top scorer (#1) of every completed week of the
// challenge — the current (in-progress) week is excluded.

import { formatDateKey, startOfWeek } from "@/lib/scoring";

export interface WeeklyWinner {
  weekStart: Date;
  weekEnd: Date | null;
  weekNumber: number | null;
  userId: string;
  name: string;
  points: number;
}

export interface WeeklyScoreLike {
  userId: string;
  points: number;
  weekStart: Date;
  weekEnd: Date | null;
  weekNumber: number | null;
}

export interface ComputeWeeklyWinnersInput {
  /** Weekly scores across all weeks of the challenge. */
  scores: WeeklyScoreLike[];
  /** userId -> display name for leaderboard members. */
  namesByUserId: Record<string, string>;
  /** Day summaries grouped by user (needed for full week totals). */
  dailySummariesByUserId?: Record<string, ScoredDay[]>;
  /** Start of the current week (Monday, UTC midnight). Weeks at/after it are in progress. */
  currentWeekStart: Date;
}

/**
 * Computes the #1 winner for each completed week, most recent first.
 * A week's total = daily task points earned that week + weekly-task points;
 * the current in-progress week is skipped.
 */
export function computeWeeklyWinners({
  scores,
  namesByUserId,
  dailySummariesByUserId = {},
  currentWeekStart,
}: ComputeWeeklyWinnersInput): WeeklyWinner[] {
  // Group completed-week scores by week.
  const byWeek = new Map<string, WeeklyScoreLike[]>();
  for (const s of scores) {
    if (s.weekStart.getTime() >= currentWeekStart.getTime()) continue;
    const key = formatDateKey(s.weekStart);
    const list = byWeek.get(key);
    if (list) list.push(s);
    else byWeek.set(key, [s]);
  }

  const winners: WeeklyWinner[] = [];
  for (const weekScores of byWeek.values()) {
    let winner: WeeklyWinner | null = null;
    for (const s of weekScores) {
      const dailySum =
        dailySummariesByUserId[s.userId]?.reduce(
          (acc, d) =>
            acc + (startOfWeek(d.date).getTime() === s.weekStart.getTime() ? d.pointsAwarded : 0),
          0
        ) ?? 0;
      const total = dailySum + s.points;
      if (!winner || total > winner.points) {
        winner = {
          weekStart: s.weekStart,
          weekEnd: s.weekEnd,
          weekNumber: s.weekNumber,
          userId: s.userId,
          name: namesByUserId[s.userId] ?? "Unknown",
          points: total,
        };
      }
    }
    if (winner) winners.push(winner);
  }

  return winners.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

export interface ScoredDay {
  pointsAwarded: number;
  date: Date;
}

export interface BestDay {
  points: number;
  date: Date;
}

/** Highest single-day points awarded so far (till date). */
export function computeBestDay(summaries: ScoredDay[]): BestDay | null {
  let best: BestDay | null = null;
  for (const s of summaries) {
    if (best === null || s.pointsAwarded > best.points) {
      best = { points: s.pointsAwarded, date: s.date };
    }
  }
  return best;
}

export interface BestWeek {
  points: number;
  weekStart: Date;
}

/**
 * Highest total points scored in a single week — daily task points earned that
 * week (from day summaries) plus weekly-task points. The current in-progress
 * week is excluded.
 */
export function computeBestWeek(
  scores: WeeklyScoreLike[],
  dailySummaries: ScoredDay[],
  userId: string,
  currentWeekStart: Date
): BestWeek | null {
  const weekTotals = new Map<number, { weekStart: Date; points: number }>();

  for (const d of dailySummaries) {
    const weekStart = startOfWeek(d.date);
    const key = weekStart.getTime();
    const entry = weekTotals.get(key) ?? { weekStart, points: 0 };
    entry.points += d.pointsAwarded;
    weekTotals.set(key, entry);
  }

  for (const s of scores) {
    if (s.userId !== userId) continue;
    if (s.weekStart.getTime() >= currentWeekStart.getTime()) continue;
    const key = s.weekStart.getTime();
    const entry = weekTotals.get(key) ?? { weekStart: s.weekStart, points: 0 };
    entry.points += s.points;
    weekTotals.set(key, entry);
  }

  let best: BestWeek | null = null;
  for (const entry of weekTotals.values()) {
    if (best === null || entry.points > best.points) {
      best = { points: entry.points, weekStart: entry.weekStart };
    }
  }
  return best;
}

export interface BestMonth {
  points: number;
  monthKey: string;
}

function defaultMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

/** Highest total points scored within a single calendar month. */
export function computeBestMonth(
  scores: WeeklyScoreLike[],
  dailySummaries: ScoredDay[],
  userId: string,
  currentWeekStart: Date
): BestMonth | null {
  const monthTotals = new Map<string, number>();
  const weeklyByMonth = new Map<string, number>();

  for (const s of scores) {
    if (s.userId !== userId) continue;
    if (s.weekStart.getTime() >= currentWeekStart.getTime()) continue;
    const key = defaultMonthKey(s.weekStart);
    weeklyByMonth.set(key, (weeklyByMonth.get(key) ?? 0) + s.points);
  }

  for (const d of dailySummaries) {
    const key = defaultMonthKey(d.date);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + d.pointsAwarded);
  }

  const keys = new Set<string>([...monthTotals.keys(), ...weeklyByMonth.keys()]);
  let best: BestMonth | null = null;
  for (const key of keys) {
    const points = (monthTotals.get(key) ?? 0) + (weeklyByMonth.get(key) ?? 0);
    if (best === null || points > best.points) best = { points, monthKey: key };
  }
  return best;
}
