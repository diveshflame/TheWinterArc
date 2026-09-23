import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getPrimaryChallenge,
  getTodayLogs,
  getWeekLogs,
  getUserChallenges,
} from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { DailyLogClient } from "@/components/daily-log";
import { ChallengeSwitcher } from "@/components/challenge-switcher";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams?: Promise<{ c?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;

  const resolvedParams = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const preferredChallengeId =
    resolvedParams.c || cookieStore.get("active_challenge_id")?.value;

  const [membership, userChallenges] = await Promise.all([
    getPrimaryChallenge(userId, preferredChallengeId),
    getUserChallenges(userId),
  ]);
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
        {userChallenges.length > 0 && (
          <ChallengeSwitcher
            challenges={userChallenges}
            activeChallengeId={membership.challenge.id}
          />
        )}
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
