import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeeklyWinnersModal, type WeeklyWinner } from "@/components/weekly-winners-modal";

const sampleWinners: WeeklyWinner[] = [
  {
    weekStart: new Date("2025-12-29T00:00:00.000Z"),
    weekEnd: new Date("2026-01-04T23:59:59.999Z"),
    weekNumber: 1,
    userId: "u2",
    name: "Bob",
    points: 50,
  },
  {
    weekStart: new Date("2025-12-22T00:00:00.000Z"),
    weekEnd: new Date("2025-12-28T23:59:59.999Z"),
    weekNumber: 2,
    userId: "u1",
    name: "Alice",
    points: 20,
  },
];

describe("WeeklyWinnersModal", () => {
  it("does not render when open is false", () => {
    const handleClose = vi.fn();
    render(
      <WeeklyWinnersModal open={false} onClose={handleClose} winners={sampleWinners} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog with weekly winners when open", () => {
    render(
      <WeeklyWinnersModal open={true} onClose={vi.fn()} winners={sampleWinners} />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    expect(
      screen.getByRole("heading", { name: "Weekly Winners" })
    ).toBeInTheDocument();

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("calls onClose when the close button or Done button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <WeeklyWinnersModal open={true} onClose={handleClose} winners={sampleWinners} />
    );

    const closeBtn = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const doneBtn = screen.getByRole("button", { name: "Done" });
    fireEvent.click(doneBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <WeeklyWinnersModal open={true} onClose={handleClose} winners={sampleWinners} />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state when there are no winners", () => {
    render(
      <WeeklyWinnersModal open={true} onClose={vi.fn()} winners={[]} />
    );

    expect(screen.getByText("No completed weeks yet.")).toBeInTheDocument();
  });
});
