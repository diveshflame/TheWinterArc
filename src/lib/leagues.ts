export type LeagueKey = "noob" | "amateur" | "silver" | "gold" | "titan" | "legend";

export type Division = "III" | "II" | "I";

export type LeagueIconType = "snowflake" | "mountain" | "shield" | "sword" | "diamond" | "crown";

export interface LeagueConfig {
  key: LeagueKey;
  name: string;
  minPoints: number;
  dailyBonus: number;
  persona: string;
  color: string;
  textColor: string;
  icon: LeagueIconType;
  description: string;
}

export const LEAGUES: LeagueConfig[] = [
  {
    key: "noob",
    name: "Noob",
    minPoints: 0,
    dailyBonus: 0,
    persona: "I'm Gay",
    color: "#94a3b8",
    textColor: "#94a3b8",
    icon: "snowflake",
    description: "Starting league",
  },
  {
    key: "amateur",
    name: "Amateur",
    minPoints: 400,
    dailyBonus: 1,
    persona: "Professional BVC",
    color: "#2dd4bf",
    textColor: "#2dd4bf",
    icon: "mountain",
    description: "Beginning the climb",
  },
  {
    key: "silver",
    name: "Silver",
    minPoints: 1200,
    dailyBonus: 2,
    persona: "Getting Stronger",
    color: "#cbd5e1",
    textColor: "#cbd5e1",
    icon: "shield",
    description: "Building momentum",
  },
  {
    key: "gold",
    name: "Gold",
    minPoints: 2200,
    dailyBonus: 3,
    persona: "Cold Blooded Laura",
    color: "#e8b73a",
    textColor: "#e8b73a",
    icon: "sword",
    description: "Unshakable discipline",
  },
  {
    key: "titan",
    name: "Titan",
    minPoints: 3200,
    dailyBonus: 4,
    persona: "Aura Grinder",
    color: "#a78bfa",
    textColor: "#a78bfa",
    icon: "diamond",
    description: "Elite consistency",
  },
  {
    key: "legend",
    name: "Legend",
    minPoints: 4500,
    dailyBonus: 5,
    persona: "Winter Arc Sovereign",
    color: "#ff8a3d",
    textColor: "#ffb35c",
    icon: "crown",
    description: "Sovereign · golden flames",
  },
];

// Configuration constants
export const MIN_DAILY_POINTS_FOR_BONUS = 20;
export const INCLUDE_BONUS_IN_LEADERBOARD = true;
export const WINTER_ARC_CHALLENGE_ID =
  process.env.NEXT_PUBLIC_WINTER_ARC_CHALLENGE_ID || "";

export interface LeagueState {
  league: LeagueConfig;
  division: Division | null;
  divisionIndex: number | null; // 0 for III, 1 for II, 2 for I, null for Legend
  title: string; // e.g. "Noob I" or "Legend"
  nextStep: string; // e.g. "Amateur III", "Noob II", or "Max league"
  nextLeague: LeagueConfig | null;
  pointsToNext: number; // points to next division or league
  pointsToNextLeague: number; // points to next major league
  divisionBoundaries: [number, number, number] | null; // [d0, d1, d2]
  nextThreshold: number | null;
  progressPerDivision: [number, number, number]; // [0..1, 0..1, 0..1]
  leagueProgress: number; // 0..1 overall in current league
  currentPoints: number;
}

/**
 * Calculates division boundaries for a league given min and nextMin.
 * Boundaries are floor(min + (nextMin - min) * i / 3) for i = 0, 1, 2.
 */
export function computeDivisionBoundaries(min: number, nextMin: number): [number, number, number] {
  const span = nextMin - min;
  const d0 = Math.floor(min + (span * 0) / 3);
  const d1 = Math.floor(min + (span * 1) / 3);
  const d2 = Math.floor(min + (span * 2) / 3);
  return [d0, d1, d2];
}

/**
 * Pure function to derive the complete league state from cumulative league points.
 */
export function getLeagueState(rawPoints: number | null | undefined): LeagueState {
  const points = Math.max(0, Math.floor(rawPoints ?? 0));

  // Find highest league where points >= minPoints
  let leagueIdx = 0;
  for (let i = 0; i < LEAGUES.length; i++) {
    if (points >= LEAGUES[i].minPoints) {
      leagueIdx = i;
    } else {
      break;
    }
  }

  const league = LEAGUES[leagueIdx];
  const isLegend = league.key === "legend";
  const nextLeague = leagueIdx < LEAGUES.length - 1 ? LEAGUES[leagueIdx + 1] : null;

  if (isLegend || !nextLeague) {
    return {
      league,
      division: null,
      divisionIndex: null,
      title: league.name,
      nextStep: "Max league",
      nextLeague: null,
      pointsToNext: 0,
      pointsToNextLeague: 0,
      divisionBoundaries: null,
      nextThreshold: null,
      progressPerDivision: [1, 1, 1],
      leagueProgress: 1,
      currentPoints: points,
    };
  }

  const boundaries = computeDivisionBoundaries(league.minPoints, nextLeague.minPoints);
  const [d0, d1, d2] = boundaries;
  const nextMin = nextLeague.minPoints;

  let division: Division = "III";
  let divisionIndex = 0;
  let nextStep = "";
  let nextThreshold = d1;

  if (points >= d2) {
    division = "I";
    divisionIndex = 2;
    nextStep = `${nextLeague.name} III`;
    nextThreshold = nextMin;
  } else if (points >= d1) {
    division = "II";
    divisionIndex = 1;
    nextStep = `${league.name} I`;
    nextThreshold = d2;
  } else {
    division = "III";
    divisionIndex = 0;
    nextStep = `${league.name} II`;
    nextThreshold = d1;
  }

  const pointsToNext = Math.max(0, nextThreshold - points);
  const pointsToNextLeague = Math.max(0, nextMin - points);

  // Calculate progress for each segment (0 to 1)
  // Segment 0: [d0, d1]
  const p0 = d1 > d0 ? Math.min(1, Math.max(0, (points - d0) / (d1 - d0))) : 1;
  // Segment 1: [d1, d2]
  const p1 = d2 > d1 ? Math.min(1, Math.max(0, (points - d1) / (d2 - d1))) : 0;
  // Segment 2: [d2, nextMin]
  const p2 = nextMin > d2 ? Math.min(1, Math.max(0, (points - d2) / (nextMin - d2))) : 0;

  const leagueSpan = nextMin - league.minPoints;
  const leagueProgress =
    leagueSpan > 0
      ? Math.min(1, Math.max(0, (points - league.minPoints) / leagueSpan))
      : 1;

  return {
    league,
    division,
    divisionIndex,
    title: `${league.name} ${division}`,
    nextStep,
    nextLeague,
    pointsToNext,
    pointsToNextLeague,
    divisionBoundaries: boundaries,
    nextThreshold,
    progressPerDivision: [p0, p1, p2],
    leagueProgress,
    currentPoints: points,
  };
}
