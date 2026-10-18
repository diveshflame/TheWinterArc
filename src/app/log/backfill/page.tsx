import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getPrimaryChallenge, getWeekLogs } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { BackfillLogClient } from "@/components/backfill-log";

export const dynamic = "force-dynamic";

/**
 * Screen 3 of the "Log yesterday" flow: a backfill-mode copy of the Daily Log
 * for the immediately previous day, at a 30% points penalty. The client
 * resolves eligibility against the user's local date on mount (server-enforced
 * via checkBackfillEligibility/saveBackfillLogs) and returns to /log when the
 * one-day window or the zero-logs requirement fails.
 */
export default async function BackfillLogPage({
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

  const membership = await getPrimaryChallenge(userId, preferredChallengeId);
  if (!membership) redirect("/challenges/new");

  const challengeId = membership.challenge.id;
  const weekLogs = await getWeekLogs(userId, challengeId);

  return (
    <AppShell>
      <div className="py-6">
        <BackfillLogClient
          challengeId={challengeId}
          challengeName={membership.challenge.name}
          tasks={membership.challenge.tasks}
          weekLogs={weekLogs}
        />
      </div>
    </AppShell>
  );
}
