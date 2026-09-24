import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { BestChallengesWidget, type BestChallengeItem } from "@/components/best-challenges-widget";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { challenge: { select: { id: true, name: true, isActive: true } } },
        orderBy: { points: "desc" },
      },
      taskLogs: {
        include: {
          task: true,
          challenge: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const displayName = user.displayName || user.name || "Unknown";
  const totalPoints = user.memberships.reduce((acc, m) => acc + m.points, 0);

  // Aggregate stats per exercise/task
  const taskStatsMap = new Map<string, BestChallengeItem>();

  user.taskLogs.forEach((log) => {
    const task = log.task;
    if (!task) return;

    // Only daily tasks accrue per-log points; weekly tasks are one reward per week.
    if (task.type !== "DAILY") return;

    let pts = 0;
    if (task.inputType === "NUMBER") {
      const count = task.unitCount && task.unitCount > 0 ? task.unitCount : 1;
      const blocks = Math.floor((log.value || 0) / count);
      pts = blocks * task.points + (log.bonusPoints || 0);
    } else if (log.completed) {
      pts = task.points;
    }

    const existing = taskStatsMap.get(task.id) || {
      taskId: task.id,
      taskName: task.name,
      inputType: task.inputType,
      unit: task.unit,
      challengeName: log.challenge?.name || "Challenge",
      totalPoints: 0,
      totalValue: 0,
      completedDays: 0,
    };

    existing.totalPoints += pts;
    existing.totalValue += log.value || 0;
    if (log.completed || (task.inputType === "NUMBER" && log.value > 0)) {
      existing.completedDays += 1;
    }

    taskStatsMap.set(task.id, existing);
  });

  // Filter positive contributors & sort descending
  const topExercises: BestChallengeItem[] = Array.from(taskStatsMap.values())
    .filter((t) => t.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 3);

  return (
    <AppShell>
      <div className="py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboards"
            className="text-lg text-muted hover:text-foreground transition px-1"
            aria-label="Back to leaderboards"
          >
            ‹
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <span className="text-muted text-xs font-medium self-center">
            {user.id === session.user.id ? "(you)" : displayName}
          </span>
        </div>

        {/* Identity */}
        <div className="rounded-2xl bg-card border border-card-border p-4 flex items-center gap-4">
          <span className="h-14 w-14 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xl font-bold overflow-hidden shrink-0">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{displayName}</p>
            {user.mantra && (
              <p className="text-xs text-muted mt-0.5 truncate">
                <span className="text-accent font-semibold">“</span>
                {user.mantra}
                <span className="text-accent font-semibold">”</span>
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Total points" value={totalPoints} />
          <StatCard label="Streak" value={user.currentStreak} suffix={user.currentStreak > 0 ? " 🔥" : ""} />
          <StatCard label="Longest" value={user.longestStreak} />
        </div>

        {/* Best Challenges Section — Donut Variant */}
        <BestChallengesWidget
          items={topExercises}
          totalUserPoints={totalPoints}
        />

        {/* Challenges List (With Long Name Wrapping & Fixed Top-Right Points) */}
        <div className="rounded-2xl bg-card border border-card-border divide-y divide-card-border">
          <h2 className="px-4 pt-3 pb-1 text-xs font-bold text-muted uppercase tracking-wide">
            Challenges
          </h2>
          {user.memberships.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted text-sm">
              Not in any challenge yet.
            </div>
          ) : (
            user.memberships.map((m) => (
              <div
                key={m.id}
                className="px-4 py-3.5 flex items-start justify-between gap-4"
              >
                {/* Left: Challenge Name (wraps to 2 lines, then ellipsis) + Subtitle on its own line */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug break-words">
                    {m.challenge.name}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {m.currentStreak > 0 ? `${m.currentStreak} 🔥 streak` : "no streak"}
                  </p>
                </div>

                {/* Right: Points Pinned to Top Right */}
                <span className="text-sm font-bold text-foreground shrink-0 text-right whitespace-nowrap pt-0.5">
                  {m.points}
                  <span className="text-muted text-xs font-medium ml-1">pts</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-card-border p-3 text-center">
      <p className="text-xl font-bold">{value}
        {suffix && <span>{suffix}</span>}
      </p>
      <p className="text-[11px] text-muted font-medium mt-0.5">{label}</p>
    </div>
  );
}