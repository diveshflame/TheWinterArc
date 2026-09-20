"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveTaskLog } from "@/app/actions";
import {
  numberTaskPoints,
  DAILY_BONUS_POINTS,
  formatDateKey,
  type ChallengeTask,
  type TaskLog,
} from "@/lib/scoring";

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
  const [isPending, startTransition] = useTransition();
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
  const [saved, setSaved] = useState(false);
  const [savePulseKey, setSavePulseKey] = useState(0);

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

  function save(taskId: string, completed: boolean, value: number) {
    const task = tasks.find((t) => t.id === taskId);
    let bonus = 0;
    if (task?.inputType === "NUMBER") {
      bonus =
        task.type === "WEEKLY"
          ? weeklyBonus(task, value)
          : dailyBonus(task, value);
    }
    setLogState((prev) => ({
      ...prev,
      [taskId]: { completed, value },
    }));
    setSaved(true);
    setSavePulseKey((k) => k + 1);
    startTransition(() => {
      saveTaskLog(challengeId, taskId, completed, value, bonus).then(() => {
        router.refresh();
      });
    });
  }

  function toggle(taskId: string) {
    const current = logState[taskId] || { completed: false, value: 0 };
    save(taskId, !current.completed, current.value);
  }

  function addValue(taskId: string, amount: number) {
    const current = logState[taskId] || { completed: false, value: 0 };
    const nextVal = Math.max(0, Math.round((current.value + amount) * 10) / 10);
    save(taskId, nextVal > 0, nextVal);
  }

  function setValue(taskId: string, nextVal: number) {
    const validVal = Math.max(0, Math.round(nextVal * 10) / 10);
    save(taskId, validVal > 0, validVal);
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
            {isPending ? (
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

      {/* 3. Score Row */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-foreground tracking-tight">
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

      {/* 4. Daily Checklist Section */}
      {dailyChecklistTasks.length > 0 && (
        <div className="space-y-2 pt-1">
          <h2 className="text-xs font-semibold text-muted tracking-wide">Daily checklist</h2>
          <div className="rounded-2xl border border-[#1e263d] bg-[#121727] divide-y divide-[#1e263d] overflow-hidden shadow-sm">
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
                  className="min-h-[56px] px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
                >
                  {/* Left: Circular Checkbox */}
                  <div className="shrink-0 flex items-center justify-center">
                    {current.completed ? (
                      isPenalty ? (
                        <div className="h-6 w-6 rounded-full bg-[#ef4444] border border-[#ef4444] flex items-center justify-center">
                          <CheckIcon className="h-3.5 w-3.5 text-white animate-check" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-[#22c55e] border border-[#22c55e] flex items-center justify-center">
                          <CheckIcon className="h-3.5 w-3.5 text-[#0b1020] animate-check" />
                        </div>
                      )
                    ) : (
                      <div
                        className={`h-6 w-6 rounded-full border-2 transition-colors ${
                          isPenalty ? "border-[#542d38]" : "border-[#3e4a68]"
                        }`}
                      />
                    )}
                  </div>

                  {/* Middle: Label + Penalty Tag */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`text-sm ${
                        current.completed
                          ? isPenalty
                            ? "line-through text-[#f87171]/80 font-normal"
                            : "line-through text-[#626c85] font-normal"
                          : "text-foreground font-medium"
                      }`}
                    >
                      {task.name}
                    </span>
                    {isPenalty && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3b181e] text-[#f87171] border border-[#59232a] shrink-0">
                        -pts
                      </span>
                    )}
                  </div>

                  {/* Right: Point value */}
                  <div className="shrink-0 text-right">
                    {isPenalty ? (
                      <span className="text-[#ef4444] font-bold text-xs">
                        {task.points}
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-bold ${
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
        </div>
      )}

      {/* 5. Weekly Challenges Section */}
      {weeklyTasks.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted tracking-wide">
              Weekly challenges
            </h2>
            <span className="text-[11px] text-muted">Credited Sunday</span>
          </div>
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
                    className={`p-4 space-y-3 ${
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
                          onClick={() => addValue(task.id, n)}
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
                        onSubmit={(n) => setValue(task.id, current.value + n)}
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
                  className="min-h-[56px] px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
                >
                  <div className="shrink-0 flex items-center justify-center">
                    {current.completed ? (
                      <div className="h-6 w-6 rounded-full bg-[#22c55e] border border-[#22c55e] flex items-center justify-center">
                        <CheckIcon className="h-3.5 w-3.5 text-[#0b1020] animate-check" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-[#3e4a68] transition-colors" />
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
        </div>
      )}

      {/* 6. Daily Movement Section */}
      {dailyMovementTasks.length > 0 && (
        <div className="space-y-2 pt-2">
          <h2 className="text-xs font-semibold text-muted tracking-wide">Movement</h2>
          <div className="space-y-3">
            {dailyMovementTasks.map((task) => {
              const current = logState[task.id] || { completed: false, value: 0 };
              const unitRaw = task.unit || "reps";
              const isPenalty = task.points < 0;
              const threshold = task.bonusThreshold;
              const bonusPts = task.bonusPoints;
              const hasBonus = threshold && threshold > 0 && bonusPts;
              const progressPct = hasBonus
                ? Math.min(100, Math.round((current.value / threshold) * 100))
                : 0;

              return (
                <div
                  key={task.id}
                  className={`rounded-2xl border p-4 space-y-3 shadow-sm transition-colors ${
                    isPenalty
                      ? "border-[#6b2532] bg-[#16121f]"
                      : "border-[#1e263d] bg-[#121727]"
                  }`}
                >
                  {/* Card Header: Task name + penalty badge on left, Count + Unit on right */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-foreground">{task.name}</span>
                      {isPenalty && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3b181e] text-[#f87171] border border-[#59232a] shrink-0">
                          -pts
                        </span>
                      )}
                    </div>
                    <span className="text-base font-bold text-foreground shrink-0">
                      {current.value}{" "}
                      <span className="text-xs font-normal text-muted">{unitRaw}</span>
                    </span>
                  </div>

                  {/* Penalty indicator note if negative, or Progress bar + milestone bonus logic if positive */}
                  {isPenalty ? (
                    <p className="text-xs text-[#f87171]">
                      {task.points} pts per {task.unitCount && task.unitCount > 1 ? `${task.unitCount} ` : ""}{unitRaw} logged
                      {current.value > 0 && (
                        <span className="ml-1.5 font-bold">
                          ({task.points * current.value} pts)
                        </span>
                      )}
                    </p>
                  ) : hasBonus ? (
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-full bg-[#1b253b] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#06b6d4] transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {current.value < threshold ? (
                        <p className="text-xs text-muted">
                          Log{" "}
                          <span className="text-[#06b6d4] font-semibold">
                            {threshold - current.value} more {unitRaw}
                          </span>{" "}
                          for a +{bonusPts} bonus
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-400 font-semibold">
                          ✓ +{bonusPts} bonus earned!
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Actions row: Quick add buttons + Custom Amount input */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {[1, 2, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => addValue(task.id, n)}
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
                      onSubmit={(n) => setValue(task.id, current.value + n)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        className="w-24 rounded-xl bg-[#1a2238] border border-[#242e4d] px-3 py-2 text-xs text-foreground placeholder:text-muted/60 outline-none focus:border-[#06b6d4]"
      />
      <button
        type="submit"
        aria-label="Add custom amount"
        className="rounded-xl bg-[#1a2238] border border-[#242e4d] px-3 py-2 text-xs text-foreground hover:bg-[#202c48] active:scale-95 transition-all font-bold flex items-center justify-center"
      >
        +
      </button>
    </form>
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
