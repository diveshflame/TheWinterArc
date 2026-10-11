import { db } from "@/lib/db";
import { startOfDay, startOfWeek } from "@/lib/scoring";
import { buildShareCardData } from "@/lib/share/build-share-data";
import type { ShareCardData, SquadMember } from "@/lib/share/types";

export interface ShareBundle {
  data: ShareCardData;
  squadMembers: SquadMember[];
  hasDay1Photo: boolean;
  avatarUrl: string | null;
}

/**
 * Assemble everything the share sheet needs for one user in one challenge:
 * the card data, the full roster (for switchable podium bases), whether a
 * stored Day-1 photo exists, and the avatar URL. The Day-1 image itself is NOT
 * loaded here — it is fetched lazily via the getDay1Photo action.
 */
export async function getShareBundle(
  userId: string,
  challengeId: string
): Promise<ShareBundle | null> {
  const membership = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
    include: {
      user: true,
      challenge: { include: { tasks: { include: { tiers: true } } } },
    },
  });
  if (!membership) return null;

  const challenge = membership.challenge;
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date());

  const [todayLogs, members, weekly, daySummaries, day1] = await Promise.all([
    db.taskLog.findMany({ where: { userId, challengeId, date: today } }),
    db.challengeMember.findMany({
      where: { challengeId },
      include: { user: { select: { id: true, name: true, displayName: true, image: true } } },
    }),
    db.weeklyScore.findMany({
      where: { challengeId, weekStart },
      select: { userId: true, points: true },
    }),
    db.daySummary.findMany({
      where: { challengeId, date: today },
      select: { userId: true, pointsAwarded: true },
    }),
    db.day1Photo.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
      select: { id: true },
    }),
  ]);

  const weekMap = new Map(weekly.map((w) => [w.userId, w.points]));
  const todayMap = new Map(daySummaries.map((d) => [d.userId, d.pointsAwarded]));

  const squadMembers: SquadMember[] = members.map((m) => ({
    name: m.user.displayName ?? m.user.name ?? "Player",
    avatarUrl: m.user.image ?? null,
    isYou: m.userId === userId,
    overall: m.points,
    week: weekMap.get(m.userId) ?? 0,
    today: todayMap.get(m.userId) ?? 0,
  }));

  const byOverall = [...squadMembers].sort(
    (a, b) => b.overall - a.overall || a.name.localeCompare(b.name)
  );
  const rankPos = byOverall.findIndex((m) => m.isYou) + 1;

  const data = buildShareCardData({
    userName: membership.user.displayName ?? membership.user.name,
    challenge: {
      name: challenge.name,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
    },
    tasks: challenge.tasks,
    todayLogs,
    streak: membership.currentStreak,
    peakLeaguePoints: membership.peakLeaguePoints,
    rank: rankPos > 0 ? { position: rankPos, total: squadMembers.length } : null,
    hasDay1Photo: Boolean(day1),
    todayPoints: todayMap.get(userId),
  });

  return {
    data,
    squadMembers,
    hasDay1Photo: Boolean(day1),
    avatarUrl: membership.user.image ?? null,
  };
}
