import { db } from "@/lib/db";
import {
  getDailyCompletionSummary,
  getDailyChecklistCompletionSummary,
  computeWeeklyResultSummary,
  dailyTaskPoints,
  getDailyCompletionBonus,
  formatDateKey,
  startOfWeek,
  endOfDay,
  startOfDay,
  daysBetween,
  DAILY_BONUS_THRESHOLD,
  STREAK_BONUS_POINTS,
  type ChallengeTask,
  type TaskLog,
} from "@/lib/scoring";
import {
  BACKFILL_AWARDS_DAILY_BONUS,
  BACKFILL_AWARDS_LEAGUE_BONUS,
  BACKFILL_AWARDS_STREAK_BONUS,
} from "@/lib/backfill-config";
import {
  getLeagueState,
  MIN_DAILY_POINTS_FOR_BONUS,
  INCLUDE_BONUS_IN_LEADERBOARD,
} from "@/lib/leagues";

/** A day is a backfill day when every one of its logs was saved via backfill. */
function isBackfillDay(dayLogs: Pick<TaskLog, "isBackfill">[]): boolean {
  return dayLogs.length > 0 && dayLogs.every((l) => !!l.isBackfill);
}

/**
 * Habit (daily task) points for a day. Backfill days award the discounted
 * totals stored on each log (awardedPoints); on-time days recompute as usual.
 */
function dayHabitPoints(
  dailyTasks: ChallengeTask[],
  dayLogs: TaskLog[]
): number {
  const backfill = isBackfillDay(dayLogs);
  return dailyTasks.reduce((points, task) => {
    const log = dayLogs.find((l) => l.taskId === task.id);
    if (backfill && log && log.awardedPoints != null) {
      return points + log.awardedPoints;
    }
    return points + dailyTaskPoints(task, log);
  }, 0);
}

export async function runDayScoring(
  userId: string,
  challengeId: string,
  onDate: Date
): Promise<void> {
  // 1. Get the challenge and all its tasks
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { tasks: { include: { tiers: true } } },
  });
  if (!challenge) return;

  const tasks = challenge.tasks;
  const dailyTasks = tasks.filter((t) => t.type === "DAILY");

  // 2. Load all task logs for this member
  const allLogs = await db.taskLog.findMany({
    where: { userId, challengeId },
    orderBy: { date: "asc" },
  });

  // Group task logs by date key
  const logsByDate: Record<string, typeof allLogs> = {};
  allLogs.forEach((log) => {
    const key = formatDateKey(log.date);
    if (!logsByDate[key]) logsByDate[key] = [];
    logsByDate[key].push(log);
  });

  // Calculate daily success for all logged dates
  const successKeys = new Set<string>();
  const loggedDates = Object.keys(logsByDate).sort();

  loggedDates.forEach((key) => {
    const dayLogs = logsByDate[key];
    const comp = getDailyCompletionSummary(tasks, dayLogs);
    const isSuccess = comp.total > 0 && comp.percent >= DAILY_BONUS_THRESHOLD * 100;
    if (isSuccess) {
      successKeys.add(key);
    }
  });

  // Determine streaks for the current date
  const run: Date[] = [];
  const d = new Date(onDate);
  while (successKeys.has(formatDateKey(d))) {
    run.unshift(new Date(d));
    d.setDate(d.getDate() - 1);
  }

  // Calculate longest streak overall
  const longest = longestConsecutiveChain([...successKeys]);

  // Shared DaySummary writer, aware of backfill days (a backfilled day keeps
  // its completion status for the streak chain but is awarded no streak,
  // daily-completion, or league bonus).
  async function upsertDaySummary(
    date: Date,
    streakPosition: number | null // 1-based position in the current run; null = not in run
  ): Promise<void> {
    const key = formatDateKey(date);
    const dayLogs = logsByDate[key] || [];
    const backfill = isBackfillDay(dayLogs);
    const comp = getDailyCompletionSummary(tasks, dayLogs);
    const habitPoints = dayHabitPoints(dailyTasks, dayLogs);
    const isSuccess = comp.total > 0 && comp.percent >= DAILY_BONUS_THRESHOLD * 100;

    const dailyBonusApplies = backfill ? BACKFILL_AWARDS_DAILY_BONUS : true;
    let awarded =
      habitPoints +
      (dailyBonusApplies
        ? getDailyCompletionBonus(getDailyChecklistCompletionSummary(tasks, dayLogs))
        : 0);

    const streakBonus =
      streakPosition !== null &&
      streakPosition % 7 === 0 && // STREAK_BONUS_DAYS = 7
      (backfill ? BACKFILL_AWARDS_STREAK_BONUS : true);
    if (streakBonus) awarded += STREAK_BONUS_POINTS;

    // Check Daily League Bonus (requires >= 20 habit points logged that day)
    const existingMember = await db.challengeMember.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    });
    const currentPeak = existingMember?.peakLeaguePoints ?? 0;
    const startOfDayLeague = getLeagueState(currentPeak).league;
    const qualifiesForLeagueBonus =
      !backfill || BACKFILL_AWARDS_LEAGUE_BONUS
        ? habitPoints >= MIN_DAILY_POINTS_FOR_BONUS
        : false;
    const leagueBonus = qualifiesForLeagueBonus ? startOfDayLeague.dailyBonus : 0;

    if (INCLUDE_BONUS_IN_LEADERBOARD && leagueBonus > 0) {
      awarded += leagueBonus;
    }

    // Audit ledger entry in ActivityEvent for league_bonus
    if (leagueBonus > 0) {
      const existingAudit = await db.activityEvent.findFirst({
        where: {
          userId,
          challengeId,
          type: "league_bonus",
          date: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
      });
      if (!existingAudit) {
        await db.activityEvent.create({
          data: {
            userId,
            challengeId,
            date: startOfDay(date),
            type: "league_bonus",
            title: `Daily League Bonus (+${leagueBonus} pts - ${startOfDayLeague.name})`,
            points: leagueBonus,
          },
        });
      }
    }

    await db.daySummary.upsert({
      where: {
        userId_challengeId_date: { userId, challengeId, date: startOfDay(date) },
      },
      update: {
        completedCount: comp.achieved,
        totalCount: comp.total,
        pointsAwarded: awarded,
        dailyBonusAwarded: isSuccess && dailyBonusApplies,
        streakBonusAwarded: streakBonus,
        leagueBonusAwarded: leagueBonus > 0,
        leagueBonusPoints: leagueBonus,
      },
      create: {
        userId,
        challengeId,
        date: startOfDay(date),
        completedCount: comp.achieved,
        totalCount: comp.total,
        pointsAwarded: awarded,
        dailyBonusAwarded: isSuccess && dailyBonusApplies,
        streakBonusAwarded: streakBonus,
        leagueBonusAwarded: leagueBonus > 0,
        leagueBonusPoints: leagueBonus,
      },
    });
  }

  // Update DaySummary records for dates in the current streak run
  for (let i = 0; i < run.length; i++) {
    await upsertDaySummary(run[i], i + 1); // position in current streak
  }

  // If onDate itself is not a success day, ensure it has a DaySummary record
  const onDateKey = formatDateKey(onDate);
  if (!successKeys.has(onDateKey)) {
    await upsertDaySummary(onDate, null);
  }

  // 3. Update Weekly Score for the week containing onDate
  const member = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  if (member) {
    const weekStart = startOfWeek(onDate);
    const weekEnd = endOfDay(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000));

    // Get logs for the entire week
    const weekLogs = await db.taskLog.findMany({
      where: {
        userId,
        challengeId,
        date: { gte: weekStart, lte: weekEnd },
      },
    });

    // Count successful days in this week
    const weekSuccessDays = await db.daySummary.count({
      where: {
        userId,
        challengeId,
        date: { gte: weekStart, lte: weekEnd },
        dailyBonusAwarded: true,
      },
    });

    const tiers = tasks.flatMap((t) => t.tiers);
    const weeklyResult = computeWeeklyResultSummary(
      tasks,
      tiers,
      weekLogs,
      weekSuccessDays,
      7
    );

    const weekNumber = Math.max(1, Math.floor(daysBetween(challenge.startDate, weekStart) / 7) + 1);

    await db.weeklyScore.upsert({
      where: {
        userId_challengeId_weekStart: { userId, challengeId, weekStart },
      },
      update: {
        points: weeklyResult.points,
        weekEnd,
        weekNumber,
      },
      create: {
        userId,
        challengeId,
        weekStart,
        weekEnd,
        weekNumber,
        points: weeklyResult.points,
      },
    });
  }

  // 4. Sync totals
  await syncMemberTotals(userId, challengeId, run.length, longest);
}

export async function syncMemberTotals(
  userId: string,
  challengeId: string,
  currentStreak: number,
  longestStreak: number
) {
  const summaries = await db.daySummary.findMany({
    where: { userId, challengeId },
  });
  const weeklyScores = await db.weeklyScore.findMany({
    where: { userId, challengeId },
  });

  // Weekly points are credited as soon as they are scored. A new WeeklyScore row
  // is created per week (keyed by weekStart = Monday), so the current week's live
  // points count immediately alongside all past weeks, and the weekly bucket
  // naturally resets at the start of Monday.
  const creditedWeeklyPoints = weeklyScores.reduce((s, w) => s + w.points, 0);

  const totalPoints =
    summaries.reduce((s, d) => s + d.pointsAwarded, 0) + creditedWeeklyPoints;

  // League progression points exclude daily league bonuses
  const baseLeaguePoints =
    summaries.reduce((s, d) => s + (d.pointsAwarded - (d.leagueBonusPoints || 0)), 0) +
    creditedWeeklyPoints;

  const membership = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  if (!membership) return;

  const peakLeaguePoints = Math.max(
    membership.peakLeaguePoints || 0,
    baseLeaguePoints,
    0
  );

  await db.challengeMember.update({
    where: { id: membership.id },
    data: {
      points: totalPoints,
      peakLeaguePoints,
      currentStreak,
      longestStreak,
    },
  });

  const currentUser = await db.user.findUnique({ where: { id: userId } });
  const userPeak = Math.max(
    currentUser?.peakLeaguePoints || 0,
    peakLeaguePoints,
    totalPoints,
    0
  );

  await db.user.update({
    where: { id: userId },
    data: {
      totalPoints,
      peakLeaguePoints: userPeak,
      currentStreak,
      longestStreak,
    },
  });
}

function longestConsecutiveChain(keys: string[]): number {
  const set = new Set(keys);
  let best = 0;
  for (const key of set) {
    best = Math.max(best, lenInclusive(set, key));
  }
  return best;
}

function lenInclusive(set: Set<string>, startKey: string): number {
  let len = 0;
  const cur = new Date(startKey + "T00:00:00Z");
  while (set.has(formatDateKey(cur))) {
    len += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return len;
}
