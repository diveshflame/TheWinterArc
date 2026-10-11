import {
  dailyTaskPoints,
  getDailyChecklistCompletionSummary,
  getDailyCompletionBonus,
  daysBetween,
  type ChallengeTask,
  type TaskLog,
} from "@/lib/scoring";
import { getLeagueState } from "@/lib/leagues";
import { deriveUser, formatValue, inferIcon } from "@/lib/share/format";
import type {
  ShareActivity,
  ShareCardData,
  ShareDayHistory,
  ShareHabit,
  SharePodiumEntry,
  SharePromotion,
  SquadBasis,
  SquadMember,
} from "@/lib/share/types";
import type { BackgroundType } from "@/lib/share/types";

type TaskLike = Pick<
  ChallengeTask,
  "id" | "name" | "type" | "inputType" | "points" | "unit" | "isRuleBreaker"
> & { unitCount?: number | null };

type LogLike = Pick<TaskLog, "taskId" | "completed" | "value" | "bonusPoints">;

const MAX_ACTIVITIES = 3;

/** The three highest-scoring logged activities today. */
export function topActivities(
  tasks: TaskLike[],
  logs: LogLike[],
  limit = MAX_ACTIVITIES
): ShareActivity[] {
  const scored = logs
    .map((log) => {
      const task = tasks.find((t) => t.id === log.taskId);
      if (!task) return null;
      const points = dailyTaskPoints(task as ChallengeTask, log as TaskLog);
      if (points <= 0) return null;
      const value = task.inputType === "NUMBER" ? log.value : null;
      return {
        label: task.name,
        value,
        unit: task.unit ?? null,
        points,
        icon: inferIcon(task.name),
      } satisfies ShareActivity;
    })
    .filter((a): a is ShareActivity => a !== null);

  return scored.sort((a, b) => b.points - a.points).slice(0, limit);
}

/** Every daily checklist habit with a resolved done flag. */
export function buildHabits(tasks: TaskLike[], logs: LogLike[]): ShareHabit[] {
  return tasks
    .filter((t) => t.type === "DAILY" && t.inputType !== "NUMBER")
    .map((task) => {
      const log = logs.find((l) => l.taskId === task.id);
      const done = task.isRuleBreaker ? !log?.completed : Boolean(log?.completed);
      return { id: task.id, label: task.name, done, points: task.points } satisfies ShareHabit;
    })
    .sort((a, b) => b.points - a.points);
}

/** Total points earned today, matching the log screen's live total. */
export function computeTodayPoints(tasks: TaskLike[], logs: LogLike[]): number {
  const completion = getDailyChecklistCompletionSummary(
    tasks as ChallengeTask[],
    logs as TaskLog[]
  );
  return tasks.reduce(
    (points, task) =>
      points + dailyTaskPoints(task as ChallengeTask, logs.find((l) => l.taskId === task.id)),
    getDailyCompletionBonus(completion)
  );
}

/** Rank a roster for a chosen basis and produce the top-3 podium + user rank. */
export function buildSquad(
  members: SquadMember[],
  basis: SquadBasis
): { top3: SharePodiumEntry[]; youRank: number | null } {
  const sorted = [...members].sort(
    (a, b) => b[basis] - a[basis] || a.name.localeCompare(b.name)
  );
  const top3: SharePodiumEntry[] = sorted.slice(0, 3).map((m) => ({
    userId: m.userId,
    firstName: m.firstName || m.name.trim().split(" ")[0] || m.name,
    name: m.name,
    initial: m.name.trim().charAt(0).toUpperCase() || "?",
    avatarUrl: m.avatarUrl ?? null,
    points: m[basis],
    isYou: m.isYou,
  }));
  const idx = sorted.findIndex((m) => m.isYou);
  return { top3, youRank: idx >= 0 ? idx + 1 : null };
}

/** Which promotion layout to use — never a full-screen overlay on a user photo. */
export function choosePromotionVariant(backgroundType: BackgroundType): "full" | "compact" {
  return backgroundType === "photo" ? "compact" : "full";
}

export interface BuildShareCardDataInput {
  userName: string | null;
  challenge: { name: string; startDate: Date; endDate: Date };
  tasks: TaskLike[];
  todayLogs: LogLike[];
  streak: number;
  peakLeaguePoints: number;
  rank: { position: number; total: number } | null;
  squadTop3?: SharePodiumEntry[];
  squadYouRank?: number | null;
  /** Leaderboard basis for the podium (defaults to overall). */
  squadBasis?: SquadBasis;
  /** Per-day history for days 1..current day (defaults to an empty list). */
  dayHistory?: ShareDayHistory[];
  /** Invite URL from NEXT_PUBLIC_INVITE_URL, when configured. */
  inviteUrl?: string | null;
  promotion?: SharePromotion;
  /** Optionally override the derived today total. */
  todayPoints?: number;
  /** Current date used for day-number math (defaults to now). */
  now?: Date;
}

/** Assemble the single object every card consumes. Pure and side-effect free. */
export function buildShareCardData(input: BuildShareCardDataInput): ShareCardData {
  const now = input.now ?? new Date();
  const dayNumber = Math.max(1, daysBetween(input.challenge.startDate, now) + 1);
  const totalDays = Math.max(1, daysBetween(input.challenge.startDate, input.challenge.endDate) + 1);
  const leagueState = getLeagueState(input.peakLeaguePoints);
  const habits = buildHabits(input.tasks, input.todayLogs);

  return {
    user: deriveUser(input.userName),
    challenge: {
      name: input.challenge.name,
      dayNumber,
      totalDays,
    },
    today: {
      points: input.todayPoints ?? computeTodayPoints(input.tasks, input.todayLogs),
      loggedToday: input.todayLogs.length > 0,
      activities: topActivities(input.tasks, input.todayLogs),
      habits,
      habitsDone: habits.filter((h) => h.done).length,
      habitsTotal: habits.length,
    },
    streak: input.streak,
    league: {
      name: leagueState.league.name,
      division: leagueState.division,
      persona: leagueState.league.persona,
      color: leagueState.league.color,
      icon: leagueState.league.icon,
      totalPoints: leagueState.currentPoints,
      bonusPerDay: leagueState.league.dailyBonus,
    },
    rank: input.rank,
    squadTop3: input.squadTop3 ?? [],
    squadYouRank: input.squadYouRank ?? null,
    squadBasis: input.squadBasis ?? "overall",
    dayHistory: input.dayHistory ?? [],
    inviteUrl: input.inviteUrl ?? null,
    promotion: input.promotion,
  };
}

export { formatValue };
