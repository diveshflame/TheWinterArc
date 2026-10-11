import { describe, it, expect } from "vitest";
import {
  RECEIPT_MAX_ROWS,
  defaultReceiptSelection,
  moveReceiptHabit,
  receiptAvailability,
  receiptRows,
  receiptTotals,
  toggleReceiptHabit,
} from "@/lib/share/receipt";
import { makeHabits, makeShareCardData } from "../fixtures/share-card-data";

const ids = (list: string[]) => list;

describe("defaultReceiptSelection", () => {
  it("takes the top-5 completed habits by points, ties in input order", () => {
    // done points: 15, 10, 25, 5, 5, 20 → 25, 20, 15, 10, 5 (Meditate before Make the bed)
    expect(ids(defaultReceiptSelection(makeHabits()))).toEqual([
      "h3", // No sugar 25
      "h6", // Journal 20
      "h1", // Cold shower 15
      "h2", // Read 10
      "h4", // Meditate 5 (tie with h5, input order wins)
    ]);
  });

  it("never selects missed habits and shrinks when fewer than 5 are done", () => {
    const habits = makeHabits().map((h) => ({ ...h, done: h.id === "h7" }));
    expect(defaultReceiptSelection(habits)).toEqual(["h7"]);
    const none = makeHabits().map((h) => ({ ...h, done: false }));
    expect(defaultReceiptSelection(none)).toEqual([]);
  });
});

describe("toggleReceiptHabit", () => {
  it("adds a done habit up to the limit and unselects freely", () => {
    const habits = makeHabits();
    const five = defaultReceiptSelection(habits);
    const add = toggleReceiptHabit(five, "h5", habits);
    expect(add.selected).toHaveLength(RECEIPT_MAX_ROWS);
    expect(add.error).toBe("Limit reached. Untick one to add another.");

    const removed = toggleReceiptHabit(five, "h3", habits);
    expect(removed.selected).not.toContain("h3");
    expect(removed.error).toBeUndefined();

    const back = toggleReceiptHabit(removed.selected, "h5", habits);
    expect(back.selected).toContain("h5");
  });

  it("ignores unknown and missed habits", () => {
    const habits = makeHabits();
    expect(toggleReceiptHabit([], "nope", habits).selected).toEqual([]);
    expect(toggleReceiptHabit([], "h7", habits).selected).toEqual([]); // h7 is missed
  });
});

describe("moveReceiptHabit", () => {
  const order = ["h3", "h6", "h1"];

  it("moves within the list and no-ops at the edges", () => {
    expect(moveReceiptHabit(order, "h3", 1)).toEqual(["h6", "h3", "h1"]);
    expect(moveReceiptHabit(order, "h1", -1)).toEqual(["h3", "h1", "h6"]);
    expect(moveReceiptHabit(order, "h3", -1)).toEqual(order);
    expect(moveReceiptHabit(order, "h1", 1)).toEqual(order);
    expect(moveReceiptHabit(order, "missing", 1)).toEqual(order);
  });
});

describe("receiptRows", () => {
  const habits = makeHabits();

  it("keeps the chosen order, drops unknown ids and skipped habits", () => {
    const { rows, missed } = receiptRows(habits, ["h2", "nope", "h7", "h1"], false);
    expect(rows.map((r) => r.id)).toEqual(["h2", "h1"]);
    expect(rows.every((r) => !r.missed)).toBe(true);
    expect(missed).toBeNull();
  });

  it("appends the highest-points missed habit when toggled on", () => {
    const { rows, missed } = receiptRows(habits, ["h1"], true);
    expect(rows.map((r) => r.id)).toEqual(["h1", "h7"]);
    expect(rows[1].missed).toBe(true);
    expect(missed?.id).toBe("h7");
    expect(missed?.points).toBe(30);
  });
});

describe("receiptTotals", () => {
  const habits = makeHabits();

  it("totals ALL completed habits, even when fewer rows are shown", () => {
    const { rows } = receiptRows(habits, defaultReceiptSelection(habits), false);
    const totals = receiptTotals(habits, rows);
    expect(totals).toEqual({
      shown: 5,
      hiddenDone: 1,
      done: 6,
      total: 7,
      habitPoints: 80, // 15+10+25+5+5+20
    });
  });

  it("never counts the missed row against the done total", () => {
    const { rows } = receiptRows(habits, ["h1", "h2"], true);
    const totals = receiptTotals(habits, rows);
    expect(totals.shown).toBe(2);
    expect(totals.done).toBe(6);
    expect(totals.hiddenDone).toBe(4);
  });
});

describe("receiptAvailability", () => {
  it("needs at least one completed habit", () => {
    expect(receiptAvailability(makeHabits())).toEqual({ available: true });
    const none = makeHabits().map((h) => ({ ...h, done: false }));
    expect(receiptAvailability(none)).toEqual({
      available: false,
      reason: "Complete a habit first",
    });
    expect(receiptAvailability([])).toEqual({
      available: false,
      reason: "Complete a habit first",
    });
  });

  it("wires into a full card fixture", () => {
    const data = makeShareCardData();
    expect(receiptAvailability(data.today.habits).available).toBe(true);
  });
});
