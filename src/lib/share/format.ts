import type { ShareIconType } from "@/lib/share/types";

/** Split a display name into a first name and a last initial, privacy-first. */
export function deriveUser(rawName: string | null | undefined): {
  firstName: string;
  lastInitial: string;
} {
  const trimmed = (rawName ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "You", lastInitial: "" };
  const parts = trimmed.split(" ");
  const firstName = parts[0];
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : "";
  return { firstName, lastInitial };
}

/** Initial only — used for squad avatars and never a full name. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

/** Map a task/activity name to one of the available share glyphs. */
export function inferIcon(rawLabel: string): ShareIconType {
  const label = (rawLabel ?? "").toLowerCase();
  if (label.includes("run")) return "run";
  if (label.includes("walk") || label.includes("step")) return "walk";
  if (label.includes("push")) return "push";
  if (label.includes("pull") || label.includes("row")) return "pull";
  if (label.includes("water") || label.includes("hydrat")) return "water";
  if (label.includes("sleep") || label.includes("bedtime")) return "sleep";
  if (label.includes("read") || label.includes("book") || label.includes("pages")) return "read";
  if (label.includes("shower") || label.includes("cold")) return "shower";
  if (label.includes("bed") || label.includes("make")) return "bed";
  if (
    label.includes("protein") ||
    label.includes("fruit") ||
    label.includes("meal") ||
    label.includes("sugar") ||
    label.includes("food") ||
    label.includes("diet") ||
    label.includes("eat")
  ) {
    return "food";
  }
  return "generic";
}

/** Format a numeric activity value without trailing zeros. */
export function formatValue(value: number | null): string | null {
  if (value === null || value === undefined) return null;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function daysLeft(dayNumber: number, totalDays: number): number {
  return Math.max(0, totalDays - dayNumber);
}

/** "1 pt" / "12 pts" */
export function pointsWord(points: number): string {
  return `${points} ${points === 1 ? "pt" : "pts"}`;
}
