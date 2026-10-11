import type { ComponentType } from "react";
import type { ShareCardProps } from "@/lib/share/card-props";
import type { BackgroundType, CardToggleState, ShareCardData, SquadBasis } from "@/lib/share/types";
import { daysLeft, signedPoints } from "@/lib/share/format";
import { receiptAvailability } from "@/lib/share/receipt";
import { podiumAvailability } from "@/lib/share/podium";
import { thenNowAvailability } from "@/lib/share/then-now";

export type ShareTemplateId =
  | "photo-stats"
  | "dare-stamp"
  | "mountain-trail"
  | "then-now"
  | "receipt"
  | "squad-podium"
  | "league-aura"
  | "league-promotion";

export interface TemplateAvailability {
  available: boolean;
  reason?: string;
}

export interface TemplateContext {
  backgroundType: BackgroundType;
  /** Selected Then → Now days (defaults to Day 1 → today when omitted). */
  thenDay?: number;
  nowDay?: number;
  /** Podium leaderboard basis (defaults to overall when omitted). */
  podiumBasis?: SquadBasis;
}

export interface ShareTemplateDefinition {
  id: ShareTemplateId;
  label: string;
  /**
   * Registry flag: disabled templates keep their code but are hidden from
   * the sheet (league aura / league promotion are parked behind this).
   */
  enabled: boolean;
  /** Short, editable default caption (appends the invite URL when configured). */
  caption: (data: ShareCardData, ctx?: TemplateContext) => string;
  /** Documentation of the data this card depends on. */
  requiredData: string[];
  /** Preferred background for the card (photo-first cards are labelled "photo"). */
  recommendedBackground: BackgroundType | "any";
  /** Which "Show on card" toggles apply to this template. */
  toggles: (keyof CardToggleState)[];
  availability: (data: ShareCardData, ctx: TemplateContext) => TemplateAvailability;
  component: ComponentType<ShareCardProps>;
}

/**
 * Invite link. Read from NEXT_PUBLIC_INVITE_URL — never hardcoded. When unset,
 * captions omit the link and the sheet hides the "Copy invite link" button;
 * `getInviteUrl` is the hook where a real URL plugs in.
 */
export function getInviteUrl(data?: ShareCardData): string {
  const fromData = data?.inviteUrl;
  if (fromData) return fromData;
  return process.env.NEXT_PUBLIC_INVITE_URL ?? "";
}

function withInvite(caption: string, data?: ShareCardData): string {
  const invite = getInviteUrl(data);
  return invite ? `${caption} ${invite}` : caption;
}

function pointsToday(data: ShareCardData): number {
  return data.today?.points ?? 0;
}

/**
 * Photo-stats and dare-stamp need *activity* today, not a positive net: a
 * day with rule-breaker penalties can still be worth sharing, and telling a
 * user who logged that they should "log something first" is wrong.
 */
function hasLoggedToday(data: ShareCardData): boolean {
  return data.today?.loggedToday === true || pointsToday(data) > 0;
}

// Component imports are kept at the bottom to avoid a circular import between
// the registry (metadata) and the card modules (which import its types).
import {
  PhotoStatsCard,
  DareStampCard,
  MountainTrailCard,
  ThenNowCard,
  ReceiptCard,
  SquadPodiumCard,
  LeagueAuraCard,
  LeaguePromotionCard,
} from "@/components/share/cards";

export const SHARE_TEMPLATES: ShareTemplateDefinition[] = [
  {
    id: "photo-stats",
    label: "Photo + stats",
    enabled: true,
    requiredData: ["today.points", "today.activities", "user", "league"],
    recommendedBackground: "photo",
    toggles: ["name", "points", "league"],
    availability: (data) =>
      hasLoggedToday(data)
        ? { available: true }
        : { available: false, reason: "Log something first" },
    caption: (d) =>
      withInvite(`Day ${d.challenge.dayNumber} of Winter Arc: ${signedPoints(d.today.points)} pts today.`, d),
    component: PhotoStatsCard,
  },
  {
    id: "dare-stamp",
    label: "Dare stamp",
    enabled: true,
    requiredData: ["today.points"],
    recommendedBackground: "photo",
    toggles: ["points"],
    availability: (data) =>
      hasLoggedToday(data)
        ? { available: true }
        : { available: false, reason: "Log something first" },
    caption: (d) =>
      withInvite(
        `Can you beat ${signedPoints(d.today.points)} pts today? Join me on Winter Arc`,
        d
      ),
    component: DareStampCard,
  },
  {
    id: "mountain-trail",
    label: "Mountain trail",
    enabled: true,
    requiredData: ["challenge.dayNumber", "challenge.totalDays"],
    recommendedBackground: "any",
    toggles: [],
    availability: () => ({ available: true }),
    caption: (d) => {
      const base = `Day ${d.challenge.dayNumber} of ${d.challenge.totalDays} on Winter Arc.`;
      const left = daysLeft(d.challenge.dayNumber, d.challenge.totalDays);
      const tail = left > 0 ? `${left} to go.` : "Summit reached.";
      return withInvite(`${base} ${tail}`, d);
    },
    component: MountainTrailCard,
  },
  {
    id: "then-now",
    label: "Then → Now",
    enabled: true,
    requiredData: ["dayHistory"],
    recommendedBackground: "any",
    toggles: [],
    availability: (data, ctx) => thenNowAvailability(data, ctx.thenDay, ctx.nowDay),
    caption: (d, ctx) => {
      const nowDay = Math.max(1, ctx?.nowDay ?? d.challenge.dayNumber);
      const thenDay = Math.max(1, ctx?.thenDay ?? 1);
      const thenPts = d.dayHistory.find((h) => h.dayNumber === thenDay)?.points ?? 0;
      const nowPts = d.dayHistory.find((h) => h.dayNumber === nowDay)?.points ?? 0;
      return withInvite(
        `Day ${thenDay} → Day ${nowDay} on Winter Arc: ${thenPts} → ${nowPts} daily pts.`,
        d
      );
    },
    component: ThenNowCard,
  },
  {
    id: "receipt",
    label: "Paper receipt",
    enabled: true,
    requiredData: ["today.habits", "today.habitsDone", "today.habitsTotal"],
    recommendedBackground: "any",
    toggles: ["points"],
    availability: (data) => receiptAvailability(data.today?.habits ?? []),
    caption: (d) =>
      withInvite(`${d.today.habitsDone} / ${d.today.habitsTotal} habits done today on Winter Arc.`, d),
    component: ReceiptCard,
  },
  {
    id: "squad-podium",
    label: "Squad podium",
    enabled: true,
    requiredData: ["squadTop3", "squadYouRank"],
    recommendedBackground: "any",
    toggles: ["rank", "hideOthers"],
    availability: (data) => podiumAvailability(data.squadTop3 ?? []),
    caption: (_d, ctx) => {
      const basis = ctx?.podiumBasis ?? "overall";
      if (basis === "today") return "Today's Winter Arc leaderboard.";
      if (basis === "week") return "This week's Winter Arc leaderboard.";
      return "Our Winter Arc leaderboard right now.";
    },
    component: SquadPodiumCard,
  },
  // Parked templates — code kept, hidden from the sheet until they return.
  {
    id: "league-aura",
    label: "League aura",
    enabled: false,
    requiredData: ["league"],
    recommendedBackground: "photo",
    toggles: ["name", "league"],
    availability: () => ({ available: true }),
    caption: (d) =>
      withInvite(
        `${d.league.persona} · ${d.league.name}${d.league.division ? ` ${d.league.division}` : ""} on Winter Arc.`,
        d
      ),
    component: LeagueAuraCard,
  },
  {
    id: "league-promotion",
    label: "League promotion",
    enabled: false,
    requiredData: ["promotion"],
    recommendedBackground: "photo",
    toggles: ["name", "league"],
    availability: (data) =>
      data.promotion ? { available: true } : { available: false, reason: "Available after a promotion" },
    caption: (d) =>
      d.promotion
        ? withInvite(
            `PROMOTED to ${d.promotion.toLeague}${d.promotion.toDivision ? ` ${d.promotion.toDivision}` : ""}! +${d.promotion.newBonusPerDay} pts/day unlocked.`,
            d
          )
        : "",
    component: LeaguePromotionCard,
  },
];

/** The templates shown in the sheet carousel, in registry order. */
export const ENABLED_TEMPLATES = SHARE_TEMPLATES.filter((t) => t.enabled);

export function getTemplate(id: ShareTemplateId): ShareTemplateDefinition | undefined {
  return SHARE_TEMPLATES.find((t) => t.id === id);
}

/** Availability helper that also supplies the Then → Now selection. */
export function templateAvailability(
  def: ShareTemplateDefinition,
  data: ShareCardData,
  ctx: Partial<TemplateContext> & { backgroundType: BackgroundType }
): TemplateAvailability {
  return def.availability(data, ctx);
}
