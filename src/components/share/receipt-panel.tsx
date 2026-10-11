"use client";

import { useRef, useState } from "react";
import type { ShareHabit } from "@/lib/share/types";
import {
  RECEIPT_MAX_ROWS,
  defaultReceiptSelection,
  moveReceiptHabit,
  toggleReceiptHabit,
} from "@/lib/share/receipt";

export interface ReceiptPanelProps {
  habits: ShareHabit[];
  selected: string[];
  showMissed: boolean;
  onChange: (selected: string[], showMissed: boolean) => void;
}

function GripGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/35" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

function ArrowGlyph({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
    </svg>
  );
}

/**
 * Customize panel for the Paper receipt: pick and reorder up to five completed
 * habits, optionally append the highest-points missed habit.
 */
export function ReceiptPanel({ habits, selected, showMissed, onChange }: ReceiptPanelProps) {
  const [limitError, setLimitError] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const done = habits.filter((h) => h.done);
  const selectedSet = new Set(selected);
  const ordered: ShareHabit[] = [
    ...selected.map((id) => done.find((h) => h.id === id)).filter((h): h is ShareHabit => Boolean(h)),
    ...done.filter((h) => !selectedSet.has(h.id)),
  ];
  const topMissed = habits.filter((h) => !h.done).sort((a, b) => b.points - a.points)[0] ?? null;
  const atLimit = selected.length >= RECEIPT_MAX_ROWS;

  function toggle(habit: ShareHabit) {
    const result = toggleReceiptHabit(selected, habit.id, habits);
    setLimitError(result.error ?? null);
    onChange(result.selected, showMissed);
  }

  function move(id: string, dir: -1 | 1) {
    onChange(moveReceiptHabit(selected, id, dir), showMissed);
  }

  function dropOn(targetId: string) {
    const dragged = dragIdRef.current;
    dragIdRef.current = null;
    if (!dragged || dragged === targetId) return;
    const next = selected.slice();
    const from = next.indexOf(dragged);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, dragged);
    onChange(next, showMissed);
  }

  const rowClass = (enabled: boolean) =>
    `flex h-11 items-center gap-2 rounded-xl border px-2 transition ${
      enabled ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-white/[0.02] opacity-45"
    }`;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Habits on receipt
        </p>
        <span className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/75">
          {selected.length} / {RECEIPT_MAX_ROWS}
        </span>
      </div>

      <div className="space-y-1.5">
        {ordered.map((habit) => {
          const checked = selectedSet.has(habit.id);
          const enabled = checked || !atLimit;
          const index = selected.indexOf(habit.id);
          return (
            <div
              key={habit.id}
              className={rowClass(enabled)}
              draggable={checked}
              onDragStart={() => {
                dragIdRef.current = checked ? habit.id : null;
              }}
              onDragOver={(e) => {
                if (dragIdRef.current) e.preventDefault();
              }}
              onDrop={() => dropOn(habit.id)}
              onDragEnd={() => {
                dragIdRef.current = null;
              }}
            >
              <span className="flex h-11 w-5 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing">
                <GripGlyph />
              </span>

              <label className={`flex min-w-0 flex-1 items-center gap-2 ${enabled ? "cursor-pointer" : "cursor-not-allowed"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!enabled}
                  onChange={() => toggle(habit)}
                  className="h-5 w-5 shrink-0 accent-[#38bdf8]"
                />
                <span className={`min-w-0 flex-1 truncate text-[13px] ${checked ? "text-white/90" : "text-white/55"}`}>
                  {habit.label}
                </span>
              </label>

              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/60">
                {habit.points} pts
              </span>

              {checked && (
                <span className="flex shrink-0">
                  <button
                    type="button"
                    aria-label={`Move ${habit.label} up`}
                    disabled={index <= 0}
                    onClick={() => move(habit.id, -1)}
                    className="flex h-11 w-11 items-center justify-center text-white/60 disabled:opacity-30"
                  >
                    <ArrowGlyph up />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${habit.label} down`}
                    disabled={index >= selected.length - 1}
                    onClick={() => move(habit.id, 1)}
                    className="flex h-11 w-11 items-center justify-center text-white/60 disabled:opacity-30"
                  >
                    <ArrowGlyph up={false} />
                  </button>
                </span>
              )}
            </div>
          );
        })}

        {topMissed && (
          <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showMissed}
                onChange={() => onChange(selected, !showMissed)}
                className="h-5 w-5 shrink-0 accent-[#38bdf8]"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/45 line-through">
                {topMissed.label}
              </span>
            </label>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/35">
              {topMissed.points} pts
            </span>
          </div>
        )}
      </div>

      {atLimit && (
        <p className="mt-2 text-[12px] font-medium text-amber-300" role="status">
          Limit reached. Untick one to add another.
        </p>
      )}
      {limitError && !atLimit && (
        <p className="mt-2 text-[12px] font-medium text-amber-300" role="status">
          {limitError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setLimitError(null);
            onChange(defaultReceiptSelection(habits), showMissed);
          }}
          className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75"
        >
          Top 5 by points
        </button>
        <button
          type="button"
          onClick={() => {
            setLimitError(null);
            onChange([], showMissed);
          }}
          className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75"
        >
          Clear
        </button>
      </div>

      <label className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <span className="text-[13px] text-white/80">Show one missed habit</span>
        <input
          type="checkbox"
          checked={showMissed}
          disabled={!topMissed}
          onChange={(e) => onChange(selected, e.target.checked)}
          className="h-5 w-5 accent-[#38bdf8]"
        />
      </label>
      {!topMissed && <p className="mt-1 text-[11px] text-white/40">No missed habits today.</p>}
    </div>
  );
}
