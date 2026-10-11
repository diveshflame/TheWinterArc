// Movement input configuration and value helpers.
//
// Movement tasks are DB `ChallengeTask` rows (type DAILY, inputType NUMBER).
// The schema has no explicit step/chip/max columns, so we derive the input
// behavior from the task's `unit`: distance-style units ("km") get decimal
// input with 0.5km steps, everything else is treated as integer reps. No
// scoring rules live here — points always come from `numberTaskPoints`.

import type { ChallengeTask } from "@/lib/scoring";

export type MovementCategory = "distance" | "reps";

export interface MovementConfig {
  category: MovementCategory;
  unit: string;
  /** HTML inputMode for the on-screen keyboard. */
  inputMode: "decimal" | "numeric";
  /** Amount added by the +/- steppers. */
  step: number;
  /** Committed values are rounded to this many decimal places (0 = integer). */
  decimals: number;
  /** Quick-add chip amounts. */
  chips: number[];
  /** Maximum value accepted for a single day. */
  maxPerDay: number;
  /** Allow a decimal point while typing (distance only). */
  allowDecimal: boolean;
}

const DISTANCE_UNITS = new Set([
  "km",
  "kilometer",
  "kilometers",
  "kilometre",
  "kilometres",
]);

export function movementCategoryFor(task: {
  unit?: string | null;
}): MovementCategory {
  const unit = (task.unit || "").trim().toLowerCase();
  return DISTANCE_UNITS.has(unit) ? "distance" : "reps";
}

export function movementConfigFor(task: ChallengeTask): MovementConfig {
  const category = movementCategoryFor(task);
  if (category === "distance") {
    return {
      category,
      unit: task.unit || "km",
      inputMode: "decimal",
      step: 0.5,
      decimals: 1,
      chips: [0.5, 1, 5],
      maxPerDay: 100,
      allowDecimal: true,
    };
  }
  return {
    category,
    unit: task.unit || "reps",
    inputMode: "numeric",
    step: 1,
    decimals: 0,
    chips: [5, 10, 20, 50],
    maxPerDay: 500,
    allowDecimal: false,
  };
}

// Sanitization order:
//   1. commas -> dots        ("1,5"  -> "1.5")
//   2. drop non-numeric      ("12abc"-> "12", "abc" -> "")
//   3. collapse to one dot   ("1.2.3"-> "1.23")
//   4. reps: drop fraction   ("1.5"  -> "1")
//   5. cap decimal places    ("1.234"-> "1.23")
//   6. strip leading zeros   ("007"  -> "7", "0.5" untouched)
export function sanitizeMovementInput(raw: string, cfg: MovementConfig): string {
  let s = raw.replace(/,/g, ".");
  s = s.replace(/[^0-9.]/g, "");

  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s.slice(firstDot + 1).replace(/\./g, "");
  }

  // Inputs allow up to 2 decimals (the spec's typing limit) even though the
  // committed value is rounded to cfg.decimals by clampMovementValue.
  const maxDecimals = cfg.allowDecimal ? 2 : 0;
  if (maxDecimals === 0) {
    s = s.split(".")[0];
  } else if (firstDot !== -1) {
    const [intPart, decPart = ""] = s.split(".");
    s = `${intPart}.${decPart.slice(0, maxDecimals)}`;
  }

  // Leading zeros are dropped unless a decimal point (or the end) follows.
  s = s.replace(/^0+(?=[0-9])/, "");

  return s;
}

/** Numeric value of the current input; 0 when empty or invalid. */
export function parseMovementInput(raw: string, cfg: MovementConfig): number {
  const cleaned = sanitizeMovementInput(raw, cfg);
  if (cleaned === "" || cleaned === ".") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** Clamp a value to [0, maxPerDay] and round per the task's precision. */
export function clampMovementValue(value: number, cfg: MovementConfig): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const factor = Math.pow(10, cfg.decimals);
  const rounded = Math.round(value * factor) / factor;
  return Math.min(rounded, cfg.maxPerDay);
}

/** Apply a chip/stepper delta to the current value, clamped. */
export function applyMovementDelta(
  value: number,
  delta: number,
  cfg: MovementConfig
): number {
  return clampMovementValue(value + delta, cfg);
}
