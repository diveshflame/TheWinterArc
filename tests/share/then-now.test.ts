import { describe, it, expect } from "vitest";
import {
  bothDaysEmpty,
  metricForTask,
  percentChip,
  resolvePreset,
  selectMetricRows,
  thenNowAvailability,
  validateNowDay,
  validateThenDay,
} from "@/lib/share/then-now";
import type { ShareDayHistory } from "@/lib/share/types";
import { makeDayHistory, makeShareCardData } from "../fixtures/share-card-data";

const day = (overrides: Partial<ShareDayHistory>): ShareDayHistory => ({
  dayNumber: 1,
  date: "2026-01-01",
  points: 0,
  pushups: 0,
  pullups: 0,
  runKm: 0,
  walkKm: 0,
  ...overrides,
});

describe("metricForTask", () => {
  it("maps task names to the compared metrics", () => {
    expect(metricForTask("Push Ups", "reps")).toBe("pushups");
    expect(metricForTask("Pull-ups", null)).toBe("pullups");
    expect(metricForTask("Running", "km")).toBe("runKm");
    expect(metricForTask("Walking", "km")).toBe("walkKm");
  });

  it("only counts distance when the unit is km", () => {
    expect(metricForTask("Running", "miles")).toBeNull();
    expect(metricForTask("Walking", null)).toBeNull();
    expect(metricForTask("Steps", "steps")).toBeNull();
    expect(metricForTask("Water", null)).toBeNull();
    expect(metricForTask("Read", null)).toBeNull();
  });

  it("treats step-style walk tasks as walk km only when the unit is km", () => {
    expect(metricForTask("Morning walk", "KM")).toBe("walkKm");
  });
});

describe("selectMetricRows", () => {
  it("picks the two metrics with the largest relative gain, excluding regressions", () => {
    const then = day({ pushups: 10, pullups: 10, runKm: 1, walkKm: 5 });
    const now = day({ pushups: 30, pullups: 12, runKm: 4, walkKm: 3 });
    const rows = selectMetricRows(then, now);
    // pushups +200%, runKm +300%, pullups +20%, walkKm regressed
    expect(rows.map((r) => r.key)).toEqual(["runKm", "pushups"]);
    expect(rows[0]).toMatchObject({ thenValue: 1, nowValue: 4 });
    expect(rows[1]).toMatchObject({ thenValue: 10, nowValue: 30 });
  });

  it("ranks zero-to-something gains above every finite gain", () => {
    const then = day({ pushups: 10, runKm: 0 });
    const now = day({ pushups: 20, runKm: 1 });
    expect(selectMetricRows(then, now).map((r) => r.key)).toEqual(["runKm", "pushups"]);
  });

  it("returns fewer rows when less than two metrics improved", () => {
    const then = day({ pushups: 10 });
    const now = day({ pushups: 20 });
    expect(selectMetricRows(then, now).map((r) => r.key)).toEqual(["pushups"]);
    expect(selectMetricRows(now, then)).toEqual([]);
  });
});

describe("percentChip / bothDaysEmpty", () => {
  it("rounds the relative gain", () => {
    expect(percentChip(40, 80)).toBe(100);
    expect(percentChip(10, 13)).toBe(30);
    expect(percentChip(3, 4)).toBe(33);
  });

  it("is null without a Then baseline or without improvement", () => {
    expect(percentChip(0, 50)).toBeNull();
    expect(percentChip(10, 10)).toBeNull();
    expect(percentChip(20, 10)).toBeNull();
  });

  it("detects empty day pairs", () => {
    expect(bothDaysEmpty(0, 0)).toBe(true);
    expect(bothDaysEmpty(0, 5)).toBe(false);
    expect(bothDaysEmpty(-1, 0)).toBe(true);
  });
});

describe("resolvePreset", () => {
  const history = makeDayHistory(30, (d) => (d === 1 ? 40 : d === 12 ? 100 : d === 30 ? 60 : 10));
  const ctx = (nowDay: number) => ({ currentDay: 30, nowDay, dayHistory: history });

  it("day1 always resolves while the challenge is running", () => {
    expect(resolvePreset("day1", ctx(30))).toBe(1);
  });

  it("yesterday / week resolve only when they exist", () => {
    expect(resolvePreset("yesterday", ctx(30))).toBe(29);
    expect(resolvePreset("yesterday", ctx(1))).toBeNull();
    expect(resolvePreset("week", ctx(30))).toBe(23);
    expect(resolvePreset("week", ctx(7))).toBeNull();
  });

  it("best picks the highest-points day strictly before Now, ties to the earlier day", () => {
    expect(resolvePreset("best", ctx(30))).toBe(12);
    expect(resolvePreset("best", ctx(13))).toBe(12);
    expect(resolvePreset("best", ctx(1))).toBeNull();

    const tie = [
      day({ dayNumber: 1, points: 50 }),
      day({ dayNumber: 2, points: 50 }),
      day({ dayNumber: 3, points: 10 }),
    ];
    expect(resolvePreset("best", { currentDay: 3, nowDay: 3, dayHistory: tie })).toBe(1);
    expect(resolvePreset("best", { currentDay: 3, nowDay: 2, dayHistory: tie })).toBe(1);
  });
});

describe("Then < Now validation", () => {
  it("rejects Then at or after Now with an inline message", () => {
    expect(validateThenDay(1, 5)).toEqual({ ok: true });
    expect(validateThenDay(5, 5)).toEqual({ ok: false, message: "Pick a day before Now" });
    expect(validateThenDay(6, 5)).toEqual({ ok: false, message: "Pick a day before Now" });
    expect(validateThenDay(0, 5)).toEqual({ ok: false, message: "No days before Day 1" });
  });

  it("rejects future days and Now at or before Then", () => {
    expect(validateNowDay(5, 1, 30)).toEqual({ ok: true });
    expect(validateNowDay(31, 1, 30)).toEqual({ ok: false, message: "No future days" });
    expect(validateNowDay(5, 5, 30)).toEqual({ ok: false, message: "Pick a day after Then" });
    expect(validateNowDay(1, 1, 30)).toEqual({ ok: false, message: "Pick a day after Then" });
  });
});

describe("thenNowAvailability", () => {
  const data = makeShareCardData();

  it("is unavailable without history or activity on both days", () => {
    expect(thenNowAvailability({ ...data, dayHistory: [] })).toMatchObject({
      available: false,
      reason: "Pick days with logged activity",
    });
    const flat = { ...data, dayHistory: data.dayHistory.map((d) => ({ ...d, points: 0 })) };
    expect(thenNowAvailability(flat, 1, 45).available).toBe(false);
    expect(thenNowAvailability(flat, 1, 45).reason).toBe("Pick days with logged activity");
  });

  it("is available when either selected day has points", () => {
    expect(thenNowAvailability(data, 1, 45).available).toBe(true);
    expect(thenNowAvailability(data, 2, 45).available).toBe(true); // Then empty, Now has points
    const todayFlat = {
      ...data,
      dayHistory: data.dayHistory.map((d) => (d.dayNumber === 45 ? { ...d, points: 0 } : d)),
    };
    expect(thenNowAvailability(todayFlat, 1, 45).available).toBe(true); // Then has points, today empty
    expect(thenNowAvailability(todayFlat, 2, 45).available).toBe(false); // both empty
  });
});
