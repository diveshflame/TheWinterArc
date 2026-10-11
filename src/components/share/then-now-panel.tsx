"use client";

import { useEffect, useRef, useState } from "react";
import type { ShareDayHistory } from "@/lib/share/types";
import {
  percentChip,
  resolvePreset,
  validateNowDay,
  validateThenDay,
  type ThenNowPreset,
} from "@/lib/share/then-now";

export interface ThenNowPanelProps {
  dayHistory: ShareDayHistory[];
  /** Today's challenge day — the maximum selectable day. */
  currentDay: number;
  thenDay: number;
  nowDay: number;
  onChange: (thenDay: number, nowDay: number) => void;
}

const AMBER = "#e8b73a";
const BLUE = "#38bdf8";

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Customize panel for Then → Now: Then/Now tabs, a tappable daily-points bar
 * chart, Then presets, an accessible pair of day selects and a summary row.
 * Selecting a Then at or after Now is rejected with a short inline message.
 */
export function ThenNowPanel({ dayHistory, currentDay, thenDay, nowDay, onChange }: ThenNowPanelProps) {
  const [activeTab, setActiveTab] = useState<"then" | "now">("then");
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const pointsOf = (day: number) => dayHistory.find((d) => d.dayNumber === day)?.points ?? 0;
  const thenPts = pointsOf(thenDay);
  const nowPts = pointsOf(nowDay);
  const pct = percentChip(thenPts, nowPts);
  const maxPoints = Math.max(1, ...dayHistory.map((d) => d.points));

  // Keep the latest days in view when the chart mounts.
  useEffect(() => {
    const el = chartRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  function pickDay(day: number) {
    if (day < 1 || day > currentDay) return;
    if (activeTab === "then") {
      const check = validateThenDay(day, nowDay);
      if (!check.ok) {
        setError(check.message ?? "Invalid day");
        return;
      }
      onChange(day, nowDay);
    } else {
      const check = validateNowDay(day, thenDay, currentDay);
      if (!check.ok) {
        setError(check.message ?? "Invalid day");
        return;
      }
      onChange(thenDay, day);
    }
    setError(null);
  }

  function applyPreset(preset: ThenNowPreset) {
    const day = resolvePreset(preset, { currentDay, nowDay, dayHistory });
    if (day === null) return;
    const check = validateThenDay(day, nowDay);
    if (!check.ok) {
      setError(check.message ?? "Invalid day");
      return;
    }
    onChange(day, nowDay);
    setError(null);
  }

  const presetOptions: { id: ThenNowPreset; label: string }[] = [
    { id: "day1", label: "Day 1" },
    { id: "best", label: "Best day" },
    { id: "week", label: "7 days ago" },
    { id: "yesterday", label: "Yesterday" },
  ];
  const presets = presetOptions.filter(
    (preset) => resolvePreset(preset.id, { currentDay, nowDay, dayHistory }) !== null
  );

  const days = Array.from({ length: Math.max(1, currentDay) }, (_, i) => i + 1);

  const tabClass = (tab: "then" | "now") => {
    const active = activeTab === tab;
    return `flex-1 rounded-xl border px-3 py-2 text-left transition ${
      active ? "bg-white/5" : "border-white/10 bg-white/[0.03]"
    }`;
  };

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Compare days
        </p>
        <div className="flex gap-2" role="tablist" aria-label="Selected days">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "then"}
            onClick={() => setActiveTab("then")}
            className={tabClass("then")}
            style={activeTab === "then" ? { borderColor: AMBER, color: AMBER } : { color: "rgba(255,255,255,0.6)" }}
          >
            <span className="block text-[11px] font-bold uppercase tracking-wide">Then</span>
            <span className="block text-[11px] text-white/70">
              Day {thenDay} · {formatDate(dayHistory.find((d) => d.dayNumber === thenDay)?.date ?? "")} ·{" "}
              <span className="font-semibold text-white">{thenPts}</span> pts
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "now"}
            onClick={() => setActiveTab("now")}
            className={tabClass("now")}
            style={activeTab === "now" ? { borderColor: BLUE, color: BLUE } : { color: "rgba(255,255,255,0.6)" }}
          >
            <span className="block text-[11px] font-bold uppercase tracking-wide">Now</span>
            <span className="block text-[11px] text-white/70">
              Day {nowDay} · {formatDate(dayHistory.find((d) => d.dayNumber === nowDay)?.date ?? "")} ·{" "}
              <span className="font-semibold text-white">{nowPts}</span> pts
            </span>
          </button>
        </div>
      </div>

      {/* Bar chart */}
      <div
        ref={chartRef}
        className="flex items-end gap-[3px] overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] px-2 pb-1 pt-2"
        style={{ height: 108 }}
        role="group"
        aria-label="Daily points by day"
      >
        {days.map((day) => {
          const points = pointsOf(day);
          const height = points > 0 ? Math.max(6, Math.round((points / maxPoints) * 64)) : 3;
          const isThen = day === thenDay;
          const isNow = day === nowDay;
          const color = isThen ? AMBER : isNow ? BLUE : "rgba(148,163,184,0.45)";
          return (
            <button
              key={day}
              type="button"
              onClick={() => pickDay(day)}
              aria-label={`Day ${day}, ${points} points`}
              aria-pressed={isThen || isNow}
              className="flex min-w-[18px] flex-1 shrink-0 flex-col items-center justify-end gap-1 py-0.5"
              title={`Day ${day} · ${points} pts`}
            >
              <span
                className="w-full rounded-[3px]"
                style={{
                  height,
                  backgroundColor: color,
                  outline: isThen || isNow ? `1px solid ${isThen ? AMBER : BLUE}` : "none",
                  outlineOffset: 1,
                }}
              />
              <span className="text-[11px] leading-none text-white/45">{day}</span>
            </button>
          );
        })}
      </div>

      {/* Presets for the Then tab */}
      <div className="mt-2 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Accessible alternative to the chart */}
      <div className="mt-3 flex gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Then day
          </span>
          <select
            value={thenDay}
            onChange={(e) => {
              const day = Number(e.target.value);
              const check = validateThenDay(day, nowDay);
              if (!check.ok) {
                setError(check.message ?? "Invalid day");
                return;
              }
              onChange(day, nowDay);
              setError(null);
            }}
            className="w-full rounded-xl border border-white/12 bg-[#0f1526] px-3 py-2.5 text-[13px] text-white outline-none focus:border-[#e8b73a]/60"
          >
            {days
              .filter((day) => day < nowDay)
              .map((day) => (
                <option key={day} value={day}>
                  Day {day} · {pointsOf(day)} pts
                </option>
              ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Now day
          </span>
          <select
            value={nowDay}
            onChange={(e) => {
              const day = Number(e.target.value);
              const check = validateNowDay(day, thenDay, currentDay);
              if (!check.ok) {
                setError(check.message ?? "Invalid day");
                return;
              }
              onChange(thenDay, day);
              setError(null);
            }}
            className="w-full rounded-xl border border-white/12 bg-[#0f1526] px-3 py-2.5 text-[13px] text-white outline-none focus:border-[#38bdf8]/60"
          >
            {days
              .filter((day) => day > thenDay)
              .map((day) => (
                <option key={day} value={day}>
                  Day {day} · {pointsOf(day)} pts
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* Summary */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <span className="text-[13px] font-semibold text-white">
          {thenPts} → {nowPts} <span className="text-white/60">pts</span>
        </span>
        {pct !== null && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ color: "#34d399", backgroundColor: "rgba(52,211,153,0.16)" }}
          >
            +{pct}%
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[12px] font-medium text-amber-300" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
