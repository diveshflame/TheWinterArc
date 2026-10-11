import { describe, it, expect } from "vitest";
import {
  PODIUM_COLORS,
  PODIUM_HEIGHTS,
  buildPodiumColumns,
  podiumAvailability,
  podiumBasisLabel,
  podiumYouLine,
} from "@/lib/share/podium";
import { makePodium, makeShareCardData } from "../fixtures/share-card-data";

describe("podiumBasisLabel", () => {
  it("labels each leaderboard basis", () => {
    expect(podiumBasisLabel("today")).toBe("Today");
    expect(podiumBasisLabel("week")).toBe("This week");
    expect(podiumBasisLabel("overall")).toBe("All time");
  });
});

describe("buildPodiumColumns", () => {
  const top3 = makePodium();

  it("lays the columns out as 2nd, 1st, 3rd with 1st tallest and crowned", () => {
    const columns = buildPodiumColumns(top3, { hideOthers: false });
    expect(columns.map((c) => c.rank)).toEqual([2, 1, 3]);
    expect(columns.map((c) => c.height)).toEqual([
      PODIUM_HEIGHTS[2],
      PODIUM_HEIGHTS[1],
      PODIUM_HEIGHTS[3],
    ]);
    expect(columns.map((c) => c.crown)).toEqual([false, true, false]);
    expect(columns[1].displayName).toBe("Ava");
    expect(columns[1].color).toBe(PODIUM_COLORS.gold);
    expect(columns[0].color).toBe(PODIUM_COLORS.silver);
    expect(columns[2].color).toBe(PODIUM_COLORS.blue); // 3rd is the sharer
    expect(columns.map((c) => c.entry.points)).toEqual([750, 900, 600]);
  });

  it("renders a silhouette (avatarUrl null) for members without a photo", () => {
    const columns = buildPodiumColumns(top3, { hideOthers: false });
    expect(columns.find((c) => c.displayName === "Ben")?.avatarUrl).toBeNull();
    expect(columns.find((c) => c.displayName === "Ava")?.avatarUrl).toBe("https://example.com/a.png");
  });

  it("hideOthers masks everyone but the sharer", () => {
    const columns = buildPodiumColumns(top3, { hideOthers: true });
    const byRank = [...columns].sort((a, b) => a.rank - b.rank);
    expect(byRank.map((c) => c.displayName)).toEqual(["#1", "#2", "You"]);
    expect(byRank.map((c) => c.avatarUrl)).toEqual([null, null, "https://example.com/me.png"]);
    expect(byRank.map((c) => c.entry.points)).toEqual([900, 750, 600]); // points stay visible
    expect(byRank[2].isYou).toBe(true);
  });

  it("uses slate for a non-sharer in 3rd place", () => {
    const others = makePodium({
      u2: { isYou: false },
      me: { userId: "z", isYou: false, firstName: "Zoe", name: "Zoe" },
    });
    const columns = buildPodiumColumns(others, { hideOthers: false });
    expect(columns.find((c) => c.rank === 3)?.color).toBe(PODIUM_COLORS.slate);
  });

  it("fills placeholder columns with fewer than three entries", () => {
    const columns = buildPodiumColumns(top3.slice(0, 2), { hideOthers: false });
    expect(columns).toHaveLength(3);
    const placeholder = columns[2];
    expect(placeholder.rank).toBe(3);
    expect(placeholder.height).toBe(0);
    expect(placeholder.displayName).toBe("");
    expect(placeholder.avatarUrl).toBeNull();
    expect(placeholder.crown).toBe(false);
  });
});

describe("podiumYouLine", () => {
  it("shows only when enabled and outside the top 3", () => {
    expect(podiumYouLine(4, true)).toBe("You · #4");
    expect(podiumYouLine(4, false)).toBeNull();
    expect(podiumYouLine(3, true)).toBeNull();
    expect(podiumYouLine(1, true)).toBeNull();
    expect(podiumYouLine(null, true)).toBeNull();
    expect(podiumYouLine(0, true)).toBeNull();
  });
});

describe("podiumAvailability", () => {
  it("needs at least three players", () => {
    expect(podiumAvailability(makePodium())).toEqual({ available: true });
    expect(podiumAvailability(makePodium().slice(0, 2))).toEqual({
      available: false,
      reason: "Needs at least 3 players",
    });
    expect(podiumAvailability([]).available).toBe(false);
  });

  it("wires into a full card fixture", () => {
    expect(podiumAvailability(makeShareCardData().squadTop3).available).toBe(true);
  });
});
