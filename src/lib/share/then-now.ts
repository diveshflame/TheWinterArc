import type { ShareCardData, ShareDayHistory } from "@/lib/share/types";
import { inferIcon } from "@/lib/share/format";

/** The four metrics the Then → Now card can compare (besides daily points). */
export type MetricKey = "pushups" | "pullups" | "runKm" | "walkKm";

export interface MetricRow {
  key: MetricKey;
  label: string;
  thenValue: number;
  nowValue: number;
}

/** Candidate order used to break ties in relative gain. */
const METRIC_ORDER: MetricKey[] = ["pushups", "pullups", "runKm", "walkKm"];

const METRIC_LABELS: Record<MetricKey, string> = {
  pushups: "Push-ups",
  pullups: "Pull-ups",
  runKm: "Run km",
  walkKm: "Walk km",
};

export function metricLabel(key: MetricKey): string {
  return METRIC_LABELS[key];
}

/**
 * Map a NUMBER task to one of the compared metrics. Distance metrics only
 * count when the task unit is km, so "Steps" is not treated as walk km.
 */
export function metricForTask(name: string, unit: string | null | undefined): MetricKey | null {
  const icon = inferIcon(name);
  if (icon === "push") return "pushups";
  if (icon === "pull") return "pullups";
  if (icon === "run" || icon === "walk") {
    if (!unit || !/km/i.test(unit)) return null;
    return icon === "run" ? "runKm" : "walkKm";
  }
  return null;
}

export function metricValue(day: ShareDayHistory, key: MetricKey): number {
  return day[key];
}

/**
 * Relative gain of a metric from Then → Now. Days with nothing logged on the
 * Then side but progress on the Now side rank above every finite gain.
 */
function relativeGain(thenValue: number, nowValue: number): number {
  if (nowValue <= thenValue) return Number.NEGATIVE_INFINITY;
  if (thenValue > 0) return (nowValue - thenValue) / thenValue;
  return Number.POSITIVE_INFINITY;
}

/**
 * The two metrics (of the four candidates) with the largest relative gain.
 * Metrics that did not improve from Then → Now are excluded.
 */
export function selectMetricRows(thenDay: ShareDayHistory, nowDay: ShareDayHistory): MetricRow[] {
  return METRIC_ORDER.map((key) => ({
    key,
    label: METRIC_LABELS[key],
    thenValue: metricValue(thenDay, key),
    nowValue: metricValue(nowDay, key),
    gain: relativeGain(metricValue(thenDay, key), metricValue(nowDay, key)),
  }))
    .filter((row) => row.nowValue > row.thenValue)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2)
    .map(({ key, label, thenValue, nowValue }) => ({ key, label, thenValue, nowValue }));
}

/**
 * The "+X% daily pts" chip: only when Then logged points and Now improved.
 * Returns null when Then is 0, when Now did not improve, or when equal.
 */
export function percentChip(thenPoints: number, nowPoints: number): number | null {
  if (thenPoints <= 0) return null;
  if (nowPoints <= thenPoints) return null;
  return Math.round(((nowPoints - thenPoints) / thenPoints) * 100);
}

/** True when the two selected days have no activity at all. */
export function bothDaysEmpty(thenPoints: number, nowPoints: number): boolean {
  return thenPoints <= 0 && nowPoints <= 0;
}

export type ThenNowPreset = "day1" | "best" | "week" | "yesterday";

export interface PresetContext {
  /** The current (today's) challenge day — the maximum selectable day. */
  currentDay: number;
  /** The day the "Now" tab is pointing at. */
  nowDay: number;
  dayHistory: ShareDayHistory[];
}

/**
 * Resolve a Then preset to a day number, or null when the preset does not
 * apply (e.g. "7 days ago" before Day 1, "Yesterday" on Day 1).
 */
export function resolvePreset(preset: ThenNowPreset, ctx: PresetContext): number | null {
  const { currentDay, nowDay, dayHistory } = ctx;
  switch (preset) {
    case "day1":
      return currentDay >= 1 ? 1 : null;
    case "yesterday": {
      const day = nowDay - 1;
      return day >= 1 ? day : null;
    }
    case "week": {
      const day = nowDay - 7;
      return day >= 1 ? day : null;
    }
    case "best": {
      // Highest-points day strictly before Now; ties go to the earlier day.
      let best: number | null = null;
      let bestPoints = -1;
      for (const entry of dayHistory) {
        if (entry.dayNumber >= nowDay) continue;
        if (entry.points > bestPoints) {
          bestPoints = entry.points;
          best = entry.dayNumber;
        }
      }
      return best;
    }
  }
}

export interface ThenNowValidation {
  ok: boolean;
  message?: string;
}

/**
 * Enforce Then < Now. Selecting a Then at or after Now is REJECTED with a
 * short inline message (documented choice: Now never moves on its own, so the
 * "Now" tab always points at a real, stable day).
 */
export function validateThenDay(thenDay: number, nowDay: number): ThenNowValidation {
  if (thenDay >= nowDay) return { ok: false, message: "Pick a day before Now" };
  if (thenDay < 1) return { ok: false, message: "No days before Day 1" };
  return { ok: true };
}

/** Enforce Now > Then and no future days (Now may not exceed today). */
export function validateNowDay(nowDay: number, thenDay: number, currentDay: number): ThenNowValidation {
  if (nowDay > currentDay) return { ok: false, message: "No future days" };
  if (nowDay <= thenDay) return { ok: false, message: "Pick a day after Then" };
  return { ok: true };
}

/**
 * Availability rule for the Then → Now template: at least one of the two
 * selected days must have logged activity.
 */
export function thenNowAvailability(
  data: ShareCardData,
  thenDay?: number,
  nowDay?: number
): { available: boolean; reason?: string } {
  const history = data.dayHistory ?? [];
  if (history.length === 0) {
    return { available: false, reason: "Pick days with logged activity" };
  }
  const currentDay = Math.max(1, data.challenge?.dayNumber ?? 1);
  const then = Math.max(1, thenDay ?? 1);
  const now = Math.max(1, Math.min(nowDay ?? currentDay, currentDay));
  const thenPoints = history.find((d) => d.dayNumber === then)?.points ?? 0;
  const nowPoints = history.find((d) => d.dayNumber === now)?.points ?? 0;
  if (bothDaysEmpty(thenPoints, nowPoints)) {
    return { available: false, reason: "Pick days with logged activity" };
  }
  return { available: true };
}
