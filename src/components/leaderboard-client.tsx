"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { getLeagueState } from "@/lib/leagues";
import { LeagueIcon } from "@/components/league-icons";

export interface LeaderboardRow {
  userId: string;
  name: string;
  image: string | null;
  mantra: string | null;
  today: number;
  week: number;
  overall: number;
  peakLeaguePoints: number;
  streak: number;
}

type Tab = "today" | "week" | "overall";

export function LeaderboardClient({
  today,
  week,
  overall,
  myUserId,
}: {
  today: LeaderboardRow[];
  week: LeaderboardRow[];
  overall: LeaderboardRow[];
  myUserId: string;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const [openId, setOpenId] = useState<string | null>(null);

  const data = tab === "today" ? today : tab === "week" ? week : overall;
  const myRank = data.findIndex((r) => r.userId === myUserId) + 1;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1 border border-card-border">
        {(
          [
            ["today", "Today"],
            ["week", "This Week"],
            ["overall", "Overall"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg py-2 text-sm font-semibold transition cursor-pointer ${
              tab === key ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leaderboard Rows */}
      <div className="rounded-2xl bg-card border border-card-border divide-y divide-card-border shadow-md">
        {data.map((row, i) => {
          const isMe = row.userId === myUserId;
          const isOpen = openId === row.userId;
          const points =
            tab === "today" ? row.today : tab === "week" ? row.week : row.overall;

          // Persona and league are cumulative from running peak points
          const leagueState = getLeagueState(row.peakLeaguePoints);
          const league = leagueState.league;
          const isLegend = league.key === "legend";

          return (
            <Fragment key={row.userId}>
              <div
                onClick={() => setOpenId((prev) => (prev === row.userId ? null : row.userId))}
                aria-expanded={isOpen}
                className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition ${
                  isMe ? "bg-accent/10" : "hover:bg-white/[0.02]"
                }`}
              >
                {/* Rank Badge */}
                <RankBadge rank={i + 1} />

                {/* Avatar with League-colored border & Legend golden ring */}
                <div className="relative shrink-0">
                  <span
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden border-2 transition ${
                      isLegend
                        ? "ring-2 ring-[#ff8a3d] ring-offset-2 ring-offset-card shadow-[0_0_12px_rgba(255,138,61,0.4)]"
                        : ""
                    }`}
                    style={{
                      borderColor: league.color,
                      backgroundColor: `${league.color}20`,
                      color: league.textColor || league.color,
                    }}
                  >
                    {row.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      row.name.charAt(0).toUpperCase()
                    )}
                  </span>
                </div>

                {/* Name & Persona line (replaces quote) */}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center text-sm font-semibold truncate text-foreground">
                    {row.name}
                    {row.streak > 0 && <span className="ml-1 text-xs">🔥</span>}
                    {isMe && <span className="ml-1.5 text-xs text-accent font-medium">(you)</span>}
                  </span>
                  
                  {/* Persona Line: League Icon + Persona in League Color */}
                  <span
                    className="flex items-center gap-1 text-xs font-medium truncate mt-0.5"
                    style={{ color: league.textColor || league.color }}
                  >
                    <LeagueIcon type={league.icon} size={12} className="shrink-0" />
                    <span className="truncate">{league.persona}</span>
                  </span>
                </span>

                {/* Right side: Points (large) + League name below in league color */}
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-foreground leading-tight">
                    {points.toLocaleString()}
                    <span className="text-muted text-xs font-normal ml-0.5">pts</span>
                  </p>
                  <p
                    className="text-[11px] font-semibold tracking-tight"
                    style={{ color: league.textColor || league.color }}
                  >
                    {league.name}
                  </p>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 py-2.5 flex items-center justify-between bg-black/20 border-t border-card-border/50">
                  <span className="text-xs text-muted">
                    {isMe ? "Your Profile" : `${row.name}'s Profile`}
                  </span>
                  <Link
                    href={isMe ? "/profile" : `/u/${row.userId}`}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    View profile →
                  </Link>
                </div>
              )}
            </Fragment>
          );
        })}
        {data.length === 0 && (
          <div className="px-4 py-10 text-center text-muted text-sm">
            No rankings yet.
          </div>
        )}
      </div>

      {myRank > 0 && (
        <p className="text-center text-xs text-muted font-medium pt-1">
          Your rank: #{myRank}
        </p>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <span className="w-6 text-center text-sm font-bold shrink-0">
      {medal ?? `#${rank}`}
    </span>
  );
}