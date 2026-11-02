import { describe, it, expect } from "vitest";
import {
  computeBestDay,
  computeBestMonth,
  computeBestWeek,
  computeWeeklyWinners,
  type ScoredDay,
  type WeeklyWinner,
} from "@/lib/weekly-winners";

// Fixed clocks: weeks start Monday (UTC midnight).
// 2026-01-05 is a Monday; 2025-12-29 / 2025-12-22 are Mondays too.
const currentWeekStart = new Date("2026-01-05T00:00:00.000Z");
const lastWeekStart = new Date("2025-12-29T00:00:00.000Z");
const prevWeekStart = new Date("2025-12-22T00:00:00.000Z");

function score(userId: string, points: number, weekStart: Date, weekNumber: number) {
  return {
    userId,
    points,
    weekStart,
    weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
    weekNumber,
  };
}

describe("computeWeeklyWinners", () => {
  it("picks the top scorer for each completed week, most recent first", () => {
    const winners: WeeklyWinner[] = computeWeeklyWinners({
      scores: [
        score("u1", 20, prevWeekStart, 2),
        score("u2", 50, lastWeekStart, 1),
      ],
      namesByUserId: { u1: "Alice", u2: "Bob" },
      currentWeekStart,
    });

    expect(winners).toHaveLength(2);
    expect(winners[0]).toMatchObject({
      userId: "u2",
      name: "Bob",
      points: 50,
      weekNumber: 1,
    });
    expect(winners[1]).toMatchObject({
      userId: "u1",
      name: "Alice",
      points: 20,
      weekNumber: 2,
    });
  });

  it("picks the top scorer per week using full week totals (daily + weekly task points)", () => {
    const winners = computeWeeklyWinners({
      scores: [
        score("u1", 20, prevWeekStart, 2),
        score("u2", 30, prevWeekStart, 2),
      ],
      namesByUserId: { u1: "Alice", u2: "Bob" },
      dailySummariesByUserId: {
        u1: [
          { pointsAwarded: 100, date: new Date("2025-12-23T00:00:00.000Z") },
          { pointsAwarded: 60, date: new Date("2025-12-27T00:00:00.000Z") },
        ],
        u2: [
          { pointsAwarded: 50, date: new Date("2025-12-24T00:00:00.000Z") },
          { pointsAwarded: 50, date: new Date("2025-12-28T00:00:00.000Z") },
        ],
      },
      currentWeekStart,
    });

    expect(winners).toHaveLength(1);
    // Alice: 160 daily + 20 weekly-task = 180. Bob: 100 daily + 30 weekly = 130.
    expect(winners[0]).toMatchObject({ userId: "u1", name: "Alice", points: 180 });
  });

  it("excludes the current in-progress week", () => {
    const winners = computeWeeklyWinners({
      scores: [
        score("u1", 99, currentWeekStart, 3),
        score("u2", 50, lastWeekStart, 1),
      ],
      namesByUserId: { u1: "Alice", u2: "Bob" },
      currentWeekStart,
    });

    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ userId: "u2", points: 50 });
  });

  it("returns an empty list when there are no completed weeks", () => {
    expect(
      computeWeeklyWinners({ scores: [], namesByUserId: {}, currentWeekStart })
    ).toEqual([]);
  });
});

describe("personal best records", () => {
  it("computes the best day from scored days", () => {
    const best = computeBestDay([
      { pointsAwarded: 30, date: new Date("2026-01-02T00:00:00.000Z") },
      { pointsAwarded: 50, date: new Date("2026-01-05T00:00:00.000Z") },
      { pointsAwarded: 20, date: new Date("2026-01-06T00:00:00.000Z") },
    ] satisfies ScoredDay[]);

    expect(best).toEqual({
      points: 50,
      date: new Date("2026-01-05T00:00:00.000Z"),
    });
  });

  it("computes the best week as daily plus weekly task points, excluding the in-progress week", () => {
    const best = computeBestWeek(
      [
        score("u1", 20, prevWeekStart, 2),
        score("u1", 10, lastWeekStart, 1),
      ],
      [
        { pointsAwarded: 100, date: new Date("2025-12-23T00:00:00.000Z") },
        { pointsAwarded: 60, date: new Date("2025-12-27T00:00:00.000Z") },
        { pointsAwarded: 80, date: new Date("2025-12-30T00:00:00.000Z") },
        { pointsAwarded: 70, date: new Date("2025-12-31T00:00:00.000Z") },
        { pointsAwarded: 99, date: new Date("2026-01-06T00:00:00.000Z") },
      ],
      "u1",
      currentWeekStart
    );

    // Week of 2025-12-22: 100 + 60 daily pts + 20 weekly-task pts = 180.
    // Week of 2025-12-29: 80 + 70 daily pts + 10 weekly-task pts = 160.
    // Current week (2026-01-05) is excluded.
    expect(best).toEqual({
      points: 180,
      weekStart: new Date("2025-12-22T00:00:00.000Z"),
    });
  });

  it("computes the best month as daily plus weekly task points", () => {
    const best = computeBestMonth(
      [
        score("u1", 20, prevWeekStart, 2),
        score("u1", 10, lastWeekStart, 1),
      ],
      [
        { pointsAwarded: 30, date: new Date("2025-12-02T00:00:00.000Z") },
        { pointsAwarded: 20, date: new Date("2025-12-04T00:00:00.000Z") },
        { pointsAwarded: 10, date: new Date("2025-11-02T00:00:00.000Z") },
      ],
      "u1",
      currentWeekStart
    );

    // December: (30 + 20) daily + (20 + 10) weekly-task = 80.
    // November: 10 daily + 0 weekly = 10.
    expect(best).toEqual({ points: 80, monthKey: "2025-12" });
  });
});
