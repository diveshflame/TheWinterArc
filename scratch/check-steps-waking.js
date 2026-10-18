const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(
  `SELECT id, "challengeId", name, type, "inputType", points, unit, "unitCount", "bonusThreshold", "bonusPoints"
   FROM challenge_tasks
   WHERE name ILIKE '%step%' OR name ILIKE '%wak%'`
).then((r) => {
  console.log(JSON.stringify(r, null, 1));
}).finally(() => p.$disconnect());
