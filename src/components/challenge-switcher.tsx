"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StreakFlame } from "@/components/ui-helpers";
import type { UserChallengeSummary } from "@/lib/queries";

export function ChallengeSwitcher({
  challenges,
  activeChallengeId,
  className = "",
}: {
  challenges: UserChallengeSummary[];
  activeChallengeId?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const activeChallenge =
    challenges.find((c) => c.id === activeChallengeId) ||
    challenges[0] ||
    null;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectChallenge = (challengeId: string) => {
    if (challengeId === activeChallengeId) {
      setIsOpen(false);
      return;
    }

    // Set cookie for cross-page persistence
    document.cookie = `active_challenge_id=${encodeURIComponent(
      challengeId
    )}; path=/; max-age=31536000; SameSite=Lax`;

    setIsOpen(false);

    startTransition(() => {
      // Retain existing params if any, but replace or set `c`
      const params = new URLSearchParams(searchParams.toString());
      params.set("c", challengeId);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    });
  };

  if (!activeChallenge && challenges.length === 0) {
    return null;
  }

  const hasMultiple = challenges.length > 1;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Switcher Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left ${
          isOpen
            ? "bg-card border-accent shadow-lg shadow-accent/10"
            : "bg-card/80 hover:bg-card border-card-border hover:border-accent/50"
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            {activeChallenge?.isActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-muted" />
            )}
          </span>

          <div className="truncate max-w-[140px] sm:max-w-[200px]">
            <span className="text-xs font-semibold text-foreground truncate block">
              {activeChallenge?.name || "Select Challenge"}
            </span>
          </div>

          {activeChallenge && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted">
              {activeChallenge.currentStreak > 0 && (
                <span className="flex items-center text-accent">
                  {activeChallenge.currentStreak}
                  <StreakFlame className="inline ml-0.5 text-xs" />
                </span>
              )}
              <span className="bg-card-border/50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                {activeChallenge.points} pts
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1 text-muted group-hover:text-accent transition">
          {hasMultiple && (
            <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.2 rounded-full font-bold">
              {challenges.length}
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-accent" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-card/95 backdrop-blur-md border border-card-border shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-card-border/60 bg-background/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Your Challenges</p>
              <p className="text-[11px] text-muted">
                {challenges.length} challenge{challenges.length === 1 ? "" : "s"} joined
              </p>
            </div>
            <Link
              href="/challenges"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-semibold text-accent hover:underline"
            >
              Manage all
            </Link>
          </div>

          <div className="max-h-72 overflow-y-auto p-2 space-y-1 divide-y divide-card-border/30">
            {challenges.map((c) => {
              const isSelected = c.id === activeChallenge?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectChallenge(c.id)}
                  disabled={isPending}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-accent/15 border border-accent/40 text-foreground"
                      : "hover:bg-card-border/40 text-muted hover:text-foreground"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {c.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full font-bold">
                          Current
                        </span>
                      )}
                      {c.isAdmin && (
                        <span className="text-[10px] bg-card-border text-muted px-1.5 py-0.5 rounded font-medium">
                          Creator
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span className="flex items-center">
                        🔥 {c.currentStreak} day streak
                      </span>
                      <span>·</span>
                      <span>🏆 {c.points} pts</span>
                      <span>·</span>
                      <span>👥 {c.memberCount}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isSelected ? (
                      <div className="h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shadow">
                        ✓
                      </div>
                    ) : (
                      <span className="text-xs text-muted font-medium hover:text-accent">
                        Switch →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="p-2 border-t border-card-border/60 bg-background/50 grid grid-cols-2 gap-2">
            <Link
              href="/challenges/join"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-card border border-card-border text-xs font-semibold text-foreground hover:border-accent transition text-center"
            >
              <span>🔑</span> Join Challenge
            </Link>
            <Link
              href="/challenges/new"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-accent text-white text-xs font-semibold hover:brightness-110 transition text-center"
            >
              <span>✨</span> Create New
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
