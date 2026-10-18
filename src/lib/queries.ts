import { db } from "@/lib/db";
import {
  startOfWeek,
  endOfDay,
  startOfDay,
  getDailyCompletionSummary,
  computeWeeklyResultSummary,
  formatDateKey,
} from "@/lib/scoring";
import {
  addDaysToKey,
  dateKeyToUtcDate,
  evaluateBackfillEligibility,
  keyNumericDate,
  keyWeekdayLong,
  keyWeekdayShort,
  type BackfillIneligibleReason,
} from "@/lib/backfill";

export interface UserChallengeSummary {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  ended: boolean;
  isAdmin: boolean;
  points: number;
  currentStreak: number;
  longestStreak: number;
  memberCount: number;
}

export async function getUserChallenges(userId: string): Promise<UserChallengeSummary[]> {
  const memberships = await db.challengeMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    include: {
      challenge: {
        include: {
          _count: {
            select: { members: true },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.challenge.id,
    name: m.challenge.name,
    description: m.challenge.description,
    startDate: m.challenge.startDate,
    endDate: m.challenge.endDate,
    isActive: m.challenge.isActive,
    ended: m.challenge.ended,
    isAdmin: m.challenge.adminId === userId,
    points: m.points,
    currentStreak: m.currentStreak,
    longestStreak: m.longestStreak,
    memberCount: m.challenge._count.members,
  }));
}

export async function getPrimaryChallenge(userId: string, preferredChallengeId?: string | null) {
  if (preferredChallengeId) {
    const specific = await db.challengeMember.findUnique({
      where: {
        challengeId_userId: {
          challengeId: preferredChallengeId,
          userId,
        },
      },
      include: {
        challenge: {
          include: {
            tasks: {
              include: { tiers: true },
            },
          },
        },
      },
    });
    if (specific) return specific;
  }

  // Fallback 1: most recently joined active challenge
  const activeMembership = await db.challengeMember.findFirst({
    where: { userId, challenge: { isActive: true } },
    orderBy: { joinedAt: "desc" },
    include: {
      challenge: {
        include: {
          tasks: {
            include: { tiers: true },
          },
        },
      },
    },
  });
  if (activeMembership) return activeMembership;

  // Fallback 2: any membership (even if ended/inactive)
  const anyMembership = await db.challengeMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    include: {
      challenge: {
        include: {
          tasks: {
            include: { tiers: true },
          },
        },
      },
    },
  });
  return anyMembership ?? null;
}

export async function getTodayLogs(userId: string, challengeId: string) {
  const today = startOfDay(new Date());
  return db.taskLog.findMany({
    where: {
      userId,
      challengeId,
      date: today,
    },
  });
}

export async function getWeekLogs(userId: string, challengeId: string) {
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfDay(new Date());
  return db.taskLog.findMany({
    where: {
      userId,
      challengeId,
      date: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { date: "asc" },
  });
}

export interface BackfillEligibility {
  eligible: boolean;
  reason?: BackfillIneligibleReason;
  /** YYYY-MM-DD key of the (only) backfillable day: clientToday − 1. */
  yesterdayKey: string;
  /** The client-claimed "today" the check ran against. */
  clientTodayKey: string;
  /** Display helpers derived from the key, timezone-independent. */
  yesterdayWeekday: string; // "Sunday"
  yesterdayShort: string;   // "Sun 10/18"
  yesterdayNumeric: string; // "10/18/2026"
}

/**
 * Server-side eligibility for the "Log yesterday" (backfill) flow, evaluated
 * against the user's local calendar day (rule 1 + rule 2): only the day before
 * `clientTodayKey` is backfillable, it must have zero logs, and the user must
 * have been in the challenge that day. `clientTodayKey` is validated for
 * staleness by the caller (actions.checkBackfillEligibility).
 */
export async function getBackfillEligibility(
  userId: string,
  challengeId: string,
  clientTodayKey: string
): Promise<BackfillEligibility> {
  const yKey = addDaysToKey(clientTodayKey, -1);
  const base: Omit<BackfillEligibility, "eligible" | "reason"> = {
    yesterdayKey: yKey,
    clientTodayKey,
    yesterdayWeekday: keyWeekdayLong(yKey),
    yesterdayShort: keyWeekdayShort(yKey),
    yesterdayNumeric: keyNumericDate(yKey),
  };

  const membership = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
    include: { challenge: { select: { startDate: true } } },
  });
  if (!membership) {
    return { ...base, eligible: false, reason: "not_in_challenge_yet" };
  }

  const existingLogCount = await db.taskLog.count({
    where: { userId, challengeId, date: dateKeyToUtcDate(yKey) },
  });

  const verdict = evaluateBackfillEligibility({
    targetKey: yKey,
    existingLogCount,
    memberJoinedKey: formatDateKey(membership.joinedAt),
    challengeStartKey: formatDateKey(membership.challenge.startDate),
  });

  return { ...base, ...verdict };
}

export interface DashboardData {
  challenge: Awaited<ReturnType<typeof getPrimaryChallenge>>;
  userChallenges: UserChallengeSummary[];
  todayLogs: Awaited<ReturnType<typeof getTodayLogs>>;
  completionToday: ReturnType<typeof getDailyCompletionSummary> | null;
  weekLogs: Awaited<ReturnType<typeof getWeekLogs>>;
  weekResult: ReturnType<typeof computeWeeklyResultSummary> | null;
  rank: number;
  memberCount: number;
  totalPoints: number;
  daysToLeaderboardRest: number;
}

export async function getDashboardData(
  userId: string,
  preferredChallengeId?: string | null
): Promise<DashboardData> {
  const [membership, userChallenges] = await Promise.all([
    getPrimaryChallenge(userId, preferredChallengeId),
    getUserChallenges(userId),
  ]);
  const challenge = membership?.challenge ?? null;

  if (!challenge || !membership) {
    return {
      challenge: null,
      userChallenges,
      todayLogs: [],
      completionToday: null,
      weekLogs: [],
      weekResult: null,
      rank: 0,
      memberCount: 0,
      totalPoints: 0,
      daysToLeaderboardRest: 0,
    };
  }

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfDay(new Date());

  const [todayLogs, weekLogs, weekSuccessDays, rankers] = await Promise.all([
    getTodayLogs(userId, challenge.id),
    getWeekLogs(userId, challenge.id),
    db.daySummary.count({
      where: {
        userId,
        challengeId: challenge.id,
        date: { gte: weekStart, lte: weekEnd },
        dailyBonusAwarded: true,
      },
    }),
    db.challengeMember.findMany({
      where: { challengeId: challenge.id },
      orderBy: [{ points: "desc" }, { joinedAt: "asc" }],
      select: { userId: true },
    }),
  ]);

  const tasks = challenge.tasks;
  const tiers = tasks.flatMap((t) => t.tiers);
  const weekResult = computeWeeklyResultSummary(
    tasks,
    tiers,
    weekLogs,
    weekSuccessDays,
    7
  );

  const completionToday = getDailyCompletionSummary(tasks, todayLogs);

  const rank =
    rankers.findIndex((m) => m.userId === userId) + 1 || rankers.length;
  const memberCount = rankers.length;

  const now = new Date();
  const sunday = startOfWeek(now);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const daysToLeaderboardRest = Math.max(
    0,
    Math.ceil((sunday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    challenge: membership,
    userChallenges,
    todayLogs,
    completionToday,
    weekLogs,
    weekResult,
    rank,
    memberCount,
    totalPoints: membership.points,
    daysToLeaderboardRest,
  };
}
