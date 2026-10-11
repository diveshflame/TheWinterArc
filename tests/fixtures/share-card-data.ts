import type {
  ShareCardData,
  ShareDayHistory,
  ShareHabit,
  SharePodiumEntry,
} from "@/lib/share/types";

/** Build a contiguous day history for days 1..total with optional point values. */
export function makeDayHistory(
  total: number,
  pointsFor?: (day: number) => number
): ShareDayHistory[] {
  return Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    return {
      dayNumber: day,
      date: `2026-01-${String(day).padStart(2, "0")}`,
      points: pointsFor ? pointsFor(day) : day === 1 ? 40 : day === total ? 80 : 0,
      pushups: day === 1 ? 20 : day === total ? 60 : 0,
      pullups: day === 1 ? 5 : day === total ? 8 : 0,
      runKm: day === 1 ? 2 : day === total ? 5 : 0,
      walkKm: day === 1 ? 3 : day === total ? 3 : 0,
    };
  });
}

export function makeHabits(overrides?: Partial<Record<string, Partial<ShareHabit>>>): ShareHabit[] {
  const base: ShareHabit[] = [
    { id: "h1", label: "Cold shower", done: true, points: 15 },
    { id: "h2", label: "Read 20 pages", done: true, points: 10 },
    { id: "h3", label: "No sugar", done: true, points: 25 },
    { id: "h4", label: "Meditate", done: true, points: 5 },
    { id: "h5", label: "Make the bed", done: true, points: 5 },
    { id: "h6", label: "Journal", done: true, points: 20 },
    { id: "h7", label: "No alcohol", done: false, points: 30 },
  ];
  return base.map((habit) => ({ ...habit, ...(overrides?.[habit.id] ?? {}) }));
}

export function makePodium(overrides?: Partial<Record<string, Partial<SharePodiumEntry>>>): SharePodiumEntry[] {
  const base: SharePodiumEntry[] = [
    {
      userId: "u1",
      firstName: "Ava",
      name: "Ava Reynolds",
      initial: "A",
      avatarUrl: "https://example.com/a.png",
      points: 900,
      isYou: false,
    },
    {
      userId: "u2",
      firstName: "Ben",
      name: "Ben Okonkwo",
      initial: "B",
      avatarUrl: null,
      points: 750,
      isYou: false,
    },
    {
      userId: "me",
      firstName: "You",
      name: "Me Today",
      initial: "M",
      avatarUrl: "https://example.com/me.png",
      points: 600,
      isYou: true,
    },
  ];
  return base.map((entry) => ({ ...entry, ...(overrides?.[entry.userId] ?? {}) }));
}

export function makeShareCardData(overrides?: Partial<ShareCardData>): ShareCardData {
  const totalDays = 90;
  const dayNumber = 45;
  return {
    user: { firstName: "Alex", lastInitial: "J" },
    challenge: { name: "Winter Arc", dayNumber, totalDays },
    today: {
      points: 42,
      loggedToday: true,
      activities: [
        { label: "Morning run", value: 5, unit: "km", points: 20, icon: "run" },
        { label: "Push ups", value: 50, unit: "reps", points: 15, icon: "push" },
        { label: "Read", value: null, unit: null, points: 7, icon: "read" },
      ],
      habits: makeHabits(),
      habitsDone: 6,
      habitsTotal: 7,
    },
    streak: 12,
    league: {
      name: "Silver",
      division: "II",
      persona: "Frostwalker",
      color: "#38bdf8",
      icon: "snowflake",
      totalPoints: 640,
      bonusPerDay: 15,
    },
    rank: { position: 4, total: 12 },
    squadTop3: makePodium(),
    squadYouRank: 4,
    squadBasis: "overall",
    dayHistory: makeDayHistory(dayNumber),
    inviteUrl: null,
    ...overrides,
  };
}
