"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  type LeagueState,
  type LeagueConfig,
  LEAGUES,
  getLeagueState,
} from "@/lib/leagues";
import { LeagueIcon } from "@/components/league-icons";

// ---------------------------------------------------------------------------
// 1. LeagueBadge
// ---------------------------------------------------------------------------
export function LeagueBadge({
  league,
  division,
  size = "md",
  className = "",
}: {
  league: LeagueConfig;
  division?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-2 py-0.5 gap-1"
      : size === "lg"
      ? "text-sm px-3.5 py-1.5 gap-2"
      : "text-xs px-2.5 py-1 gap-1.5";

  const iconSizes = size === "sm" ? 12 : size === "lg" ? 18 : 14;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${sizeClasses} ${className}`}
      style={{
        backgroundColor: `${league.color}15`,
        borderColor: `${league.color}35`,
        color: league.textColor || league.color,
      }}
    >
      <LeagueIcon type={league.icon} size={iconSizes} />
      <span>
        {league.name}
        {division ? ` ${division}` : ""}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// 2. PersonaLabel
// ---------------------------------------------------------------------------
export function PersonaLabel({
  league,
  className = "",
}: {
  league: LeagueConfig;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}
      style={{ color: league.textColor || league.color }}
    >
      <LeagueIcon type={league.icon} size={13} className="shrink-0" />
      <span className="truncate">{league.persona}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// 3. LeagueEmblemCard
// ---------------------------------------------------------------------------
export function LeagueEmblemCard({
  state,
  onElementRef,
}: {
  state: LeagueState;
  onElementRef?: (el: HTMLElement | null) => void;
}) {
  const { league, division, title, pointsToNext, nextStep, progressPerDivision } = state;
  const isLegend = league.key === "legend";

  const ariaLabel = isLegend
    ? "Max league reached: Legend"
    : `${pointsToNext} points to ${nextStep}`;

  return (
    <section
      ref={onElementRef}
      className="bg-[#111a2e] border border-[#1f2a44] rounded-[18px] p-6 text-center shadow-lg relative overflow-hidden"
    >
      {/* Background ambient glow matching league color */}
      <div
        className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: league.color }}
      />

      {/* Large Emblem Circle with Dashed Outer Ring */}
      <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
        {/* Outer Dashed Ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed transition-all duration-500 animate-[spin_60s_linear_infinite]"
          style={{ borderColor: `${league.color}55` }}
        />
        {/* Inner Solid Circle */}
        <div
          className="w-18 h-18 rounded-full flex items-center justify-center shadow-inner border transition-all duration-300"
          style={{
            backgroundColor: "#162038",
            borderColor: `${league.color}60`,
            boxShadow: `0 0 20px ${league.color}25`,
          }}
        >
          <LeagueIcon
            type={league.icon}
            size={36}
            style={{ color: league.textColor || league.color }}
          />
        </div>
      </div>

      {/* League & Division Title */}
      <h2 className="text-2xl font-bold font-display tracking-tight text-[#e8ecf7]">
        {title}
      </h2>

      {/* Persona and Daily Bonus Line */}
      <p className="text-xs text-[#8a97b2] font-medium mt-1">
        <span>{league.persona}</span>
        <span className="mx-1.5">·</span>
        <span
          className="font-semibold"
          style={{ color: league.textColor || league.color }}
        >
          +{league.dailyBonus} pts/day
        </span>
      </p>

      {/* 3 Progress Segments for Divisions */}
      <div
        className="grid grid-cols-3 gap-1.5 mt-5 mb-2.5"
        role="progressbar"
        aria-valuenow={Math.round(state.leagueProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        {progressPerDivision.map((val, idx) => (
          <div
            key={idx}
            className="h-1.5 rounded-full bg-[#1c2742] overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(val * 100)}%`,
                backgroundColor: league.color,
                boxShadow: val > 0 ? `0 0 8px ${league.color}80` : "none",
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. LeagueRoad
// ---------------------------------------------------------------------------
export function LeagueRoad({
  currentPoints,
  challengeName = "Winter Arc 2026",
}: {
  currentPoints: number;
  challengeName?: string;
}) {
  const currentState = getLeagueState(currentPoints);
  const currentKey = currentState.league.key;

  const currentLeagueIndex = LEAGUES.findIndex((l) => l.key === currentKey);

  return (
    <section className="space-y-2.5 pt-1">
      <div className="flex items-center justify-between font-mono text-xs">
        <h2 className="font-display font-bold text-sm text-[#e8ecf7] tracking-wide">
          League road
        </h2>
        <span className="text-[#8a97b2]">{challengeName}</span>
      </div>

      <div className="bg-[#111a2e] border border-[#1f2a44] rounded-[18px] p-5 shadow-lg relative">
        <div className="space-y-6 relative">
          {/* Vertical Connecting Track Line */}
          <div className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-[#1f2a44]" />

          {LEAGUES.map((league, idx) => {
            const isReached = currentPoints >= league.minPoints;
            const isCurrentLeague = idx === currentLeagueIndex;
            const isNextLeague = idx === currentLeagueIndex + 1;
            const isLocked = idx > currentLeagueIndex + 1;
            const isLegend = league.key === "legend";

            return (
              <React.Fragment key={league.key}>
                {/* Dynamic "You · N pts" Marker between reached and next */}
                {isCurrentLeague && idx < LEAGUES.length - 1 && (
                  <div className="relative flex items-center gap-3 pl-1.5 py-1 z-10">
                    <div className="w-6 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f3a] ring-4 ring-[#111a2e] shadow-[0_0_8px_#ff5f3a]" />
                    </div>
                    <span className="text-xs font-bold text-[#ff5f3a]">
                      You · {currentPoints} pts
                    </span>
                  </div>
                )}

                <div className="relative flex items-start gap-3.5 z-10">
                  {/* Node Circle */}
                  <div className="shrink-0 pt-0.5">
                    {isReached ? (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white ring-4 ring-[#111a2e] shadow-md"
                        style={{
                          backgroundColor:
                            isLegend ? "#ff8a3d" : "#0284c7",
                        }}
                      >
                        {isLegend ? (
                          <LeagueIcon type="crown" size={18} className="text-white" />
                        ) : (
                          <svg
                            className="w-4 h-4 stroke-[3]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    ) : isNextLeague ? (
                      <div
                        className="w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center ring-4 ring-[#111a2e] bg-[#162038]"
                        style={{ borderColor: league.color }}
                      >
                        <LeagueIcon
                          type={league.icon}
                          size={18}
                          style={{ color: league.color }}
                        />
                      </div>
                    ) : isLegend ? (
                      <div className="w-9 h-9 rounded-full border-2 border-[#e8b73a]/50 flex items-center justify-center ring-4 ring-[#111a2e] bg-[#162038]">
                        <LeagueIcon
                          type="crown"
                          size={18}
                          className="text-[#e8b73a]"
                        />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full border border-[#2b3856] flex items-center justify-center ring-4 ring-[#111a2e] bg-[#162038] text-[#55617d]">
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
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* League Node Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="font-display font-bold text-sm"
                        style={{
                          color: isLegend
                            ? "#ffb35c"
                            : isReached || isNextLeague
                            ? "#e8ecf7"
                            : "#8a97b2",
                        }}
                      >
                        {league.name}
                      </h3>
                      <span className="text-xs text-[#8a97b2] font-mono">
                        · {league.minPoints.toLocaleString()} pts
                      </span>
                    </div>

                    {/* Subtitle / Tags */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {idx === 0 ? (
                        <span className="text-xs text-[#8a97b2]">
                          Starting league
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#162038] text-[#8a97b2] border border-[#233150]">
                            +{league.dailyBonus} pt{league.dailyBonus === 1 ? "" : "s"}/day
                          </span>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: `${league.color}15`,
                              borderColor: `${league.color}35`,
                              color: league.textColor || league.color,
                            }}
                          >
                            {league.persona}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. RankStrip (Sticky Bar when emblem scrolled out of view)
// ---------------------------------------------------------------------------
export function RankStrip({
  state,
  visible,
}: {
  state: LeagueState;
  visible: boolean;
}) {
  if (!visible) return null;

  const { league, title, currentPoints, nextThreshold, leagueProgress } = state;
  const isLegend = league.key === "legend";

  const progressTarget = nextThreshold ?? league.minPoints;

  return (
    <div
      className="fixed bottom-18 md:bottom-6 inset-x-4 max-w-md mx-auto z-20 transition-all duration-300 transform translate-y-0"
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div className="bg-[#111a2e]/95 backdrop-blur-md border border-[#1f2a44] rounded-2xl p-3.5 shadow-2xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center border"
              style={{
                backgroundColor: `${league.color}15`,
                borderColor: `${league.color}40`,
                color: league.textColor || league.color,
              }}
            >
              <LeagueIcon type={league.icon} size={15} />
            </div>
            <span className="font-display font-bold text-sm text-[#e8ecf7]">
              {title}
            </span>
          </div>

          <div className="text-xs font-mono font-semibold text-[#8a97b2]">
            {currentPoints}{" "}
            {!isLegend && progressTarget && (
              <span className="text-[#55617d]">/ {progressTarget}</span>
            )}
          </div>
        </div>

        {/* Thin progress bar */}
        <div className="h-1 rounded-full bg-[#1c2742] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.round(leagueProgress * 100)}%`,
              backgroundColor: league.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. RankUpModal (Celebration Modal)
// ---------------------------------------------------------------------------
export function RankUpModal({
  leagueState,
  isOpen,
  onClose,
}: {
  leagueState: LeagueState;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const { league, title } = leagueState;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rankup-title"
    >
      <div className="bg-[#111a2e] border border-[#1f2a44] rounded-[22px] max-w-sm w-full p-6 text-center shadow-2xl space-y-5 relative overflow-hidden animate-[scaleIn_0.25s_ease-out]">
        {/* Ambient Glow */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: league.color }}
        />

        {/* Celebration Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border-2 border-dashed animate-[spin_40s_linear_infinite]"
            style={{ borderColor: `${league.color}60` }}
          />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border"
            style={{
              backgroundColor: "#162038",
              borderColor: league.color,
              boxShadow: `0 0 25px ${league.color}40`,
            }}
          >
            <LeagueIcon
              type={league.icon}
              size={32}
              style={{ color: league.textColor || league.color }}
            />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-accent">
            Rank Promotion!
          </span>
          <h2
            id="rankup-title"
            className="text-2xl font-bold font-display tracking-tight text-[#e8ecf7] mt-1"
          >
            {title}
          </h2>
          <p
            className="text-sm font-semibold mt-1"
            style={{ color: league.textColor || league.color }}
          >
            {league.persona}
          </p>
        </div>

        {/* Reward Card */}
        <div className="bg-[#162038] border border-[#233150] rounded-xl p-3.5 space-y-1">
          <p className="text-xs text-[#8a97b2]">Daily Bonus Unlocked</p>
          <p className="text-base font-bold text-[#e8ecf7]">
            +{league.dailyBonus} Points / Day
          </p>
          <p className="text-[10px] text-[#8a97b2]">
            Awarded every day when you log ≥20 points
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-95"
          style={{
            backgroundColor: league.color,
            boxShadow: `0 4px 15px ${league.color}35`,
          }}
        >
          Claim Promotion
        </button>
      </div>
    </div>
  );
}
