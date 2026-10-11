import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/share/templates";

describe("share templates", () => {
  it("day1-vs-today requires Day-1 photo; unlocks via picker", () => {
    const t = getTemplate("day1-vs-today");
    expect(t).toBeDefined();
    const noPhoto = t!.availability(
      { day1PhotoUrl: null, hasDay1Photo: false } as any,
      { backgroundType: "color" }
    );
    expect(noPhoto.available).toBe(false);
    expect(noPhoto.unlockAction).toBe("photo-picker");
    const withUrl = t!.availability(
      { day1PhotoUrl: "data:..." } as any,
      { backgroundType: "color" }
    );
    expect(withUrl.available).toBe(false); // still needs points
    const ready = t!.availability(
      { day1PhotoUrl: "data:...", today: { points: 5 } } as any,
      { backgroundType: "color" }
    );
    expect(ready.available).toBe(true);
    const hasStored = t!.availability(
      { day1PhotoUrl: null, hasDay1Photo: true, today: { points: 5 } } as any,
      { backgroundType: "color" }
    );
    expect(hasStored.available).toBe(true);
  });

  it("league-promotion gated to promotion data", () => {
    const t = getTemplate("league-promotion");
    expect(t!.availability({ promotion: undefined } as any, { backgroundType: "photo" }).available).toBe(false);
    expect(t!.availability({ promotion: { toLeague: "Amateur" } } as any, { backgroundType: "photo" }).available).toBe(true);
  });

  it("squad-podium gated to roster", () => {
    const t = getTemplate("squad-podium");
    expect(t!.availability({ squadTop3: [] } as any, { backgroundType: "color" }).available).toBe(false);
    expect(t!.availability({ squadTop3: [{ initial: "A", points: 10, isYou: false }] } as any, { backgroundType: "color" }).available).toBe(true);
  });

  it("habit-checklist gated to habits", () => {
    const t = getTemplate("habit-checklist");
    expect(t!.availability({ today: { habitsTotal: 0 } } as any, { backgroundType: "color" }).available).toBe(false);
    expect(t!.availability({ today: { habitsTotal: 2, habits: [] } } as any, { backgroundType: "color" }).available).toBe(true);
  });
});
