import { db } from "@/lib/db";

export async function runLeagueBackfill() {
  console.log("Starting league backfill...");

  // 1. Backfill ChallengeMember peakLeaguePoints
  const members = await db.challengeMember.findMany();
  for (const m of members) {
    const peak = Math.max(m.peakLeaguePoints || 0, m.points || 0);
    await db.challengeMember.update({
      where: { id: m.id },
      data: { peakLeaguePoints: peak },
    });
  }
  console.log(`Updated ${members.length} challenge members.`);

  // 2. Backfill User peakLeaguePoints
  const users = await db.user.findMany({
    include: { memberships: true },
  });
  for (const u of users) {
    const memberMaxPeak = u.memberships.reduce(
      (max, m) => Math.max(max, m.peakLeaguePoints, m.points),
      0
    );
    const userPeak = Math.max(u.peakLeaguePoints || 0, u.totalPoints || 0, memberMaxPeak);
    await db.user.update({
      where: { id: u.id },
      data: { peakLeaguePoints: userPeak },
    });
  }
  console.log(`Updated ${users.length} users.`);
}
