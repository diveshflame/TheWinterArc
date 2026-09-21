"use client";

export interface BestChallengeItem {
  taskId: string;
  taskName: string;
  inputType: string;
  unit: string | null;
  challengeName: string;
  totalPoints: number;
  totalValue: number;
  completedDays: number;
}

// Rank-based palette — position in the top 3 decides the color, never the challenge itself
const RANK_COLORS = ["#fbbf24", "#cbd5e1", "#fb923c"] as const;

function getTaskEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("sugar")) return "🥗";
  if (lower.includes("meal") || lower.includes("home")) return "🍱";
  if (lower.includes("protein")) return "🍗";
  if (lower.includes("push") || lower.includes("pull") || lower.includes("gym") || lower.includes("workout")) return "💪";
  if (lower.includes("run") || lower.includes("walk") || lower.includes("jog") || lower.includes("step")) return "🏃";
  if (lower.includes("meditat") || lower.includes("mind")) return "🧘";
  if (lower.includes("read") || lower.includes("book") || lower.includes("study")) return "📖";
  if (lower.includes("sleep") || lower.includes("bed")) return "🛏️";
  if (lower.includes("water") || lower.includes("drink") || lower.includes("hydrat")) return "💧";
  if (lower.includes("cold") || lower.includes("shower")) return "🚿";
  if (lower.includes("fruit")) return "🍎";
  if (lower.includes("phone") || lower.includes("screen")) return "📵";
  if (lower.includes("alcohol") || lower.includes("beer") || lower.includes("wine")) return "🍷";
  return "⚡";
}

export function BestChallengesWidget({
  items,
  totalUserPoints,
}: {
  items: BestChallengeItem[];
  totalUserPoints: number;
}) {
  const top = [...items]
    .filter((item) => item.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 3);

  const sumTop = top.reduce((s, c) => s + c.totalPoints, 0);

  if (totalUserPoints <= 0 || top.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-card-border p-4 shadow-sm">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase mb-3.5">
          BEST CHALLENGES
        </p>
        <p className="text-xs text-muted py-3 text-center">
          No standout challenges yet
        </p>
      </div>
    );
  }

  const r = 46;
  const circumference = 2 * Math.PI * r;
  const gapDeg = 6; // visual gap between segments, in degrees
  const gapLen = (gapDeg / 360) * circumference;

  let cursor = 0;
  const segments = top.map((c, i) => {
    const rawLen = (c.totalPoints / totalUserPoints) * circumference;
    const segLen = Math.max(rawLen - gapLen, 2); // shrink for the gap, keep a visible minimum
    const strokeDasharray = `${segLen} ${circumference - segLen}`;
    const strokeDashoffset = -cursor;
    const currentCursor = cursor;
    cursor += rawLen; // advance by the true proportional length, not the shrunk one

    const share = Math.round((c.totalPoints / totalUserPoints) * 100);
    const color = RANK_COLORS[i] || RANK_COLORS[0];
    const icon = getTaskEmoji(c.taskName);

    return {
      ...c,
      icon,
      color,
      share,
      segLen,
      strokeDasharray,
      strokeDashoffset: -currentCursor,
    };
  });

  return (
    <div className="rounded-2xl bg-card border border-card-border p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wider text-muted uppercase mb-3.5">
        BEST CHALLENGES
      </p>
      <div className="flex items-center gap-4 sm:gap-[18px]">
        {/* SVG Donut Chart */}
        <svg
          className="shrink-0"
          width="112"
          height="112"
          viewBox="0 0 112 112"
        >
          {/* Base track = subtle track with 0.9 opacity */}
          <circle
            cx="56"
            cy="56"
            r={r}
            fill="none"
            stroke="var(--color-card-border, var(--card-border, #242e4d))"
            strokeWidth="14"
            opacity="0.9"
          />
          <g transform="rotate(-90 56 56)">
            {segments.map((seg) => (
              <circle
                key={seg.taskId}
                cx="56"
                cy="56"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
              />
            ))}
          </g>
          <text
            x="56"
            y="52"
            textAnchor="middle"
            fill="var(--color-foreground, var(--foreground, #e8ecf7))"
            fontFamily="'Space Grotesk', system-ui, sans-serif"
            fontWeight="700"
            fontSize="22"
          >
            {sumTop}
          </text>
          <text
            x="56"
            y="68"
            textAnchor="middle"
            fill="var(--color-muted, var(--muted, #8b93ad))"
            fontSize="10.5"
            fontFamily="Inter, system-ui, sans-serif"
          >
            of {totalUserPoints} pts
          </text>
        </svg>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-[11px] min-w-0">
          {segments.map((c) => (
            <div
              key={c.taskId}
              className="flex items-center gap-2.5 min-w-0 justify-between"
            >
              <div
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ background: c.color }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-semibold text-foreground truncate"
                  title={c.taskName}
                >
                  {c.icon} {c.taskName}
                </div>
                <div className="text-[11px] text-muted leading-none mt-0.5">
                  {c.share}% share
                </div>
              </div>
              <div className="font-display font-bold text-[13.5px] text-foreground whitespace-nowrap shrink-0">
                {c.totalPoints}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
