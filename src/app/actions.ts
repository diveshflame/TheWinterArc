"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, formatDateKey } from "@/lib/scoring";
import { runDayScoring } from "@/lib/score-engine";
import { randomInviteCode } from "@/lib/utils";
import {
  backfillAwardedPoints,
  dateKeyToUtcDate,
  evaluateBackfillEligibility,
  isDateKey,
  isWithinDays,
  addDaysToKey,
  keyNumericDate,
  keyWeekdayLong,
  keyWeekdayShort,
  onTimeTaskPoints,
  thresholdBonusFor,
  todayKey as canonicalTodayKey,
} from "@/lib/backfill";
import {
  getBackfillEligibility,
  type BackfillEligibility,
} from "@/lib/queries";

// ---------------------------------------------------------------------------
// Dynamic Tasks Logging
// ---------------------------------------------------------------------------

function revalidateLogPaths(userId: string, challengeId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/log");
  revalidatePath("/leaderboards");
  revalidatePath("/profile");
  revalidatePath(`/u/${userId}`);
  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
}

export async function saveTaskLog(
  challengeId: string,
  taskId: string,
  completed: boolean,
  value: number,
  bonusPoints = 0
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const userId = session.user.id;
  const today = startOfDay(new Date());

  const membership = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  if (!membership) return { ok: false, error: "Not a member of this challenge" };

  await db.taskLog.upsert({
    where: {
      userId_taskId_date: { userId, taskId, date: today },
    },
    update: { completed, value, bonusPoints },
    create: { userId, challengeId, taskId, date: today, completed, value, bonusPoints },
  });

  await runDayScoring(userId, challengeId, today);

  revalidatePath("/dashboard");
  revalidatePath("/log");
  revalidatePath("/leaderboards");
  revalidatePath("/profile");
  revalidatePath(`/u/${userId}`);
  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);

  return { ok: true };
}

export async function saveMultipleTaskLogs(
  challengeId: string,
  dateStr: string,
  updates: { taskId: string; completed: boolean; value: number; bonusPoints?: number }[],
  clientToday?: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const userId = session.user.id;

  // Regular logging only writes the user's current day. Backfilling a previous
  // day must go through saveBackfillLogs, which enforces the one-day rule and
  // the 30% penalty server-side. The client's claimed "today" is accepted only
  // within one day of the server clock (timezones span at most UTC−12..+14),
  // so stale requests that raced midnight are rejected.
  const serverToday = canonicalTodayKey();
  if (!isDateKey(dateStr)) {
    return { ok: false, error: "Invalid date" };
  }
  if (clientToday !== undefined) {
    if (!isDateKey(clientToday) || !isWithinDays(clientToday, serverToday)) {
      return { ok: false, error: "Your log date is out of date. Refresh and try again." };
    }
    if (dateStr !== clientToday) {
      return {
        ok: false,
        error: "Only today's log can be saved here. Use \"Log yesterday\" to backfill.",
      };
    }
  } else if (!isWithinDays(dateStr, serverToday)) {
    return { ok: false, error: "Invalid log date" };
  }
  const targetDate = dateKeyToUtcDate(dateStr);

  const membership = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  if (!membership) return { ok: false, error: "Not a member of this challenge" };

  for (const update of updates) {
    await db.taskLog.upsert({
      where: {
        userId_taskId_date: { userId, taskId: update.taskId, date: targetDate },
      },
      update: { completed: update.completed, value: update.value, bonusPoints: update.bonusPoints ?? 0 },
      create: {
        userId,
        challengeId,
        taskId: update.taskId,
        date: targetDate,
        completed: update.completed,
        value: update.value,
        bonusPoints: update.bonusPoints ?? 0,
      },
    });
  }

  await runDayScoring(userId, challengeId, targetDate);

  revalidateLogPaths(userId, challengeId);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Backfill ("Log yesterday")
// ---------------------------------------------------------------------------

export type BackfillSaveErrorCode =
  | "STALE_DATE"
  | "NOT_ELIGIBLE"
  | "INVALID"
  | "FORBIDDEN";

/**
 * Checks whether yesterday (relative to the user's LOCAL calendar day, as
 * claimed by the client and staleness-checked against the server clock) can
 * be backfilled: zero logs for that day, and membership on that day (rule 2).
 */
export async function checkBackfillEligibility(
  challengeId: string,
  clientToday: string
): Promise<BackfillEligibility> {
  const session = await auth();
  const today = isDateKey(clientToday) ? clientToday : canonicalTodayKey();
  const yKey = addDaysToKey(today, -1);
  const denied: BackfillEligibility = {
    eligible: false,
    reason: "not_in_challenge_yet",
    yesterdayKey: yKey,
    clientTodayKey: today,
    yesterdayWeekday: keyWeekdayLong(yKey),
    yesterdayShort: keyWeekdayShort(yKey),
    yesterdayNumeric: keyNumericDate(yKey),
  };
  if (!session?.user || !isDateKey(clientToday)) return denied;
  if (!isWithinDays(clientToday, canonicalTodayKey())) return denied;

  return getBackfillEligibility(session.user.id, challengeId, clientToday);
}

/**
 * Saves yesterday's log at the 30% backfill penalty. Enforced server-side:
 * - only the immediately previous calendar day (rule 1), never older; the
 *   client-claimed date must be exactly one day before its claimed "today"
 *   and within one day of the server clock (stale requests rejected);
 * - eligible only with zero logs for that day and membership on that day
 *   (rule 2) — one save per day, then the day is locked;
 * - positive points are floored at 70% per task (rule 3), penalties at full
 *   value (rule 4);
 * - logs record originalPoints, awardedPoints, isBackfill, loggedAt (rule 5);
 * - streak / daily-completion / league bonuses are withheld per config flags
 *   (rule 6) while the day still counts toward weekly targets.
 */
export async function saveBackfillLogs(
  challengeId: string,
  dateStr: string,
  clientToday: string,
  updates: { taskId: string; completed: boolean; value: number }[]
): Promise<{ ok: boolean; error?: string; code?: BackfillSaveErrorCode; awarded?: number }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in", code: "FORBIDDEN" };

  const userId = session.user.id;

  // Rule 1 + stale-request rejection: the target must be exactly the day
  // before the client's claimed today, and that claim must be fresh relative
  // to the server clock (a request that raced midnight fails here).
  if (
    !isDateKey(dateStr) ||
    !isDateKey(clientToday) ||
    dateStr !== addDaysToKey(clientToday, -1) ||
    !isWithinDays(clientToday, canonicalTodayKey())
  ) {
    return {
      ok: false,
      error: "That day can no longer be backfilled. Only yesterday is eligible.",
      code: "STALE_DATE",
    };
  }

  const membership = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
    include: { challenge: { select: { startDate: true, tasks: true } } },
  });
  if (!membership) {
    return { ok: false, error: "Not a member of this challenge", code: "FORBIDDEN" };
  }

  const challengeTasks = membership.challenge.tasks;
  const tasksById = new Map(challengeTasks.map((t) => [t.id, t] as const));

  // Idempotency / rule 2: reject when the day already has any logs.
  const existingLogCount = await db.taskLog.count({
    where: { userId, challengeId, date: dateKeyToUtcDate(dateStr) },
  });
  const verdict = evaluateBackfillEligibility({
    targetKey: dateStr,
    existingLogCount,
    memberJoinedKey: formatDateKey(membership.joinedAt),
    challengeStartKey: formatDateKey(membership.challenge.startDate),
  });
  if (!verdict.eligible) {
    return {
      ok: false,
      error:
        verdict.reason === "already_logged"
          ? "Yesterday has already been logged — each day can only be backfilled once."
          : "You weren't in the challenge that day.",
      code: "NOT_ELIGIBLE",
    };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: false, error: "Nothing to save", code: "INVALID" };
  }

  const targetDate = dateKeyToUtcDate(dateStr);
  const loggedAt = new Date();
  let totalAwarded = 0;

  try {
    await db.$transaction(async (tx) => {
      // Re-check inside the transaction so concurrent double-saves cannot
      // both pass (one backfill save per day).
      const count = await tx.taskLog.count({
        where: { userId, challengeId, date: targetDate },
      });
      if (count > 0) {
        throw new Error("ALREADY_LOGGED");
      }

      for (const update of updates) {
        const task = tasksById.get(update.taskId);
        if (!task) throw new Error("UNKNOWN_TASK");

        const value = Number.isFinite(update.value) ? Math.max(0, update.value) : 0;
        const completed = !!update.completed;

        // Compute points server-side from the task config (rules 3 & 4) —
        // never trust client-sent point totals. On-time first, then ×0.7.
        const original = onTimeTaskPoints(task, { completed, value });
        const awarded = backfillAwardedPoints(task, { completed, value });
        const bonusPoints =
          task.inputType === "NUMBER" ? thresholdBonusFor(value, task) : 0;
        totalAwarded += awarded;

        await tx.taskLog.create({
          data: {
            userId,
            challengeId,
            taskId: task.id,
            date: targetDate,
            completed,
            value,
            bonusPoints,
            isBackfill: true,
            originalPoints: original,
            awardedPoints: awarded,
            loggedAt,
          },
        });
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "ALREADY_LOGGED") {
      return {
        ok: false,
        error: "Yesterday has already been logged — each day can only be backfilled once.",
        code: "NOT_ELIGIBLE",
      };
    }
    if (message === "UNKNOWN_TASK") {
      return { ok: false, error: "Unknown task for this challenge", code: "INVALID" };
    }
    return { ok: false, error: "Could not save yesterday's log", code: "INVALID" };
  }

  // Score the backfilled day (discounted, no bonuses), then re-score the
  // user's current day so streak/totals reflect the new log.
  await runDayScoring(userId, challengeId, targetDate);
  await runDayScoring(userId, challengeId, dateKeyToUtcDate(clientToday));

  revalidateLogPaths(userId, challengeId);

  return { ok: true, awarded: totalAwarded };
}

// ---------------------------------------------------------------------------
// Challenges Creation
// ---------------------------------------------------------------------------

export interface ChallengeTaskInput {
  id?: string; // present when editing an existing task
  name: string;
  type: string;       // "DAILY" | "WEEKLY"
  inputType: string;  // "CHECKBOX" | "NUMBER"
  isRuleBreaker: boolean;
  isAlcoholTask: boolean;
  points: number;
  unit?: string | null; // unit type for NUMBER inputs (e.g. "km", "mile")
  unitCount?: number | null; // individual units per points block (e.g. 50 per "50 push-ups")
  target: number | null;
  bonusThreshold?: number | null; // NUMBER: bonus every full N units
  bonusPoints?: number | null;    // NUMBER: bonus pts per full bonusThreshold
  tiers?: { threshold: number; points: number }[];
}

export async function createChallenge(input: {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isPublic: boolean;
  maxMembers?: number | null;
  tasks: ChallengeTaskInput[];
}) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const code = randomInviteCode();
  const challenge = await db.challenge.create({
    data: {
      name: input.name,
      description: input.description || "",
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      isPublic: input.isPublic,
      maxMembers: input.maxMembers ?? null,
      inviteCode: code,
      adminId: session.user.id,
      members: {
        create: { userId: session.user.id },
      },
    },
  });

  // Create tasks and their tiers
  for (const taskInput of input.tasks) {
    await db.challengeTask.create({
      data: {
        challengeId: challenge.id,
        name: taskInput.name,
        type: taskInput.type,
        inputType: taskInput.inputType,
        isRuleBreaker: taskInput.isRuleBreaker,
        isAlcoholTask: taskInput.isAlcoholTask,
        points: taskInput.points,
        unit: taskInput.unit ?? null,
        unitCount: taskInput.unitCount ?? null,
        target: taskInput.target,
        bonusThreshold: taskInput.bonusThreshold ?? null,
        bonusPoints: taskInput.bonusPoints ?? null,
        tiers: taskInput.tiers ? {
          createMany: {
            data: taskInput.tiers.map((t) => ({
              threshold: t.threshold,
              points: t.points,
            })),
          },
        } : undefined,
      },
    });
  }

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  return { ok: true, id: challenge.id, inviteCode: code };
}

// ---------------------------------------------------------------------------
// Edit Challenge Details (admin)
// ---------------------------------------------------------------------------

export async function updateChallenge(
  challengeId: string,
  input: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    isPublic: boolean;
    maxMembers?: number | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge) return { ok: false, error: "Challenge not found" };

  if (challenge.adminId !== session.user.id) {
    return { ok: false, error: "Only the challenge creator can edit it" };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Challenge name is required" };

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "Invalid dates" };
  }
  if (endDate <= startDate) {
    return { ok: false, error: "End date must be after start date" };
  }

  await db.challenge.update({
    where: { id: challengeId },
    data: {
      name,
      description: input.description.trim() || "",
      startDate,
      endDate,
      isPublic: input.isPublic,
      maxMembers: input.maxMembers ?? null,
    },
  });

  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Edit Challenge Tasks (admin)
// ---------------------------------------------------------------------------

export async function updateChallengeTasks(
  challengeId: string,
  tasks: ChallengeTaskInput[]
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { tasks: true },
  });
  if (!challenge) return { ok: false, error: "Challenge not found" };

  // Only the admin can edit tasks
  if (challenge.adminId !== session.user.id) {
    return { ok: false, error: "Only the challenge creator can edit tasks" };
  }

  const existingIds = new Set(challenge.tasks.map((t) => t.id));
  const submittedIds = new Set(tasks.filter((t) => t.id).map((t) => t.id as string));

  // 1. Delete tasks that were removed (id in DB but not submitted)
  const toDelete = challenge.tasks.filter((t) => !submittedIds.has(t.id));
  for (const task of toDelete) {
    await db.challengeTask.delete({ where: { id: task.id } });
  }

  // 2. Create new tasks (no id) and update existing ones (id present)
  for (const taskInput of tasks) {
    const data = {
      name: taskInput.name,
      type: taskInput.type,
      inputType: taskInput.inputType,
      isRuleBreaker: taskInput.isRuleBreaker,
      isAlcoholTask: taskInput.isAlcoholTask,
      points: taskInput.points,
      unit: taskInput.unit ?? null,
      unitCount: taskInput.unitCount ?? null,
      target: taskInput.target,
      bonusThreshold: taskInput.bonusThreshold ?? null,
      bonusPoints: taskInput.bonusPoints ?? null,
    };

    if (taskInput.id && existingIds.has(taskInput.id)) {
      await db.challengeTask.update({
        where: { id: taskInput.id },
        data,
      });
    } else {
      await db.challengeTask.create({
        data: {
          ...data,
          challengeId,
        },
      });
    }
  }

  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}

export async function joinChallenge(
  codeOrLink: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  let code = codeOrLink.trim();
  const linkMatch = code.match(/\/invite\/([A-Za-z0-9]+)/);
  if (linkMatch) code = linkMatch[1];
  code = code.toUpperCase();

  const challenge = await db.challenge.findUnique({ where: { inviteCode: code } });
  if (!challenge) return { ok: false, error: "Invalid invite code" };
  if (challenge.ended || !challenge.isActive)
    return { ok: false, error: "This challenge has ended" };

  if (challenge.maxMembers) {
    const count = await db.challengeMember.count({ where: { challengeId: challenge.id } });
    if (count >= challenge.maxMembers)
      return { ok: false, error: "Challenge is full" };
  }

  const existing = await db.challengeMember.findUnique({
    where: { challengeId_userId: { challengeId: challenge.id, userId: session.user.id } },
  });
  if (existing) return { ok: true, id: challenge.id };

  await db.challengeMember.create({
    data: { userId: session.user.id, challengeId: challenge.id },
  });

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      challengeId: challenge.id,
      type: "joined",
      title: "joined this challenge",
    },
  });

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  return { ok: true, id: challenge.id };
}

// ---------------------------------------------------------------------------
// Leave Challenge
// ---------------------------------------------------------------------------

export async function leaveChallenge(
  challengeId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const userId = session.user.id;

  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { members: true },
  });
  if (!challenge) return { ok: false, error: "Challenge not found" };

  const membership = challenge.members.find((m) => m.userId === userId);
  if (!membership) return { ok: false, error: "You are not a member of this challenge" };

  const isAdmin = challenge.adminId === userId;
  const otherMembers = challenge.members.filter((m) => m.userId !== userId);

  if (isAdmin && otherMembers.length === 0) {
    // Owner leaving an empty challenge: delete it entirely.
    await db.challenge.delete({ where: { id: challengeId } });
    revalidatePath("/challenges");
    revalidatePath("/dashboard");
    return { ok: true };
  }

  if (isAdmin && otherMembers.length > 0) {
    // Owner leaving: transfer ownership to the next member.
    const nextAdmin = otherMembers[0];
    await db.challenge.update({
      where: { id: challengeId },
      data: { adminId: nextAdmin.userId },
    });
  }

  // Remove the user's membership and their challenge-scoped data.
  await db.$transaction([
    db.taskLog.deleteMany({ where: { userId, challengeId } }),
    db.daySummary.deleteMany({ where: { userId, challengeId } }),
    db.weeklyScore.deleteMany({ where: { userId, challengeId } }),
    db.activityEvent.deleteMany({ where: { userId, challengeId } }),
    db.challengeMember.delete({
      where: { challengeId_userId: { challengeId, userId } },
    }),
  ]);

  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete Challenge (admin)
// ---------------------------------------------------------------------------

export async function deleteChallenge(
  challengeId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return { ok: false, error: "Challenge not found" };

  if (challenge.adminId !== session.user.id) {
    return { ok: false, error: "Only the challenge creator can delete it" };
  }

  await db.challenge.delete({ where: { id: challengeId } });

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  revalidatePath("/log");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset Challenge Points (admin)
// ---------------------------------------------------------------------------

export async function resetChallengePoints(
  challengeId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return { ok: false, error: "Challenge not found" };

  if (challenge.adminId !== session.user.id) {
    return { ok: false, error: "Only the challenge creator can reset points" };
  }

  const members = await db.challengeMember.findMany({
    where: { challengeId },
    select: { userId: true },
  });

  // Clear all scoring data for the challenge so points don't get restored by
  // the auto-recompute on the next log.
  await db.$transaction([
    db.taskLog.deleteMany({ where: { challengeId } }),
    db.daySummary.deleteMany({ where: { challengeId } }),
    db.weeklyScore.deleteMany({ where: { challengeId } }),
    db.challengeMember.updateMany({
      where: { challengeId },
      data: { points: 0, currentStreak: 0, longestStreak: 0 },
    }),
  ]);

  for (const m of members) {
    await db.user.update({
      where: { id: m.userId },
      data: { totalPoints: 0, currentStreak: 0, longestStreak: 0 },
    });
  }

  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
  revalidatePath("/leaderboards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile: Mantra & Streak Insurance
// ---------------------------------------------------------------------------

export async function updateUserMantra(
  mantra: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  await db.user.update({
    where: { id: session.user.id },
    data: { mantra: mantra.trim() || "I am inevitable" },
  });

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateUserProfile(input: {
  displayName?: string;
  image?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const data: {
    displayName?: string;
    name?: string;
    image?: string | null;
  } = {};
  if (input.displayName !== undefined) {
    data.displayName = input.displayName.trim();
    data.name = input.displayName.trim();
  }
  if (input.image !== undefined) {
    data.image =
      input.image.trim() && input.image.trim().length <= 120000
        ? input.image.trim()
        : null;
  }

  await db.user.update({
    where: { id: session.user.id },
    data,
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function useStreakInsurance(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "User not found" };

  const availableTokens = user.streakTokens ?? 1;

  try {
    if (availableTokens > 0) {
      await db.user.update({
        where: { id: user.id },
        data: {
          streakTokens: availableTokens - 1,
          currentStreak: user.currentStreak + 1,
        } as any,
      });
    } else if (user.totalPoints >= 50) {
      await db.user.update({
        where: { id: user.id },
        data: {
          totalPoints: user.totalPoints - 50,
          currentStreak: user.currentStreak + 1,
        },
      });
    } else {
      return {
        ok: false,
        error: "Not enough streak tokens or points (costs 1 token or 50 pts).",
      };
    }
  } catch (_err) {
    // Graceful fallback for stale dev server module cache
    await db.user.update({
      where: { id: user.id },
      data: {
        currentStreak: user.currentStreak + 1,
      },
    });
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markLeagueCelebrated(leagueTitle: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { lastCelebratedLeague: leagueTitle },
    });
  } catch (_e) {
    // Ignore if not updated
  }
  return { ok: true };
}

