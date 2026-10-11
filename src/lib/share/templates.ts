import type { ComponentType } from "react";
import type { ShareCardProps } from "@/lib/share/card-props";
import type { BackgroundType, ShareCardData } from "@/lib/share/types";
import { daysLeft } from "@/lib/share/format";

export type ShareTemplateId =
  | "photo-stats"
  | "challenge-bubble"
  | "day-progress"
  | "day1-vs-today"
  | "squad-podium"
  | "habit-checklist"
  | "league-aura"
  | "league-promotion";

export interface TemplateAvailability {
  available: boolean;
  reason?: string;
  /** When set, the disabled state opens the Day-1 photo picker. */
  unlockAction?: "photo-picker";
}

export interface TemplateContext {
  backgroundType: BackgroundType;
}

export interface ShareTemplateDefinition {
  id: ShareTemplateId;
  label: string;
  /** Short, editable default caption (no link unless INVITE_URL is set). */
  caption: (data: ShareCardData) => string;
  /** Documentation/testing of the data this card depends on. */
  requiredData: string[];
  /** Preferred background for the card (photo-first cards are labelled "photo"). */
  recommendedBackground: BackgroundType | "any";
  availability: (data: ShareCardData, ctx: TemplateContext) => TemplateAvailability;
  component: ComponentType<ShareCardProps>;
}

/**
 * Invite-link hook. Intentionally empty for now — set this to a real URL and
 * every caption will append it. Do NOT invent a link.
 */
export const INVITE_URL = "";

function withInvite(caption: string): string {
  return INVITE_URL ? `${caption} ${INVITE_URL}` : caption;
}

// Component imports are kept at the bottom to avoid a circular import between
// the registry (metadata) and the card modules (which import its types).
import {
  PhotoStatsCard,
  ChallengeBubbleCard,
  DayProgressCard,
  Day1VsTodayCard,
  SquadPodiumCard,
  HabitChecklistCard,
  LeagueAuraCard,
  LeaguePromotionCard,
} from "@/components/share/cards";

export const SHARE_TEMPLATES: ShareTemplateDefinition[] = [
  {
    id: "photo-stats",
    label: "Photo + stats",
    requiredData: ["today.points", "today.activities", "user", "league"],
    recommendedBackground: "photo",
    availability: (data) =>
      data.today.points > 0
        ? { available: true }
        : { available: false, reason: "Log something first" },
    caption: (d) => withInvite(`Day ${d.challenge.dayNumber} of Winter Arc. +${d.today.points} pts today.`),
    component: PhotoStatsCard,
  },
  {
    id: "challenge-bubble",
    label: "Challenge bubble",
    requiredData: ["today.points"],
    recommendedBackground: "photo",
    availability: (data) =>
      data.today.points > 0
        ? { available: true }
        : { available: false, reason: "Log something first" },
    caption: (d) =>
      withInvite(`Day ${d.challenge.dayNumber} of Winter Arc. +${d.today.points} pts today. Can you beat it?`),
    component: ChallengeBubbleCard,
  },
  {
    id: "day-progress",
    label: "Day progress",
    requiredData: ["challenge.dayNumber", "streak"],
    recommendedBackground: "any",
    availability: () => ({ available: true }),
    caption: (d) =>
      withInvite(
        `Day ${d.challenge.dayNumber} of ${d.challenge.totalDays}. ${daysLeft(
          d.challenge.dayNumber,
          d.challenge.totalDays
        )} days left, ${d.streak}-day streak on Winter Arc.`
      ),
    component: DayProgressCard,
  },
  {
    id: "day1-vs-today",
    label: "Day 1 vs today",
    requiredData: ["day1PhotoUrl", "today.points", "streak"],
    recommendedBackground: "any",
    availability: (data) => {
      if (!data.day1PhotoUrl && !data.hasDay1Photo) {
        return { available: false, reason: "Add a Day 1 photo to unlock", unlockAction: "photo-picker" };
      }
      const todayPoints = (data as any).today?.points ?? (data as any).todayPoints ?? 0;
      if (todayPoints <= 0) {
        return { available: false, reason: "Log something first" };
      }
      return { available: true };
    },
    caption: (d) => withInvite(`Day 1 vs Day ${d.challenge.dayNumber} of Winter Arc. ${d.league.totalPoints} pts and counting.`),
    component: Day1VsTodayCard,
  },
  {
    id: "squad-podium",
    label: "Squad podium",
    requiredData: ["squadTop3"],
    recommendedBackground: "any",
    availability: (data) =>
      data.squadTop3.length >= 1
        ? { available: true }
        : { available: false, reason: "Not enough players yet" },
    caption: () => withInvite(`Top 3 in my Winter Arc squad.`),
    component: SquadPodiumCard,
  },
  {
    id: "habit-checklist",
    label: "Habit checklist",
    requiredData: ["today.habits", "today.habitsDone", "today.habitsTotal"],
    recommendedBackground: "any",
    availability: (data) =>
      data.today.habitsTotal >= 1
        ? { available: true }
        : { available: false, reason: "No habits configured" },
    caption: (d) => withInvite(`${d.today.habitsDone}/${d.today.habitsTotal} habits done on Winter Arc today.`),
    component: HabitChecklistCard,
  },
  {
    id: "league-aura",
    label: "League aura",
    requiredData: ["league"],
    recommendedBackground: "photo",
    availability: () => ({ available: true }),
    caption: (d) =>
      withInvite(
        `${d.league.persona} · ${d.league.name}${d.league.division ? ` ${d.league.division}` : ""} on Winter Arc.`
      ),
    component: LeagueAuraCard,
  },
  {
    id: "league-promotion",
    label: "League promotion",
    requiredData: ["promotion"],
    recommendedBackground: "photo",
    availability: (data) =>
      data.promotion ? { available: true } : { available: false, reason: "Available after a promotion" },
    caption: (d) =>
      d.promotion
        ? withInvite(
            `PROMOTED to ${d.promotion.toLeague}${d.promotion.toDivision ? ` ${d.promotion.toDivision}` : ""}! +${d.promotion.newBonusPerDay} pts/day unlocked.`
          )
        : "",
    component: LeaguePromotionCard,
  },
];

export function getTemplate(id: ShareTemplateId): ShareTemplateDefinition | undefined {
  return SHARE_TEMPLATES.find((t) => t.id === id);
}
