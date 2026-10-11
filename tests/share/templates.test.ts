import { describe, it, expect } from "vitest";
import {
  ENABLED_TEMPLATES,
  SHARE_TEMPLATES,
  getInviteUrl,
  getTemplate,
} from "@/lib/share/templates";
import { makeShareCardData } from "../fixtures/share-card-data";
import type { BackgroundType } from "@/lib/share/types";

const ctx = (backgroundType: BackgroundType = "color") => ({ backgroundType });

describe("share template registry", () => {
  it("shows exactly the six spec templates, in spec order, with components", () => {
    expect(ENABLED_TEMPLATES.map((t) => t.id)).toEqual([
      "photo-stats",
      "dare-stamp",
      "mountain-trail",
      "then-now",
      "receipt",
      "squad-podium",
    ]);
    for (const template of ENABLED_TEMPLATES) {
      expect(template.component).toBeTypeOf("function");
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.toggles.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps league aura / promotion in the registry but parked", () => {
    expect(SHARE_TEMPLATES).toHaveLength(8);
    expect(getTemplate("league-aura")?.enabled).toBe(false);
    expect(getTemplate("league-promotion")?.enabled).toBe(false);
    expect(getTemplate("league-promotion")?.component).toBeTypeOf("function");
  });

  it("gates photo-stats and dare-stamp to days with logged activity", () => {
    const ready = makeShareCardData();
    expect(getTemplate("photo-stats")!.availability(ready, ctx()).available).toBe(true);
    expect(getTemplate("dare-stamp")!.availability(ready, ctx()).available).toBe(true);

    // Nothing logged at all → blocked.
    const idle = makeShareCardData({
      today: { ...ready.today, points: 0, loggedToday: false },
    });
    const blocked = getTemplate("photo-stats")!.availability(idle, ctx());
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toBe("Log something first");
    expect(getTemplate("dare-stamp")!.availability(idle, ctx()).available).toBe(false);

    // Logged, but the net is negative (rule-breaker penalties) → still shareable.
    const penaltyDay = makeShareCardData({
      today: { ...ready.today, points: -8, activities: [] },
    });
    expect(getTemplate("photo-stats")!.availability(penaltyDay, ctx()).available).toBe(true);
    expect(getTemplate("dare-stamp")!.availability(penaltyDay, ctx()).available).toBe(true);
  });

  it("mountain-trail is always available", () => {
    expect(getTemplate("mountain-trail")!.availability(makeShareCardData(), ctx()).available).toBe(true);
    expect(
      getTemplate("mountain-trail")!.availability(
        makeShareCardData({ dayHistory: [] }),
        ctx()
      ).available
    ).toBe(true);
  });

  it("then-now needs at least one selected day with activity", () => {
    const data = makeShareCardData();
    expect(getTemplate("then-now")!.availability(data, ctx()).available).toBe(true);

    const empty = makeShareCardData({
      dayHistory: data.dayHistory.map((d) => ({ ...d, points: 0 })),
    });
    const blocked = getTemplate("then-now")!.availability(empty, ctx());
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toBe("Pick days with logged activity");

    const noHistory = makeShareCardData({ dayHistory: [] });
    expect(getTemplate("then-now")!.availability(noHistory, ctx()).available).toBe(false);
  });

  it("receipt needs a completed habit; podium needs three players", () => {
    const data = makeShareCardData();
    expect(getTemplate("receipt")!.availability(data, ctx()).available).toBe(true);

    const noneDone = makeShareCardData({
      today: { ...data.today, habits: data.today.habits.map((h) => ({ ...h, done: false })) },
    });
    const blocked = getTemplate("receipt")!.availability(noneDone, ctx());
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toBe("Complete a habit first");

    expect(getTemplate("squad-podium")!.availability(data, ctx()).available).toBe(true);
    const smallSquad = getTemplate("squad-podium")!.availability(
      makeShareCardData({ squadTop3: data.squadTop3.slice(0, 2) }),
      ctx()
    );
    expect(smallSquad.available).toBe(false);
    expect(smallSquad.reason).toBe("Needs at least 3 players");
  });

  it("declares the per-template toggles from the spec", () => {
    expect(getTemplate("photo-stats")!.toggles).toEqual(["name", "points", "league"]);
    expect(getTemplate("dare-stamp")!.toggles).toEqual(["points"]);
    expect(getTemplate("mountain-trail")!.toggles).toEqual([]);
    expect(getTemplate("then-now")!.toggles).toEqual([]);
    expect(getTemplate("receipt")!.toggles).toEqual(["points"]);
    expect(getTemplate("squad-podium")!.toggles).toEqual(["rank", "hideOthers"]);
  });
});

describe("share captions", () => {
  const data = makeShareCardData({ inviteUrl: "https://winterarc.app/join/ABC" });

  it("matches the spec copy for the six enabled templates", () => {
    const caption = (id: (typeof ENABLED_TEMPLATES)[number]["id"], thenDay?: number, nowDay?: number) =>
      getTemplate(id)!.caption(data, { backgroundType: "color", thenDay, nowDay });

    expect(caption("photo-stats")).toBe(
      "Day 45 of Winter Arc: +42 pts today. https://winterarc.app/join/ABC"
    );
    expect(caption("dare-stamp")).toBe(
      "Can you beat +42 pts today? Join me on Winter Arc https://winterarc.app/join/ABC"
    );
    expect(caption("mountain-trail")).toBe(
      "Day 45 of 90 on Winter Arc. 45 to go. https://winterarc.app/join/ABC"
    );
    expect(caption("then-now")).toBe(
      "Day 1 → Day 45 on Winter Arc: 40 → 80 daily pts. https://winterarc.app/join/ABC"
    );
    expect(caption("receipt")).toBe(
      "6 / 7 habits done today on Winter Arc. https://winterarc.app/join/ABC"
    );
    expect(caption("squad-podium")).toBe("Our Winter Arc leaderboard right now.");
  });

  it("switches the podium caption with the leaderboard basis", () => {
    const podium = getTemplate("squad-podium")!;
    const captionWithBasis = (basis?: "today" | "week" | "overall") =>
      podium.caption(data, { backgroundType: "color", podiumBasis: basis });
    expect(captionWithBasis("today")).toBe("Today's Winter Arc leaderboard.");
    expect(captionWithBasis("week")).toBe("This week's Winter Arc leaderboard.");
    expect(captionWithBasis("overall")).toBe("Our Winter Arc leaderboard right now.");
    expect(captionWithBasis()).toBe("Our Winter Arc leaderboard right now.");
  });

  it("reports the summit when the challenge is finished", () => {
    const finished = makeShareCardData({
      challenge: { name: "Winter Arc", dayNumber: 90, totalDays: 90 },
      dayHistory: [],
      inviteUrl: null,
    });
    expect(getTemplate("mountain-trail")!.caption(finished, ctx())).toBe(
      "Day 90 of 90 on Winter Arc. Summit reached."
    );
  });

  it("omits the invite link when none is configured", () => {
    const noInvite = makeShareCardData({ inviteUrl: null });
    expect(getTemplate("photo-stats")!.caption(noInvite, ctx())).toBe(
      "Day 45 of Winter Arc: +42 pts today."
    );
    expect(getInviteUrl(noInvite)).toBe(process.env.NEXT_PUBLIC_INVITE_URL ?? "");
    expect(getInviteUrl(data)).toBe("https://winterarc.app/join/ABC");
  });
});
