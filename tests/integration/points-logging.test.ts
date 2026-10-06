import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";

// Point the app's `db` singleton at an isolated PGlite database.
vi.mock("@/lib/db", async () => {
  const { getTestDb } = await import("../helpers/test-db");
  return { db: await getTestDb() };
});

// Simulate an authenticated user and silence path revalidation.
vi.mock("@/lib/auth", async () => ({
  auth: async () => ({ user: { id: "CURRENT_USER" } }),
}));
vi.mock("next/cache", async () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getDashboardData } from "@/lib/queries";
import { startOfDay, formatDateKey } from "@/lib/scoring";
import { saveTaskLog, saveMultipleTaskLogs } from "@/app/actions";

// A fixed date far enough back that "today" (server time) never overlaps with the
// challenge's start week, isolating the exact logging behavior we're asserting on.
const MON = new Date(2026, 0, 5, 12);
let challengeId = "";
const taskIds: Record<string, string> = {};

beforeAll(async () => {
  const admin = await db.user.create({
    data: { email: "admin-log@test.dev", name: "Admin" },
  });
  const c = await db.challenge.create({
    data: {
      name: "Points Log",
      description: "",
      startDate: MON,
      endDate: new Date(2026, 1, 28, 12),
      isPublic: true,
      inviteCode: "LOG001",
      adminId: admin.id,
    },
  });
  challengeId = c.id;

  const tasks = [
    { name: "Habit A", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 5, target: null },
    { name: "Habit B", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 2, target: null },
    { name: "Rule R", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 4, target: null },
    { name: "Gym", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 40, unit: "sessions", target: null },
    { name: "Walk", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", target: null },
    { name: "Drinking", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: -10, target: null },
    { name: "Run", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: "km", target: null, bonusThreshold: 10, bonusPoints: 20 },
  ];
  for (const t of tasks) {
    const created = await db.challengeTask.create({ data: { challengeId, ...t } });
    taskIds[t.name] = created.id;
  }
});

afterAll(async () => {
  const { closeTestDb } = await import("../helpers/test-db");
  await closeTestDb();
});

describe("saveTaskLog updates member points", () => {
  it("awards task points immediately and accumulates weekly points", async () => {
    const user = await db.user.create({
      data: { email: "user-log@test.dev", name: "User", id: "CURRENT_USER" },
    });
    const member = await db.challengeMember.create({
      data: { challengeId, userId: user.id },
    });

    // Log a single daily habit -> should immediately add its 5 points, plus the
    // 4 points from unbroken Rule R, plus 5 for completing 2/3 checklist habits.
    const res = await saveTaskLog(challengeId, taskIds["Habit A"], true, 0);
    expect(res.ok).toBe(true);

    let m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(14); // 2/3 checklist habits: +5 completion bonus

    // Log a weekly number task (gym value 4 → 4 × 40 pts/unit = 160) -> creates
    // the week's 160-pt WeeklyScore. Weekly points only credit on Sunday, so the
    // member total reflects that depending on the day the test runs.
    const sundayCredit = new Date().getDay() === 0 ? 160 : 0;
    await saveTaskLog(challengeId, taskIds["Gym"], true, 4);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(14 + sundayCredit);

    // Toggling the habit off should remove those 5 points.
    await saveTaskLog(challengeId, taskIds["Habit A"], false, 0);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(4 + sundayCredit);
  });

  it("awards per-unit points for daily NUMBER tasks and deducts negative toggle points", async () => {
    // saveTaskLog acts as CURRENT_USER (auth mock), so reset that user's data.
    await db.user.deleteMany({ where: { id: "CURRENT_USER" } });
    const user = await db.user.create({
      data: { email: "user-neg@test.dev", name: "Negative", id: "CURRENT_USER" },
    });
    const member = await db.challengeMember.create({
      data: { challengeId, userId: user.id },
    });

    // Walk 2 km × 10 pts/km = 20; Rule R unbroken = +4 (Habit A/B not logged,
    // so 2/5 daily tasks done = 40% → no daily bonus interferes).
    await saveTaskLog(challengeId, taskIds["Walk"], true, 2);
    let m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(24);

    // Toggling "Drinking" on deducts 10 points.
    await saveTaskLog(challengeId, taskIds["Drinking"], true, 0);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(14);

    // Turning it back off restores the points.
    await saveTaskLog(challengeId, taskIds["Drinking"], false, 0);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(24);

    // A zero value clears a NUMBER task's points for the day.
    await saveTaskLog(challengeId, taskIds["Walk"], false, 0);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(4);
  });

  it("adds the bonus the log UI awards when a daily NUMBER task reaches its threshold", async () => {
    await db.user.deleteMany({ where: { id: "CURRENT_USER" } });
    const user = await db.user.create({
      data: { email: "user-bonus@test.dev", name: "Bonus", id: "CURRENT_USER" },
    });
    const member = await db.challengeMember.create({
      data: { challengeId, userId: user.id },
    });

    // "Run": 5 pts/km, +20 bonus at 10 km. The log UI awarded the +20 once the
    // value crossed 10 and sent it along like any other point.
    // 24 km → 24 × 5 = 120 + 20 bonus, plus +4 from the unbroken Rule R = 144.
    await saveTaskLog(challengeId, taskIds["Run"], true, 24, 20);
    let m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(144);

    // Below the threshold → no bonus sent: 9 × 5 = 45 + 4 = 49.
    await saveTaskLog(challengeId, taskIds["Run"], true, 9, 0);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(49);

    // The backend does not auto-award: 24 km with no bonus logged is just 24 × 5 = 120 + 4 = 124.
    await saveTaskLog(challengeId, taskIds["Run"], true, 24, 0);
    m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBe(124);
  });
});


describe("daily checklist bonus consistency", () => {
  it("persists tiers in leaderboard and dashboard totals, without stacking on retries", async () => {
    await db.user.deleteMany({ where: { id: "CURRENT_USER" } });
    await db.user.create({ data: { id: "CURRENT_USER", email: "checklist@test.dev" } });
    const challenge = await db.challenge.create({
      data: {
        name: "Checklist tiers", description: "", inviteCode: "TIERS1",
        startDate: MON, endDate: new Date(2027, 0, 1), adminId: "CURRENT_USER",
        members: { create: { userId: "CURRENT_USER" } },
        tasks: { create: [
          ...[1, 2, 3, 4].map((n) => ({ name: `Habit ${n}`, type: "DAILY", inputType: "CHECKBOX", points: 2 })),
          { name: "Movement", type: "DAILY", inputType: "NUMBER", points: 10 },
          { name: "Penalty", type: "DAILY", inputType: "CHECKBOX", points: -10 },
        ] },
      },
      include: { tasks: true },
    });
    const habits = challenge.tasks.filter((task) => task.name.startsWith("Habit"));
    const today = startOfDay(new Date());
    for (const [count, expected] of [[1, 2], [2, 9], [3, 21], [4, 23], [4, 23], [2, 9], [1, 2], [0, 0]]) {
      vi.mocked(revalidatePath).mockClear();
      const result = await saveMultipleTaskLogs(challenge.id, formatDateKey(today),
        habits.map((task, index) => ({ taskId: task.id, completed: index < count, value: 0 }))
      );
      expect(result.ok).toBe(true);
      const summary = await db.daySummary.findUniqueOrThrow({
        where: { userId_challengeId_date: { userId: "CURRENT_USER", challengeId: challenge.id, date: today } },
      });
      // Today and This Week use DaySummary; Overall uses ChallengeMember.points.
      expect(summary.pointsAwarded).toBe(expected);
      expect(summary.totalCount).toBe(6);
      expect(summary.completedCount).toBe(count);
      expect(summary.dailyBonusAwarded).toBe(false); // Existing overall 75% streak threshold is unchanged.
      const dashboard = await getDashboardData("CURRENT_USER", challenge.id);
      expect(dashboard.totalPoints).toBe(expected);
      expect(dashboard.completionToday?.percent).toBe(Math.round(count / 6 * 100));
      const user = await db.user.findUniqueOrThrow({ where: { id: "CURRENT_USER" } });
      expect(user.totalPoints).toBe(expected);
      expect(revalidatePath).toHaveBeenCalledWith("/leaderboards");
      expect(revalidatePath).toHaveBeenCalledWith("/profile");
    }
    const movement = challenge.tasks.find((task) => task.name === "Movement")!;
    const penalty = challenge.tasks.find((task) => task.name === "Penalty")!;
    await saveMultipleTaskLogs(challenge.id, formatDateKey(today), [
      ...habits.slice(0, 2).map((task) => ({ taskId: task.id, completed: true, value: 0 })),
      { taskId: movement.id, completed: true, value: 2 },
      { taskId: penalty.id, completed: true, value: 0 },
    ]);
    const dashboard = await getDashboardData("CURRENT_USER", challenge.id);
    expect(dashboard.completionToday).toEqual({ achieved: 4, total: 6, percent: 67 });
    expect(dashboard.totalPoints).toBe(19); // 4 habits + 20 movement - 10 penalty + 5 bonus
  });
});
