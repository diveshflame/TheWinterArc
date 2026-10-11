import type { ShareHabit } from "@/lib/share/types";

/** Maximum rows a user may select for the receipt. */
export const RECEIPT_MAX_ROWS = 5;

/**
 * Default selection: the top-5 completed habits by points, ties broken by the
 * order the habits appear in the app (the input order — Array.sort is stable).
 */
export function defaultReceiptSelection(habits: ShareHabit[]): string[] {
  return habits
    .filter((h) => h.done)
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, RECEIPT_MAX_ROWS)
    .map((h) => h.id);
}

export interface ReceiptSelectionResult {
  selected: string[];
  /** Set when the change was rejected (limit reached). */
  error?: string;
}

/** Toggle a habit in/out of the selection, enforcing the maximum. */
export function toggleReceiptHabit(
  selected: string[],
  habitId: string,
  habits: ShareHabit[]
): ReceiptSelectionResult {
  if (selected.includes(habitId)) {
    return { selected: selected.filter((id) => id !== habitId) };
  }
  if (selected.length >= RECEIPT_MAX_ROWS) {
    return {
      selected,
      error: "Limit reached. Untick one to add another.",
    };
  }
  const habit = habits.find((h) => h.id === habitId);
  if (!habit || !habit.done) return { selected };
  return { selected: [...selected, habitId] };
}

/** Move a selected habit up (-1) or down (+1); no-op at the edges. */
export function moveReceiptHabit(selected: string[], habitId: string, dir: -1 | 1): string[] {
  const index = selected.indexOf(habitId);
  if (index < 0) return selected;
  const target = index + dir;
  if (target < 0 || target >= selected.length) return selected;
  const next = selected.slice();
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export interface ReceiptRow extends ShareHabit {
  /** True for the appended missed habit (shown struck through). */
  missed: boolean;
}

export interface ReceiptRowsResult {
  rows: ReceiptRow[];
  /** The highest-points missed habit when the toggle is on (or null). */
  missed: ShareHabit | null;
}

/**
 * Rows in the user's chosen order (unknown ids are dropped). When showMissed
 * is on, the highest-points missed habit is appended — it never counts toward
 * the 5-row limit.
 */
export function receiptRows(
  habits: ShareHabit[],
  selected: string[],
  showMissed: boolean
): ReceiptRowsResult {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const rows: ReceiptRow[] = [];
  for (const id of selected) {
    const habit = byId.get(id);
    if (habit && habit.done) rows.push({ ...habit, missed: false });
  }
  const missed = showMissed
    ? habits.filter((h) => !h.done).sort((a, b) => b.points - a.points)[0] ?? null
    : null;
  if (missed) rows.push({ ...missed, missed: true });
  return { rows, missed };
}

export interface ReceiptTotals {
  /** Completed habits displayed as rows. */
  shown: number;
  /** Completed habits not displayed ("+ N more done"). */
  hiddenDone: number;
  /** Every completed habit today — the footer is always honest. */
  done: number;
  /** Every habit configured for today (completed + missed). */
  total: number;
  /** Points from ALL completed habits, even when fewer rows are shown. */
  habitPoints: number;
}

/** Footer/hidden counts. `shownRows` should come from receiptRows(). */
export function receiptTotals(habits: ShareHabit[], shownRows: ReceiptRow[]): ReceiptTotals {
  const doneHabits = habits.filter((h) => h.done);
  const shownDone = shownRows.filter((r) => !r.missed).length;
  return {
    shown: shownDone,
    hiddenDone: Math.max(0, doneHabits.length - shownDone),
    done: doneHabits.length,
    total: habits.length,
    habitPoints: doneHabits.reduce((sum, h) => sum + h.points, 0),
  };
}

/** Availability rule for the Paper receipt template. */
export function receiptAvailability(habits: ShareHabit[]): {
  available: boolean;
  reason?: string;
} {
  if (!habits.some((h) => h.done)) {
    return { available: false, reason: "Complete a habit first" };
  }
  return { available: true };
}
