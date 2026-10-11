import type { BackgroundType } from "@/lib/share/types";
import type { ShareTemplateId } from "@/lib/share/templates";

/**
 * Analytics events for the share feature. No personal data is ever included.
 */
export type ShareEvent =
  | { name: "share_opened"; template: ShareTemplateId; source: string }
  | { name: "template_selected"; template: ShareTemplateId }
  | { name: "background_selected"; background: BackgroundType }
  | {
      name: "share_completed";
      destination: string;
      template: ShareTemplateId;
      background: BackgroundType;
    }
  | { name: "share_failed"; template: ShareTemplateId; reason: string };

export type AnalyticsSink = (event: ShareEvent) => void;

let sink: AnalyticsSink = () => {
  /* no-op by default — plug in a provider here */
};

/** Register a real analytics provider (e.g. PostHog). */
export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

/** Track a share event. Never throws. */
export function track(event: ShareEvent): void {
  try {
    sink(event);
  } catch {
    // analytics must never break the UI
  }
}
