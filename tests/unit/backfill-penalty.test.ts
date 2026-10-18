import { describe, it, expect } from "vitest";
import {
  applyBackfillFactor,
  onTimeTaskPoints,
  backfillAwardedPoints,
  backfillNumberTaskPoints,
  thresholdBonusFor,
  evaluateBackfillEligibility,
  yesterdayKey,
  todayKey,
  addDaysToKey,
  daysBetweenKeys,
  isWithinDays,
  isDateKey,
  dateKeyToUtcDate,
  keyWeekdayLong,
  keyNumericDate,
  BACKFILL_AWARDS_STREAK_BONUS,
  BACKFILL_AWARDS_DAILY_BONUS,
  BACKFILL_COUNTS_TOWARD_WEEKLY,
  BACKFILL_AWARDS_LEAGUE_BONUS,
} from "@/lib/backfill";
import {
  computeWeeklyResultSummary,
  type ChallengeTask,
  type TaskLog,
} from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Rule 3: floor(normalPoints × 0.7); rule 4: penalties at full value
// ---------------------------------------------------------------------------

describe("applyBackfillFactor", () => {
  it("floors positive points at 70% (spec examples)", () => {
    expect(applyBackfillFactor(20)).toBe(14); // 14.0 → 14
    expect(applyBackfillFactor(12)).toBe(8); //   8.4 → 8
    expect(applyBackfillFactor(5)).toBe(3); //    3.5 → 3
    expect(applyBackfillFactor(2)).toBe(1); //    1.4 → 1
    expect(applyBackfillFactor(45)).toBe(31); // 31.5 → 31
  });

  it("floors per task, so a 72-pt day can pay out 49", () => {
    const onTime = [20, 20, 12, 10, 5, 5]; // sums to 72
    expect(onTime.reduce((s, p) => s + p, 0)).toBe(72);
    const discounted = onTime.reduce((s, p) => s + applyBackfillFactor(p), 0);
    expect(discounted).toBe(49); // 14+14+8+7+3+3
  });

  it("leaves zero and negative (penalty) points untouched", () => {
    expect(applyBackfillFactor(0)).toBe(0);
    expect(applyBackfillFactor(-10)).toBe(-10);
    expect(applyBackfillFactor(-5)).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// Rule 3 for movement tasks: normal points (incl. bonuses) first, then ×0.7
// ---------------------------------------------------------------------------

const walking: ChallengeTask = {
  id: "t-walking",
  challengeId: "c1",
  name: "Walking",
  type: "DAILY",
  inputType: "NUMBER",
  isRuleBreaker: false,
  isAlcoholTask: false,
  points: 5,
  unit: "km",
  unitCount: 1,
  target: null,
  bonusThreshold: 5,
  bonusPoints: 15,
};

const pushups: ChallengeTask = {
  id: "t-pushups",
  challengeId: "c1",
  name: "push-ups",
  type: "DAILY",
  inputType: "NUMBER",
  isRuleBreaker: false,
  isAlcoholTask: false,
  points: 1,
  unit: "reps",
  unitCount: 5,
  target: null,
  bonusThreshold: 100,
  bonusPoints: 25,
};

const protein: ChallengeTask = {
  id: "t-protein",
  challengeId: "c1",
  name: "1.5x body weight Protein",
  type: "DAILY",
  inputType: "CHECKBOX",
  isRuleBreaker: false,
  isAlcoholTask: false,
  points: 20,
  unit: null,
  target: null,
  bonusThreshold: null,
  bonusPoints: null,
};

const readBook: ChallengeTask = {
  ...protein,
  id: "t-read",
  name: "Read book for 30 mins",
  points: 12,
};

const fruit: ChallengeTask = { ...protein, id: "t-fruit", name: "1 fruit intake", points: 2 };

const noPhone: ChallengeTask = {
  ...protein,
  id: "t-nophone",
  name: "No phone while eating",
  points: 5,
};

const alcohol: ChallengeTask = {
  ...protein,
  id: "t-alcohol",
  name: "Drank Alcohol",
  points: -10,
  isAlcoholTask: true,
};

describe("backfill movement points", () => {
  it("computes normal points (incl. threshold bonus) before applying 0.7", () => {
    // 6 km walking: 6×5 = 30, + 15 threshold bonus = 45 → floor(45×0.7) = 31
    expect(backfillNumberTaskPoints(6, walking)).toEqual({ original: 45, awarded: 31 });
    // 3 km: 15 on-time, no bonus → 10
    expect(backfillNumberTaskPoints(3, walking)).toEqual({ original: 15, awarded: 10 });
    // 100 push-ups: floor(100/5)=20 blocks + 25 threshold bonus = 45 → 31
    expect(backfillNumberTaskPoints(100, pushups)).toEqual({ original: 45, awarded: 31 });
    // 45 push-ups: floor(45/5)=9 → 9 → 6 (no threshold bonus yet)
    expect(backfillNumberTaskPoints(45, pushups)).toEqual({ original: 9, awarded: 6 });
    // 150 push-ups: 30 blocks + 25 bonus = 55 → 38
    expect(backfillNumberTaskPoints(150, pushups)).toEqual({ original: 55, awarded: 38 });
  });

  it("returns zero for empty movement values", () => {
    expect(backfillNumberTaskPoints(0, walking)).toEqual({ original: 0, awarded: 0 });
  });

  it("exposes the on-time threshold bonus for log storage", () => {
    expect(thresholdBonusFor(6, walking)).toBe(15);
    expect(thresholdBonusFor(3, walking)).toBe(0);
    expect(thresholdBonusFor(100, pushups)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Checkbox habits and penalties (rules 3 & 4)
// ---------------------------------------------------------------------------

describe("backfill checkbox points", () => {
  it("discounts habit points with the spec examples", () => {
    expect(onTimeTaskPoints(protein, { completed: true, value: 0 })).toBe(20);
    expect(backfillAwardedPoints(protein, { completed: true, value: 0 })).toBe(14);
    expect(backfillAwardedPoints(readBook, { completed: true, value: 0 })).toBe(8);
    expect(backfillAwardedPoints(noPhone, { completed: true, value: 0 })).toBe(3);
    expect(backfillAwardedPoints(fruit, { completed: true, value: 0 })).toBe(1);
  });

  it("does not discount penalty tasks (negative points at full value)", () => {
    expect(onTimeTaskPoints(alcohol, { completed: true, value: 0 })).toBe(-10);
    expect(backfillAwardedPoints(alcohol, { completed: true, value: 0 })).toBe(-10);
  });

  it("awards nothing for unchecked habits", () => {
    expect(backfillAwardedPoints(protein, { completed: false, value: 0 })).toBe(0);
  });

  it("treats broken rule breakers as zero (no points lost twice)", () => {
    const noEatingLate: ChallengeTask = {
      ...protein,
      id: "t-noeve",
      isRuleBreaker: true,
      points: 4,
    };
    expect(backfillAwardedPoints(noEatingLate, { completed: true, value: 0 })).toBe(0);
    expect(backfillAwardedPoints(noEatingLate, { completed: false, value: 0 })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Rule 6: config flags default as specified
// ---------------------------------------------------------------------------

describe("backfill config flags (rule 6 defaults)", () => {
  it("withholds streak and daily-completion bonuses; keeps weekly counting", () => {
    expect(BACKFILL_AWARDS_STREAK_BONUS).toBe(false);
    expect(BACKFILL_AWARDS_DAILY_BONUS).toBe(false);
    expect(BACKFILL_COUNTS_TOWARD_WEEKLY).toBe(true);
    expect(BACKFILL_AWARDS_LEAGUE_BONUS).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: eligibility
// ---------------------------------------------------------------------------

describe("evaluateBackfillEligibility", () => {
  const base = {
    targetKey: "2026-10-18",
    memberJoinedKey: "2026-01-01",
    challengeStartKey: "2026-01-01",
  };

  it("is eligible with zero logs and membership that day", () => {
    expect(evaluateBackfillEligibility({ ...base, existingLogCount: 0 })).toEqual({
      eligible: true,
    });
  });

  it("locks the day once any log exists", () => {
    expect(evaluateBackfillEligibility({ ...base, existingLogCount: 1 })).toEqual({
      eligible: false,
      reason: "already_logged",
    });
  });

  it("rejects users who joined after that day", () => {
    expect(
      evaluateBackfillEligibility({ ...base, existingLogCount: 0, memberJoinedKey: "2026-10-19" })
    ).toEqual({ eligible: false, reason: "not_in_challenge_yet" });
  });

  it("rejects days before the challenge started", () => {
    expect(
      evaluateBackfillEligibility({
        ...base,
        existingLogCount: 0,
        challengeStartKey: "2026-10-18",
        memberJoinedKey: "2026-10-18",
      }).eligible
    ).toBe(true); // same day is fine
    expect(
      evaluateBackfillEligibility({
        ...base,
        existingLogCount: 0,
        challengeStartKey: "2026-10-19",
        memberJoinedKey: "2026-10-01",
      })
    ).toEqual({ eligible: false, reason: "challenge_starts_later" });
  });
});

// ---------------------------------------------------------------------------
// Rule 1: only the immediately previous day
// ---------------------------------------------------------------------------

describe("backfill date keys", () => {
  it("todayKey/yesterdayKey use the LOCAL calendar day (startOfDay convention)", () => {
    // Local-noon construction keeps this TZ-agnostic.
    const now = new Date(2026, 9, 19, 12, 30); // 2026-10-19 local
    expect(todayKey(now)).toBe("2026-10-19");
    expect(yesterdayKey(now)).toBe("2026-10-18");

    // Near-midnight edges resolve to the local day, not the UTC day.
    expect(todayKey(new Date(2026, 9, 19, 0, 0))).toBe("2026-10-19");
    expect(yesterdayKey(new Date(2026, 9, 19, 23, 59, 59))).toBe("2026-10-18");
    expect(todayKey(new Date(2026, 8, 30, 0, 5))).toBe("2026-09-30"); // month rollover
    expect(yesterdayKey(new Date(2026, 9, 1, 0, 1))).toBe("2026-09-30"); // month rollover
    expect(yesterdayKey(new Date(2026, 2, 1, 12))).toBe("2026-02-28"); // non-leap
    expect(yesterdayKey(new Date(2024, 2, 1, 12))).toBe("2024-02-29"); // leap

    expect(addDaysToKey("2026-10-18", 1)).toBe("2026-10-19");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToKey("2024-03-01", -1)).toBe("2024-02-29"); // leap year
  });

  it("validates and round-trips date keys", () => {
    expect(isDateKey("2026-10-18")).toBe(true);
    expect(isDateKey("18-10-2026")).toBe(false);
    expect(isDateKey("2026-10-1")).toBe(false);
    expect(dateKeyToUtcDate("2026-10-18").toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });

  it("isWithinDays accepts cross-timezone claims but rejects stale/forged dates", () => {
    // Real client/server clock skew is bounded by the UTC−12..+14 span.
    expect(isWithinDays("2026-10-19", "2026-10-19")).toBe(true);
    expect(isWithinDays("2026-10-19", "2026-10-18")).toBe(true);
    expect(isWithinDays("2026-10-18", "2026-10-19")).toBe(true);
    // More than one day apart: stale (midnight race) or forged.
    expect(isWithinDays("2026-10-17", "2026-10-19")).toBe(false);
    expect(isWithinDays("2026-10-21", "2026-10-19")).toBe(false);
    // Zero tolerance at the save boundary.
    expect(isWithinDays("2026-10-17", "2026-10-19", 1)).toBe(false);
    expect(daysBetweenKeys("2026-10-17", "2026-10-19")).toBe(2);
    expect(daysBetweenKeys("2026-10-19", "2026-10-17")).toBe(-2);
  });

  it("derives display labels from the key", () => {
    expect(keyWeekdayLong("2026-10-18")).toBe("Sunday");
    expect(keyNumericDate("2026-10-18")).toBe("10/18/2026");
  });
});

// ---------------------------------------------------------------------------
// Weekly summary: backfill logs use awarded points; checkbox logs count (rule 6)
// ---------------------------------------------------------------------------

function taskLog(partial: Partial<TaskLog> & { taskId: string }): TaskLog {
  return {
    id: "log-1",
    challengeId: "c1",
    userId: "u1",
    date: new Date("2026-10-18T00:00:00.000Z"),
    completed: false,
    value: 0,
    bonusPoints: 0,
    isBackfill: false,
    originalPoints: null,
    awardedPoints: null,
    loggedAt: null,
    ...partial,
  };
}

describe("computeWeeklyResultSummary with backfill logs", () => {
  const gym: ChallengeTask = {
    id: "t-gym",
    challengeId: "c1",
    name: "Gym",
    type: "WEEKLY",
    inputType: "CHECKBOX",
    isRuleBreaker: false,
    isAlcoholTask: false,
    points: 125,
    unit: null,
    unitCount: 1,
    target: 2,
    bonusThreshold: null,
    bonusPoints: null,
  };

  const upskilling: ChallengeTask = {
    id: "t-upskill",
    challengeId: "c1",
    name: "Upskilling",
    type: "WEEKLY",
    inputType: "NUMBER",
    isRuleBreaker: false,
    isAlcoholTask: false,
    points: 10,
    unit: "hrs",
    unitCount: 1,
    target: null,
    bonusThreshold: 5,
    bonusPoints: 15,
  };

  it("counts a backfilled day toward a weekly checkbox target (rule 6)", () => {
    const logs = [
      taskLog({ taskId: "t-gym", completed: true }),
      taskLog({ taskId: "t-gym", completed: true, isBackfill: true, awardedPoints: 0, originalPoints: 0 }),
    ];
    const result = computeWeeklyResultSummary([gym], [], logs, 0, 7);
    expect(result.taskResults[0].currentValue).toBe(2);
    expect(result.taskResults[0].achieved).toBe(true);
    expect(result.points).toBe(125);
  });

  it("sums discounted awardedPoints for weekly NUMBER backfill entries", () => {
    // 2 h on time = 20 pts; backfill entry stores awarded = floor(20×0.7) = 14
    const logs = [
      taskLog({ taskId: "t-upskill", value: 2, bonusPoints: 0 }),
      taskLog({
        taskId: "t-upskill",
        value: 2,
        isBackfill: true,
        originalPoints: 20,
        awardedPoints: 14,
      }),
    ];
    const result = computeWeeklyResultSummary([upskilling], [], logs, 0, 7);
    expect(result.points).toBe(20 + 14);
  });
});
