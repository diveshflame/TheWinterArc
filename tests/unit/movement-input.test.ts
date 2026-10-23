import { describe, it, expect } from "vitest";
import type { ChallengeTask } from "@/lib/scoring";
import {
  movementConfigFor,
  sanitizeMovementInput,
  parseMovementInput,
  clampMovementValue,
  applyMovementDelta,
} from "@/lib/movement-config";

function task(unit: string | null): ChallengeTask {
  return {
    id: "t1",
    challengeId: "c1",
    name: unit === "km" ? "Running" : "Push-ups",
    type: "DAILY",
    inputType: "NUMBER",
    isRuleBreaker: false,
    isAlcoholTask: false,
    points: 10,
    unit,
    unitCount: 1,
    target: null,
    bonusThreshold: null,
    bonusPoints: null,
  };
}

const km = movementConfigFor(task("km"));
const reps = movementConfigFor(task("reps"));

describe("movementConfigFor", () => {
  it("treats km-like units as distance (0.5 steps, decimal input)", () => {
    expect(km.category).toBe("distance");
    expect(km.step).toBe(0.5);
    expect(km.decimals).toBe(1);
    expect(km.maxPerDay).toBe(100);
    expect(km.chips).toEqual([0.5, 1, 5]);
    expect(km.inputMode).toBe("decimal");
  });

  it("treats everything else as integer reps", () => {
    expect(reps.category).toBe("reps");
    expect(reps.step).toBe(1);
    expect(reps.decimals).toBe(0);
    expect(reps.maxPerDay).toBe(50000);
    expect(reps.chips).toEqual([5, 10, 20, 50]);
    expect(reps.inputMode).toBe("numeric");
  });
});

describe("sanitizeMovementInput", () => {
  it("normalizes commas to a decimal point", () => {
    expect(sanitizeMovementInput("1,5", km)).toBe("1.5");
  });

  it("strips non-numeric characters", () => {
    expect(sanitizeMovementInput("abc", reps)).toBe("");
    expect(sanitizeMovementInput("12abc", reps)).toBe("12");
  });

  it("strips leading zeros but keeps a leading 0 before a decimal", () => {
    expect(sanitizeMovementInput("007", reps)).toBe("7");
    expect(sanitizeMovementInput("0.5", km)).toBe("0.5");
    expect(sanitizeMovementInput("0", reps)).toBe("0");
    expect(sanitizeMovementInput("00", reps)).toBe("0");
  });

  it("keeps at most one decimal point and caps decimals", () => {
    expect(sanitizeMovementInput("1.2.3", km)).toBe("1.23");
    expect(sanitizeMovementInput("1.234", km)).toBe("1.23");
  });

  it("rejects decimals for reps by dropping the fraction", () => {
    expect(sanitizeMovementInput("1.5", reps)).toBe("1");
    expect(sanitizeMovementInput("12.9", reps)).toBe("12");
  });

  it("returns empty for an empty input", () => {
    expect(sanitizeMovementInput("", reps)).toBe("");
  });
});

describe("parseMovementInput", () => {
  it("returns 0 for empty or invalid text", () => {
    expect(parseMovementInput("", reps)).toBe(0);
    expect(parseMovementInput("abc", reps)).toBe(0);
    expect(parseMovementInput("0", reps)).toBe(0);
  });

  it("parses valid values", () => {
    expect(parseMovementInput("12abc", reps)).toBe(12);
    expect(parseMovementInput("007", reps)).toBe(7);
    expect(parseMovementInput("0.5", km)).toBe(0.5);
    expect(parseMovementInput("1,5", km)).toBe(1.5);
    expect(parseMovementInput("1.234", km)).toBe(1.23);
  });
});

describe("clampMovementValue", () => {
  it("never goes below zero", () => {
    expect(clampMovementValue(-5, reps)).toBe(0);
  });

  it("caps at the per-day maximum", () => {
    expect(clampMovementValue(60000, reps)).toBe(50000);
    expect(clampMovementValue(150, km)).toBe(100);
  });

  it("rounds to the task precision", () => {
    expect(clampMovementValue(1.26, km)).toBe(1.3);
    expect(clampMovementValue(40.4, reps)).toBe(40);
  });
});

describe("applyMovementDelta", () => {
  it("adds a typed value plus a chip without exceeding the max", () => {
    expect(applyMovementDelta(40, 10, reps)).toBe(50);
    expect(applyMovementDelta(49950, 50, reps)).toBe(50000);
  });

  it("stops at zero when decreasing", () => {
    expect(applyMovementDelta(0, -1, reps)).toBe(0);
  });

  it("applies fractional steps for distance", () => {
    expect(applyMovementDelta(0, 0.5, km)).toBe(0.5);
  });
});
