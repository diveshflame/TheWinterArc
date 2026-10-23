"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveBackfillLogs, checkBackfillEligibility } from "@/app/actions";
import {
  numberTaskPoints,
  getDailyChecklistCompletionSummary,
  formatDateKey,
  type ChallengeTask,
  type TaskLog,
} from "@/lib/scoring";
import {
  addDaysToKey,
  applyBackfillFactor,
  keyNumericDate,
  keyWeekdayLong,
  todayKey,
} from "@/lib/backfill";
import type { BackfillEligibility } from "@/lib/queries";
import {
  movementConfigFor,
  clampMovementValue,
} from "@/lib/movement-config";
import {
  CheckIcon,
  ChevronIcon,
  CustomAmountInput,
  MovementIcon,
  MovementSheet,
  MovementToast,
} from "@/components/daily-log";

// Mutual exclusion mirrors the normal Daily Log: only one of these movement
// tasks may be logged per day.
const EXCLUSIVE_MOVEMENT_TASK_NAMES = ["Total steps", "Walking"];

function isExclusiveMovementTaskName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return EXCLUSIVE_MOVEMENT_TASK_NAMES.some((x) => x.toLowerCase() === n);
}

// Dismiss is per challenge + per local calendar day ("rest of today only").
function dismissStorageKey(challengeId: string): string {
  return `winter-arc:backfill-dismissed:${challengeId}:${todayKey()}`;
}

function readDismissed(challengeId: string): boolean {
  try {
    return localStorage.getItem(dismissStorageKey(challengeId)) === "1";
  } catch {
    return false;
  }
}

function markDismissed(challengeId: string): void {
  try {
    localStorage.setItem(dismissStorageKey(challengeId), "1");
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Screen 1: entry banner on the Daily Log page (+ Screen 2 confirm sheet)
// ---------------------------------------------------------------------------

export function BackfillBanner({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "hidden" | "eligible">("loading");
  const [eligibility, setEligibility] = useState<BackfillEligibility | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Dismiss is stored per local calendar day; read it before hitting the server.
      if (readDismissed(challengeId)) {
        setStatus("hidden");
        return;
      }
      const res = await checkBackfillEligibility(challengeId, todayKey());
      if (cancelled) return;
      if (res.eligible) {
        setEligibility(res);
        setStatus("eligible");
      } else {
        setStatus("hidden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  if (status !== "eligible" || !eligibility) return null;

  function dismiss() {
    markDismissed(challengeId);
    setStatus("hidden");
  }

  return (
    <>
      {/* Screen 1: amber entry card */}
      <div className="rounded-[14px] border border-[#f59e0b66] bg-[#1a1608] p-[14px] shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[16px] font-bold leading-tight text-[#fbbf24]">
            Yesterday isn&apos;t logged
          </span>
          <span className="shrink-0 pt-0.5 text-[13px] text-[#8fa1c3]">
            {eligibility.yesterdayShort}
          </span>
        </div>
        <p className="mt-2 text-[14px] leading-[1.5] text-[#e6d8ae]">
          Catch up now and earn 70% of yesterday&apos;s points. The 30% penalty
          applies to earned points; penalties stay at full value.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex-1 min-h-[48px] rounded-[12px] bg-[#38bdf8] px-4 text-[15px] font-semibold text-[#04121f] transition active:scale-[0.98] disabled:opacity-60"
          >
            Log yesterday
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-[48px] rounded-[12px] px-4 text-[15px] font-medium text-[#8fa1c3] transition hover:text-[#e8eefc]"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Screen 2: confirm bottom sheet */}
      {sheetOpen && (
        <BackfillConfirmSheet
          yesterdayKey={eligibility.yesterdayKey}
          yesterdayWeekday={eligibility.yesterdayWeekday}
          onClose={() => setSheetOpen(false)}
          onContinue={() => router.push("/log/backfill")}
        />
      )}
    </>
  );
}

function BackfillConfirmSheet({
  yesterdayKey,
  yesterdayWeekday,
  onClose,
  onContinue,
}: {
  yesterdayKey: string;
  yesterdayWeekday: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // "Log Sunday, 10/18?" — weekday + short numeric date from the key.
  const shortNumeric = keyNumericDate(yesterdayKey); // "10/18/2026"
  const shortDate = shortNumeric.replace(/\/\d{4}$/, ""); // "10/18"

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusables = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const firstButton = sheetRef.current?.querySelector<HTMLElement>("button");
    firstButton?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        className="absolute inset-0 bg-[rgba(4,8,16,0.72)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backfill-sheet-title"
        className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-[14px] rounded-t-[22px] border-t border-[#1d2a47] bg-[#111a30] px-4 pb-7 pt-3 shadow-2xl animate-sheet-up"
      >
        {/* 1. Drag handle */}
        <div className="mx-auto h-1 w-10 rounded-[2px] bg-[#3a4a6b]" aria-hidden="true" />

        {/* 2. Title + subtitle */}
        <div>
          <h2
            id="backfill-sheet-title"
            className="text-[22px] font-bold leading-tight text-[#e8eefc]"
          >
            Log {yesterdayWeekday}, {shortDate}?
          </h2>
          <p className="mt-1 text-[13px] text-[#8fa1c3]">
            You can fill in yesterday once. Points work differently:
          </p>
        </div>

        {/* 3. On time vs Backfill cards */}
        <div className="grid grid-cols-2 items-stretch gap-2">
          <div className="flex min-h-[88px] flex-col justify-between rounded-[14px] border border-[#1d2a47] bg-[#0a1020] p-3">
            <span className="text-[13px] text-[#8fa1c3]">On time</span>
            <span className="text-[28px] font-bold leading-none text-[#e8eefc]">
              100%
            </span>
          </div>
          <div className="flex min-h-[88px] flex-col justify-between rounded-[14px] border border-[#f59e0b66] bg-[#1a1608] p-3">
            <span className="text-[13px] text-[#fbbf24]">Backfill</span>
            <span className="text-[28px] font-bold leading-none text-[#fbbf24]">
              70%
            </span>
          </div>
        </div>

        {/* 4. Three plain lines */}
        <div className="text-[14px] leading-[1.7] text-[#c4d0e8]">
          <p>Earned points are cut by 30%.</p>
          <p>Penalties stay at full value.</p>
          <p>Only yesterday can be backfilled.</p>
        </div>

        {/* 5 + 6. Actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="min-h-[48px] w-full rounded-[12px] bg-[#38bdf8] text-[15px] font-semibold text-[#04121f] transition active:scale-[0.98]"
          >
            Continue to {yesterdayWeekday}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] w-full rounded-[12px] text-[15px] font-medium text-[#8fa1c3] transition hover:text-[#e8eefc]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Screen 3: backfill logging screen
// ---------------------------------------------------------------------------

type EntryState = { completed: boolean; value: number };

export function BackfillLogClient({
  challengeId,
  challengeName,
  tasks,
  weekLogs = [],
}: {
  challengeId: string;
  challengeName: string;
  tasks: ChallengeTask[];
  weekLogs?: TaskLog[];
}) {
  const router = useRouter();

  // Resolved on mount from the user's LOCAL date (rule 1): yesterday relative
  // to the client's calendar day, validated server-side.
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [gating, setGating] = useState<"loading" | "ready" | "blocked">("loading");

  const [logState, setLogState] = useState<Record<string, EntryState>>({});
  const [isChecklistOpen, setIsChecklistOpen] = useState(true);
  const [isMovementOpen, setIsMovementOpen] = useState(true);
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);
  const [openMovementTaskId, setOpenMovementTaskId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ awarded: number } | null>(null);
  const [rolledOver, setRolledOver] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await checkBackfillEligibility(challengeId, todayKey());
      if (cancelled) return;
      if (res.eligible) {
        setDateKey(res.yesterdayKey);
        setGating("ready");
      } else {
        setGating("blocked");
        setTimeout(() => router.replace("/log"), 2200);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateWeekday = dateKey ? keyWeekdayLong(dateKey) : "";
  const dateNumeric = dateKey ? keyNumericDate(dateKey) : "";

  const entryOf = (taskId: string): EntryState =>
    logState[taskId] || { completed: false, value: 0 };

  const hasEntries = tasks.some((task) => {
    const s = entryOf(task.id);
    return s.completed || s.value > 0;
  });

  const dailyChecklistTasks = tasks.filter(
    (t) => t.type === "DAILY" && t.inputType !== "NUMBER"
  );
  const dailyMovementTasks = tasks.filter(
    (t) => t.type === "DAILY" && t.inputType === "NUMBER"
  );
  const weeklyTasks = tasks.filter((t) => t.type === "WEEKLY");

  // Per-task on-time vs awarded points (rule 3: factor applies after full
  // on-time computation, including distance/rep bonuses).
  function pointsForTask(task: ChallengeTask, s: EntryState): { original: number; awarded: number } {
    if (task.inputType === "NUMBER") {
      const original = s.value > 0 ? numberTaskPoints(s.value, task) : 0;
      return { original, awarded: applyBackfillFactor(original) };
    }
    const earns = task.isRuleBreaker ? !s.completed : s.completed;
    const original = earns ? task.points : 0;
    return { original, awarded: applyBackfillFactor(original) };
  }

  const dailyTotals = [...dailyChecklistTasks, ...dailyMovementTasks].reduce(
    (acc, task) => {
      const { original, awarded } = pointsForTask(task, entryOf(task.id));
      return { original: acc.original + original, awarded: acc.awarded + awarded };
    },
    { original: 0, awarded: 0 }
  );

  const liveLogs = tasks.map((task) => {
    const s = entryOf(task.id);
    return { taskId: task.id, completed: s.completed, value: s.value };
  });
  const completion = getDailyChecklistCompletionSummary(tasks, liveLogs);

  function toggle(taskId: string) {
    setLogState((prev) => {
      const cur = prev[taskId] || { completed: false, value: 0 };
      return { ...prev, [taskId]: { completed: !cur.completed, value: cur.value } };
    });
  }

  function setMovementValue(taskId: string, value: number) {
    setLogState((prev) => ({
      ...prev,
      [taskId]: { completed: value > 0, value },
    }));
  }

  function setWeeklyValue(taskId: string, value: number) {
    const valid = Math.max(0, Math.round(value * 10) / 10);
    setLogState((prev) => ({
      ...prev,
      [taskId]: { completed: valid > 0, value: valid },
    }));
  }

  // Mutual exclusion between Total steps / Walking (same as the normal log).
  function exclusivePartnerOf(taskId: string): ChallengeTask | null {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !isExclusiveMovementTaskName(task.name)) return null;
    return tasks.find((t) => t.id !== task.id && isExclusiveMovementTaskName(t.name)) ?? null;
  }
  function isLogged(taskId: string): boolean {
    const s = entryOf(taskId);
    return s.value > 0 || s.completed;
  }
  function isMovementLocked(taskId: string): boolean {
    const partner = exclusivePartnerOf(taskId);
    if (!partner) return false;
    return isLogged(partner.id) && !isLogged(taskId);
  }

  const openMovementTask = openMovementTaskId
    ? dailyMovementTasks.find((t) => t.id === openMovementTaskId) ?? null
    : null;

  function closeMovementSheet() {
    const taskId = openMovementTaskId;
    setOpenMovementTaskId(null);
    if (taskId) {
      requestAnimationFrame(() => {
        document.getElementById(`backfill-movement-row-${taskId}`)?.focus();
      });
    }
  }

  function goToday() {
    if (
      hasEntries &&
      !window.confirm("Discard the changes you've made to yesterday's log?")
    ) {
      return;
    }
    router.push("/log");
  }

  async function handleSave() {
    if (saving || !hasEntries || !dateKey) return;
    const clientToday = todayKey();
    // Reject stale requests if the date rolled over while this screen was open.
    if (addDaysToKey(clientToday, -1) !== dateKey) {
      setRolledOver(true);
      setTimeout(() => router.replace("/log"), 2500);
      return;
    }

    const updates = tasks
      .map((task) => ({ task, s: entryOf(task.id) }))
      .filter(({ s }) => s.completed || s.value > 0)
      .map(({ task, s }) => ({
        taskId: task.id,
        completed: s.completed,
        value: s.value,
      }));

    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveBackfillLogs(challengeId, dateKey, clientToday, updates);
      if (!res.ok) {
        if (res.code === "STALE_DATE" || res.code === "NOT_ELIGIBLE") {
          setRolledOver(true);
          setTimeout(() => router.replace("/log"), 2500);
          return;
        }
        setSaveError(res.error || "Couldn't save. Try again.");
        return;
      }
      setSavedInfo({ awarded: res.awarded ?? dailyTotals.awarded });
      router.refresh();
      setTimeout(() => router.push("/log"), 1600);
    } finally {
      setSaving(false);
    }
  }

  // --- Date rollover / locked states ---------------------------------------
  if (rolledOver || gating === "blocked") {
    const title = rolledOver ? "Yesterday has passed" : "Yesterday isn't backfillable";
    const body = rolledOver
      ? "The date rolled over while this page was open, so this day can no longer be backfilled. Taking you back to today's log…"
      : "It has already been logged, or it was outside your one-day backfill window. Taking you back to today's log…";
    return (
      <div className="space-y-4 pt-2">
        <div className="rounded-[14px] border border-[#7f1d1d] bg-[#1a1010] p-4">
          <h1 className="text-[18px] font-bold text-[#f87171]">{title}</h1>
          <p className="mt-1 text-[14px] leading-[1.5] text-[#e6d8ae]">{body}</p>
        </div>
      </div>
    );
  }

  if (gating === "loading" || !dateKey) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-9 w-40 animate-pulse rounded-[12px] bg-[#111a30]" />
        <div className="h-20 rounded-[14px] border border-[#1d2a47] bg-[#111a30] animate-pulse" />
        <div className="h-20 rounded-[14px] border border-[#1d2a47] bg-[#111a30] animate-pulse" />
      </div>
    );
  }

  const sign = dailyTotals.awarded >= 0 ? "+" : "";

  return (
    <div className="space-y-4 pb-44">
      {/* Header row: ‹ Today + Backfill chip */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={goToday}
          className="min-h-[40px] rounded-[12px] px-3 text-[15px] font-medium text-[#8fa1c3] transition hover:text-[#e8eefc]"
        >
          ‹ Today
        </button>
        <span className="rounded-full border border-[#f59e0b66] bg-[#2a1d05] px-3 py-1.5 text-[12px] font-semibold text-[#fbbf24] select-none">
          Backfill · −30%
        </span>
      </div>

      {/* Title + subtitle */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#e8eefc]">
          Log {dateWeekday}
        </h1>
        <p className="mt-1 text-[13px] text-[#8fa1c3]">
          {dateNumeric} · {challengeName}
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-[14px] border border-[#f59e0b66] bg-[#1a1608] p-[14px] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#e6d8ae]">You&apos;ll earn</span>
          <span className="flex items-baseline gap-1.5">
            {dailyTotals.original !== dailyTotals.awarded && (
              <span className="text-[12px] text-[#8fa1c3] line-through">
                {dailyTotals.original}
              </span>
            )}
            <span className="text-[26px] font-bold leading-none text-[#fbbf24]">
              {sign}
              {dailyTotals.awarded} pts
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-[4px] bg-[#1d2a47]">
          <div
            className="h-full rounded-[4px] bg-[#38bdf8] transition-all duration-300 ease-out"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        <p className="text-[13px] text-[#8fa1c3]">
          {completion.achieved} of {completion.total} tasks done · points × 0.7
        </p>
      </div>

      {/* Daily checklist */}
      {dailyChecklistTasks.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsChecklistOpen(!isChecklistOpen)}
            className="flex w-full items-center gap-2 py-1 text-left select-none"
          >
            <h2 className="text-[13px] font-semibold tracking-wide text-[#8fa1c3]">
              Daily checklist
            </h2>
            <ChevronIcon
              className={`h-4 w-4 text-[#8fa1c3] transition-transform duration-200 ${isChecklistOpen ? "rotate-180" : ""}`}
            />
          </button>
          {isChecklistOpen && (
            <div className="space-y-2">
              {dailyChecklistTasks.map((task) => {
                const s = entryOf(task.id);
                const isPenalty = task.points < 0;
                const { original, awarded } = pointsForTask(task, s);
                return (
                  <div
                    key={task.id}
                    onClick={() => toggle(task.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(task.id);
                      }
                    }}
                    className={`flex min-h-[48px] cursor-pointer select-none items-center gap-3 rounded-[12px] border px-3 py-2 transition-all hover:bg-white/[0.03] active:scale-[0.99] ${
                      isPenalty ? "border-[#7f1d1d] bg-[#14101c]" : "border-[#1d2a47] bg-[#111a30]"
                    }`}
                  >
                    {/* Checkbox */}
                    {s.completed ? (
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          isPenalty
                            ? "border-[#ef4444] bg-[#ef4444]"
                            : "border-[#22c55e] bg-[#22c55e]"
                        }`}
                      >
                        <CheckIcon
                          className={`h-3 w-3 animate-check ${isPenalty ? "text-white" : "text-[#04121f]"}`}
                        />
                      </div>
                    ) : (
                      <div
                        className={`h-5 w-5 shrink-0 rounded-md border-2 ${
                          isPenalty ? "border-[#542d38]" : "border-[#3e4a68]"
                        }`}
                      />
                    )}

                    {/* Name */}
                    <span
                      className={`min-w-0 flex-1 text-[14px] leading-tight ${
                        s.completed && !isPenalty ? "text-[#626c85] line-through" : "text-[#e8eefc]"
                      }`}
                    >
                      {task.name}
                    </span>

                    {/* Points */}
                    {isPenalty ? (
                      <span className="flex shrink-0 items-baseline gap-1.5">
                        <span className="text-[12px] text-[#8fa1c3]">unchanged</span>
                        <span className="text-[13px] font-bold text-[#f87171]">
                          {task.points}
                        </span>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-baseline gap-1.5">
                        <span className="text-[12px] text-[#8fa1c3] line-through">
                          +{original}
                        </span>
                        <span className="text-[13px] font-bold text-[#fbbf24]">
                          +{awarded}
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Movement */}
      {dailyMovementTasks.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsMovementOpen(!isMovementOpen)}
            className="flex w-full items-center gap-2 py-1 text-left select-none"
          >
            <h2 className="text-[13px] font-semibold tracking-wide text-[#8fa1c3]">
              Movement
            </h2>
            <ChevronIcon
              className={`h-4 w-4 text-[#8fa1c3] transition-transform duration-200 ${isMovementOpen ? "rotate-180" : ""}`}
            />
          </button>
          {isMovementOpen && (
            <div className="overflow-hidden rounded-[14px] border border-[#1d2a47] bg-[#111a30] divide-y divide-[#1d2a47]">
              {dailyMovementTasks.map((task) => {
                const cfg = movementConfigFor(task);
                const s = entryOf(task.id);
                const { original, awarded } = pointsForTask(task, s);
                const partner = exclusivePartnerOf(task.id);
                const locked = isMovementLocked(task.id);
                return (
                  <button
                    key={task.id}
                    id={`backfill-movement-row-${task.id}`}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      if (!locked) setOpenMovementTaskId(task.id);
                    }}
                    className={`flex min-h-[48px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors select-none ${
                      locked ? "cursor-not-allowed opacity-50" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <MovementIcon task={task} className="h-5 w-5 shrink-0 text-[#8fa1c3]" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#e8eefc]">
                      {task.name}
                    </span>
                    {locked && partner ? (
                      <span className="shrink-0 rounded-md border border-[#4d3a1e] bg-[#2a2314] px-2 py-0.5 text-[11px] font-semibold text-[#d4b483]">
                        {partner.name} logged
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#e8eefc]">
                      {s.value}
                      <span className="ml-1 text-[11px] font-normal text-[#8fa1c3]">
                        {cfg.unit}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md border border-[#f59e0b66] bg-[#2a1d05] px-2 py-0.5 text-[11px] font-bold text-[#fbbf24]">
                      {original !== awarded && (
                        <span className="mr-1 font-normal text-[#8fa1c3] line-through">
                          {original}
                        </span>
                      )}
                      {awarded} pts
                    </span>
                    <ChevronIcon className="h-4 w-4 shrink-0 -rotate-90 text-[#8fa1c3]" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Weekly challenges — unchanged; a backfilled day counts (rule 6) */}
      {weeklyTasks.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsWeeklyOpen(!isWeeklyOpen)}
            className="flex w-full items-center justify-between gap-2 py-1 text-left select-none"
          >
            <span className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-wide text-[#8fa1c3]">
                Weekly challenges
              </h2>
              <ChevronIcon
                className={`h-4 w-4 text-[#8fa1c3] transition-transform duration-200 ${isWeeklyOpen ? "rotate-180" : ""}`}
              />
            </span>
            <span className="text-[11px] text-[#8fa1c3]">Credited this week</span>
          </button>
          {isWeeklyOpen && (
            <div className="overflow-hidden rounded-[14px] border border-[#1d2a47] bg-[#111a30] divide-y divide-[#1d2a47]">
              {weeklyTasks.map((task) => {
                const s = entryOf(task.id);
                const weekLogsForTask = weekLogs.filter(
                  (l) => l.taskId === task.id && formatDateKey(l.date) !== dateKey
                );
                const priorDone = weekLogsForTask.filter((l) => l.completed).length;
                const doneCount = priorDone + (s.completed ? 1 : 0);
                const target = task.target || 0;
                const isMet = target > 0 ? doneCount >= target : doneCount > 0;

                if (task.inputType === "NUMBER") {
                  const priorSum = weekLogsForTask.reduce((a, l) => a + (l.value || 0), 0);
                  const totalSum = Math.round((priorSum + s.value) * 10) / 10;
                  const unitRaw = task.unit || "unit";
                  const isPenalty = task.points < 0;
                  return (
                    <div key={task.id} className={`space-y-3 p-3 ${isPenalty ? "bg-[#14101c]" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[14px] font-bold text-[#e8eefc]">{task.name}</span>
                          <p className={`text-[12px] ${isPenalty ? "text-[#f87171]" : "text-[#8fa1c3]"}`}>
                            {task.points} pts /{" "}
                            {task.unitCount && task.unitCount > 1 ? `${task.unitCount} ` : ""}
                            {unitRaw} · Credited this week
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[14px] font-bold text-[#e8eefc]">
                            {totalSum}{" "}
                            <span className="text-[12px] font-normal text-[#8fa1c3]">{unitRaw}</span>
                          </span>
                          <p className="text-[11px] text-[#8fa1c3]">This week</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[1, 2, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setWeeklyValue(task.id, s.value + n)}
                            className={`rounded-[12px] border px-3.5 py-2 text-[12px] font-semibold text-[#e8eefc] active:scale-95 transition-all ${
                              isPenalty
                                ? "border-[#4d1f2b] bg-[#251924]"
                                : "border-[#1d2a47] bg-[#16203a]"
                            }`}
                          >
                            +{n}
                          </button>
                        ))}
                        <CustomAmountInput
                          placeholder="Amount"
                          onSubmit={(n) => setWeeklyValue(task.id, s.value + n)}
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.id}
                    onClick={() => toggle(task.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(task.id);
                      }
                    }}
                    className="flex min-h-[48px] cursor-pointer select-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    {s.completed ? (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#22c55e] bg-[#22c55e]">
                        <CheckIcon className="h-3 w-3 text-[#04121f] animate-check" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 shrink-0 rounded-full border-2 border-[#3e4a68]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[14px] ${s.completed ? "font-medium text-[#e8eefc]" : "text-[#8fa1c3]"}`}>
                          {task.name}
                        </span>
                        <span className="shrink-0 rounded border border-[#334155] bg-[#1e293b] px-1.5 py-0.5 text-[10px] font-bold text-[#38bdf8]">
                          Weekly
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#8fa1c3]">
                        {target > 0 ? (
                          <>
                            <span className={isMet ? "font-medium text-emerald-400" : ""}>
                              {doneCount}/{target} days logged this week
                            </span>
                            {isMet ? " ✓" : ""} · Credited this week
                          </>
                        ) : (
                          "Logged now · Credited this week"
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-bold text-[#8fa1c3]">
                      +{task.points} this week
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error toast */}
      {saveError && (
        <MovementToast
          message={saveError}
          actionLabel="Dismiss"
          onAction={() => setSaveError(null)}
          onDismiss={() => setSaveError(null)}
          error
        />
      )}

      {/* Movement editor sheet (shared with the normal log) */}
      {openMovementTask && (
        <MovementSheet
          task={openMovementTask}
          value={entryOf(openMovementTask.id).value}
          saving={false}
          pointsFor={(v) => applyBackfillFactor(numberTaskPoints(v, openMovementTask))}
          originalPointsFor={(v) => (v > 0 ? numberTaskPoints(v, openMovementTask) : 0)}
          onClose={closeMovementSheet}
          onDone={async (value) => {
            const partner = exclusivePartnerOf(openMovementTask.id);
            const clamped = clampMovementValue(value, movementConfigFor(openMovementTask));
            if (
              clamped > 0 &&
              partner &&
              isLogged(partner.id) &&
              !isLogged(openMovementTask.id)
            ) {
              setSaveError(
                `${openMovementTask.name} and ${partner.name} can't both be logged — clear ${partner.name} first.`
              );
              return false;
            }
            // Backfill entries are batched; the save bar persists them.
            setMovementValue(openMovementTask.id, clamped);
            closeMovementSheet();
            return true;
          }}
        />
      )}

      {/* Pinned save bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[58px] z-30 md:bottom-4">
        <div className="pointer-events-auto mx-auto max-w-2xl px-4">
          <div className="space-y-2 rounded-[14px] border border-[#1d2a47] bg-[#111a30] p-3 shadow-2xl">
            <button
              type="button"
              disabled={!hasEntries || saving}
              onClick={() => void handleSave()}
              className="min-h-[48px] w-full rounded-[12px] bg-[#38bdf8] text-[15px] font-semibold text-[#04121f] transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {saving
                ? "Saving…"
                : `Save ${dateWeekday} · ${sign}${dailyTotals.awarded} pts`}
            </button>
            <p className="text-center text-[13px] text-[#8fa1c3]">
              Worth {dailyTotals.original} pts on time · 30% penalty applied
            </p>
          </div>
        </div>
      </div>

      {/* Success state */}
      {savedInfo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-[rgba(4,8,16,0.72)]" aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-[14px] border border-[#f59e0b66] bg-[#1a1608] p-6 text-center shadow-2xl animate-toast-in">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#22c55e]">
              <CheckIcon className="h-6 w-6 text-[#04121f]" />
            </div>
            <h2 className="text-[20px] font-bold text-[#fbbf24]">
              {dateWeekday} logged
            </h2>
            <p className="mt-1 text-[14px] text-[#e6d8ae]">
              +{savedInfo.awarded} pts earned at the 30% penalty. Taking you
              back to today&apos;s log…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
