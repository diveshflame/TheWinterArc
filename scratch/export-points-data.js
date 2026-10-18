const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

const prisma = new PrismaClient();
const OUT = path.join(__dirname, 'points-data.json');

async function main() {
  const [users, challenges, challengeTasks, taskTiers, taskLogs, daySummaries, weeklyScores, members] =
    await Promise.all([
      prisma.$queryRawUnsafe(`SELECT id, "displayName", "totalPoints", "currentStreak", "longestStreak", "createdAt" FROM users`),
      prisma.$queryRawUnsafe(`SELECT id, name, "adminId", "createdAt" FROM challenges`),
      prisma.$queryRawUnsafe(`SELECT * FROM challenge_tasks`),
      prisma.$queryRawUnsafe(`SELECT * FROM task_tiers`),
      prisma.$queryRawUnsafe(`SELECT * FROM task_logs`),
      prisma.$queryRawUnsafe(`SELECT * FROM day_summaries`),
      prisma.$queryRawUnsafe(`SELECT * FROM weekly_scores`),
      prisma.$queryRawUnsafe(`SELECT * FROM challenge_members`),
    ]);

  const clean = (rows) => rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = v instanceof Date ? v.toISOString() : v;
    return o;
  });

  const data = {
    users: clean(users), challenges: clean(challenges), challengeTasks: clean(challengeTasks),
    taskTiers: clean(taskTiers), taskLogs: clean(taskLogs), daySummaries: clean(daySummaries),
    weeklyScores: clean(weeklyScores), members: clean(members),
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log('Wrote', OUT);
  for (const [k, v] of Object.entries(data)) console.log(k + ':', v.length);
  console.log('task keys:', Object.keys(data.challengeTasks[0] || {}));
  console.log('log keys:', Object.keys(data.taskLogs[0] || {}));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
