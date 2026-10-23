import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/app/actions", () => ({
  checkBackfillEligibility: vi.fn(async () => ({
    eligible: true,
    yesterdayKey: "2026-10-22",
    yesterdayWeekday: "Thursday",
    yesterdayShort: "Thu, Oct 22",
  })),
  saveBackfillLogs: vi.fn(async () => ({ ok: true, awarded: 0 })),
}));

import { BackfillLogClient } from "@/components/backfill-log";
import type { ChallengeTask } from "@/lib/scoring";

const CHALLENGE_ID = "ch-1";

function task(overrides: Partial<ChallengeTask> & { id: string; name: string }): ChallengeTask {
  return {
    challengeId: CHALLENGE_ID,
    type: "DAILY",
    inputType: "CHECKBOX",
    isRuleBreaker: false,
    isAlcoholTask: false,
    points: 10,
    unit: null,
    unitCount: null,
    target: null,
    bonusThreshold: null,
    bonusPoints: null,
    ...overrides,
  };
}

const running = task({ id: "run", name: "Running", inputType: "NUMBER", unit: "km" });

function renderClient(tasks: ChallengeTask[]) {
  return render(
    <BackfillLogClient
      challengeId={CHALLENGE_ID}
      challengeName="Winter Arc"
      tasks={tasks}
    />
  );
}

async function openSheet(rowName: RegExp) {
  const row = await screen.findByRole("button", { name: rowName });
  fireEvent.click(row);
  return screen.getByRole("dialog");
}

function setValue(text: string) {
  const input = screen.getByRole("textbox", { name: /value in / });
  fireEvent.change(input, { target: { value: text } });
}

function clickDone() {
  fireEvent.click(screen.getByRole("button", { name: /^Done · / }));
}

describe("BackfillLogClient movement sheet", () => {
  it("closes the sheet on Done and writes the value into the row", async () => {
    renderClient([running]);

    const dialog = await openSheet(/Running/);
    setValue("5");
    clickDone();

    // The sheet must dismiss itself — Done is not a no-op.
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    const row = document.getElementById("backfill-movement-row-run") as HTMLElement;
    expect(row).toHaveTextContent("5");
    expect(row).toHaveTextContent("km");
  });

  it("reopens with the committed value and leaves it untouched on Cancel", async () => {
    renderClient([running]);

    await openSheet(/Running/);
    setValue("5");
    clickDone();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(document.getElementById("backfill-movement-row-run") as HTMLElement);
    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("textbox", { name: /value in / })).toHaveValue("5");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(document.getElementById("backfill-movement-row-run")).toHaveTextContent("5");
  });
});
