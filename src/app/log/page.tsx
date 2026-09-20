import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrimaryChallenge, getTodayLogs, getWeekLogs } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { DailyLogClient } from "@/components/daily-log";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const membership = await getPrimaryChallenge(userId);
  if (!membership) redirect("/challenges/new");

const todayLogs = await getTodayLogs(userId, membership.challenge.id);
  const weekLogs = await getWeekLogs(userId, membership.challenge.id);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      <div className="py-6 space-y-4">
        <DailyLogClient
          challengeId={membership.challenge.id}
          challengeName={membership.challenge.name}
          tasks={membership.challenge.tasks}
          initialLogs={todayLogs}
          weekLogs={weekLogs}
          currentStreak={membership.currentStreak ?? 0}
          todayFormatted={todayFormatted}
        />
      </div>
    </AppShell>
  );
}
