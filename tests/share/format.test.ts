import { describe, it, expect } from "vitest";
import {
  deriveUser,
  initialOf,
  inferIcon,
  formatValue,
  daysLeft,
  pointsWord,
} from "@/lib/share/format";

describe("share format helpers", () => {
  it("deriveUser keeps privacy: first name + last initial only", () => {
    expect(deriveUser("Divesh Shetty")).toEqual({ firstName: "Divesh", lastInitial: "S" });
    expect(deriveUser("  divesh   kumar shetty  ")).toEqual({ firstName: "divesh", lastInitial: "S" });
    expect(deriveUser("Cher")).toEqual({ firstName: "Cher", lastInitial: "" });
    expect(deriveUser(null)).toEqual({ firstName: "You", lastInitial: "" });
    expect(deriveUser("   ")).toEqual({ firstName: "You", lastInitial: "" });
  });

  it("initialOf returns a single uppercase letter or ?", () => {
    expect(initialOf("divesh")).toBe("D");
    expect(initialOf("")).toBe("?");
    expect(initialOf(null)).toBe("?");
  });

  it("inferIcon maps common activity labels", () => {
    expect(inferIcon("Morning Run")).toBe("run");
    expect(inferIcon("10k steps")).toBe("walk");
    expect(inferIcon("100 Push-ups")).toBe("push");
    expect(inferIcon("Water")).toBe("water");
    expect(inferIcon("Read 20 pages")).toBe("read");
    expect(inferIcon("Cold Shower")).toBe("shower");
    expect(inferIcon("Make Bed")).toBe("bed");
    expect(inferIcon("Protein target")).toBe("food");
    expect(inferIcon("Meditate")).toBe("generic");
  });

  it("formatValue trims trailing zeros", () => {
    expect(formatValue(4)).toBe("4");
    expect(formatValue(4.5)).toBe("4.5");
    expect(formatValue(4.04)).toBe("4");
    expect(formatValue(3.96)).toBe("4");
    expect(formatValue(null)).toBeNull();
  });

  it("daysLeft never goes negative", () => {
    expect(daysLeft(1, 75)).toBe(74);
    expect(daysLeft(75, 75)).toBe(0);
    expect(daysLeft(80, 75)).toBe(0);
  });

  it("pointsWord pluralizes", () => {
    expect(pointsWord(0)).toBe("0 pts");
    expect(pointsWord(1)).toBe("1 pt");
    expect(pointsWord(2)).toBe("2 pts");
  });
});
