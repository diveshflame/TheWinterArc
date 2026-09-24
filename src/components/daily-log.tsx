"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveMultipleTaskLogs } from "@/app/actions";
import {
  numberTaskPoints,
  DAILY_BONUS_POINTS,
  formatDateKey,
  type ChallengeTask,
  type TaskLog,
} from "@/lib/scoring";

const MOVEMENT_DEBOUNCE_MS = 5000;
const GROUP_DEBOUNCE_MS = 400;

type PendingUpdate = { completed: boolean; value: number; bonus: number };

export function DailyLogClient({
  challengeId,
  challengeName,
  tasks,
  initialLogs,
  weekLogs = [],
  currentStreak = 0,
  todayFormatted,
}: {
  challengeId: string;
  challengeName: string;
  tasks: ChallengeTask[];
  initialLogs: TaskLog[];
  weekLogs?: TaskLog[];
  currentStreak?: number;
  todayFormatted?: string;
}) {
  const router = useRouter();
  const [logState, setLogState] = useState<Record<string, { completed: boolean; value: number }>>(() => {
    const state: Record<string, { completed: boolean; value: number }> = {};
    tasks.forEach((task) => {
      const log = initialLogs.find((l) => l.taskId === task.id);
      state[task.id] = {
        completed: log ? log.completed : false,
        value: log ? log.value : 0,
      };
    });
    return state;
  });

  // Local immediate state for responsive movement counter updates
  const [movementValues, setMovementValues] = useState<Record<string, number>>(() => {
    const state: Record<string, number> = {};
    tasks.forEach((task) => {
      if (task.inputType === "NUMBER") {
        const log = initialLogs.find((l) => l.taskId === task.id);
        state[task.id] = log ? log.value : 0;
      }
    });
    return state;
  });

  // All sections collapsed initially as requested
  const [isDailyChecklistOpen, setIsDailyChecklistOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);

  const [saved, setSaved] = useState(false);
  const [savePulseKey, setSavePulseKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Updates applied to the UI but not yet confirmed in the DB. Coalesced into
  // batched saves so rapid toggles produce a single write to the database.
  const pendingRef = useRef<Record<string, PendingUpdate>>({});
  const flushInFlight = useRef(false);
  const flushQueuedKind = useRef<"MOVEMENT" | "GROUP" | null>(null);
  const groupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Per-task debounce timers for movement values (5s)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
      if (groupTimerRef.current) clearTimeout(groupTimerRef.current);
    };
  }, []);

  const todayKey = formatDateKey(new Date());
  const dateDisplay = todayFormatted || new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  // Derived state: Logged in status (automatically on if any task completed or value > 0 today)
  const isLoggedIn = Object.values(logState).some((item) => item.completed || item.value > 0);

  // Bonus helpers
  function dailyBonus(task: ChallengeTask, value: number): number {
    return task.bonusThreshold &&
      task.bonusThreshold > 0 &&
      task.bonusPoints &&
      value >= task.bonusThreshold
      ? task.bonusPoints
      : 0;
  }

  function weeklyBonus(task: ChallengeTask, value: number): number {
    if (!task.bonusThreshold || task.bonusThreshold <= 0 || !task.bonusPoints)
      return 0;
    const prior = weekLogs.filter(
      (l) => l.taskId === task.id && formatDateKey(l.date) !== todayKey
    );
    const total = prior.reduce((s, l) => s + (l.value || 0), 0) + value;
    if (total < task.bonusThreshold) return 0;
    const priorBonus = prior.reduce((s, l) => s + (l.bonusPoints || 0), 0);
    if (priorBonus > 0) return 0; // already rewarded this week
    return task.bonusPoints;
  }

  const draftKey = `pending-log:${challengeId}:${todayKey}`;

  function persistDraft() {
    try {
      const entries = Object.entries(pendingRef.current);
      if (entries.length === 0) {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(
          draftKey,
          JSON.stringify(
            entries.map(([taskId, p]) => ({
              taskId,
              completed: p.completed,
              value: p.value,
              bonus: p.bonus,
            }))
          )
        );
      }
    } catch {
      // Storage unavailable; the in-memory debounce still works.
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }

  function pendingEntries(kind: "MOVEMENT" | "GROUP") {
    return Object.entries(pendingRef.current).filter(([taskId]) => {
      const t = tasks.find((x) => x.id === taskId);
      const isMovement = t?.type === "DAILY" && t.inputType === "NUMBER";
      return kind === "MOVEMENT" ? isMovement : !isMovement;
    });
  }

  async function flushPending(kind: "MOVEMENT" | "GROUP") {
    const entries = pendingEntries(kind);
    if (entries.length === 0) return;

    if (flushInFlight.current) {
      flushQueuedKind.current = kind;
      return;
    }

    flushInFlight.current = true;
    const updates = entries.map(([taskId, p]) => ({
      taskId,
      completed: p.completed,
      value: p.value,
      bonusPoints: p.bonus,
    }));

    setIsSyncing(true);
    try {
      await saveMultipleTaskLogs(challengeId, todayKey, updates);
      // Only drop updates from the queue once the DB confirms them.
      const remaining = { ...pendingRef.current };
      entries.forEach(([taskId]) => delete remaining[taskId]);
      pendingRef.current = remaining;
      setPendingCount(Object.keys(remaining).length);
      persistDraft();
      setSaved(true);
      setSavePulseKey((k) => k + 1);
      router.refresh();
    } finally {
      setIsSyncing(false);
      flushInFlight.current = false;
      const next = flushQueuedKind.current;
      flushQueuedKind.current = null;
      if (next) void flushPending(next);
    }
  }

  function markPending(taskId: string, completed: boolean, value: number) {
    const task = tasks.find((t) => t.id === taskId);
    let bonus = 0;
    if (task?.inputType === "NUMBER") {
      bonus =
        task.type === "WEEKLY"
          ? weeklyBonus(task, value)
          : dailyBonus(task, value);
    }
    pendingRef.current = { ...pendingRef.current, [taskId]: { completed, value, bonus } };
    setPendingCount(Object.keys(pendingRef.current).length);
    persistDraft();

    const isMovement = task?.type === "DAILY" && task.inputType === "NUMBER";
    if (isMovement) {
      // Keep the 5s debounce so rapid +/- clicks produce a single DB write.
      if (debounceTimers.current[taskId]) clearTimeout(debounceTimers.current[taskId]);
      debounceTimers.current[taskId] = setTimeout(() => {
        delete debounceTimers.current[taskId];
        void flushPending("MOVEMENT");
      }, MOVEMENT_DEBOUNCE_MS);
    } else {
      if (!groupTimerRef.current) {
        groupTimerRef.current = setTimeout(() => {
          groupTimerRef.current = null;
          void flushPending("GROUP");
        }, GROUP_DEBOUNCE_MS);
      }
    }
  }

  // Restore any draft left behind by a refresh that interrupted a debounced
  // save, and flush it so the DB catches up with what the user last saw.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(draftKey);
    } catch {
      // ignore
    }
    if (raw) {
      let drafts: { taskId: string; completed: boolean; value: number; bonus: number }[] = [];
      try {
        const parsed = JSON.parse(raw);
        drafts = Array.isArray(parsed) ? parsed : [];
      } catch {
        // ignore
      }
      const knownIds = new Set(tasks.map((t) => t.id));
      const valid = drafts.filter((d) => d && knownIds.has(d.taskId));
      if (valid.length === 0) {
        clearDraft();
      } else {
        const restored: Record<string, PendingUpdate> = {};
        const movementRestore: Record<string, number> = {};
        valid.forEach((d) => {
          restored[d.taskId] = { completed: d.completed, value: d.value, bonus: d.bonus };
          const task = tasks.find((t) => t.id === d.taskId);
          if (task?.type === "DAILY" && task.inputType === "NUMBER") {
            movementRestore[d.taskId] = d.value;
          }
        });
        pendingRef.current = { ...pendingRef.current, ...restored };
        setPendingCount(Object.keys(pendingRef.current).length);
        setMovementValues((prev) => ({ ...prev, ...movementRestore }));
        setLogState((prev) => {
          const next = { ...prev };
          valid.forEach((d) => {
            next[d.taskId] = { completed: d.completed, value: d.value };
          });
          return next;
        });
        void flushPending("GROUP");
        void flushPending("MOVEMENT");
      }
    }
    // Drop drafts left over from previous days/challenges.
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("pending-log:")) keys.push(k);
      }
      keys.forEach((k) => {
        if (k !== draftKey) localStorage.removeItem(k);
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort flush when the tab is hidden/closed. The draft above is only
  // cleared after the DB confirms, so an aborted request is restored on load.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") flushOnHide();
    }
    function flushOnHide() {
      const entries = Object.entries(pendingRef.current);
      if (entries.length === 0) return;
      void saveMultipleTaskLogs(
        challengeId,
        todayKey,
        entries.map(([taskId, p]) => ({
          taskId,
          completed: p.completed,
          value: p.value,
          bonusPoints: p.bonus,
        }))
      );
    }
    window.addEventListener("pagehide", flushOnHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flushOnHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(taskId: string, completed: boolean, value: number) {
    setLogState((prev) => ({
      ...prev,
      [taskId]: { completed, value },
    }));
    markPending(taskId, completed, value);
  }

  function toggle(taskId: string) {
    const current = logState[taskId] || { completed: false, value: 0 };
    save(taskId, !current.completed, current.value);
  }

  // Debounced handler for Movement numbers: update displayed reps immediately,
  // wait 5s of inactivity before persisting to the DB.
  function handleMovementChange(taskId: string, nextVal: number) {
    const validVal = Math.max(0, Math.round(nextVal * 10) / 10);
    setMovementValues((prev) => ({
      ...prev,
      [taskId]: validVal,
    }));
    markPending(taskId, validVal > 0, validVal);
  }

  // Weekly numbers persist with the short group debounce
  function saveWeeklyValue(taskId: string, nextVal: number) {
    const validVal = Math.max(0, Math.round(nextVal * 10) / 10);
    setLogState((prev) => ({
      ...prev,
      [taskId]: { completed: validVal > 0, value: validVal },
    }));
    markPending(taskId, validVal > 0, validVal);
  }

  // Task partitions: Daily Checklist (habits/penalties), Daily Movement, Weekly Challenges
  const dailyChecklistTasks = tasks.filter(
    (t) => t.type === "DAILY" && t.inputType !== "NUMBER"
  );
  const dailyMovementTasks = tasks.filter(
    (t) => t.type === "DAILY" && t.inputType === "NUMBER"
  );
  const weeklyTasks = tasks.filter((t) => t.type === "WEEKLY");

  // Completion calculation for DAILY HABIT tasks (excluding negative/penalty tasks and weekly tasks)
  const positiveHabits = dailyChecklistTasks.filter((t) => t.points >= 0);
  const totalHabits = positiveHabits.length;
  const achievedHabits = positiveHabits.filter((t) => logState[t.id]?.completed).length;
  const habitCompletionPercent = totalHabits > 0 ? Math.round((achievedHabits / totalHabits) * 100) : 0;

  // Bonus tier note under completion bar
  const nextBonusTier =
    habitCompletionPercent < 50
      ? { percent: 50, bonus: 5 }
      : habitCompletionPercent < 75
      ? { percent: 75, bonus: 15 }
      : null;

  // Points today calculation — ONLY DAILY tasks contribute to today's score!
  // Weekly task points are credited on Sunday at the end of the week.
  let todayTotalPoints = 0;
  tasks.forEach((t) => {
    if (t.type !== "DAILY") return;
    const state = logState[t.id];
    if (!state) return;
    if (t.inputType === "NUMBER") {
      todayTotalPoints += numberTaskPoints(state.value, t);
    } else if (state.completed) {
      todayTotalPoints += t.points;
    }
  });
  if (habitCompletionPercent >= 75) {
    todayTotalPoints += DAILY_BONUS_POINTS;
  }

  // Points earned from daily checklist
  let dailyChecklistPoints = 0;
  dailyChecklistTasks.forEach((t) => {
    const state = logState[t.id];
    if (state?.completed) {
      dailyChecklistPoints += t.points;
    }
  });

  return (
    <div className="space-y-4">
      {/* 1. Header: Title + Subtitle on Left, Status Pill on Right */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Log</h1>
          <p className="text-xs text-muted mt-0.5">
            {challengeName} · {dateDisplay}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">
          {isLoggedIn ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#142921] border border-[#1b4332] text-[#4ade80] select-none shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              Logged in
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#161d2d] border border-[#242e44] text-[#8b93ad] select-none shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#525d7a]" />
              Not logged in
            </div>
          )}
        </div>
      </div>

      {/* 2. Today's Completion Card */}
      <div className="rounded-2xl border border-[#1d2b45] bg-gradient-to-b from-[#142239] to-[#0d1627] p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Today&apos;s completion</span>
          <div className="h-5 flex items-center">
            {isSyncing || pendingCount > 0 ? (
              <span className="text-xs font-medium text-muted">Saving…</span>
            ) : saved ? (
              <span
                key={savePulseKey}
                className="text-xs font-medium text-[#38bdf8] animate-autosave"
              >
                Auto-saved ✓
              </span>
            ) : (
              <span className="text-xs font-medium text-[#38bdf8] opacity-80">Auto-saved ✓</span>
            )}
          </div>
        </div>

        {/* Progress bar + percentage */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[#1b253b] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#38bdf8] transition-all duration-300 ease-out"
              style={{ width: `${habitCompletionPercent}%` }}
            />
          </div>
          <span className="text-sm font-bold text-[#38bdf8] shrink-0">
            {habitCompletionPercent}%
          </span>
        </div>

        {/* Completion tier note */}
        <p className="text-xs text-muted">
          {totalHabits > 0 ? (
            nextBonusTier ? (
              <>
                {achievedHabits}/{totalHabits} daily tasks done ·{" "}
                <span className="text-[#38bdf8] font-bold">{nextBonusTier.percent}%</span> earns{" "}
                <span className="text-[#38bdf8] font-bold">+{nextBonusTier.bonus} bonus</span>
              </>
            ) : (
              <>
                {achievedHabits}/{totalHabits} daily tasks done ·{" "}
                <span className="text-emerald-400 font-semibold">all bonus tiers unlocked</span>
              </>
            )
          ) : (
            "No daily habit tasks configured"
          )}
        </p>
      </div>

      {/* 3. Sticky Score Row Header */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-[#0b1020]/90 backdrop-blur-md border-b border-[#1e263d]/50 flex items-center justify-between shadow-sm">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            <AnimatedNumber value={todayTotalPoints} />
          </span>
          <span className="text-xs font-semibold text-muted">pts today</span>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-muted">
          <span className="text-sm">🔥</span>
          <span className="text-amber-500 font-bold">{currentStreak}</span>
          <span className="text-xs font-semibold text-muted">-day streak</span>
        </div>
      </div>

      {/* 4. Daily Checklist Section (Collapsible & 2-column responsive grid) */}
      {dailyChecklistTasks.length > 0 && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => setIsDailyChecklistOpen(!isDailyChecklistOpen)}
            className="w-full flex items-center justify-between text-left group py-1 select-none"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-muted tracking-wide group-hover:text-foreground transition-colors">
                Daily checklist
              </h2>
              <ChevronIcon
                className={`h-4 w-4 text-muted transition-transform duration-200 ${
                  isDailyChecklistOpen ? "rotate-180" : ""
                }`}
              />
            </div>
            <div className="px-2.5 py-0.5 rounded-lg bg-[#452713] border border-[#78350f] text-[#fed7aa] text-xs font-bold shadow-sm">
              {dailyChecklistPoints} pts
            </div>
          </button>

          {isDailyChecklistOpen && (
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {dailyChecklistTasks.map((task) => {
                const current = logState[task.id] || { completed: false, value: 0 };
                const isPenalty = task.points < 0;

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
                    className={`min-h-[52px] sm:min-h-[58px] px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border flex items-center justify-between gap-1.5 sm:gap-2 cursor-pointer select-none transition-all hover:bg-white/[0.03] active:scale-[0.98] shadow-sm ${
                      isPenalty
                        ? "border-[#6b2532] bg-[#16121f]"
                        : "border-[#1e263d] bg-[#121727]"
                    }`}
                  >
                    {/* Left: Checkbox */}
                    <div className="shrink-0 flex items-center justify-center">
                      {current.completed ? (
                        isPenalty ? (
                          <div className="h-4.5 w-4.5 sm:h-5 sm:w-5 rounded-md bg-[#ef4444] border border-[#ef4444] flex items-center justify-center shadow-sm">
                            <CheckIcon className="h-3 w-3 text-white animate-check" />
                          </div>
                        ) : (
                          <div className="h-4.5 w-4.5 sm:h-5 sm:w-5 rounded-md bg-[#22c55e] border border-[#22c55e] flex items-center justify-center shadow-sm">
                            <CheckIcon className="h-3 w-3 text-[#0b1020] animate-check" />
                          </div>
                        )
                      ) : (
                        <div
                          className={`h-4.5 w-4.5 sm:h-5 sm:w-5 rounded-md border-2 transition-colors ${
                            isPenalty ? "border-[#542d38]" : "border-[#3e4a68]"
                          }`}
                        />
                      )}
                    </div>

                    {/* Middle: Name */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-xs sm:text-sm font-medium leading-tight line-clamp-2 ${
                          current.completed
                            ? isPenalty
                              ? "line-through text-[#f87171]/80 font-normal"
                              : "line-through text-[#626c85] font-normal"
                            : "text-foreground"
                        }`}
                      >
                        {task.name}
                      </span>
                    </div>

                    {/* Right: Point value */}
                    <div className="shrink-0 text-right">
                      {isPenalty ? (
                        <span className="text-[#ef4444] font-bold text-xs sm:text-sm">
                          {task.points}
                        </span>
                      ) : (
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            current.completed ? "text-amber-500/60" : "text-amber-500"
                          }`}
                        >
                          +{task.points}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Movement Section (Collapsible, Mobile-Optimized & 5s Debounced) */}
      {dailyMovementTasks.length > 0 && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => setIsMovementOpen(!isMovementOpen)}
            className="w-full flex items-center justify-between text-left group py-1 select-none"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-muted tracking-wide group-hover:text-foreground transition-colors">
                Movement
              </h2>
              <ChevronIcon
                className={`h-4 w-4 text-muted transition-transform duration-200 ${
                  isMovementOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {isMovementOpen && (
            <div className="space-y-2.5 sm:space-y-3">
              {dailyMovementTasks.map((task) => {
                const liveValue = movementValues[task.id] ?? logState[task.id]?.value ?? 0;
                const unitRaw = task.unit || "reps";
                const isPenalty = task.points < 0;
                const threshold = task.bonusThreshold;
                const bonusPts = task.bonusPoints;
                const hasBonus = threshold && threshold > 0 && bonusPts;
                const progressPct = hasBonus
                  ? Math.min(100, Math.round((liveValue / threshold) * 100))
                  : 0;

                const cardPoints = numberTaskPoints(liveValue, task);

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-3 sm:p-4 space-y-3 shadow-sm transition-colors ${
                      isPenalty
                        ? "border-[#6b2532] bg-[#16121f]"
                        : "border-[#1e263d] bg-[#121727]"
                    }`}
                  >
                    {/* Card Header: Task name on left, points badge on right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm sm:text-base font-bold text-foreground">{task.name}</span>
                        {isPenalty && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3b181e] text-[#f87171] border border-[#59232a] shrink-0">
                            -pts
                          </span>
                        )}
                      </div>
                      <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-[#452713] border border-[#78350f] text-[#fed7aa] text-[11px] sm:text-xs font-bold shadow-sm">
                        {cardPoints} pts
                      </div>
                    </div>

                    {/* Stepper row: [ - ] [ Value & Unit Box ] [ + ] */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease reps"
                        onClick={() => handleMovementChange(task.id, Math.max(0, liveValue - 1))}
                        className="h-10 w-12 sm:h-11 sm:w-13 rounded-xl bg-white text-black hover:bg-zinc-200 active:scale-95 font-bold text-xl flex items-center justify-center transition-all shadow-sm shrink-0 select-none"
                      >
                        −
                      </button>

                      <div className="h-10 sm:h-11 flex-1 rounded-xl bg-[#0b0f19] border border-[#1e263d] flex items-center justify-center gap-1.5 px-3">
                        <span className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                          {liveValue}
                        </span>
                        <span className="text-xs sm:text-sm font-normal text-muted">
                          {unitRaw}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label="Increase reps"
                        onClick={() => handleMovementChange(task.id, liveValue + 1)}
                        className="h-10 w-12 sm:h-11 sm:w-13 rounded-xl bg-white text-black hover:bg-zinc-200 active:scale-95 font-bold text-xl flex items-center justify-center transition-all shadow-sm shrink-0 select-none"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick add buttons row + custom input */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {[1, 2, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleMovementChange(task.id, liveValue + n)}
                          className={`flex-1 min-w-[42px] rounded-lg sm:rounded-xl border py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-foreground active:scale-95 transition-all ${
                            isPenalty
                              ? "bg-[#251924] border-[#4d1f2b] hover:bg-[#322030]"
                              : "bg-[#1a2238] border-[#242e4d] hover:bg-[#202c48]"
                          }`}
                        >
                          +{n}
                        </button>
                      ))}
                      <CustomAmountInput
                        placeholder="Amount"
                        onSubmit={(n) => handleMovementChange(task.id, liveValue + n)}
                      />
                    </div>

                    {/* Bonus progress or penalty note */}
                    {isPenalty ? (
                      <p className="text-[11px] sm:text-xs text-[#f87171]">
                        {task.points} pts per {task.unitCount && task.unitCount > 1 ? `${task.unitCount} ` : ""}{unitRaw} logged
                      </p>
                    ) : hasBonus ? (
                      <div className="space-y-1">
                        <div className="h-1 sm:h-1.5 rounded-full bg-[#1b253b] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#06b6d4] transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        {liveValue < threshold ? (
                          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted">
                            <span className="text-[#38bdf8] text-xs">↻</span>
                            <span>
                              Add <span className="text-[#38bdf8] font-bold">{threshold - liveValue} {unitRaw}</span> more for a +{bonusPts}pts bonus
                            </span>
                          </div>
                        ) : (
                          <p className="text-[11px] sm:text-xs text-emerald-400 font-semibold">
                            ✓ +{bonusPts} bonus earned!
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Weekly Challenges Section (Collapsible) */}
      {weeklyTasks.length > 0 && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => setIsWeeklyOpen(!isWeeklyOpen)}
            className="w-full flex items-center justify-between text-left group py-1 select-none"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-muted tracking-wide group-hover:text-foreground transition-colors">
                Weekly challenges
              </h2>
              <ChevronIcon
                className={`h-4 w-4 text-muted transition-transform duration-200 ${
                  isWeeklyOpen ? "rotate-180" : ""
                }`}
              />
            </div>
            <span className="text-[11px] text-muted">Credited Sunday</span>
          </button>

          {isWeeklyOpen && (
            <div className="rounded-2xl border border-[#1e263d] bg-[#121727] divide-y divide-[#1e263d] overflow-hidden shadow-sm">
              {weeklyTasks.map((task) => {
                const current = logState[task.id] || { completed: false, value: 0 };
                const weekLogsForTask = weekLogs.filter(
                  (l) => l.taskId === task.id && formatDateKey(l.date) !== todayKey
                );
                const priorDone = weekLogsForTask.filter((l) => l.completed).length;
                const doneCount = priorDone + (current.completed ? 1 : 0);
                const target = task.target || 0;
                const isMet = target > 0 ? doneCount >= target : doneCount > 0;

                if (task.inputType === "NUMBER") {
                  const priorSum = weekLogsForTask.reduce((s, l) => s + (l.value || 0), 0);
                  const totalSum = Math.round((priorSum + current.value) * 10) / 10;
                  const unitRaw = task.unit || "unit";
                  const isPenalty = task.points < 0;
                  return (
                    <div
                      key={task.id}
                      className={`p-3 sm:p-4 space-y-3 ${
                        isPenalty ? "bg-[#16121f]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">{task.name}</span>
                            {isPenalty && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3b181e] text-[#f87171] border border-[#59232a] shrink-0">
                                -pts
                              </span>
                            )}
                          </div>
                          <p className={`text-xs ${isPenalty ? "text-[#f87171]" : "text-muted"}`}>
                            {task.points} pts / {task.unitCount && task.unitCount > 1 ? `${task.unitCount} ` : ""}{unitRaw} · Credited Sunday
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-foreground">
                            {totalSum} <span className="text-xs font-normal text-muted">{unitRaw}</span>
                          </span>
                          <p className="text-[11px] text-muted">This week</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[1, 2, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => saveWeeklyValue(task.id, current.value + n)}
                            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold text-foreground active:scale-95 transition-all ${
                              isPenalty
                                ? "bg-[#251924] border-[#4d1f2b] hover:bg-[#322030]"
                                : "bg-[#1a2238] border-[#242e4d] hover:bg-[#202c48]"
                            }`}
                          >
                            +{n}
                          </button>
                        ))}
                        <CustomAmountInput
                          placeholder="Amount"
                          onSubmit={(n) => saveWeeklyValue(task.id, current.value + n)}
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
                    className="min-h-[52px] sm:min-h-[56px] px-3.5 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
                  >
                    <div className="shrink-0 flex items-center justify-center">
                      {current.completed ? (
                        <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-[#22c55e] border border-[#22c55e] flex items-center justify-center">
                          <CheckIcon className="h-3.5 w-3.5 text-[#0b1020] animate-check" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-[#3e4a68] transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm ${
                            current.completed
                              ? "text-foreground font-medium"
                              : "text-muted font-normal"
                          }`}
                        >
                          {task.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1e293b] text-[#38bdf8] border border-[#334155] shrink-0">
                          Weekly
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {target > 0 ? (
                          <>
                            <span className={isMet ? "text-emerald-400 font-medium" : ""}>
                              {doneCount}/{target} days logged this week
                            </span>
                            {isMet ? " ✓" : ""} · Credited Sunday
                          </>
                        ) : (
                          "Logged today · Credited Sunday"
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs font-bold text-muted">
                        +{task.points} Sun
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomAmountInput({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (val: number) => void;
}) {
  const [text, setText] = useState("");

  function commit() {
    const n = parseFloat(text);
    if (!isNaN(n) && n > 0) {
      onSubmit(n);
      setText("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    commit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1 flex-1 min-w-[100px]">
      <input
        type="number"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        className="w-full rounded-lg sm:rounded-xl bg-[#1a2238] border border-[#242e4d] px-2.5 py-2 text-xs text-foreground placeholder:text-muted/60 outline-none focus:border-[#06b6d4]"
      />
      <button
        type="submit"
        aria-label="Add custom amount"
        className="rounded-lg sm:rounded-xl bg-[#1a2238] border border-[#242e4d] px-2.5 py-2 text-xs text-foreground hover:bg-[#202c48] active:scale-95 transition-all font-bold flex items-center justify-center shrink-0"
      >
        +
      </button>
    </form>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const duration = 400; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easedProgress);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    const handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, [value]);

  return <span>{displayValue}</span>;
}
