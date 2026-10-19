import { describe, it, expect } from "vitest";
import {
  computeTaskPointsByUser,
  taskCategory,
  type TaskPointsByUser,
} from "@/lib/leaderboard-tasks";
import type { ChallengeTask, TaskLog, TaskTier } from "@/lib/scoring";

// Fixed clock: Wednesday 2026-01-07, week starts Monday 2026-01-05.
const todayStart = new Date("2026-01-07T00:00:00.000Z");
const weekStart = new Date("2026-01-05T00:00:00.000Z");

const tasks: ChallengeTask[] = [
  { id: "t-protein", challengeId: "c1", name: "Protein", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-run", challengeId: "c1", name: "Run", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", unitCount: 1, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-nosugar", challengeId: "c1", name: "No sugar", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 4, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-gym", challengeId: "c1", name: "Gym 4x/week", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 40, unit: "sessions", unitCount: 4, target: 4, bonusThreshold: null, bonusPoints: null },
  { id: "t-nofastfood", challengeId: "c1", name: "No fast food", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 20, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
];

const tiers: TaskTier[] = [];

let seq = 0;
function log(
  overrides: Partial<TaskLog> & { userId: string; taskId: string; date: Date }
): TaskLog {
  seq += 1;
  return {
    id: `l${seq}`,
    challengeId: "c1",
    completed: false,
    value: 0,
    bonusPoints: 0,
    isBackfill: false,
    awardedPoints: null,
    ...overrides,
  };
}

function run(
  logs: TaskLog[],
  userIds = ["u1", "u2"],
  today = todayStart,
  week = weekStart
): TaskPointsByUser {
  return computeTaskPointsByUser({
    tasks,
    tiers,
    logs,
    userIds,
    todayStart: today,
    weekStart: week,
  });
}

function pointsOf(
  result: TaskPointsByUser,
  userId: string,
  taskId: string
) {
  return result[userId][taskId];
}

describe("computeTaskPointsByUser", () => {
  it("seeds every member and task with zeros", () => {
    const result = run([]);
    expect(result.u1["t-protein"]).toEqual({ today: 0, week: 0, overall: 0 });
    expect(result.u2["t-gym"]).toEqual({ today: 0, week: 0, overall: 0 });
  });

  it("attributes checkbox daily points to today, week, and overall", () => {
    const result = run([
      log({ userId: "u1", taskId: "t-protein", date: todayStart, completed: true }),
    ]);
    expect(pointsOf(result, "u1", "t-protein")).toEqual({
      today: 5,
      week: 5,
      overall: 5,
    });
    expect(pointsOf(result, "u2", "t-protein").today).toBe(0);
  });

  it("sums number daily logs with their stored bonus points", () => {
    const result = run([
      log({ userId: "u1", taskId: "t-run", date: todayStart, value: 1, bonusPoints: 3 }),
    ]);
    expect(pointsOf(result, "u1", "t-run")).toEqual({
      today: 13,
      week: 13,
      overall: 13,
    });
  });

  it("credits unbroken rule breakers on logged days but not on days with no logs", () => {
    const result = run([
      // u1 logged today (protein) but nothing for the rule breaker.
      log({ userId: "u1", taskId: "t-protein", date: todayStart, completed: true }),
      // u2 logged today and broke the rule.
      log({ userId: "u2", taskId: "t-nosugar", date: todayStart, completed: true }),
    ]);
    expect(pointsOf(result, "u1", "t-nosugar")).toEqual({
      today: 4,
      week: 4,
      overall: 4,
    });
    expect(pointsOf(result, "u2", "t-nosugar").today).toBe(0);
    expect(pointsOf(result, "u1", "t-protein").today).toBe(5);
  });

  it("uses the discounted awardedPoints for backfilled logs", () => {
    const result = run([
      log({
        userId: "u1",
        taskId: "t-protein",
        date: new Date("2026-01-06T00:00:00.000Z"),
        completed: true,
        isBackfill: true,
        awardedPoints: 3,
      }),
    ]);
    expect(pointsOf(result, "u1", "t-protein")).toEqual({
      today: 0,
      week: 3,
      overall: 3,
    });
  });

  it("counts earlier days in week and overall but not today", () => {
    const result = run([
      log({ userId: "u1", taskId: "t-protein", date: weekStart, completed: true }),
      // Previous week (Sunday 2026-01-04): overall only.
      log({
        userId: "u1",
        taskId: "t-protein",
        date: new Date("2026-01-04T00:00:00.000Z"),
        completed: true,
      }),
    ]);
    expect(pointsOf(result, "u1", "t-protein")).toEqual({
      today: 0,
      week: 5,
      overall: 10,
    });
  });

  it("evaluates weekly tasks per week and never credits the today bucket", () => {
    const result = run([
      // Weekly number task: 2 + 2 = 4 sessions = one 40-point block.
      log({ userId: "u1", taskId: "t-gym", date: weekStart, value: 2 }),
      log({ userId: "u1", taskId: "t-gym", date: todayStart, value: 2 }),
      // Rule breaker weekly: only earns when the week's logs never break it.
      log({ userId: "u1", taskId: "t-protein", date: todayStart, completed: true }),
      // u2 broke the rule this week.
      log({ userId: "u2", taskId: "t-nofastfood", date: weekStart, completed: true }),
    ]);
    expect(pointsOf(result, "u1", "t-gym")).toEqual({
      today: 0,
      week: 40,
      overall: 40,
    });
    expect(pointsOf(result, "u1", "t-nofastfood")).toEqual({
      today: 0,
      week: 20,
      overall: 20,
    });
    expect(pointsOf(result, "u2", "t-nofastfood")).toEqual({
      today: 0,
      week: 0,
      overall: 0,
    });
  });

  it("re-evaluates weekly tasks week by week so past weeks each count", () => {
    const lastWeek = new Date("2025-12-29T00:00:00.000Z"); // Monday
    const result = run([
      log({ userId: "u1", taskId: "t-gym", date: lastWeek, value: 4 }),
      log({ userId: "u1", taskId: "t-gym", date: weekStart, value: 4 }),
    ]);
    expect(pointsOf(result, "u1", "t-gym")).toEqual({
      today: 0,
      week: 40,
      overall: 80,
    });
  });
});

// ---------------------------------------------------------------------------
// taskCategory — drives the grouped task-filter sheet
// ---------------------------------------------------------------------------

function task(
  name: string,
  overrides: Partial<{ type: string; points: number }> = {}
) {
  return { name, type: "DAILY", points: 10, ...overrides };
}

describe("taskCategory", () => {
  it("places movement tasks by name", () => {
    for (const name of [
      "Walking",
      "push-ups",
      "pull-ups",
      "Running",
      "Total steps",
      "Situps",
    ]) {
      expect(taskCategory(task(name))).toBe("movement");
    }
  });

  it("places food tasks by name", () => {
    for (const name of [
      "1.5x body weight Protein intake",
      "No sugar",
      "No junk food, all day meals at home",
      "1 fruit intake",
      "2L water",
    ]) {
      expect(taskCategory(task(name))).toBe("food");
    }
  });

  it("falls back to mind & habits, keeping 'eating' habits out of food", () => {
    for (const name of [
      "Read book for 30 mins",
      "Meditation for 30 minutes",
      "Skin care",
      "No phone while eating",
      "Some brand new habit",
    ]) {
      expect(taskCategory(task(name))).toBe("mind");
    }
  });

  it("routes weekly-flagged tasks to weekly before any name matching", () => {
    expect(taskCategory(task("Gym", { type: "WEEKLY" }))).toBe("weekly");
    expect(taskCategory(task("Upskilling (Min 90 mins)", { type: "WEEKLY" }))).toBe("weekly");
    expect(taskCategory(task("Sport", { type: "WEEKLY" }))).toBe("weekly");
    expect(taskCategory(task("Walking", { type: "WEEKLY" }))).toBe("weekly");
  });

  it("routes negative-point tasks to penalties", () => {
    expect(taskCategory(task("Drank Alcohol", { points: -20 }))).toBe("penalty");
    expect(taskCategory(task("Screen time", { points: -15 }))).toBe("penalty");
    expect(taskCategory(task("Cigarette", { points: -30 }))).toBe("penalty");
  });
});
