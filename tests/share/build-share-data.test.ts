import { describe, it, expect } from "vitest";
import {
  topActivities,
  buildHabits,
  computeTodayPoints,
  buildSquad,
  choosePromotionVariant,
  buildShareCardData,
} from "@/lib/share/build-share-data";

const TASKS = [
  {
    id: "t1",
    name: "Morning Run",
    type: "DAILY" as const,
    inputType: "NUMBER" as const,
    points: 1,
    unit: "km",
    isRuleBreaker: false,
  },
  {
    id: "t2",
    name: "Push Ups",
    type: "DAILY" as const,
    inputType: "NUMBER" as const,
    points: 1,
    unit: "reps",
    isRuleBreaker: false,
  },
  {
    id: "t3",
    name: "Water",
    type: "DAILY" as const,
    inputType: "CHECKBOX" as const,
    points: 5,
    unit: null,
    isRuleBreaker: false,
  },
  {
    id: "t4",
    name: "Read",
    type: "DAILY" as const,
    inputType: "CHECKBOX" as const,
    points: 10,
    unit: null,
    isRuleBreaker: false,
  },
];

describe("share build-share-data", () => {
  it("topActivities returns top 3 by points", () => {
    const logs = [
      { taskId: "t1", completed: true, value: 5, bonusPoints: 0 }, // +5
      { taskId: "t2", completed: true, value: 50, bonusPoints: 10 }, // +60
      { taskId: "t3", completed: true, value: 0, bonusPoints: 0 }, // +5
      { taskId: "t4", completed: true, value: 0, bonusPoints: 0 }, // +10
    ];
    const acts = topActivities(TASKS as any, logs as any, 3);
    expect(acts.map((a) => a.label)).toEqual(["Push Ups", "Read", "Morning Run"]);
    expect(acts[0].points).toBe(60);
    expect(acts[0].value).toBe(50);
    expect(acts[0].unit).toBe("reps");
  });

  it("buildHabits filters to checkbox tasks and flags done", () => {
    const logs = [{ taskId: "t3", completed: true, value: 0, bonusPoints: 0 }];
    const habits = buildHabits(TASKS as any, [] as any);
    // Only t3,t4 checkbox
    expect(habits.length).toBe(2);
    const water = habits.find((h) => h.label === "Water");
    const read = habits.find((h) => h.label === "Read");
    expect(water?.done).toBe(false);
    expect(read?.done).toBe(false);
    const habits2 = buildHabits(TASKS as any, logs as any);
    expect(habits2.find((h) => h.label === "Water")?.done).toBe(true);
  });

  it("computeTodayPoints includes completion bonus for >75%", () => {
    const logs = [
      { taskId: "t3", completed: true, value: 0, bonusPoints: 0 },
      { taskId: "t4", completed: true, value: 0, bonusPoints: 0 },
    ]; // 2/4 checklist = 50% → tier gives +5 bonus
    const pts = computeTodayPoints(TASKS as any, logs as any);
    expect(pts).toBe(5 + 10 + 15); // water 5 + read 10 + 75% tier bonus 15
  });

  it("buildSquad ranks by basis and returns podium + user rank", () => {
    const members = [
      { name: "A", isYou: false, overall: 100, week: 20, today: 10 },
      { name: "B", isYou: true, overall: 50, week: 30, today: 5 },
      { name: "C", isYou: false, overall: 80, week: 10, today: 20 },
      { name: "D", isYou: false, overall: 80, week: 15, today: 0 },
    ];
    const week = buildSquad(members, "week");
    expect(week.top3.map((e) => ({ name: e.name, initial: e.initial, pts: e.points, you: e.isYou }))).toEqual([
      { name: "B", initial: "B", pts: 30, you: true },
      { name: "A", initial: "A", pts: 20, you: false },
      { name: "D", initial: "D", pts: 15, you: false },
    ]);
    expect(week.youRank).toBe(1);
    const today = buildSquad(members, "today");
    expect(today.top3[0].initial).toBe("C");
    expect(today.youRank).toBe(3);
  });

  it("choosePromotionVariant avoids photo overlay", () => {
    expect(choosePromotionVariant("photo")).toBe("compact");
    expect(choosePromotionVariant("color")).toBe("full");
    expect(choosePromotionVariant("clear")).toBe("full");
  });

  it("buildShareCardData computes dayNumber and assembles card", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-05T00:00:00Z"); // day 5
    const end = new Date("2026-03-16T00:00:00Z");
    const card = buildShareCardData({
      userName: "Alex Johnson",
      challenge: { name: "Winter Arc", startDate: start, endDate: end },
      tasks: TASKS as any,
      todayLogs: [{ taskId: "t4", completed: true, value: 0, bonusPoints: 0 }] as any,
      streak: 7,
      peakLeaguePoints: 200,
      rank: { position: 2, total: 10 },
      now,
    });
    expect(card.user).toEqual({ firstName: "Alex", lastInitial: "J" });
    expect(card.challenge.dayNumber).toBe(5);
    expect(card.today.points).toBe(10 + 5); // read 10 + 50% bonus 5
    expect(card.league.name).toBe("Noob");
    expect(card.league.division).toBe("II");
    expect(card.rank).toEqual({ position: 2, total: 10 });
    expect(card.squadTop3).toEqual([]);
    expect(card.hasDay1Photo).toBeUndefined();
  });
});
