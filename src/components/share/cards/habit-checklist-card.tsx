"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { CheckMark, XMark } from "@/components/share/share-icons";

/**
 * Card 6 — Habit checklist.
 * Bottom-right translucent panel: "{done} / {total} habits", up to five done
 * rows with a teal check, then one missed row dimmed with an x.
 */
export function HabitChecklistCard({ data, background, panelAlpha, safeZones }: ShareCardProps) {
  const { today } = data;
  const done = today.habits.filter((h) => h.done).slice(0, 5);
  const missed = today.habits.find((h) => !h.done);
  const rows = [...done, ...(missed ? [missed] : [])];

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      <div className="absolute rounded-2xl p-3.5" style={{ ...panelStyle(), right: 16, bottom: "14%", width: 236 }}>
        <p className="mb-2.5 flex items-baseline gap-1 text-white">
          <span className="font-display text-[18px] font-bold">{today.habitsDone}</span>
          <span className="text-[12px] font-medium text-white/65">/ {today.habitsTotal} habits</span>
        </p>

        <div className="space-y-1.5">
          {rows.map((habit, i) => (
            <div key={`${habit.label}-${i}`} className="flex items-center gap-2 text-[12px]">
              {habit.done ? (
                <CheckMark className="h-3.5 w-3.5 shrink-0 text-[#2dd4bf]" />
              ) : (
                <XMark className="h-3.5 w-3.5 shrink-0 text-white/35" />
              )}
              <span className={`min-w-0 flex-1 truncate ${habit.done ? "text-white/90" : "text-white/45"}`}>
                {habit.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ShareCardFrame>
  );
}
