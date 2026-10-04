"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import {
  updateUserMantra,
  updateUserProfile,
  useStreakInsurance,
  markLeagueCelebrated,
} from "@/app/actions";
import { getLeagueState } from "@/lib/leagues";
import {
  LeagueEmblemCard,
  LeagueRoad,
  RankStrip,
  RankUpModal,
} from "@/components/league-components";

export interface UserSummaryLog {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  completedCount: number;
  totalCount: number;
  pointsAwarded: number;
  dailyBonusAwarded: boolean;
}

export interface ActiveMembershipData {
  id: string;
  points: number;
  currentStreak: number;
  challenge: {
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    tasks: {
      id: string;
      name: string;
      points: number;
      type: string;
    }[];
  };
  todayLogs: { taskId: string; completed: boolean }[];
}

export interface ProfileClientProps {
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
    image: string | null;
    totalPoints: number;
    peakLeaguePoints?: number;
    lastCelebratedLeague?: string | null;
    currentStreak: number;
    longestStreak: number;
    mantra: string | null;
    streakTokens: number | null;
  };
  challengeName?: string;
  stats: {
    daysLogged: number;
    perfectDays: number;
    avgCompletion: number;
  };
  summaries: UserSummaryLog[];
  activeMemberships: ActiveMembershipData[];
}

export function ProfileClient({
  user,
  challengeName = "Winter Arc 2026",
  stats,
  summaries,
  activeMemberships,
}: ProfileClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Avatar upload file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userImage, setUserImage] = useState<string | null>(user.image);

  // Display Name inline editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameText, setDisplayNameText] = useState(
    user.displayName || user.name || "Divesh Shetty"
  );

  // Mantra inline editing
  const [isEditingMantra, setIsEditingMantra] = useState(false);
  const [mantraText, setMantraText] = useState(
    user.mantra || "I always win"
  );

  // Modals state
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insuranceStatus, setInsuranceStatus] = useState<string | null>(null);
  const [showRecapModal, setShowRecapModal] = useState(false);

  // League State & Sticky Rank Strip state
  const peakPoints = user.peakLeaguePoints ?? user.totalPoints ?? 0;
  const leagueState = getLeagueState(peakPoints);

  const [showStickyStrip, setShowStickyStrip] = useState(false);
  const emblemCardRef = useRef<HTMLElement | null>(null);

  // Rank-up celebration modal
  const [showRankUpModal, setShowRankUpModal] = useState(false);

  useEffect(() => {
    // Check if current league/division was celebrated
    const storageKey = `winter_arc_celebrated_${user.id}`;
    const lastCelebrated =
      localStorage.getItem(storageKey) || user.lastCelebratedLeague;

    if (
      lastCelebrated &&
      lastCelebrated !== leagueState.title &&
      peakPoints > 0
    ) {
      setShowRankUpModal(true);
    }
  }, [user.id, leagueState.title, user.lastCelebratedLeague, peakPoints]);

  function handleDismissRankUp() {
    setShowRankUpModal(false);
    const storageKey = `winter_arc_celebrated_${user.id}`;
    try {
      localStorage.setItem(storageKey, leagueState.title);
    } catch (_e) {
      // Ignore localStorage errors
    }
    markLeagueCelebrated(leagueState.title);
  }

  // IntersectionObserver for Emblem Card to trigger sticky RankStrip
  useEffect(() => {
    const el = emblemCardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When emblem card is out of view (bounding client top < 0), show sticky strip
        setShowStickyStrip(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Inline challenge expansion
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);

  // Proof wall day inspector & filter state
  const [selectedDayLog, setSelectedDayLog] = useState<UserSummaryLog | null>(null);
  const [filterPerfectDaysOnly, setFilterPerfectDaysOnly] = useState(false);

  // Long press timer ref for challenge card
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Handle Avatar file selection
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUserImage(base64);
      startTransition(() => {
        updateUserProfile({ image: base64 }).then(() => {
          router.refresh();
        });
      });
    };
    reader.readAsDataURL(file);
  }

  // Handle Display Name save
  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setIsEditingName(false);
    startTransition(() => {
      updateUserProfile({ displayName: displayNameText }).then(() => {
        router.refresh();
      });
    });
  }

  // Handle Mantra save
  function handleSaveMantra(e: React.FormEvent) {
    e.preventDefault();
    setIsEditingMantra(false);
    startTransition(() => {
      updateUserMantra(mantraText).then(() => {
        router.refresh();
      });
    });
  }

  // Streak insurance redemption
  function handleUseStreakInsurance() {
    setInsuranceStatus(null);
    startTransition(() => {
      useStreakInsurance().then((res) => {
        if (res.ok) {
          setInsuranceStatus("Streak protected successfully! 🔥");
          router.refresh();
        } else {
          setInsuranceStatus(res.error || "Failed to redeem streak insurance.");
        }
      });
    });
  }

  // Generate 14-day mosaic dates aligned with user summaries
  const today = new Date();
  const mosaicDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const summary = summaries.find((s) => {
      const sDateStr = s.date.slice(0, 10);
      const sObj = new Date(s.date);
      const sY = sObj.getFullYear();
      const sM = String(sObj.getMonth() + 1).padStart(2, "0");
      const sD = String(sObj.getDate()).padStart(2, "0");
      const sKey = `${sY}-${sM}-${sD}`;
      return sKey === dateKey || sDateStr === dateKey;
    });

    return {
      dateKey,
      displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      summary,
    };
  });

  const levelCount = Math.max(1, stats.daysLogged);
  const streakActive = user.currentStreak > 0;

  // Calculate dynamic date range from summaries
  let recentDatesRange = "Ongoing";
  if (summaries.length > 0) {
    const sorted = [...summaries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const startStr = new Date(sorted[0].date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = new Date(sorted[sorted.length - 1].date).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" }
    );
    recentDatesRange =
      sorted.length === 1 || startStr === endStr
        ? startStr
        : `${startStr}–${endStr.split(" ")[1] ?? endStr}`;
  }

  const currentWeekNumber = Math.max(1, Math.ceil(stats.daysLogged / 7));

  // Compute days logged this week
  const thisWeekStart = new Date(today);
  const dayOfWeek = (thisWeekStart.getDay() + 6) % 7;
  thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);
  thisWeekStart.setHours(0, 0, 0, 0);
  const thisWeekKey = `${thisWeekStart.getFullYear()}-${String(thisWeekStart.getMonth() + 1).padStart(2, "0")}-${String(thisWeekStart.getDate()).padStart(2, "0")}`;

  const thisWeekDaysSet = new Set(
    summaries
      .filter((s) => s.date.slice(0, 10) >= thisWeekKey)
      .map((s) => s.date.slice(0, 10))
  );
  const daysLoggedThisWeek = thisWeekDaysSet.size;

  return (
    <div className="min-h-screen text-[#e8ecf7] px-4 sm:px-5 pt-0 pb-16 font-sans space-y-3.5 max-w-md mx-auto relative">
      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 1. Header */}
      <header className="flex items-center justify-between pt-0 pb-0.5">
        <button
          onClick={() => router.back()}
          className="text-lg text-[#8a97b2] hover:text-[#e8ecf7] transition px-2 py-1 cursor-pointer"
          aria-label="Back"
        >
          ‹
        </button>
        <h1 className="font-display font-bold text-sm tracking-[0.25em] text-[#e8ecf7] uppercase">
          PROFILE
        </h1>
        <button
          onClick={() => setIsEditingName(true)}
          className="text-xs font-semibold text-[#e8b73a] hover:underline cursor-pointer px-2 py-1"
        >
          Edit
        </button>
      </header>

      {/* 2. Identity Section */}
      <section className="flex flex-col items-center text-center space-y-2 pt-0">
        {/* Avatar Trigger */}
        <button
          onClick={handleAvatarClick}
          className="relative group cursor-pointer focus:outline-none"
          title="Click to change profile picture"
        >
          <div
            className="w-18 h-18 rounded-full bg-[#162038] border-2 border-dashed flex items-center justify-center overflow-hidden shadow-lg transition transform group-hover:scale-105"
            style={{ borderColor: `${leagueState.league.color}70` }}
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-8 h-8 text-[#8a97b2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-[#ff5f3a] text-white p-1 rounded-full text-[10px] shadow group-hover:brightness-110 flex items-center justify-center w-5 h-5 border border-[#0b1020]">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M68 9a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-3.172a2 2 0 01-1.414-.586l-1.828-1.828A2 2 0 0011.172 6H8.828a2 2 0 00-1.414.586L5.586 8.414A2 2 0 014.172 9H4z" />
              <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </button>

        {/* Display Name with Pencil Icon */}
        {isEditingName ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-2">
            <input
              type="text"
              value={displayNameText}
              onChange={(e) => setDisplayNameText(e.target.value)}
              className="bg-[#111a2e] border border-accent rounded-xl px-3 py-1 text-sm font-display font-bold text-[#e8ecf7] text-center outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={isPending}
              className="bg-accent text-white text-xs px-2.5 py-1 rounded-lg font-bold"
            >
              Save
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5 justify-center">
            <h2 className="font-display font-bold text-xl text-[#e8ecf7] tracking-wide">
              {displayNameText}
            </h2>
            <button
              onClick={() => setIsEditingName(true)}
              className="p-1 opacity-70 hover:opacity-100 text-[#8a97b2] hover:text-[#e8b73a] transition cursor-pointer"
              title="Edit name"
              aria-label="Edit name"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}

        <p className="text-xs text-[#8a97b2] font-mono tracking-tight">
          {user.email}
        </p>
      </section>

      {/* 3. Emblem Card */}
      <div ref={(el) => { emblemCardRef.current = el; }}>
        <LeagueEmblemCard state={leagueState} />
      </div>

      {/* 4. Quote Card */}
      <section className="bg-[#111a2e] border border-[#1f2a44] p-3.5 rounded-[14px] flex items-center justify-between shadow-sm">
        {isEditingMantra ? (
          <form onSubmit={handleSaveMantra} className="flex-1 flex gap-2">
            <input
              type="text"
              value={mantraText}
              onChange={(e) => setMantraText(e.target.value)}
              className="flex-1 bg-[#162038] border border-accent rounded-xl px-3 py-1.5 text-xs text-[#e8ecf7] outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={isPending}
              className="bg-accent text-white text-xs px-3 py-1.5 rounded-xl font-bold"
            >
              Save
            </button>
          </form>
        ) : (
          <div
            onClick={() => setIsEditingMantra(true)}
            className="flex-1 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2 pr-2">
              <span className="text-[#ff5f3a] font-serif text-lg font-bold leading-none">
                “
              </span>
              <p className="text-xs text-[#e8ecf7] font-semibold leading-tight">
                {mantraText}
              </p>
            </div>
            <button
              type="button"
              className="p-1 opacity-70 hover:opacity-100 text-[#8a97b2] hover:text-[#e8b73a] transition cursor-pointer shrink-0"
              title="Edit quote"
              aria-label="Edit quote"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
      </section>

      {/* 5. Stats Row: Points, Streak, Active */}
      <section className="grid grid-cols-3 gap-3">
        {/* Points Medallion */}
        <div className="bg-[#111a2e] border border-[#1f2a44] p-3.5 rounded-[14px] flex flex-col items-center justify-center text-center shadow-sm">
          <span className="font-display font-bold text-2xl text-[#e8b73a]">
            {user.totalPoints.toLocaleString()}
          </span>
          <span className="text-[11px] font-medium text-[#8a97b2] mt-0.5">Points</span>
        </div>

        {/* Streak Medallion */}
        <button
          onClick={() => setShowInsuranceModal(true)}
          className="bg-[#111a2e] border border-[#1f2a44] p-3.5 rounded-[14px] flex flex-col items-center justify-center text-center shadow-sm hover:border-[#ff5f3a]/40 transition cursor-pointer"
        >
          <span className="font-display font-bold text-2xl text-[#ff5f3a]">
            {user.currentStreak}
          </span>
          <span className="text-[11px] font-medium text-[#8a97b2] mt-0.5">Streak</span>
        </button>

        {/* Active Challenges Medallion */}
        <div className="bg-[#111a2e] border border-[#1f2a44] p-3.5 rounded-[14px] flex flex-col items-center justify-center text-center shadow-sm">
          <span className="font-display font-bold text-2xl text-[#e8ecf7]">
            {activeMemberships.length}
          </span>
          <span className="text-[11px] font-medium text-[#8a97b2] mt-0.5">Active</span>
        </div>
      </section>

      {/* 6. League Road */}
      <LeagueRoad
        currentPoints={peakPoints}
        challengeName={challengeName}
      />

      {/* 7. Sticky Rank Strip */}
      <RankStrip state={leagueState} visible={showStickyStrip} />

      {/* 8. Rank-Up Celebration Modal */}
      <RankUpModal
        leagueState={leagueState}
        isOpen={showRankUpModal}
        onClose={handleDismissRankUp}
      />

      {/* 9. Proof (14-day Heatmap Wall) */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <h2 className="font-display font-bold text-sm text-[#e8ecf7] tracking-wide">
            Proof
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterPerfectDaysOnly((prev) => !prev)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition cursor-pointer ${
                filterPerfectDaysOnly
                  ? "bg-[#e8b73a]/20 border-[#e8b73a] text-[#e8b73a]"
                  : "border-[#1f2a44] text-[#8a97b2] hover:text-[#e8ecf7]"
              }`}
            >
              {filterPerfectDaysOnly ? "★ Perfect only" : "All days"}
            </button>
            <span className="text-[#8a97b2]">14-day record</span>
          </div>
        </div>

        <div className="bg-[#111a2e] p-4 rounded-[14px] border border-[#1f2a44] shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            {mosaicDays.map((day, idx) => {
              const summary = day.summary;
              const hasLog = !!summary;
              const isPerfect = summary?.dailyBonusAwarded;
              const points = summary?.pointsAwarded || 0;
              const isSelected = selectedDayLog?.id === summary?.id && hasLog;

              let tileBg = "bg-[#162038] border border-[#1f2a44]";
              if (hasLog) {
                if (isPerfect) {
                  tileBg = "bg-[#e8b73a] text-[#0b1020] font-bold border-none shadow-[0_0_8px_rgba(232,183,58,0.4)]";
                } else if (points > 0) {
                  tileBg = "bg-[#38bdf8] text-[#0b1020] font-bold border-none";
                } else {
                  tileBg = "bg-[#1c2742] border border-[#24314f] text-[#8a97b2]";
                }
              }

              if (filterPerfectDaysOnly && !isPerfect) {
                tileBg = "bg-[#162038]/40 border border-[#1f2a44]/50 opacity-40";
              }

              return (
                <button
                  key={idx}
                  onClick={() => hasLog && setSelectedDayLog(summary)}
                  disabled={!hasLog}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center text-[10px] transition transform active:scale-95 ${tileBg} ${
                    isSelected ? "ring-2 ring-white" : ""
                  }`}
                  title={`${day.displayDate}: ${points} pts`}
                >
                  <span className="leading-tight font-mono text-[9px] opacity-75">
                    {day.displayDate.split(" ")[1]}
                  </span>
                  <span className="font-bold leading-none">
                    {hasLog ? (isPerfect ? "★" : points) : "·"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Day Inspector Details */}
          {selectedDayLog && (
            <div className="mt-3.5 pt-3 border-t border-[#1f2a44] flex items-center justify-between text-xs font-mono animate-fadeIn">
              <div>
                <p className="text-[#e8ecf7] font-bold">
                  {new Date(selectedDayLog.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="text-[11px] text-[#8a97b2]">
                  {selectedDayLog.completedCount}/{selectedDayLog.totalCount} tasks completed
                  {selectedDayLog.dailyBonusAwarded && " · Perfect Day ★"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-accent font-bold text-sm">
                  +{selectedDayLog.pointsAwarded} pts
                </span>
                <button
                  onClick={() => setSelectedDayLog(null)}
                  className="block text-[10px] text-[#8a97b2] hover:underline mt-0.5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 10. Record Stats Grid */}
      <section className="space-y-2.5 pt-1">
        <h2 className="font-display font-bold text-sm text-[#e8ecf7] tracking-wide font-mono">
          Record
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111a2e] p-3.5 rounded-[14px] border border-[#1f2a44] text-center shadow-sm">
            <span className="text-xl font-bold font-display text-[#e8ecf7]">
              {stats.daysLogged}
            </span>
            <p className="text-[11px] text-[#8a97b2] mt-0.5 font-medium">Days Logged</p>
          </div>
          <div className="bg-[#111a2e] p-3.5 rounded-[14px] border border-[#1f2a44] text-center shadow-sm">
            <span className="text-xl font-bold font-display text-[#e8b73a]">
              {stats.perfectDays}
            </span>
            <p className="text-[11px] text-[#8a97b2] mt-0.5 font-medium">Perfect Days</p>
          </div>
          <div className="bg-[#111a2e] p-3.5 rounded-[14px] border border-[#1f2a44] text-center shadow-sm">
            <span className="text-xl font-bold font-display text-accent">
              {stats.avgCompletion}%
            </span>
            <p className="text-[11px] text-[#8a97b2] mt-0.5 font-medium">Avg Completion</p>
          </div>
          <div className="bg-[#111a2e] p-3.5 rounded-[14px] border border-[#1f2a44] text-center shadow-sm">
            <span className="text-xl font-bold font-display text-[#ff5f3a]">
              {user.longestStreak}
            </span>
            <p className="text-[11px] text-[#8a97b2] mt-0.5 font-medium">Longest Streak</p>
          </div>
        </div>
      </section>

      {/* 11. Week Recap Trigger */}
      <section className="pt-1">
        <button
          onClick={() => setShowRecapModal(true)}
          className="w-full bg-[#111a2e] border border-[#1f2a44] hover:border-accent/40 p-4 rounded-[14px] flex items-center justify-between text-left transition cursor-pointer shadow-sm group"
        >
          <div>
            <h3 className="font-display font-bold text-sm text-[#e8ecf7] group-hover:text-accent transition">
              Week {currentWeekNumber} Recap
            </h3>
            <p className="text-xs text-[#8a97b2] mt-0.5 font-mono">
              {stats.daysLogged} days logged · Summary & badges
            </p>
          </div>
          <span className="text-accent text-sm font-semibold">
            View →
          </span>
        </button>
      </section>

      {/* 12. Sign Out Button */}
      <section className="pt-3">
        <SignOutButton />
      </section>

      {/* Streak Insurance Modal */}
      {showInsuranceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111a2e] border border-[#1f2a44] rounded-2xl max-w-sm w-full p-5 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#ff5f3a]/20 text-[#ff5f3a] flex items-center justify-center mx-auto text-2xl">
              🔥
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[#e8ecf7]">
                Streak Protection
              </h3>
              <p className="text-xs text-[#8a97b2] mt-1">
                Protect your current streak if you missed logging yesterday.
              </p>
            </div>

            <div className="bg-[#162038] border border-[#1f2a44] p-3 rounded-xl text-xs space-y-1">
              <p className="text-[#e8ecf7] font-semibold">
                Available Tokens: {user.streakTokens ?? 1}
              </p>
              <p className="text-[11px] text-[#8a97b2]">
                Costs 1 Token or 50 Points.
              </p>
            </div>

            {insuranceStatus && (
              <p className="text-xs font-semibold text-accent">
                {insuranceStatus}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowInsuranceModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[#162038] text-[#8a97b2] hover:text-[#e8ecf7]"
              >
                Close
              </button>
              <button
                onClick={handleUseStreakInsurance}
                disabled={isPending}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#ff5f3a] text-white hover:brightness-110"
              >
                {isPending ? "Applying..." : "Use Protection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recap Modal */}
      {showRecapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111a2e] border border-[#1f2a44] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f2a44] pb-3">
              <h3 className="font-display font-bold text-base text-[#e8ecf7]">
                Week {currentWeekNumber} Recap
              </h3>
              <button
                onClick={() => setShowRecapModal(false)}
                className="text-[#8a97b2] hover:text-[#e8ecf7] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1f2a44]/50">
                <span className="text-[#8a97b2]">Days completed</span>
                <span className="font-bold text-[#e8ecf7]">{stats.daysLogged} days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1f2a44]/50">
                <span className="text-[#8a97b2]">This week</span>
                <span className="font-bold text-accent">{daysLoggedThisWeek} / 7 days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1f2a44]/50">
                <span className="text-[#8a97b2]">Perfect days logged</span>
                <span className="font-bold text-[#e8b73a]">{stats.perfectDays}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1f2a44]/50">
                <span className="text-[#8a97b2]">Current League</span>
                <span
                  className="font-bold"
                  style={{ color: leagueState.league.textColor || leagueState.league.color }}
                >
                  {leagueState.title}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8a97b2]">Daily Bonus</span>
                <span className="font-bold text-accent">+{leagueState.league.dailyBonus} pts/day</span>
              </div>
            </div>

            <button
              onClick={() => setShowRecapModal(false)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:brightness-110 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
