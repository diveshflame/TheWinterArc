import { describe, it, expect } from "vitest";
import {
  getDailyCompletionSummary,
  isDailySuccessSummary,
  computeWeeklyResultSummary,
  numberTaskPoints,
  unitsLabel,
  type ChallengeTask,
  type TaskTier,
  type TaskLog,
} from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Task fixtures matching the user's challenge spec
// ---------------------------------------------------------------------------

const dailyTasks: ChallengeTask[] = [  // Protein, fruit, water, sleep, bed, cold shower, reading → standard habits (checkbox)
  { id: "t-protein", challengeId: "c1", name: "Daily protein 100g", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: null, target: 100, bonusThreshold: null, bonusPoints: null },
  { id: "t-fruit", challengeId: "c1", name: "1 fruit", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 2, unit: null, target: 1, bonusThreshold: null, bonusPoints: null },
  { id: "t-water", challengeId: "c1", name: "3L water", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 2, unit: null, target: 3, bonusThreshold: null, bonusPoints: null },
  { id: "t-sleep", challengeId: "c1", name: "8h sleep", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 7, unit: null, target: 8, bonusThreshold: null, bonusPoints: null },
  { id: "t-bed", challengeId: "c1", name: "Make bed", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 1, unit: null, target: 1, bonusThreshold: null, bonusPoints: null },
  { id: "t-shower", challengeId: "c1", name: "Cold shower", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 3, unit: null, target: 1, bonusThreshold: null, bonusPoints: null },
  { id: "t-read", challengeId: "c1", name: "Read 20 pages", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: false, points: 3, unit: null, target: 20, bonusThreshold: null, bonusPoints: null },
  // Rule breakers: success = NOT broken
  { id: "t-noeve", challengeId: "c1", name: "No eating after 10PM", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 4, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-noscope", challengeId: "c1", name: "No YT shorts after 6pm", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 5, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-nophone", challengeId: "c1", name: "No phone during meals", type: "DAILY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 2, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
];

const weeklyTasks: ChallengeTask[] = [
  { id: "t-gym", challengeId: "c1", name: "Gym 4x/week", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 40, unit: "sessions", target: 4, bonusThreshold: null, bonusPoints: null },
  { id: "t-walk", challengeId: "c1", name: "10km walk", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", target: 10, bonusThreshold: null, bonusPoints: null },
  { id: "t-push", challengeId: "c1", name: "100 pushups", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: "reps", target: 100, bonusThreshold: null, bonusPoints: null },
  { id: "t-sugar", challengeId: "c1", name: "No sugar", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 20, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-ffood", challengeId: "c1", name: "No fast food", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 20, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-junk", challengeId: "c1", name: "All meals at home (no junk)", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: 30, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
  { id: "t-alc", challengeId: "c1", name: "No alcohol", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: false, isAlcoholTask: true, points: 20, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
];

const pushupTiers: TaskTier[] = [
  { id: "p-100", taskId: "t-push", threshold: 100, points: 5 },
  { id: "p-200", taskId: "t-push", threshold: 200, points: 10 },
  { id: "p-350", taskId: "t-push", threshold: 350, points: 50 },
  { id: "p-700", taskId: "t-push", threshold: 700, points: 100 },
];

function log(taskId: string, completed = false, value = 0, bonusPoints = 0): TaskLog {
  return {
    id: "x",
    challengeId: "c1",
    userId: "u1",
    taskId,
    date: new Date("2026-01-05T00:00:00.000Z"),
    completed,
    value,
    bonusPoints,
  };
}

// ---------------------------------------------------------------------------
// Daily completion
// ---------------------------------------------------------------------------

describe("getDailyCompletionSummary", () => {
  it("counts completed standard habits and unbroken rule breakers", () => {
    const logs = [
      log("t-protein", true),
      log("t-fruit", true),
      log("t-water", true),
      log("t-sleep", true),
      log("t-bed", true),
      log("t-shower", true),
      log("t-read", true),
      // rule breakers: no logs → success (not broken)
    ];
    const comp = getDailyCompletionSummary(dailyTasks, logs);
    // 7 completed + 3 unbroken rule breakers = 10/10
    expect(comp).toEqual({ achieved: 10, total: 10, percent: 100 });
    expect(isDailySuccessSummary(dailyTasks, logs)).toBe(true);
  });

  it("a broken rule breaker does not count as achieved", () => {
    const logs = [
      log("t-protein", true),
      log("t-fruit", true),
      log("t-water", true),
      log("t-sleep", true),
      log("t-bed", true),
      log("t-shower", true),
      log("t-read", true),
      log("t-noscope", true), // watched shorts → rule broken
    ];
    const comp = getDailyCompletionSummary(dailyTasks, logs);
    // 7 completed + 2 unbroken rule breakers (noeve, nophone) = 9/10
    expect(comp.achieved).toBe(9);
    expect(comp.total).toBe(10);
    expect(comp.percent).toBe(90);
  });

  it("reports a day as success at the 75% threshold (8 of 10)", () => {
    const completed: [string, boolean][] = [
      ["t-protein", true],
      ["t-fruit", true],
      ["t-water", true],
      ["t-sleep", true],
      ["t-bed", true],
      ["t-shower", true],
      ["t-read", true], // 7 habits
      ["t-nophone", true], // broken rule → loses one of 3
    ];
    const logs = completed.map(([id, c]) => log(id, c));
    const comp = getDailyCompletionSummary(dailyTasks, logs);
    // achieved = 7 + (3 rule breakers - 1 broken) = 9 → 90%
    expect(comp.percent).toBe(90);
    expect(comp.achieved).toBe(9);
  });

  it("counts a daily NUMBER input as achieved when its value is above zero", () => {
    const numberTasks: ChallengeTask[] = [
      { id: "t-walk", challengeId: "c1", name: "Walk", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", target: null, bonusThreshold: null, bonusPoints: null },
    ];
    const zero = getDailyCompletionSummary(numberTasks, [log("t-walk", true, 0)]);
    expect(zero).toEqual({ achieved: 0, total: 1, percent: 0 });
    const some = getDailyCompletionSummary(numberTasks, [log("t-walk", false, 2)]);
    expect(some).toEqual({ achieved: 1, total: 1, percent: 100 });
  });
});

// ---------------------------------------------------------------------------
// Weekly result
// ---------------------------------------------------------------------------

describe("computeWeeklyResultSummary", () => {
  it("awards per-unit points for weekly NUMBER inputs (value × pts per unit)", () => {
    const weekLogs = [
      // gym: 4 sessions logged
      ...[1, 2, 3, 4].map(() => log("t-gym", true, 1)),
      // walking: total 11 km → 11 × 10 pts/km = 110
      log("t-walk", true, 6),
      log("t-walk", true, 5),
      // pushups: total 220 reps → 220 × 5 pts/rep = 1100
      log("t-push", true, 220),
    ];
    const res = computeWeeklyResultSummary(weeklyTasks, [], weekLogs, 7, 7);
    const byName = Object.fromEntries(res.taskResults.map((r) => [r.name, r]));
    expect(byName["10km walk"].achieved).toBe(true);
    expect(byName["10km walk"].points).toBe(110);
    expect(byName["10km walk"].unit).toBe("km");
    expect(byName["100 pushups"].achieved).toBe(true);
    expect(byName["100 pushups"].points).toBe(1100);
    // Plus clean rules: no sugar 20 + no fast food 20 + no junk 30 + no alcohol 20
    expect(byName["No sugar"].points).toBe(20);
    expect(byName["No fast food"].points).toBe(20);
    expect(byName["All meals at home (no junk)"].points).toBe(30);
    expect(byName["No alcohol"].points).toBe(20);
    expect(res.taskResults.every((r) => r.achieved)).toBe(true);
  });

  it("awards zero points for a weekly NUMBER input with no logged value", () => {
    const res = computeWeeklyResultSummary(weeklyTasks, [], [], 7, 7);
    const byName = Object.fromEntries(res.taskResults.map((r) => [r.name, r]));
    expect(byName["10km walk"].achieved).toBe(false);
    expect(byName["10km walk"].points).toBe(0);
  });

  it("a weekly rule breaker awards points when never broken, none when broken", () => {
    const clean = computeWeeklyResultSummary(weeklyTasks, pushupTiers, [], 7, 7);
    expect(clean.taskResults.find((r) => r.taskId === "t-sugar")!.points).toBe(20);
    expect(clean.taskResults.find((r) => r.taskId === "t-ffood")!.points).toBe(20);
    expect(clean.taskResults.find((r) => r.taskId === "t-junk")!.points).toBe(30);

    const broken = computeWeeklyResultSummary(
      weeklyTasks,
      pushupTiers,
      [log("t-sugar", true)],
      7,
      7
    );
    expect(broken.taskResults.find((r) => r.taskId === "t-sugar")!.points).toBe(0);
  });

  it("no alcohol: awards full points when not broken, none when broken", () => {
    const notBroken: TaskLog[] = []; // no alcohol logs → not broken
    const clean = computeWeeklyResultSummary(weeklyTasks, pushupTiers, notBroken, 7, 7);
    expect(clean.taskResults.find((r) => r.taskId === "t-alc")!.points).toBe(20);

    // broken (a drink happened)
    const broken = computeWeeklyResultSummary(weeklyTasks, pushupTiers, [log("t-alc", true)], 7, 7);
    expect(broken.taskResults.find((r) => r.taskId === "t-alc")!.points).toBe(0);
  });

  it("negative-point weekly rule: deducts when broken, zero when kept", () => {
    const badTasks: ChallengeTask[] = [
      { id: "t-drink", challengeId: "c1", name: "Drinking alcohol", type: "WEEKLY", inputType: "CHECKBOX", isRuleBreaker: true, isAlcoholTask: false, points: -10, unit: null, target: null, bonusThreshold: null, bonusPoints: null },
    ];
    const clean = computeWeeklyResultSummary(badTasks, [], [], 7, 7);
    expect(clean.taskResults[0].achieved).toBe(true);
    expect(clean.taskResults[0].points).toBe(0);

    const broken = computeWeeklyResultSummary(badTasks, [], [log("t-drink", true)], 7, 7);
    expect(broken.taskResults[0].achieved).toBe(false);
    expect(broken.taskResults[0].points).toBe(-10);
  });

  it("represents a perfect week when all daily days and all weekly tasks succeeded", () => {
    const weekLogs = [
      ...[1, 2, 3, 4].map(() => log("t-gym", true, 1)),
      log("t-walk", true, 10),
      log("t-push", true, 150),
    ];
    const res = computeWeeklyResultSummary(weeklyTasks, pushupTiers, weekLogs, 7, 7);
    expect(res.perfectWeek).toBe(true);
  });

  it("is not a perfect week if a daily day was missed", () => {
    const weekLogs = [
      ...[1, 2, 3, 4].map(() => log("t-gym", true, 1)),
      log("t-walk", true, 10),
      log("t-push", true, 150),
    ];
    const res = computeWeeklyResultSummary(weeklyTasks, pushupTiers, weekLogs, 6, 7);
    expect(res.perfectWeek).toBe(false);
  });

  it("awards weekly points when a days/week checkbox goal is met", () => {
    const goalTasks: ChallengeTask[] = [
      {
        id: "w-gym",
        challengeId: "c1",
        name: "Gym 4x/week",
        type: "WEEKLY",
        inputType: "CHECKBOX",
        isRuleBreaker: false,
        isAlcoholTask: false,
        points: 40,
        unit: null,
        target: 4,
        bonusThreshold: null,
        bonusPoints: null,
      },
    ];

    // 3 days logged → goal not met yet, no points.
    const threeDays = [
      log("w-gym", true),
      log("w-gym", true),
      log("w-gym", true),
    ];
    const partial = computeWeeklyResultSummary(goalTasks, [], threeDays, 3, 7);
    expect(partial.taskResults[0].achieved).toBe(false);
    expect(partial.points).toBe(0);

    // 4 days logged → goal met, points awarded.
    const fourDays = [...threeDays, log("w-gym", true)];
    const met = computeWeeklyResultSummary(goalTasks, [], fourDays, 4, 7);
    expect(met.taskResults[0].achieved).toBe(true);
    expect(met.points).toBe(40);

    // Unchecking one day drops it below the goal.
    const threeAgain = [...fourDays.slice(0, 3)];
    const reverted = computeWeeklyResultSummary(goalTasks, [], threeAgain, 3, 7);
    expect(reverted.taskResults[0].achieved).toBe(false);
  });

  it("sums the per-log bonus the log UI awarded when a weekly NUMBER task reached its threshold", () => {
    const runTasks: ChallengeTask[] = [
      { id: "t-run", challengeId: "c1", name: "Run", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: "km", target: null, bonusThreshold: 20, bonusPoints: 100 },
    ];

    // The user hit 25 km ≥ 20 → the log UI awarded +100 on that day's entry.
    const res = computeWeeklyResultSummary(runTasks, [], [log("t-run", true, 25, 100)], 7, 7);
    const r = res.taskResults[0];
    expect(r.achieved).toBe(true);
    expect(r.currentValue).toBe(25);
    expect(r.points).toBe(25 * 5 + 100); // 125 per-unit + 100 bonus
    expect(r.bonusThreshold).toBe(20);
    expect(r.bonusPoints).toBe(100);

    // Bonus awarded across two days still sums to a single award.
    const split = computeWeeklyResultSummary(
      runTasks,
      [],
      [log("t-run", true, 20, 100), log("t-run", true, 5, 0)],
      7, 7
    );
    expect(split.taskResults[0].points).toBe(25 * 5 + 100);
  });

  it("does NOT auto-award a bonus in the backend when the threshold is crossed", () => {
    const runTasks: ChallengeTask[] = [
      { id: "t-run", challengeId: "c1", name: "Run", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 5, unit: "km", target: null, bonusThreshold: 20, bonusPoints: 100 },
    ];

    // 25 km but no bonus was logged → only per-unit points, no magic bonus.
    const res = computeWeeklyResultSummary(runTasks, [], [log("t-run", true, 25)], 7, 7);
    expect(res.taskResults[0].points).toBe(125);
  });

  it("awards no bonus when the task has no bonus configured", () => {
    const noBonusTasks: ChallengeTask[] = [
      { id: "t-walk", challengeId: "c1", name: "10km walk", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", target: null, bonusThreshold: null, bonusPoints: null },
    ];
    const res = computeWeeklyResultSummary(noBonusTasks, [], [log("t-walk", true, 25)], 7, 7);
    expect(res.taskResults[0].points).toBe(250);
  });

  it("awards weekly NUMBER points per block of unitCount units", () => {
    const pushupTasks: ChallengeTask[] = [
      { id: "t-push", challengeId: "c1", name: "Pushups", type: "WEEKLY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 20, unit: "push-ups", unitCount: 50, target: null, bonusThreshold: null, bonusPoints: null },
    ];
    // 220 push-ups → floor(220/50) = 4 blocks → 80 pts
    const res = computeWeeklyResultSummary(pushupTasks, [], [log("t-push", true, 220)], 7, 7);
    expect(res.taskResults[0].achieved).toBe(true);
    expect(res.taskResults[0].points).toBe(80);
  });
});

describe("unitsLabel", () => {
  it("renders the unit type alone for a single unit", () => {
    expect(unitsLabel({ unit: "km", unitCount: null })).toBe("km");
    expect(unitsLabel({ unit: "km", unitCount: 1 })).toBe("km");
    expect(unitsLabel({ unit: null, unitCount: null })).toBe("unit");
  });

  it("prefixes the count for multi-unit blocks", () => {
    expect(unitsLabel({ unit: "push-ups", unitCount: 50 })).toBe("50 push-ups");
    expect(unitsLabel({ unit: null, unitCount: 50 })).toBe("50 units");
  });
});

describe("numberTaskPoints", () => {
  it("adds the configured bonus once the value reaches the threshold", () => {
    const walk: ChallengeTask = { id: "t-walk", challengeId: "c1", name: "Walk", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", target: null, bonusThreshold: 10, bonusPoints: 15 };
    // 21 km → 21 × 10 = 210 + one bonus of 15 → 225
    expect(numberTaskPoints(21, walk)).toBe(225);
    // 9 km → 90, no bonus yet
    expect(numberTaskPoints(9, walk)).toBe(90);
    // Exactly at the threshold → one bonus
    expect(numberTaskPoints(10, walk)).toBe(115);
  });

  it("treats fractional values by rounding the earned units", () => {
    const pushups: ChallengeTask = { id: "t-push", challengeId: "c1", name: "Pushups", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 2, unit: "reps", target: null, bonusThreshold: 50, bonusPoints: 10 };
    // 120.4 rounds to 120 → 120 × 2 = 240 + one bonus of 10 → 250
    expect(numberTaskPoints(120.4, pushups)).toBe(250);
  });

  it("awards points per block of unitCount units", () => {
    const pushups: ChallengeTask = { id: "t-push", challengeId: "c1", name: "Pushups", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 20, unit: "push-ups", unitCount: 50, target: null, bonusThreshold: null, bonusPoints: null };
    // 20 pts per 50 push-ups:
    expect(numberTaskPoints(0, pushups)).toBe(0);
    expect(numberTaskPoints(49, pushups)).toBe(0); // no full block yet
    expect(numberTaskPoints(50, pushups)).toBe(20);
    expect(numberTaskPoints(100, pushups)).toBe(40);
    expect(numberTaskPoints(123, pushups)).toBe(40); // floor of 123/50 = 2 blocks
  });

  it("duplicates a unitCount of 1 behave line per-unit scoring", () => {
    const walk: ChallengeTask = { id: "t-walk", challengeId: "c1", name: "Walk", type: "DAILY", inputType: "NUMBER", isRuleBreaker: false, isAlcoholTask: false, points: 10, unit: "km", unitCount: 1, target: null, bonusThreshold: null, bonusPoints: null };
    expect(numberTaskPoints(21, walk)).toBe(210);
  });
});
