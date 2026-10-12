import { db } from "@/lib/db";
import { daysBetween, startOfDay, startOfWeek, formatDateKey } from "@/lib/scoring";
import { buildShareCardData, buildSquad } from "@/lib/share/build-share-data";
import { metricForTask } from "@/lib/share/then-now";
import type { ShareCardData, ShareDayHistory, SquadMember } from "@/lib/share/types";

export interface ShareBundle {
  data: ShareCardData;
  squadMembers: SquadMember[];
  avatarUrl: string | null;
}

function firstNameOf(displayName: string | null, name: string | null): string {
  const raw = (displayName ?? name ?? "").trim();
  return raw ? raw.split(/\s+/)[0] : "Player";
}

/**
 * Per-day history for days 1..current: points from DaySummary plus the four
 * compared movement metrics summed from NUMBER task logs for that date.
 */
function buildDayHistory(opts: {
  startDate: Date;
  currentDay: number;
  totalDays: number;
  summaries: { date: Date; pointsAwarded: number }[];
  logs: { date: Date; value: number; task: { name: string; unit: string | null } }[];
}): ShareDayHistory[] {
  const maxDay = Math.max(1, Math.min(opts.currentDay, opts.totalDays));
  const start = startOfDay(opts.startDate);

  const pointsByDate = new Map<string, number>();
  for (const summary of opts.summaries) {
    pointsByDate.set(formatDateKey(summary.date), summary.pointsAwarded);
  }

  const metricsByDate = new Map<string, ShareDayHistory>();
  const entryFor = (dateKey: string): ShareDayHistory => {
    let entry = metricsByDate.get(dateKey);
    if (!entry) {
      entry = {
        dayNumber: 0,
        date: dateKey,
        points: pointsByDate.get(dateKey) ?? 0,
        pushups: 0,
        pullups: 0,
        runKm: 0,
        walkKm: 0,
      };
      metricsByDate.set(dateKey, entry);
    }
    return entry;
  };

  for (const log of opts.logs) {
    const key = metricForTask(log.task.name, log.task.unit);
    if (!key) continue;
    const dateKey = formatDateKey(log.date);
    const entry = entryFor(dateKey);
    entry[key] = Math.round((entry[key] + log.value) * 100) / 100;
  }

  const history: ShareDayHistory[] = [];
  for (let day = 1; day <= maxDay; day++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (day - 1));
    const dateKey = formatDateKey(date);
    const entry = metricsByDate.get(dateKey);
    history.push({
      dayNumber: day,
      date: dateKey,
      points: entry?.points ?? pointsByDate.get(dateKey) ?? 0,
      pushups: entry?.pushups ?? 0,
      pullups: entry?.pullups ?? 0,
      runKm: entry?.runKm ?? 0,
      walkKm: entry?.walkKm ?? 0,
    });
  }
  return history;
}

/**
 * Assemble everything the share sheet needs for one user in one challenge:
 * card data (including per-day history and the top-3 squad), the full roster
 * and the avatar URL. Pure reads — no writes.
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
  const start = startOfDay(challenge.startDate);
  const totalDays = Math.max(1, daysBetween(challenge.startDate, challenge.endDate) + 1);
  const currentDay = Math.max(1, daysBetween(challenge.startDate, today) + 1);
  const historyLimit = Math.max(1, Math.min(currentDay, totalDays));
  const historyStart = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + (historyLimit - 1)
  );

  const [todayLogs, members, weekly, daySummaries, historySummaries, historyLogs] =
    await Promise.all([
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
      db.daySummary.findMany({
        where: { challengeId, userId, date: { gte: start, lte: historyStart } },
        select: { date: true, pointsAwarded: true },
      }),
      db.taskLog.findMany({
        where: {
          challengeId,
          userId,
          date: { gte: start, lte: historyStart },
          task: { inputType: "NUMBER" },
        },
        select: {
          date: true,
          value: true,
          task: { select: { name: true, unit: true } },
        },
      }),
    ]);

  const weekMap = new Map(weekly.map((w) => [w.userId, w.points]));
  const todayMap = new Map(daySummaries.map((d) => [d.userId, d.pointsAwarded]));

  const squadMembers: SquadMember[] = members.map((m) => ({
    userId: m.userId,
    name: m.user.displayName ?? m.user.name ?? "Player",
    firstName: firstNameOf(m.user.displayName, m.user.name),
    avatarUrl: m.user.image ?? null,
    isYou: m.userId === userId,
    overall: m.points,
    week: weekMap.get(m.userId) ?? 0,
    today: todayMap.get(m.userId) ?? 0,
  }));

  const { top3, youRank } = buildSquad(squadMembers, "overall");
  const rankPos = youRank ?? 0;

  const dayHistory = buildDayHistory({
    startDate: challenge.startDate,
    currentDay,
    totalDays,
    summaries: historySummaries,
    logs: historyLogs,
  });

  const data = buildShareCardData({
    userName: membership.user.displayName ?? membership.user.name,
    userId,
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
    squadTop3: top3,
    squadYouRank: youRank,
    dayHistory,
    inviteUrl: process.env.NEXT_PUBLIC_INVITE_URL ?? null,
    todayPoints: todayMap.get(userId),
  });

  // Keep the history's "today" entry consistent with the card's today total.
  const todayEntry = data.dayHistory.find((d) => d.dayNumber === data.challenge.dayNumber);
  if (todayEntry) todayEntry.points = data.today.points;

  return {
    data,
    squadMembers,
    avatarUrl: membership.user.image ?? null,
  };
}
