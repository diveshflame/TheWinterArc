import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPrimaryChallenge, getUserChallenges } from "@/lib/queries";
import { startOfWeek, startOfDay, endOfDay } from "@/lib/scoring";
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
    include: { user: { select: { name: true, image: true, mantra: true } } },
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

  const rows = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? "Unknown",
    image: m.user.image,
    mantra: m.user.mantra,
    today: todayByUser.get(m.userId) ?? 0,
    week: weekByUser.get(m.userId) ?? 0,
    overall: m.points,
    streak: m.currentStreak,
  }));

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
          myUserId={session.user.id}
        />
      </div>
    </AppShell>
  );
}
