import { describe, it, expect } from "vitest";
import {
  SUMMIT,
  TRAIL_POINTS,
  checkpointDays,
  pointAtProgress,
  trailProgress,
  trailState,
} from "@/lib/share/trail";

describe("trailProgress", () => {
  it("sits at the trail head on day 0/1 and the summit from day N onward", () => {
    expect(trailProgress(0, 90)).toBe(0);
    expect(trailProgress(1, 90)).toBe(0);
    expect(trailProgress(90, 90)).toBe(1);
    expect(trailProgress(120, 90)).toBe(1);
  });

  it("is day/total in between, for 30/60/90 and fractional progress", () => {
    expect(trailProgress(30, 90)).toBeCloseTo(1 / 3, 10);
    expect(trailProgress(45, 90)).toBe(0.5);
    expect(trailProgress(60, 90)).toBeCloseTo(2 / 3, 10);
    expect(trailProgress(89, 90)).toBeCloseTo(89 / 90, 10);
  });

  it("handles degenerate totals without dividing by zero", () => {
    expect(trailProgress(1, 0)).toBe(0);
    expect(trailProgress(2, 0)).toBe(1);
    expect(trailProgress(Number.NaN, 90)).toBe(0);
    expect(trailProgress(-5, 90)).toBe(0);
  });
});

describe("pointAtProgress", () => {
  it("clamps to the trail head and the summit", () => {
    expect(pointAtProgress(0)).toEqual(TRAIL_POINTS[0]);
    expect(pointAtProgress(-1)).toEqual(TRAIL_POINTS[0]);
    expect(pointAtProgress(1)).toEqual(SUMMIT);
    expect(pointAtProgress(2)).toEqual(SUMMIT);
  });

  it("stays on the polyline and moves monotonically upward as progress grows", () => {
    let previousY = pointAtProgress(0).y;
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const { x, y } = pointAtProgress(p);
      expect(x).toBeGreaterThanOrEqual(0.05);
      expect(x).toBeLessThanOrEqual(0.622);
      expect(y).toBeLessThanOrEqual(previousY);
      previousY = y;
    }
  });

  it("places the midpoint of the first segment exactly halfway", () => {
    const a = TRAIL_POINTS[0];
    const b = TRAIL_POINTS[1];
    const mid = pointAtProgress(0.5 * firstSegmentLength());
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2, 6);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2, 6);
  });
});

function firstSegmentLength(): number {
  const a = TRAIL_POINTS[0];
  const b = TRAIL_POINTS[1];
  const full = Math.hypot(b.x - a.x, b.y - a.y);
  // fraction of total trail length that the first segment represents
  let total = 0;
  for (let i = 1; i < TRAIL_POINTS.length; i++) {
    total += Math.hypot(
      TRAIL_POINTS[i].x - TRAIL_POINTS[i - 1].x,
      TRAIL_POINTS[i].y - TRAIL_POINTS[i - 1].y
    );
  }
  return full / total;
}

describe("checkpointDays", () => {
  it("derives one-third and two-thirds of the challenge", () => {
    expect(checkpointDays(90)).toEqual([30, 60]);
    expect(checkpointDays(60)).toEqual([20, 40]);
    expect(checkpointDays(61)).toEqual([20, 41]);
  });

  it("keeps checkpoints strictly before the summit and dedupes", () => {
    expect(checkpointDays(2)).toEqual([1]);
    expect(checkpointDays(1)).toEqual([]);
    expect(checkpointDays(0)).toEqual([]);
    expect(checkpointDays(3)).toEqual([1, 2]);
  });
});

describe("trailState", () => {
  it("day 0/1 stays at the head with all checkpoints ahead", () => {
    const state = trailState(1, 90);
    expect(state.progress).toBe(0);
    expect(state.marker).toEqual(TRAIL_POINTS[0]);
    expect(state.summitReached).toBe(false);
    expect(state.headerRight).toBe("89 to go");
    expect(state.footerLine).toBe("Checkpoints · Day 30, 60 · Summit 90");
    expect(state.checkpoints.map((c) => c.passed)).toEqual([false, false]);
  });

  it("checkpoints pass as the day reaches them", () => {
    expect(trailState(30, 90).checkpoints.map((c) => c.passed)).toEqual([true, false]);
    expect(trailState(60, 90).checkpoints.map((c) => c.passed)).toEqual([true, true]);
    expect(trailState(90, 90).checkpoints.map((c) => c.passed)).toEqual([true, true]);
  });

  it("day 30 and 60 sit exactly on their checkpoint positions", () => {
    const day30 = trailState(30, 90);
    expect(day30.progress).toBeCloseTo(1 / 3, 10);
    const cp = day30.checkpoints[0];
    expect(day30.marker.x).toBeCloseTo(cp.x, 6);
    expect(day30.marker.y).toBeCloseTo(cp.y, 6);
    expect(trailState(60, 90).marker.y).toBeCloseTo(day30.checkpoints[1].y, 6);
  });

  it("summit reached on day 90 and clamped beyond it", () => {
    const atSummit = trailState(90, 90);
    expect(atSummit.summitReached).toBe(true);
    expect(atSummit.headerRight).toBe("Summit reached");
    expect(atSummit.daysLeft).toBe(0);
    expect(atSummit.marker).toEqual(SUMMIT);

    const beyond = trailState(120, 90);
    expect(beyond.summitReached).toBe(true);
    expect(beyond.marker).toEqual(SUMMIT);
    expect(beyond.headerRight).toBe("Summit reached");
  });

  it("falls back to a summit-only line when checkpoints collapse", () => {
    const state = trailState(1, 1);
    expect(state.summitReached).toBe(true);
    expect(state.checkpoints).toEqual([]);
    expect(state.footerLine).toBe("Summit 1");
  });
});
