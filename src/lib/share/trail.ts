/**
 * Mountain trail geometry and progress math for the Mountain trail card.
 *
 * The trail is a polyline in normalized SVG space (0..1, y grows downward).
 * Marker and checkpoint positions are derived from the travelled fraction of
 * the polyline — never hardcoded per day — so any challenge length works.
 */

export interface TrailPoint {
  x: number;
  y: number;
}

/**
 * From the trail head (bottom-left) to the summit flag (top of the peak),
 * switchbacking across the mountain's left face (normalized SVG space).
 */
export const TRAIL_POINTS: TrailPoint[] = [
  { x: 0.05, y: 0.98 },
  { x: 0.234, y: 0.862 },
  { x: 0.218, y: 0.745 },
  { x: 0.422, y: 0.627 },
  { x: 0.384, y: 0.526 },
  { x: 0.588, y: 0.409 },
  { x: 0.55, y: 0.308 },
  { x: 0.622, y: 0.207 },
  { x: 0.62, y: 0.14 },
];

/** Summit position (end of the trail) in normalized SVG space. */
export const SUMMIT: TrailPoint = TRAIL_POINTS[TRAIL_POINTS.length - 1];

const SEGMENT_LENGTHS: number[] = (() => {
  const lengths: number[] = [];
  for (let i = 1; i < TRAIL_POINTS.length; i++) {
    const a = TRAIL_POINTS[i - 1];
    const b = TRAIL_POINTS[i];
    lengths.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  return lengths;
})();

const TRAIL_LENGTH = SEGMENT_LENGTHS.reduce((sum, l) => sum + l, 0);

/** Point at `progress` (0..1) along the trail, by arc length. */
export function pointAtProgress(progress: number): TrailPoint {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0) return { ...TRAIL_POINTS[0] };
  if (clamped >= 1) return { ...SUMMIT };
  let target = clamped * TRAIL_LENGTH;
  for (let i = 0; i < SEGMENT_LENGTHS.length; i++) {
    const segment = SEGMENT_LENGTHS[i];
    if (target <= segment) {
      const t = segment === 0 ? 0 : target / segment;
      const a = TRAIL_POINTS[i];
      const b = TRAIL_POINTS[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    target -= segment;
  }
  return { ...SUMMIT };
}

/**
 * Travelled fraction for a challenge day: dayNumber / totalDays, with the
 * documented edge cases — day 0 or 1 sits at the trail head, day >= total is
 * the summit, anything beyond is clamped to the summit.
 */
export function trailProgress(dayNumber: number, totalDays: number): number {
  const total = Math.max(1, totalDays);
  if (!Number.isFinite(dayNumber) || dayNumber <= 1) return 0;
  if (dayNumber >= total) return 1;
  return Math.max(0, Math.min(1, dayNumber / total));
}

/**
 * Config-driven checkpoints: one third and two thirds of the challenge,
 * rounded, de-duplicated and kept strictly before the summit.
 */
export function checkpointDays(totalDays: number): number[] {
  const total = Math.max(1, totalDays);
  const raw = [Math.round(total / 3), Math.round((2 * total) / 3)];
  const seen = new Set<number>();
  return raw.filter((day) => {
    if (day < 1 || day >= total || seen.has(day)) return false;
    seen.add(day);
    return true;
  });
}

export interface TrailCheckpoint {
  day: number;
  x: number;
  y: number;
  /** Fills in solid white once the user's day reaches the checkpoint. */
  passed: boolean;
}

export interface TrailState {
  progress: number;
  marker: TrailPoint;
  checkpoints: TrailCheckpoint[];
  summitReached: boolean;
  daysLeft: number;
  /** Right side of the panel header: "{n} to go" or "Summit reached". */
  headerRight: string;
  /** "Checkpoints · Day 30, 60 · Summit 90" — empty when no checkpoints. */
  footerLine: string;
}

export function trailState(dayNumber: number, totalDays: number): TrailState {
  const total = Math.max(1, totalDays);
  const day = Math.max(0, dayNumber);
  const progress = trailProgress(day, total);
  const summitReached = day >= total;
  const daysLeft = Math.max(0, total - day);
  const checkpoints = checkpointDays(total).map((cpDay) => {
    const point = pointAtProgress(trailProgress(cpDay, total));
    return { day: cpDay, x: point.x, y: point.y, passed: day >= cpDay };
  });
  const checkpointLabel =
    checkpoints.length > 0
      ? `Day ${checkpoints.map((c) => c.day).join(", ")}`
      : "";
  return {
    progress,
    marker: pointAtProgress(progress),
    checkpoints,
    summitReached,
    daysLeft,
    headerRight: summitReached ? "Summit reached" : `${daysLeft} to go`,
    footerLine:
      checkpoints.length > 0
        ? `Checkpoints · ${checkpointLabel} · Summit ${total}`
        : `Summit ${total}`,
  };
}
