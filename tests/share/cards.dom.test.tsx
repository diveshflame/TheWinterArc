import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DareStampCard,
  MountainTrailCard,
  PhotoStatsCard,
  ReceiptCard,
  SquadPodiumCard,
  ThenNowCard,
} from "@/components/share/cards";
import { DEFAULT_TOGGLES } from "@/lib/share/types";
import type { BackgroundState, CardToggleState, ShareDayHistory } from "@/lib/share/types";
import type { ReceiptSelection, ThenNowSelection } from "@/lib/share/card-props";
import { makeShareCardData } from "../fixtures/share-card-data";

const background: BackgroundState = { type: "color", colorKey: "midnight" };

const base = (overrides?: {
  data?: ReturnType<typeof makeShareCardData>;
  toggles?: Partial<CardToggleState>;
  thenNow?: ThenNowSelection;
  receipt?: ReceiptSelection;
}) => ({
  data: overrides?.data ?? makeShareCardData(),
  background,
  toggles: { ...DEFAULT_TOGGLES, ...(overrides?.toggles ?? {}) },
  ...(overrides?.thenNow ? { thenNow: overrides.thenNow } : {}),
  ...(overrides?.receipt ? { receipt: overrides.receipt } : {}),
});

describe("PhotoStatsCard", () => {
  it("renders the day pill, points, league, name, activities and wordmark", () => {
    render(<PhotoStatsCard {...base()} />);
    expect(screen.getByText("Day 45")).toBeInTheDocument();
    expect(screen.getByText("+42")).toBeInTheDocument();
    expect(screen.getByText("pts today")).toBeInTheDocument();
    expect(screen.getByText("Silver II")).toBeInTheDocument();
    expect(screen.getByText("Alex J")).toBeInTheDocument();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
    expect(screen.getByText("WINTER ARC")).toBeInTheDocument();
    // rank chip defaults off
    expect(screen.queryByText("#4/12")).not.toBeInTheDocument();
  });

  it("honours the name/points/league/rank toggles", () => {
    render(<PhotoStatsCard {...base({ toggles: { points: false, league: false, rank: true } })} />);
    expect(screen.queryByText("+42")).not.toBeInTheDocument();
    expect(screen.queryByText("Silver II")).not.toBeInTheDocument();
    expect(screen.getByText("Alex J")).toBeInTheDocument();
    expect(screen.getByText("#4/12")).toBeInTheDocument();
  });

  it("hides preview-only chrome when exporting", () => {
    const { container } = render(<PhotoStatsCard {...base()} forExport />);
    // camera chip is preview only; the day pill is not
    expect(screen.getByText("Day 45")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("DareStampCard", () => {
  it("renders the stamp, the points and the visual-only join button", () => {
    render(<DareStampCard {...base()} />);
    expect(screen.getByText("Beat me")).toBeInTheDocument();
    expect(screen.getByText("+42")).toBeInTheDocument();
    expect(screen.getByText("pts today")).toBeInTheDocument();
    expect(screen.getByText("Join Winter Arc →")).toBeInTheDocument();
  });

  it("drops the points line when the toggle is off", () => {
    render(<DareStampCard {...base({ toggles: { points: false } })} />);
    expect(screen.queryByText("+42")).not.toBeInTheDocument();
    expect(screen.getByText("Beat me")).toBeInTheDocument();
  });
});

describe("MountainTrailCard", () => {
  it("shows the day, days to go, checkpoints and the trail", () => {
    const { container } = render(<MountainTrailCard {...base()} />);
    expect(screen.getByText("DAY 45")).toBeInTheDocument();
    expect(screen.getByText("45 to go")).toBeInTheDocument();
    expect(screen.getByText("Checkpoints · Day 30, 60 · Summit 90")).toBeInTheDocument();
    expect(container.querySelector('svg[aria-label="Day 45 of 90 on the trail"]')).toBeTruthy();
    expect(screen.queryByText("Summit reached")).not.toBeInTheDocument();
  });

  it("flips to the summit state on the final day", () => {
    const data = makeShareCardData({
      challenge: { name: "Winter Arc", dayNumber: 90, totalDays: 90 },
    });
    render(<MountainTrailCard {...base({ data })} />);
    expect(screen.getByText("DAY 90")).toBeInTheDocument();
    expect(screen.getByText("Summit reached")).toBeInTheDocument();
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
  });
});

describe("ThenNowCard", () => {
  it("renders day chips, comparison rows and the percent chip", () => {
    render(<ThenNowCard {...base({ thenNow: { thenDay: 1, nowDay: 45 } })} />);
    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(screen.getByText("Day 45")).toBeInTheDocument();
    expect(screen.getByText("Daily pts")).toBeInTheDocument();
    expect(screen.getByText("Push-ups")).toBeInTheDocument();
    expect(screen.getByText("Run km")).toBeInTheDocument();
    expect(screen.queryByText("Walk km")).not.toBeInTheDocument(); // did not improve
    expect(screen.getByText("+100% daily pts")).toBeInTheDocument();
  });

  it("stays neutral and hides the chip when Now is lower than Then", () => {
    const history: ShareDayHistory[] = [
      {
        dayNumber: 1,
        date: "2026-01-01",
        points: 80,
        pushups: 60,
        pullups: 8,
        runKm: 5,
        walkKm: 3,
      },
      {
        dayNumber: 45,
        date: "2026-02-14",
        points: 40,
        pushups: 20,
        pullups: 5,
        runKm: 2,
        walkKm: 3,
      },
    ];
    const data = makeShareCardData({ dayHistory: history });
    render(<ThenNowCard {...base({ data, thenNow: { thenDay: 1, nowDay: 45 } })} />);
    expect(screen.getByText("Daily pts")).toBeInTheDocument();
    expect(screen.queryByText("Push-ups")).not.toBeInTheDocument();
    expect(screen.queryByText(/% daily pts/)).not.toBeInTheDocument();
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });
});

describe("ReceiptCard", () => {
  it("renders the top-5 selection with an honest footer", () => {
    render(<ReceiptCard {...base()} />);
    expect(screen.getByText("Today's habits")).toBeInTheDocument();
    for (const label of ["No sugar", "Journal", "Cold shower", "Read 20 pages", "Meditate"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText("Make the bed")).not.toBeInTheDocument(); // 6th by points
    expect(screen.getByText("+ 1 more done")).toBeInTheDocument();
    expect(screen.getByText("6 / 7")).toBeInTheDocument();
    expect(screen.getByText("+80 pts")).toBeInTheDocument();
  });

  it("appends the missed habit without changing the done total", () => {
    const data = makeShareCardData();
    const receipt: ReceiptSelection = {
      selected: ["h3", "h6", "h1"],
      showMissed: true,
    };
    render(<ReceiptCard {...base({ data, receipt })} />);
    expect(screen.getByText("No alcohol")).toBeInTheDocument();
    expect(screen.getByText("+ 3 more done")).toBeInTheDocument();
    expect(screen.getByText("6 / 7")).toBeInTheDocument();
  });

  it("drops the points total when the toggle is off", () => {
    render(<ReceiptCard {...base({ toggles: { points: false } })} />);
    expect(screen.queryByText("+80 pts")).not.toBeInTheDocument();
    expect(screen.getByText("6 / 7")).toBeInTheDocument();
  });
});

describe("SquadPodiumCard", () => {
  it("renders three columns with names, points and the panel headers", () => {
    const { container } = render(<SquadPodiumCard {...base()} />);
    expect(screen.getByText("Winter Arc")).toBeInTheDocument();
    expect(screen.getByText("All time · Top 3")).toBeInTheDocument();
    expect(screen.getByText("Ava")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.getByText("600")).toBeInTheDocument();
    // member without a photo falls back to the silhouette
    expect(screen.queryByText("#4/12")).not.toBeInTheDocument();
    expect(container.querySelector('img[src="https://example.com/a.png"]')).toBeTruthy();
    expect(screen.queryByText("You · #4")).not.toBeInTheDocument(); // rank toggle off
  });

  it("masks other members when hideOthers is on, keeping the sharer visible", () => {
    const { container } = render(<SquadPodiumCard {...base({ toggles: { hideOthers: true } })} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByText("Ava")).not.toBeInTheDocument();
    expect(screen.queryByText("Ben")).not.toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument(); // points stay visible
    expect(container.querySelector('img[src="https://example.com/a.png"]')).not.toBeInTheDocument();
  });

  it("shows the You rank line only when the rank toggle is on", () => {
    render(<SquadPodiumCard {...base({ toggles: { rank: true } })} />);
    expect(screen.getByText("You · #4")).toBeInTheDocument();
  });

  it("labels the header with the chosen leaderboard basis", () => {
    const { rerender } = render(
      <SquadPodiumCard {...base({ data: { ...makeShareCardData(), squadBasis: "week" } })} />
    );
    expect(screen.getByText("This week · Top 3")).toBeInTheDocument();
    rerender(
      <SquadPodiumCard {...base({ data: { ...makeShareCardData(), squadBasis: "today" } })} />
    );
    expect(screen.getByText("Today · Top 3")).toBeInTheDocument();
  });

  it("renders silhouettes for members with no photo", () => {
    const { container } = render(<SquadPodiumCard {...base()} />);
    const imgs = Array.from(container.querySelectorAll("img")).map((img) =>
      img.getAttribute("src")
    );
    expect(imgs).toContain("https://example.com/a.png");
    expect(imgs).toContain("https://example.com/me.png");
    expect(imgs).not.toContain("https://example.com/b.png"); // Ben has no photo
  });
});
