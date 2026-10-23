import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { getTestDb } = await import("../helpers/test-db");
  return { db: await getTestDb() };
});

vi.mock("@/lib/auth", async () => ({
  auth: async () => ({ user: { id: "CURRENT_USER" } }),
}));
vi.mock("next/cache", async () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { checkBackfillEligibility, saveBackfillLogs } from "@/app/actions";
import { addDaysToKey, todayKey } from "@/lib/backfill";

let challengeId = "";
const taskIds: string[] = [];

beforeAll(async () => {
  const admin = await db.user.create({
    data: { email: "admin-backfill@test.dev", name: "Admin", id: "ADMIN_USER" },
  });
  const start = new Date();
  start.setDate(start.getDate() - 20);
  const c = await db.challenge.create({
    data: {
      name: "Backfill Save",
      description: "",
      startDate: start,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isPublic: true,
      inviteCode: "BFSAVE1",
      adminId: admin.id,
      members: { create: { userId: admin.id } },
    },
  });
  challengeId = c.id;

  const tasks = [
    { name: "Habit A", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 5, target: null },
    { name: "Habit B", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 2, target: null },
    { name: "Rule R", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 4, target: null },
    { name: "Drinking", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: true, points: -10, target: null },
    { name: "Penalty", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: -10, target: null },
    { name: "Walk", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", target: null },
    { name: "Steps", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 1, unit: "steps", target: null, unitCount: 1000 },
    { name: "Run", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: "km", target: null, bonusThreshold: 10, bonusPoints: 20 },
    { name: "Gym", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 40, target: 3 },
    { name: "Read", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 3, target: null },
    { name: "Meditate", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 3, target: null },
    { name: "Sleep 8h", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 5, target: null },
    { name: "Journal", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 4, target: null },
    { name: "Cold shower", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 4, target: null },
    { name: "No sugar", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 6, target: null },
    { name: "Vitamins", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 2, target: null },
    { name: "Stretch", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 3, target: null },
    { name: "Water", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 2, unit: "glasses", target: null, unitCount: 4 },
  ];
  for (const t of tasks) {
    const created = await db.challengeTask.create({ data: { challengeId, ...t } });
    taskIds.push(created.id);
  }
});

afterAll(async () => {
  const { closeTestDb } = await import("../helpers/test-db");
  await closeTestDb();
});

describe("saveBackfillLogs", () => {
  it("is eligible then saves a full day at the backfill penalty", async () => {
    const user = await db.user.create({
      data: { email: "bf-save@test.dev", name: "BF", id: "CURRENT_USER" },
    });
    const joined = new Date();
    joined.setDate(joined.getDate() - 20);
    const member = await db.challengeMember.create({
      data: { challengeId, userId: user.id, joinedAt: joined },
    });

    const clientToday = todayKey();
    const yesterday = addDaysToKey(clientToday, -1);

    const eligibility = await checkBackfillEligibility(challengeId, clientToday);
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.yesterdayKey).toBe(yesterday);

    // "Log everything": every task gets an entry.
    const updates = taskIds.map((taskId, i) => ({
      taskId,
      completed: true,
      value: i % 3 === 0 ? 0 : 7,
    }));

    const res = await saveBackfillLogs(challengeId, yesterday, clientToday, updates);
    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.awarded).toBeGreaterThan(0);

    const m = await db.challengeMember.findUnique({ where: { id: member.id } });
    expect(m!.points).toBeGreaterThan(0);

    const logs = await db.taskLog.findMany({
      where: { userId: user.id, challengeId, isBackfill: true },
    });
    expect(logs.length).toBe(taskIds.length);

    // A second save must be rejected (one backfill per day).
    const res2 = await saveBackfillLogs(challengeId, yesterday, clientToday, [
      { taskId: taskIds[0], completed: true, value: 0 },
    ]);
    expect(res2.ok).toBe(false);
    expect(res2.code).toBe("NOT_ELIGIBLE");
  });
});
