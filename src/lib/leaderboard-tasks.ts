// Per-task point attribution for the leaderboard's task filter.
//
// Points shown in the leaderboard columns come from aggregates
// (DaySummary.pointsAwarded / WeeklyScore.points / ChallengeMember.points)
// that mix habit points with daily-completion, streak, and league bonuses —
// none of which can be attributed to a single task. This module recomputes
// points strictly from TaskLogs so a task-filtered board shows only what that
// task earned. Filtered totals therefore intentionally do not sum to the
// unfiltered column.

import {
  computeWeeklyResultSummary,
  dailyTaskPoints,
  formatDateKey,
  startOfWeek,
  type ChallengeTask,
  type TaskLog,
  type TaskTier,
} from "@/lib/scoring";

export interface TaskPointTotals {
  today: number;
  week: number;
  overall: number;
}

/** userId -> taskId -> points per leaderboard basis. */
export type TaskPointsByUser = Record<string, Record<string, TaskPointTotals>>;

export interface ComputeTaskPointsInput {
  tasks: ChallengeTask[];
  tiers: TaskTier[];
  /** Every TaskLog of the challenge from its start date up to now. */
  logs: TaskLog[];
  /** All challenge member user ids (seeded with zeros). */
  userIds: string[];
  /** Start of the current local day. */
  todayStart: Date;
  /** Start of the current week (Monday, UTC-midnight day key). */
  weekStart: Date;
}

function zeroTotals(): TaskPointTotals {
  return { today: 0, week: 0, overall: 0 };
}

// ---------------------------------------------------------------------------
// Task categories for the leaderboard's task-filter sheet
// ---------------------------------------------------------------------------

export type TaskCategory = "movement" | "food" | "mind" | "weekly" | "penalty";

// Name keywords used to place a task in MOVEMENT or FOOD. Anything that
// matches neither (and is not weekly/penalty) falls back to MIND & HABITS.
// Deliberately excludes "eat"/"eating" so habits like "No phone while eating"
// stay in MIND & HABITS.
const MOVEMENT_WORDS = [
  "walk", "run", "push", "pull", "situp", "sit-up", "squat", "plank",
  "jog", "swim", "bike", "ride", "step", "jump", "lunge", "cardio",
  "workout", "exercise", "stretch", "mile",
];
const FOOD_WORDS = [
  "protein", "sugar", "junk", "meal", "fruit", "water", "food",
  "diet", "snack", "calorie", "breakfast", "lunch", "dinner", "hydrat",
];

function nameMatches(words: string[], name: string): boolean {
  const lower = name.toLowerCase();
  return words.some((w) => lower.includes(w));
}

/**
 * Places a task in one of the filter sheet's groups. Weekly flag wins first,
 * then negative points (penalties), then MOVEMENT/FOOD keyword matching,
 * with MIND & HABITS as the fallback — in that precedence order.
 */
export function taskCategory(task: {
  name: string;
  type: string;
  points: number;
}): TaskCategory {
  if (task.type === "WEEKLY") return "weekly";
  if (task.points < 0) return "penalty";
  if (nameMatches(MOVEMENT_WORDS, task.name)) return "movement";
  if (nameMatches(FOOD_WORDS, task.name)) return "food";
  return "mind";
}

/** Backfill entries already carry their discounted total on the log. */
function dailyPointsForLog(
  task: ChallengeTask,
  log: TaskLog | undefined
): number {
  if (log?.isBackfill && log.awardedPoints != null) return log.awardedPoints;
  return dailyTaskPoints(task, log);
}

export function computeTaskPointsByUser(
  input: ComputeTaskPointsInput
): TaskPointsByUser {
  const { tasks, tiers, logs, userIds, todayStart, weekStart } = input;

  const byUser: TaskPointsByUser = {};
  const totals = (userId: string, taskId: string): TaskPointTotals => {
    const user = (byUser[userId] ??= {});
    return (user[taskId] ??= zeroTotals());
  };

  userIds.forEach((userId) =>
    tasks.forEach((task) => totals(userId, task.id))
  );

  const todayKey = formatDateKey(todayStart);
  const weekKey = formatDateKey(weekStart);
  const dailyTasks = tasks.filter((t) => t.type === "DAILY");
  const weeklyTasks = tasks.filter((t) => t.type === "WEEKLY");

  // --- DAILY tasks: score every day the user logged anything ---
  // Days with no logs at all are skipped: no scoring ran for them, so the
  // DaySummary-backed columns credit nothing either.
  const dayGroups = new Map<string, TaskLog[]>();
  for (const log of logs) {
    const key = `${log.userId}|${formatDateKey(log.date)}`;
    const group = dayGroups.get(key);
    if (group) group.push(log);
    else dayGroups.set(key, [log]);
  }

  for (const group of dayGroups.values()) {
    const userId = group[0].userId;
    const date = group[0].date;
    const dateKey = formatDateKey(date);
    const isToday = dateKey === todayKey;
    const isThisWeek = date >= weekStart;

    for (const task of dailyTasks) {
      const log = group.find((l) => l.taskId === task.id);
      const points = dailyPointsForLog(task, log);
      if (points === 0) continue;
      const t = totals(userId, task.id);
      t.overall += points;
      if (isThisWeek) t.week += points;
      if (isToday) t.today += points;
    }
  }

  // --- WEEKLY tasks: evaluate week by week (weekly targets reset Mondays) ---
  // "today" stays 0: weekly tasks never award daily points, and the client
  // hides them from the Today tab's filter options. Every log of a week is
  // grouped (not just weekly-task logs) so evaluation matches how
  // score-engine computes WeeklyScore — an unlogged rule-breaker weekly task
  // still earns its points.
  if (weeklyTasks.length > 0) {
    const weekGroups = new Map<string, TaskLog[]>();
    for (const log of logs) {
      const key = `${log.userId}|${formatDateKey(startOfWeek(log.date))}`;
      const group = weekGroups.get(key);
      if (group) group.push(log);
      else weekGroups.set(key, [log]);
    }

    for (const group of weekGroups.values()) {
      const userId = group[0].userId;
      const isCurrentWeek = formatDateKey(startOfWeek(group[0].date)) === weekKey;

      const result = computeWeeklyResultSummary(tasks, tiers, group, 0, 7);
      for (const taskResult of result.taskResults) {
        if (taskResult.points === 0) continue;
        const t = totals(userId, taskResult.taskId);
        t.overall += taskResult.points;
        if (isCurrentWeek) t.week += taskResult.points;
      }
    }
  }

  return byUser;
}
