import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPrimaryChallenge, getUserChallenges } from "@/lib/queries";
import { startOfWeek, startOfDay, endOfDay } from "@/lib/scoring";
import { computeTaskPointsByUser, taskCategory } from "@/lib/leaderboard-tasks";
import {
  computeBestDay,
  computeBestMonth,
  computeBestWeek,
  computeWeeklyWinners,
  type ScoredDay,
  type WeeklyWinner,
} from "@/lib/weekly-winners";
import { AppShell } from "@/components/app-shell";
import { LeaderboardClient } from "@/components/leaderboard-client";
import { ChallengeSwitcher } from "@/components/challenge-switcher";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ c?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const resolvedParams = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const preferredChallengeId =
    resolvedParams.c || cookieStore.get("active_challenge_id")?.value;

  const [membership, userChallenges] = await Promise.all([
    getPrimaryChallenge(session.user.id, preferredChallengeId),
    getUserChallenges(session.user.id),
  ]);
  if (!membership) redirect("/challenges/new");
  const challengeId = membership.challenge.id;

  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfDay(new Date());

  const members = await db.challengeMember.findMany({
    where: { challengeId },
    include: {
      user: {
        select: {
          name: true,
          image: true,
          mantra: true,
          peakLeaguePoints: true,
        },
      },
    },
  });

  const todayScores = await db.daySummary.findMany({
    where: { challengeId, date: { gte: dayStart, lte: dayEnd } },
    select: { userId: true, pointsAwarded: true },
  });
  const weekScores = await db.daySummary.findMany({
    where: { challengeId, date: { gte: weekStart, lte: weekEnd } },
    select: { userId: true, pointsAwarded: true },
  });
  const weekChallengeScores = await db.weeklyScore.findMany({
    where: { challengeId, weekStart },
    select: { userId: true, points: true },
  });

  const todayByUser = new Map<string, number>();
  todayScores.forEach((l) =>
    todayByUser.set(l.userId, (todayByUser.get(l.userId) ?? 0) + l.pointsAwarded)
  );
  // "This Week" = every point earned since Monday (daily + streak/bonus points)
  // plus any points earned from weekly challenges logged this week.
  const weekByUser = new Map<string, number>();
  weekScores.forEach((l) =>
    weekByUser.set(l.userId, (weekByUser.get(l.userId) ?? 0) + l.pointsAwarded)
  );
  weekChallengeScores.forEach((l) =>
    weekByUser.set(l.userId, (weekByUser.get(l.userId) ?? 0) + l.points)
  );

  const tasks = membership.challenge.tasks;
  const tiers = tasks.flatMap((t) => t.tiers);

  // Every weekly score of the challenge, so the Winners modal can list the
  // top scorer of each week (current/in-progress week excluded downstream).
  const allWeeklyScores = await db.weeklyScore.findMany({
    where: { challengeId },
    orderBy: { weekStart: "asc" },
  });

  // Every day summary of the challenge, so week totals (daily + weekly task
  // points) can be computed for each member when picking weekly winners.
  const allDaySummaries = await db.daySummary.findMany({
    where: { challengeId },
    orderBy: { date: "asc" },
  });

  const dailySummariesByUserId: Record<string, ScoredDay[]> = {};
  for (const d of allDaySummaries) {
    const list = dailySummariesByUserId[d.userId] ?? [];
    list.push({ pointsAwarded: d.pointsAwarded, date: d.date });
    dailySummariesByUserId[d.userId] = list;
  }

  const weeklyWinners: WeeklyWinner[] = computeWeeklyWinners({
    scores: allWeeklyScores,
    namesByUserId: Object.fromEntries(
      members.map((m) => [m.userId, m.user.name ?? "Unknown"])
    ),
    dailySummariesByUserId,
    currentWeekStart: startOfWeek(new Date()),
  });

  // Personal best records for the signed-in user (active challenge).
  const myDaySummaries = await db.daySummary.findMany({
    where: { userId: session.user.id, challengeId },
    orderBy: { date: "asc" },
  });
  const myRecords = {
    bestDay: computeBestDay(myDaySummaries),
    bestWeek: computeBestWeek(
      allWeeklyScores,
      myDaySummaries,
      session.user.id,
      startOfWeek(new Date())
    ),
    bestMonth: computeBestMonth(
      allWeeklyScores,
      myDaySummaries,
      session.user.id,
      startOfWeek(new Date())
    ),
  };
  // Filter options: grouped by category, never including negative-point tasks.
  const filterableTasks = tasks
    .filter((t) => t.points >= 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      category: taskCategory(t),
    }));
  const challengeLogs = await db.taskLog.findMany({
    where: { challengeId, date: { gte: membership.challenge.startDate } },
  });

  const taskPointsByUser = computeTaskPointsByUser({
    tasks,
    tiers,
    logs: challengeLogs,
    userIds: members.map((m) => m.userId),
    todayStart: dayStart,
    weekStart,
  });

  const rows = members.map((m) => {
    const peakPoints = Math.max(
      m.peakLeaguePoints || 0,
      m.points || 0,
      m.user.peakLeaguePoints || 0
    );
    return {
      userId: m.userId,
      name: m.user.name ?? "Unknown",
      image: m.user.image,
      mantra: m.user.mantra,
      today: todayByUser.get(m.userId) ?? 0,
      week: weekByUser.get(m.userId) ?? 0,
      overall: m.points,
      peakLeaguePoints: peakPoints,
      streak: m.currentStreak,
      taskPoints: taskPointsByUser[m.userId] ?? {},
    };
  });

  const today = [...rows].sort((a, b) => b.today - a.today || b.week - a.week);
  const week = [...rows].sort((a, b) => b.week - a.week || b.overall - a.overall);
  const overall = [...rows].sort((a, b) => b.overall - a.overall);

  return (
    <AppShell>
      <div className="py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leaderboards</h1>
            <p className="text-muted text-xs">{membership.challenge.name}</p>
          </div>
          {userChallenges.length > 0 && (
            <ChallengeSwitcher
              challenges={userChallenges}
              activeChallengeId={membership.challenge.id}
            />
          )}
        </div>
        <LeaderboardClient
          today={today}
          week={week}
          overall={overall}
          tasks={filterableTasks}
          myUserId={session.user.id}
          weeklyWinners={weeklyWinners}
          myRecords={myRecords}
        />
      </div>
    </AppShell>
  );
}
