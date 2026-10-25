"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import type { TaskCategory } from "@/lib/leaderboard-tasks";

export interface TaskPointBreakdown {
  id: string;
  name: string;
  type: "DAILY" | "WEEKLY";
  inputType: "CHECKBOX" | "NUMBER";
  isRuleBreaker: boolean;
  isAlcoholTask: boolean;
  points: number;
  unit: string | null;
  unitCount: number | null;
  target: number | null;
  category: TaskCategory;
  todayPoints: number;
  weekPoints: number;
  overallPoints: number;
  loggedCount: number;
  totalValue: number;
}

export interface ChallengePointsBreakdown {
  challengeId: string;
  challengeName: string;
  totalPoints: number;
  taskPointsTotal: number;
  bonusPointsTotal: number;
  dailyBonusTotal: number;
  streakBonusTotal: number;
  leagueBonusTotal: number;
  tasks: TaskPointBreakdown[];
}

export interface TaskPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeBreakdowns: ChallengePointsBreakdown[];
  initialChallengeId?: string;
}

type Timeframe = "overall" | "week" | "today";
type SortOption = "points" | "completed" | "name";

const CATEGORY_META: Record<
  TaskCategory,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  movement: {
    label: "Movement",
    icon: "🏃",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.12)",
    border: "rgba(56, 189, 248, 0.25)",
  },
  food: {
    label: "Food",
    icon: "🥗",
    color: "#34d399",
    bg: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.25)",
  },
  mind: {
    label: "Mind & Habits",
    icon: "🧠",
    color: "#c084fc",
    bg: "rgba(192, 132, 252, 0.12)",
    border: "rgba(192, 132, 252, 0.25)",
  },
  weekly: {
    label: "Weekly",
    icon: "📅",
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.12)",
    border: "rgba(251, 191, 36, 0.25)",
  },
  penalty: {
    label: "Penalties",
    icon: "⚠️",
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.12)",
    border: "rgba(248, 113, 113, 0.25)",
  },
};

export function TaskPointsModal({
  isOpen,
  onClose,
  challengeBreakdowns,
  initialChallengeId,
}: TaskPointsModalProps) {
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    initialChallengeId || challengeBreakdowns[0]?.challengeId || ""
  );
  const [timeframe, setTimeframe] = useState<Timeframe>("overall");
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("points");
  const [showBonusBreakdown, setShowBonusBreakdown] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Sync selected challenge if initial challenge changes or falls back
  useEffect(() => {
    if (initialChallengeId) {
      setSelectedChallengeId(initialChallengeId);
    } else if (challengeBreakdowns[0]?.challengeId) {
      setSelectedChallengeId(challengeBreakdowns[0].challengeId);
    }
  }, [initialChallengeId, challengeBreakdowns]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const currentChallenge = useMemo(() => {
    return (
      challengeBreakdowns.find((c) => c.challengeId === selectedChallengeId) ??
      challengeBreakdowns[0] ??
      null
    );
  }, [challengeBreakdowns, selectedChallengeId]);

  // Distinct categories available in this challenge
  const availableCategories = useMemo(() => {
    if (!currentChallenge) return [];
    const catSet = new Set<TaskCategory>();
    currentChallenge.tasks.forEach((t) => catSet.add(t.category));
    const order: TaskCategory[] = ["movement", "food", "mind", "weekly", "penalty"];
    return order.filter((c) => catSet.has(c));
  }, [currentChallenge]);

  // Points selector helper
  const getTaskPoints = (t: TaskPointBreakdown) => {
    if (timeframe === "today") return t.todayPoints;
    if (timeframe === "week") return t.weekPoints;
    return t.overallPoints;
  };

  // Filter & sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    if (!currentChallenge) return [];

    let list = currentChallenge.tasks.filter((t) => {
      if (selectedCategory !== "all" && t.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return t.name.toLowerCase().includes(q);
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const aPts = getTaskPoints(a);
      const bPts = getTaskPoints(b);

      if (sortBy === "points") {
        if (bPts !== aPts) return bPts - aPts;
        if (b.overallPoints !== a.overallPoints) return b.overallPoints - a.overallPoints;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "completed") {
        if (b.loggedCount !== a.loggedCount) return b.loggedCount - a.loggedCount;
        return bPts - aPts;
      }
      // sortBy === "name"
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [currentChallenge, selectedCategory, searchQuery, sortBy, timeframe]);

  // Total points earned in the active timeframe across all tasks
  const timeframeTotalTaskPoints = useMemo(() => {
    if (!currentChallenge) return 0;
    return currentChallenge.tasks.reduce((sum, t) => sum + getTaskPoints(t), 0);
  }, [currentChallenge, timeframe]);

  // Max points for relative progress visualization
  const maxScore = useMemo(() => {
    if (!filteredAndSortedTasks.length) return 1;
    const max = Math.max(...filteredAndSortedTasks.map(getTaskPoints));
    return max > 0 ? max : 1;
  }, [filteredAndSortedTasks, timeframe]);

  if (!isOpen || !currentChallenge) return null;

  const taskPct =
    currentChallenge.totalPoints > 0
      ? Math.round(
          (currentChallenge.taskPointsTotal / currentChallenge.totalPoints) * 100
        )
      : 100;
  const bonusPct = Math.max(0, 100 - taskPct);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-points-title"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111a2e] border border-[#1f2a44] rounded-[22px] max-w-lg w-full flex flex-col max-h-[90vh] shadow-2xl relative overflow-hidden animate-[scaleIn_0.2s_ease-out]"
      >
        {/* Subtle Ambient Gold Glow Header Accent */}
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-64 h-36 bg-[#e8b73a]/15 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1f2a44] flex items-center justify-between shrink-0 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#e8b73a] font-mono">
                Points Record
              </span>
              <span className="text-[10px] text-[#8a97b2] font-mono">•</span>
              <span className="text-xs text-[#8a97b2] font-mono">
                {currentChallenge.tasks.length} tasks
              </span>
            </div>
            <h2
              id="task-points-title"
              className="font-display font-bold text-lg sm:text-xl text-[#e8ecf7] tracking-tight mt-0.5"
            >
              Task Points Breakdown
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#162038] hover:bg-[#1f2a44] text-[#8a97b2] hover:text-[#e8ecf7] flex items-center justify-center transition cursor-pointer"
            aria-label="Close dialog"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 2. Challenge Switcher (if user is in multiple challenges) */}
        {challengeBreakdowns.length > 1 && (
          <div className="px-4 sm:px-5 pt-3 pb-1 shrink-0 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-[#8a97b2] shrink-0 font-medium">
              Challenge:
            </span>
            {challengeBreakdowns.map((c) => {
              const active = c.challengeId === currentChallenge.challengeId;
              return (
                <button
                  key={c.challengeId}
                  type="button"
                  onClick={() => setSelectedChallengeId(c.challengeId)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition shrink-0 cursor-pointer ${
                    active
                      ? "bg-accent/20 border border-accent text-accent font-bold"
                      : "bg-[#162038] border border-[#1f2a44] text-[#8a97b2] hover:text-[#e8ecf7]"
                  }`}
                >
                  {c.challengeName}
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 3. Overall Points Summary Card */}
          <div className="bg-[#162038] border border-[#233150] rounded-2xl p-4 relative overflow-hidden shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#8a97b2] uppercase tracking-wider block">
                  Overall Score
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-display font-bold text-3xl text-[#e8b73a]">
                    {currentChallenge.totalPoints.toLocaleString()}
                  </span>
                  <span className="text-xs text-[#8a97b2] font-semibold">pts</span>
                </div>
              </div>

              {/* Timeframe selector pill */}
              <div className="flex items-center bg-[#111a2e] p-1 rounded-xl border border-[#1f2a44] text-xs">
                {(["overall", "week", "today"] as Timeframe[]).map((tf) => {
                  const active = timeframe === tf;
                  const label =
                    tf === "overall" ? "Overall" : tf === "week" ? "This Week" : "Today";
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer capitalize ${
                        active
                          ? "bg-[#e8b73a] text-[#0b1020] shadow-sm"
                          : "text-[#8a97b2] hover:text-[#e8ecf7]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual Point Composition Bar */}
            <div>
              <div className="h-2 w-full rounded-full bg-[#111a2e] overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-[#e8b73a] to-[#ffb35c] transition-all duration-300"
                  style={{ width: `${taskPct}%` }}
                  title={`Tasks: ${currentChallenge.taskPointsTotal} pts (${taskPct}%)`}
                />
                <div
                  className="h-full bg-gradient-to-r from-[#38bdf8] to-[#818cf8] transition-all duration-300"
                  style={{ width: `${bonusPct}%` }}
                  title={`Bonuses: ${currentChallenge.bonusPointsTotal} pts (${bonusPct}%)`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] mt-2 font-mono">
                <span className="text-[#e8b73a] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#e8b73a] inline-block" />
                  Tasks:{" "}
                  <strong className="text-[#e8ecf7]">
                    {currentChallenge.taskPointsTotal.toLocaleString()} pts
                  </strong>{" "}
                  ({taskPct}%)
                </span>

                <button
                  type="button"
                  onClick={() => setShowBonusBreakdown((prev) => !prev)}
                  className="text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  title="Click to toggle bonus breakdown"
                >
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block" />
                  Bonuses:{" "}
                  <strong className="text-[#e8ecf7]">
                    +{currentChallenge.bonusPointsTotal.toLocaleString()} pts
                  </strong>{" "}
                  ({bonusPct}%)
                  <span className="text-[10px] text-accent">
                    {showBonusBreakdown ? "▲" : "▼"}
                  </span>
                </button>
              </div>
            </div>

            {/* Expandable Bonus Details */}
            {showBonusBreakdown && (
              <div className="pt-2.5 border-t border-[#1f2a44] text-xs space-y-1.5 animate-fadeIn font-mono">
                <div className="flex justify-between items-center text-[#8a97b2]">
                  <span>Daily Checklist Completion:</span>
                  <span className="text-[#e8ecf7] font-semibold">
                    +{currentChallenge.dailyBonusTotal.toLocaleString()} pts
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#8a97b2]">
                  <span>Streak Milestones (7-day chain):</span>
                  <span className="text-[#e8ecf7] font-semibold">
                    +{currentChallenge.streakBonusTotal.toLocaleString()} pts
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#8a97b2]">
                  <span>Daily League Boost:</span>
                  <span className="text-[#e8ecf7] font-semibold">
                    +{currentChallenge.leagueBonusTotal.toLocaleString()} pts
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Controls Row: Search & Sort */}
          <div className="space-y-2.5">
            <div className="flex gap-2">
              {/* Search Bar */}
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a97b2] text-xs">
                  🔍
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full bg-[#162038] border border-[#1f2a44] rounded-xl pl-8 pr-8 py-2 text-xs text-[#e8ecf7] placeholder-[#8a97b2] outline-none focus:border-accent transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a97b2] hover:text-[#e8ecf7] text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="shrink-0 flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-[#162038] border border-[#1f2a44] rounded-xl px-2.5 py-2 text-xs text-[#e8ecf7] outline-none focus:border-accent cursor-pointer"
                  aria-label="Sort tasks by"
                >
                  <option value="points">Sort: Highest Points</option>
                  <option value="completed">Sort: Most Logged</option>
                  <option value="name">Sort: A to Z</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 cursor-pointer flex items-center gap-1 ${
                  selectedCategory === "all"
                    ? "bg-[#e8ecf7] text-[#0b1020] font-bold"
                    : "bg-[#162038] border border-[#1f2a44] text-[#8a97b2] hover:text-[#e8ecf7]"
                }`}
              >
                <span>All</span>
                <span className="opacity-75 text-[11px]">
                  ({currentChallenge.tasks.length})
                </span>
              </button>

              {availableCategories.map((catKey) => {
                const meta = CATEGORY_META[catKey];
                const active = selectedCategory === catKey;
                const count = currentChallenge.tasks.filter(
                  (t) => t.category === catKey
                ).length;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? "font-bold border"
                        : "bg-[#162038] border border-[#1f2a44] text-[#8a97b2] hover:text-[#e8ecf7]"
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: meta.bg,
                            borderColor: meta.border,
                            color: meta.color,
                          }
                        : {}
                    }
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="opacity-70 text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeframe Context Indicator */}
          <div className="flex items-center justify-between text-xs text-[#8a97b2] font-mono px-1">
            <span>
              {timeframe === "overall"
                ? "All-time points by task"
                : timeframe === "week"
                ? "Points scored this week"
                : "Points scored today"}
            </span>
            <span>
              {filteredAndSortedTasks.length} task
              {filteredAndSortedTasks.length === 1 ? "" : "s"} ·{" "}
              <strong className="text-[#e8b73a]">
                {timeframeTotalTaskPoints.toLocaleString()} pts
              </strong>
            </span>
          </div>

          {/* 5. Tasks List */}
          <div className="space-y-2">
            {filteredAndSortedTasks.length === 0 ? (
              <div className="bg-[#162038]/50 border border-dashed border-[#1f2a44] rounded-2xl p-8 text-center space-y-2">
                <span className="text-2xl block">🔍</span>
                <p className="text-sm font-semibold text-[#e8ecf7]">
                  No tasks found
                </p>
                <p className="text-xs text-[#8a97b2]">
                  Try clearing your search query or picking a different category.
                </p>
                {(searchQuery || selectedCategory !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                    className="text-xs text-accent font-semibold hover:underline pt-2 cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              filteredAndSortedTasks.map((task) => {
                const pts = getTaskPoints(task);
                const meta = CATEGORY_META[task.category];
                const pctOfMax = Math.max(
                  3,
                  Math.round((Math.max(0, pts) / maxScore) * 100)
                );

                return (
                  <div
                    key={task.id}
                    className="bg-[#0e1628] border border-[#1f2a44] hover:border-[#38bdf8]/40 p-3.5 rounded-xl transition-all duration-150 space-y-2 shadow-sm group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Icon & Name */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm border mt-0.5"
                          style={{
                            backgroundColor: meta.bg,
                            borderColor: meta.border,
                            color: meta.color,
                          }}
                          title={meta.label}
                        >
                          {meta.icon}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm text-[#e8ecf7] leading-tight group-hover:text-white transition">
                            {task.name}
                          </h3>

                          {/* Meta Tags */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-[#162038] text-[#8a97b2] border border-[#1f2a44]">
                              {task.type === "WEEKLY" ? "Weekly" : "Daily"}
                            </span>

                            {task.isRuleBreaker && (
                              <span className="px-1.5 py-0.5 rounded bg-[#f87171]/15 text-[#f87171] border border-[#f87171]/30 font-semibold">
                                Rule Breaker
                              </span>
                            )}

                            {task.inputType === "NUMBER" ? (
                              <span className="text-[#8a97b2]">
                                {task.totalValue > 0
                                  ? `${task.totalValue.toLocaleString()} ${
                                      task.unit ?? "units"
                                    } logged`
                                  : `+${task.points} pts / ${
                                      task.unitCount && task.unitCount > 1
                                        ? `${task.unitCount} `
                                        : ""
                                    }${task.unit ?? "unit"}`}
                              </span>
                            ) : (
                              <span className="text-[#8a97b2]">
                                {task.loggedCount > 0
                                  ? `Logged ${task.loggedCount} ${
                                      task.type === "WEEKLY" ? "weeks" : "days"
                                    }`
                                  : `+${task.points} pts / ${
                                      task.type === "WEEKLY" ? "week" : "day"
                                    }`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Points */}
                      <div className="text-right shrink-0">
                        <div className="flex items-baseline justify-end gap-1">
                          <span
                            className={`font-display font-bold text-lg leading-none ${
                              pts > 0
                                ? "text-[#e8b73a]"
                                : pts < 0
                                ? "text-[#f87171]"
                                : "text-[#8a97b2]"
                            }`}
                          >
                            {pts > 0 ? `+${pts.toLocaleString()}` : pts.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#8a97b2] font-mono">
                            pts
                          </span>
                        </div>

                        {/* Secondary breakdown indicator */}
                        <div className="text-[10px] text-[#8a97b2] font-mono mt-0.5">
                          {timeframe === "overall" ? (
                            task.weekPoints > 0 ? (
                              <span className="text-[#34d399]">
                                +{task.weekPoints} this week
                              </span>
                            ) : (
                              <span>overall</span>
                            )
                          ) : (
                            <span>overall: {task.overallPoints} pts</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mini contribution relative bar */}
                    {pts > 0 && (
                      <div className="w-full bg-[#162038] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#e8b73a] to-[#ffb35c] transition-all duration-300"
                          style={{ width: `${pctOfMax}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 6. Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#1f2a44] bg-[#0e1628]/80 flex items-center justify-between shrink-0">
          <p className="text-xs text-[#8a97b2] font-mono">
            {timeframe === "overall" ? (
              <>
                <strong className="text-[#e8ecf7]">
                  {currentChallenge.taskPointsTotal.toLocaleString()}
                </strong>{" "}
                task pts +{" "}
                <strong className="text-[#e8ecf7]">
                  {currentChallenge.bonusPointsTotal.toLocaleString()}
                </strong>{" "}
                bonuses
              </>
            ) : (
              <>
                Total task points in this view:{" "}
                <strong className="text-[#e8ecf7]">
                  {timeframeTotalTaskPoints.toLocaleString()} pts
                </strong>
              </>
            )}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#e8ecf7] text-[#0b1020] hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
