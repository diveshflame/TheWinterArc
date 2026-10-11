import { db } from "@/lib/db";
import { syncMemberTotals } from "@/lib/score-engine";

/**
 * One-time backfill: recompute stored member/user point totals from the
 * underlying DaySummary + WeeklyScore rows.
 *
 * Needed because stored totals (ChallengeMember.points / User.totalPoints) are
 * only refreshed when a member logs. Any weekly points credited into the
 * current week's WeeklyScore before the "credit weekly points immediately"
 * change were never folded into those stored totals, so the Overall
 * leaderboard lagged the live This Week leaderboard.
 *
 * Reuses the exact same sync used on every log, so results match future
 * scoring runs. Idempotent and safe to run repeatedly.
 */
export async function runPointsBackfill() {
  console.log("Starting points backfill...");

  const members = await db.challengeMember.findMany();
  for (const m of members) {
    await syncMemberTotals(m.userId, m.challengeId, m.currentStreak, m.longestStreak);
  }

  console.log(`Recomputed points for ${members.length} challenge members.`);
}
