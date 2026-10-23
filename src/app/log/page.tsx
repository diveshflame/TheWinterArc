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
import { BackfillBanner } from "@/components/backfill-log";
import { ChallengeSwitcher } from "@/components/challenge-switcher";
import { ShareLauncher } from "@/components/share/share-launcher";
import { getShareBundle } from "@/lib/share/server";

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

  const challengeId = membership.challenge.id;
  const [todayLogs, weekLogs] = await Promise.all([
    getTodayLogs(userId, challengeId),
    getWeekLogs(userId, challengeId),
  ]);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  const shareBundle = await getShareBundle(userId, challengeId);

  return (
    <AppShell>
      <div className="py-6 space-y-4">
        {userChallenges.length > 0 && (
          <ChallengeSwitcher
            challenges={userChallenges}
            activeChallengeId={challengeId}
          />
        )}
        {shareBundle && (
          <ShareLauncher
            source="log"
            data={shareBundle.data}
            squadMembers={shareBundle.squadMembers}
            avatarUrl={shareBundle.avatarUrl}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#1f2a44] bg-[#111a2e] py-3 text-sm font-semibold text-accent transition hover:border-accent/40"
          >
            Share Malpvara ?
          </ShareLauncher>
        )}
        <DailyLogClient
          challengeId={challengeId}
          challengeName={membership.challenge.name}
          tasks={membership.challenge.tasks}
          initialLogs={todayLogs}
          weekLogs={weekLogs}
          currentStreak={membership.currentStreak ?? 0}
          todayFormatted={todayFormatted}
          banner={
            // The key silences a React 19.2 false-positive "missing key"
            // warning: the large `tasks` prop makes Flight outline this
            // element into a lazy row, which drops its validation state on
            // the client (facebook/react#37240, fixed in #37258). Harmless
            // once React is updated past 19.2.
            <BackfillBanner key="backfill-banner" challengeId={challengeId} />
          }
        />
      </div>
    </AppShell>
  );
}
