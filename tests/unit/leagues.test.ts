import { describe, it, expect } from "vitest";
import { getLeagueState, computeDivisionBoundaries, LEAGUES } from "@/lib/leagues";

describe("League Core Logic", () => {
  it("computes division boundaries correctly for Noob", () => {
    const [d0, d1, d2] = computeDivisionBoundaries(0, 400);
    expect(d0).toBe(0);
    expect(d1).toBe(133);
    expect(d2).toBe(266);
  });

  it("computes division boundaries correctly for Amateur", () => {
    const [d0, d1, d2] = computeDivisionBoundaries(400, 1200);
    expect(d0).toBe(400);
    expect(d1).toBe(666);
    expect(d2).toBe(933);
  });

  it("0 -> Noob III", () => {
    const state = getLeagueState(0);
    expect(state.league.key).toBe("noob");
    expect(state.division).toBe("III");
    expect(state.title).toBe("Noob III");
    expect(state.nextStep).toBe("Noob II");
    expect(state.pointsToNext).toBe(133);
  });

  it("132 -> Noob III; 133 -> Noob II; 266 -> Noob I", () => {
    const s132 = getLeagueState(132);
    expect(s132.league.key).toBe("noob");
    expect(s132.division).toBe("III");
    expect(s132.pointsToNext).toBe(1);

    const s133 = getLeagueState(133);
    expect(s133.league.key).toBe("noob");
    expect(s133.division).toBe("II");
    expect(s133.nextStep).toBe("Noob I");

    const s266 = getLeagueState(266);
    expect(s266.league.key).toBe("noob");
    expect(s266.division).toBe("I");
    expect(s266.nextStep).toBe("Amateur III");
  });

  it("360 -> Noob I, 40 pts to Amateur III", () => {
    const state = getLeagueState(360);
    expect(state.league.key).toBe("noob");
    expect(state.division).toBe("I");
    expect(state.nextStep).toBe("Amateur III");
    expect(state.pointsToNext).toBe(40);
    expect(state.pointsToNextLeague).toBe(40);
  });

  it("399 -> Noob I; 400 -> Amateur III", () => {
    const s399 = getLeagueState(399);
    expect(s399.league.key).toBe("noob");
    expect(s399.division).toBe("I");
    expect(s399.pointsToNext).toBe(1);

    const s400 = getLeagueState(400);
    expect(s400.league.key).toBe("amateur");
    expect(s400.division).toBe("III");
  });

  it("666 -> Amateur II; 933 -> Amateur I", () => {
    const s666 = getLeagueState(666);
    expect(s666.league.key).toBe("amateur");
    expect(s666.division).toBe("II");

    const s933 = getLeagueState(933);
    expect(s933.league.key).toBe("amateur");
    expect(s933.division).toBe("I");
  });

  it("1200 -> Silver III", () => {
    const state = getLeagueState(1200);
    expect(state.league.key).toBe("silver");
    expect(state.division).toBe("III");
    expect(state.title).toBe("Silver III");
  });

  it("4499 -> Titan I, 1 pt to Legend", () => {
    const state = getLeagueState(4499);
    expect(state.league.key).toBe("titan");
    expect(state.division).toBe("I");
    expect(state.nextStep).toBe("Legend III"); // or Legend
    expect(state.pointsToNext).toBe(1);
    expect(state.pointsToNextLeague).toBe(1);
  });

  it("4500 and 10000 -> Legend, max league", () => {
    const s4500 = getLeagueState(4500);
    expect(s4500.league.key).toBe("legend");
    expect(s4500.division).toBeNull();
    expect(s4500.title).toBe("Legend");
    expect(s4500.nextStep).toBe("Max league");
    expect(s4500.pointsToNext).toBe(0);
    expect(s4500.progressPerDivision).toEqual([1, 1, 1]);

    const s10000 = getLeagueState(10000);
    expect(s10000.league.key).toBe("legend");
    expect(s10000.division).toBeNull();
    expect(s10000.title).toBe("Legend");
    expect(s10000.nextStep).toBe("Max league");
  });

  it("Negative or null input -> treated as 0", () => {
    const sNull = getLeagueState(null as unknown as number);
    expect(sNull.league.key).toBe("noob");
    expect(sNull.division).toBe("III");
    expect(sNull.currentPoints).toBe(0);

    const sNeg = getLeagueState(-50);
    expect(sNeg.league.key).toBe("noob");
    expect(sNeg.division).toBe("III");
    expect(sNeg.currentPoints).toBe(0);
  });

  it("Calculates division progress segments accurately", () => {
    // At 0 pts in Noob
    const s0 = getLeagueState(0);
    expect(s0.progressPerDivision[0]).toBe(0);
    expect(s0.progressPerDivision[1]).toBe(0);
    expect(s0.progressPerDivision[2]).toBe(0);

    // At 133 pts in Noob (completed segment 0)
    const s133 = getLeagueState(133);
    expect(s133.progressPerDivision[0]).toBe(1);
    expect(s133.progressPerDivision[1]).toBe(0);
    expect(s133.progressPerDivision[2]).toBe(0);

    // At 360 pts in Noob (completed seg 0 & 1, partial seg 2: (360-266)/(400-266) = 94/134 ~ 0.7)
    const s360 = getLeagueState(360);
    expect(s360.progressPerDivision[0]).toBe(1);
    expect(s360.progressPerDivision[1]).toBe(1);
    expect(s360.progressPerDivision[2]).toBeGreaterThan(0.65);
    expect(s360.progressPerDivision[2]).toBeLessThan(0.75);
  });
});
