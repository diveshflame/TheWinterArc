import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileClient } from "@/components/profile-client";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock("@/app/actions", () => ({
  updateUserMantra: vi.fn().mockResolvedValue({ success: true }),
  updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
  useStreakInsurance: vi.fn().mockResolvedValue({ success: true }),
  markLeagueCelebrated: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Profile Points Modal Integration", () => {
  const dummyUser = {
    id: "user-1",
    name: "Alex Hunter",
    displayName: "Alex Hunter",
    email: "alex@example.com",
    image: null,
    totalPoints: 1420,
    peakLeaguePoints: 1420,
    lastCelebratedLeague: null,
    currentStreak: 12,
    longestStreak: 18,
    mantra: "Unstoppable",
    streakTokens: 2,
  };

  const dummyBreakdown = [
    {
      challengeId: "c-winter-arc",
      challengeName: "Winter Arc 2026",
      totalPoints: 1420,
      taskPointsTotal: 1250,
      bonusPointsTotal: 170,
      dailyBonusTotal: 70,
      streakBonusTotal: 100,
      leagueBonusTotal: 0,
      tasks: [
        {
          id: "t1",
          name: "Push-ups 100x",
          type: "DAILY" as const,
          inputType: "NUMBER" as const,
          isRuleBreaker: false,
          isAlcoholTask: false,
          points: 10,
          unit: "reps",
          unitCount: 100,
          target: null,
          category: "movement" as const,
          todayPoints: 10,
          weekPoints: 40,
          overallPoints: 450,
          loggedCount: 45,
          totalValue: 4500,
        },
        {
          id: "t2",
          name: "Clean Eating",
          type: "DAILY" as const,
          inputType: "CHECKBOX" as const,
          isRuleBreaker: false,
          isAlcoholTask: false,
          points: 5,
          unit: null,
          unitCount: null,
          target: null,
          category: "food" as const,
          todayPoints: 5,
          weekPoints: 20,
          overallPoints: 300,
          loggedCount: 60,
          totalValue: 0,
        },
      ],
    },
  ];

  it("opens TaskPointsModal when the user clicks the Points card", () => {
    render(
      <ProfileClient
        user={dummyUser}
        challengeName="Winter Arc 2026"
        stats={{ daysLogged: 20, perfectDays: 10, avgCompletion: 90 }}
        summaries={[]}
        activeMemberships={[]}
        challengePointsBreakdowns={dummyBreakdown}
      />
    );

    // Dialog should initially not be open
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Find and click the Points card button
    const pointsButton = screen.getByRole("button", {
      name: "View task points breakdown",
    });
    expect(pointsButton).toBeInTheDocument();
    expect(pointsButton).toHaveTextContent("1,420");

    fireEvent.click(pointsButton);

    // Modal should now be open
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Task Points Breakdown" })
    ).toBeInTheDocument();

    // Task details shown
    expect(screen.getByText("Push-ups 100x")).toBeInTheDocument();
    expect(screen.getByText("+450")).toBeInTheDocument();
    expect(screen.getByText("Clean Eating")).toBeInTheDocument();
    expect(screen.getByText("+300")).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole("button", { name: "Close dialog" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
