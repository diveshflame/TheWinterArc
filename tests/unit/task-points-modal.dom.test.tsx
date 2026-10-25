import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TaskPointsModal,
  type ChallengePointsBreakdown,
} from "@/components/task-points-modal";

const sampleBreakdowns: ChallengePointsBreakdown[] = [
  {
    challengeId: "c-winter-arc",
    challengeName: "Winter Arc 2026",
    totalPoints: 1250,
    taskPointsTotal: 1080,
    bonusPointsTotal: 170,
    dailyBonusTotal: 70,
    streakBonusTotal: 100,
    leagueBonusTotal: 0,
    tasks: [
      {
        id: "t-run",
        name: "Morning Run",
        type: "DAILY",
        inputType: "NUMBER",
        isRuleBreaker: false,
        isAlcoholTask: false,
        points: 10,
        unit: "km",
        unitCount: 1,
        target: null,
        category: "movement",
        todayPoints: 10,
        weekPoints: 30,
        overallPoints: 320,
        loggedCount: 32,
        totalValue: 128,
      },
      {
        id: "t-protein",
        name: "Daily Protein Target",
        type: "DAILY",
        inputType: "CHECKBOX",
        isRuleBreaker: false,
        isAlcoholTask: false,
        points: 5,
        unit: null,
        unitCount: null,
        target: null,
        category: "food",
        todayPoints: 5,
        weekPoints: 15,
        overallPoints: 240,
        loggedCount: 48,
        totalValue: 0,
      },
      {
        id: "t-meditation",
        name: "Meditation 15m",
        type: "DAILY",
        inputType: "CHECKBOX",
        isRuleBreaker: false,
        isAlcoholTask: false,
        points: 5,
        unit: null,
        unitCount: null,
        target: null,
        category: "mind",
        todayPoints: 0,
        weekPoints: 10,
        overallPoints: 160,
        loggedCount: 32,
        totalValue: 0,
      },
      {
        id: "t-gym",
        name: "Gym 4x/week",
        type: "WEEKLY",
        inputType: "NUMBER",
        isRuleBreaker: false,
        isAlcoholTask: false,
        points: 40,
        unit: "sessions",
        unitCount: 4,
        target: 4,
        category: "weekly",
        todayPoints: 0,
        weekPoints: 40,
        overallPoints: 360,
        loggedCount: 9,
        totalValue: 36,
      },
    ],
  },
  {
    challengeId: "c-spring-challenge",
    challengeName: "Spring Rebirth",
    totalPoints: 150,
    taskPointsTotal: 150,
    bonusPointsTotal: 0,
    dailyBonusTotal: 0,
    streakBonusTotal: 0,
    leagueBonusTotal: 0,
    tasks: [
      {
        id: "t-spring-walk",
        name: "Spring Walk",
        type: "DAILY",
        inputType: "NUMBER",
        isRuleBreaker: false,
        isAlcoholTask: false,
        points: 5,
        unit: "km",
        unitCount: 1,
        target: null,
        category: "movement",
        todayPoints: 5,
        weekPoints: 15,
        overallPoints: 150,
        loggedCount: 30,
        totalValue: 60,
      },
    ],
  },
];

describe("TaskPointsModal", () => {
  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    render(
      <TaskPointsModal
        isOpen={false}
        onClose={handleClose}
        challengeBreakdowns={sampleBreakdowns}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog with header, overall points, and task list when open", () => {
    const handleClose = vi.fn();
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={handleClose}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    // Title & overall score
    expect(
      screen.getByRole("heading", { name: "Task Points Breakdown" })
    ).toBeInTheDocument();
    expect(screen.getByText("1,250")).toBeInTheDocument();
    expect(screen.getAllByText(/1,080 pts/).length).toBeGreaterThan(0);

    // Tasks rendered
    expect(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(screen.getByText("Daily Protein Target")).toBeInTheDocument();
    expect(screen.getByText("Meditation 15m")).toBeInTheDocument();
    expect(screen.getByText("Gym 4x/week")).toBeInTheDocument();

    // Overall points values
    expect(screen.getByText("+360")).toBeInTheDocument();
    expect(screen.getByText("+320")).toBeInTheDocument();
    expect(screen.getByText("+240")).toBeInTheDocument();
    expect(screen.getByText("+160")).toBeInTheDocument();
  });

  it("calls onClose when the close button or Done button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={handleClose}
        challengeBreakdowns={sampleBreakdowns}
      />
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
      <TaskPointsModal
        isOpen={true}
        onClose={handleClose}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("toggles timeframe and updates displayed points", () => {
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={vi.fn()}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    // Default: Overall
    expect(screen.getByText("All-time points by task")).toBeInTheDocument();

    // Switch to This Week
    const weekBtn = screen.getByRole("button", { name: "This Week" });
    fireEvent.click(weekBtn);
    expect(screen.getByText("Points scored this week")).toBeInTheDocument();
    // In This Week, Morning Run weekPoints is 30
    expect(screen.getByText("+30")).toBeInTheDocument();

    // Switch to Today
    const todayBtn = screen.getByRole("button", { name: "Today" });
    fireEvent.click(todayBtn);
    expect(screen.getByText("Points scored today")).toBeInTheDocument();
    // In Today, Morning Run todayPoints is 10
    expect(screen.getByText("+10")).toBeInTheDocument();
  });

  it("filters tasks by category pills", () => {
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={vi.fn()}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    // Click Food category
    const foodBtn = screen.getByRole("button", { name: /Food/i });
    fireEvent.click(foodBtn);

    expect(screen.getByText("Daily Protein Target")).toBeInTheDocument();
    expect(screen.queryByText("Morning Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Meditation 15m")).not.toBeInTheDocument();
  });

  it("filters tasks by search input", () => {
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={vi.fn()}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search tasks...");
    fireEvent.change(searchInput, { target: { value: "medit" } });

    expect(screen.getByText("Meditation 15m")).toBeInTheDocument();
    expect(screen.queryByText("Morning Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Daily Protein Target")).not.toBeInTheDocument();
  });

  it("switches challenge using challenge selector pills", () => {
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={vi.fn()}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    // Initial challenge: Winter Arc 2026
    expect(screen.getByText("Morning Run")).toBeInTheDocument();

    // Click "Spring Rebirth" challenge tab
    const springBtn = screen.getByRole("button", { name: "Spring Rebirth" });
    fireEvent.click(springBtn);

    expect(screen.getByText("Spring Walk")).toBeInTheDocument();
    expect(screen.queryByText("Morning Run")).not.toBeInTheDocument();
  });

  it("toggles bonus breakdown details", () => {
    render(
      <TaskPointsModal
        isOpen={true}
        onClose={vi.fn()}
        challengeBreakdowns={sampleBreakdowns}
      />
    );

    const bonusToggle = screen.getByRole("button", {
      name: /Bonuses:/i,
    });
    fireEvent.click(bonusToggle);

    expect(screen.getByText("Daily Checklist Completion:")).toBeInTheDocument();
    expect(screen.getByText("+70 pts")).toBeInTheDocument();
    expect(screen.getByText("Streak Milestones (7-day chain):")).toBeInTheDocument();
    expect(screen.getByText("+100 pts")).toBeInTheDocument();
  });
});
