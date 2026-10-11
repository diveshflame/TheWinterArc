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
    const acts = topActivities(TASKS, logs, 3);
    expect(acts.map((a) => a.label)).toEqual(["Push Ups", "Read", "Morning Run"]);
    expect(acts[0].points).toBe(60);
    expect(acts[0].value).toBe(50);
    expect(acts[0].unit).toBe("reps");
  });

  it("buildHabits filters to checkbox tasks, flags done and carries stable ids", () => {
    const logs = [{ taskId: "t3", completed: true, value: 0, bonusPoints: 0 }];
    const habits = buildHabits(TASKS, []);
    // Only t3,t4 checkbox
    expect(habits.length).toBe(2);
    const water = habits.find((h) => h.label === "Water");
    const read = habits.find((h) => h.label === "Read");
    expect(water?.done).toBe(false);
    expect(read?.done).toBe(false);
    expect(water?.id).toBe("t3");
    expect(read?.id).toBe("t4");
    const habits2 = buildHabits(TASKS, logs);
    expect(habits2.find((h) => h.label === "Water")?.done).toBe(true);
  });

  it("computeTodayPoints includes completion bonus for >75%", () => {
    const logs = [
      { taskId: "t3", completed: true, value: 0, bonusPoints: 0 },
      { taskId: "t4", completed: true, value: 0, bonusPoints: 0 },
    ]; // 2/4 checklist = 50% → tier gives +5 bonus
    const pts = computeTodayPoints(TASKS, logs);
    expect(pts).toBe(5 + 10 + 15); // water 5 + read 10 + 75% tier bonus 15
  });

  it("buildSquad ranks by basis and returns podium + user rank", () => {
    const members = [
      { userId: "a", name: "A", firstName: "Ava", isYou: false, overall: 100, week: 20, today: 10 },
      { userId: "b", name: "B", firstName: "Ben", isYou: true, overall: 50, week: 30, today: 5 },
      { userId: "c", name: "C", firstName: "Cara", isYou: false, overall: 80, week: 10, today: 20 },
      { userId: "d", name: "D", firstName: "Dee", isYou: false, overall: 80, week: 15, today: 0 },
    ];
    const week = buildSquad(members, "week");
    expect(week.top3.map((e) => ({ name: e.name, initial: e.initial, pts: e.points, you: e.isYou, userId: e.userId }))).toEqual([
      { name: "B", initial: "B", pts: 30, you: true, userId: "b" },
      { name: "A", initial: "A", pts: 20, you: false, userId: "a" },
      { name: "D", initial: "D", pts: 15, you: false, userId: "d" },
    ]);
    expect(week.top3.map((e) => e.firstName)).toEqual(["Ben", "Ava", "Dee"]);
    expect(week.youRank).toBe(1);
    const today = buildSquad(members, "today");
    expect(today.top3[0].initial).toBe("C");
    expect(today.youRank).toBe(3);
  });

  it("buildSquad returns null rank when the sharer is absent", () => {
    const squad = buildSquad(
      [{ userId: "a", name: "A", firstName: "Ava", isYou: false, overall: 1, week: 1, today: 1 }],
      "overall"
    );
    expect(squad.youRank).toBeNull();
  });

  it("buildSquad falls back to the first name when firstName is missing", () => {
    const squad = buildSquad(
      [{ userId: "a", name: "Ada Lovelace", firstName: "", isYou: false, overall: 1, week: 1, today: 1 }],
      "overall"
    );
    expect(squad.top3[0].firstName).toBe("Ada");
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
      tasks: TASKS,
      todayLogs: [{ taskId: "t4", completed: true, value: 0, bonusPoints: 0 }],
      streak: 7,
      peakLeaguePoints: 200,
      rank: { position: 2, total: 10 },
      now,
    });
    expect(card.user).toEqual({ firstName: "Alex", lastInitial: "J" });
    expect(card.challenge.dayNumber).toBe(5);
    expect(card.today.points).toBe(10 + 5); // read 10 + 50% bonus 5
    expect(card.today.loggedToday).toBe(true);
    expect(card.league.name).toBe("Noob");
    expect(card.league.division).toBe("II");
    expect(card.rank).toEqual({ position: 2, total: 10 });
    expect(card.squadTop3).toEqual([]);
    expect(card.squadYouRank).toBeNull();
    expect(card.squadBasis).toBe("overall");
    expect(card.dayHistory).toEqual([]);
    expect(card.inviteUrl).toBeNull();
    expect(card.promotion).toBeUndefined();
    expect(card.today.habits.map((h) => h.id)).toEqual(["t4", "t3"]); // sorted by points
  });

  it("buildShareCardData passes through dayHistory and inviteUrl", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const card = buildShareCardData({
      userName: null,
      challenge: { name: "Winter Arc", startDate: start, endDate: new Date("2026-03-31T00:00:00Z") },
      tasks: [],
      todayLogs: [],
      streak: 0,
      peakLeaguePoints: 0,
      rank: null,
      dayHistory: [
        { dayNumber: 1, date: "2026-01-01", points: 40, pushups: 20, pullups: 5, runKm: 2, walkKm: 3 },
      ],
      inviteUrl: "https://winterarc.app/join/ABC",
      now: new Date("2026-01-01T12:00:00Z"),
    });
    expect(card.dayHistory).toHaveLength(1);
    expect(card.dayHistory[0].points).toBe(40);
    expect(card.today.loggedToday).toBe(false);
    expect(card.inviteUrl).toBe("https://winterarc.app/join/ABC");
    expect(card.user).toEqual({ firstName: "You", lastInitial: "" });
  });

  it("buildShareCardData passes through the squadBasis override", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const base = {
      userName: null,
      challenge: { name: "Winter Arc", startDate: start, endDate: new Date("2026-03-31T00:00:00Z") },
      tasks: [],
      todayLogs: [],
      streak: 0,
      peakLeaguePoints: 0,
      rank: null,
      now: new Date("2026-01-01T12:00:00Z"),
    };
    expect(buildShareCardData({ ...base, squadBasis: "week" }).squadBasis).toBe("week");
    expect(buildShareCardData({ ...base, squadBasis: "today" }).squadBasis).toBe("today");
  });
});
