import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";

// Reproduces production conditions. The deployed app talks to a remote
// Postgres where a single statement costs a real round trip (~350ms measured
// against this project's database), and Prisma's query engine aborts an
// interactive transaction that exceeds its default 5000ms budget (P2028).
// saveBackfillLogs used to issue 1 count + one INSERT per task inside that
// transaction, so saving a fully-logged day blew the budget, rolled back, and
// surfaced as "Could not save yesterday's log".
//
// Each statement below is delayed by 400ms, and the wall-clock duration of the
// save's transaction is asserted against the engine's budget.

const TX_BUDGET_MS = 5000;

vi.mock("@/lib/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { PrismaPGlite } = await import("pglite-prisma-adapter");
  const { PrismaClient } = await import("@/generated/client");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const DELAY = 400;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const client = new PGlite();
  await client.exec(readFileSync(join(process.cwd(), "tests", "fixtures", "schema.sql"), "utf8"));

  // Delays query/exec so every statement — including the ones issued inside an
  // interactive transaction — pays the synthetic round trip.
  function wrapQueryable<T extends object>(target: T): T {
    return new Proxy(target, {
      get(t, prop) {
        const value = Reflect.get(t, prop);
        if (typeof value !== "function") return value;
        if (prop !== "query" && prop !== "exec") return value.bind(t);
        return async (...args: unknown[]) => {
          await sleep(DELAY);
          return (value as (...a: unknown[]) => unknown).apply(t, args);
        };
      },
    });
  }

  const slowClient = new Proxy(client, {
    get(t, prop) {
      const value = Reflect.get(t, prop);
      if (typeof value !== "function") return value;
      if (prop === "transaction") {
        return (fn: (tx: unknown) => unknown, ...rest: unknown[]) => {
          const g = globalThis as Record<string, unknown>;
          g.__txStart = Date.now();
          g.__txEnd = undefined;
          const result = (
            value as (f: (tx: unknown) => unknown, ...r: unknown[]) => unknown
          ).call(t, (tx: unknown) => fn(wrapQueryable(tx)), ...rest);
          return Promise.resolve(result).then(
            (r) => {
              g.__txEnd = Date.now();
              return r;
            },
            (e) => {
              g.__txEnd = Date.now();
              throw e;
            }
          );
        };
      }
      if (prop === "query" || prop === "exec") {
        return async (...args: unknown[]) => {
          await sleep(DELAY);
          return (value as (...a: unknown[]) => unknown).apply(t, args);
        };
      }
      return value.bind(t);
    },
  });

  const prisma = new PrismaClient({ adapter: new PrismaPGlite(slowClient) });
  await prisma.$connect();
  return { db: prisma };
});

vi.mock("@/lib/auth", async () => ({
  auth: async () => ({ user: { id: "CURRENT_USER" } }),
}));
vi.mock("next/cache", async () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { checkBackfillEligibility, saveBackfillLogs } from "@/app/actions";
import { addDaysToKey, todayKey } from "@/lib/backfill";

let challengeId = "";
const TASK_COUNT = 16;

beforeAll(async () => {
  const admin = await db.user.create({
    data: { email: "admin-slow@test.dev", name: "Admin", id: "ADMIN_SLOW" },
  });
  const start = new Date();
  start.setDate(start.getDate() - 20);
  const c = await db.challenge.create({
    data: {
      name: "Slow DB Backfill",
      description: "",
      startDate: start,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isPublic: true,
      inviteCode: "BFSLOW1",
      adminId: admin.id,
      members: { create: { userId: admin.id } },
    },
  });
  challengeId = c.id;

  for (let i = 0; i < TASK_COUNT; i++) {
    await db.challengeTask.create({
      data: {
        challengeId,
        name: `Habit ${i}`,
        type: "DAILY",
        inputType: i % 4 === 0 ? "NUMBER" : "CHECKBOX",
        points: i % 4 === 0 ? 5 : 3,
        unit: i % 4 === 0 ? "km" : null,
        target: null,
      },
    });
  }
}, 120_000);

afterAll(async () => {
  const { closeTestDb } = await import("../helpers/test-db");
  await closeTestDb();
});

describe("saveBackfillLogs against a slow database", () => {
  it(
    "saves a fully-logged day without exhausting the transaction time budget",
    async () => {
      const user = await db.user.create({
        data: { email: "bf-slow@test.dev", name: "BF", id: "CURRENT_USER" },
      });
      const joined = new Date();
      joined.setDate(joined.getDate() - 20);
      await db.challengeMember.create({
        data: { challengeId, userId: user.id, joinedAt: joined },
      });

      const clientToday = todayKey();
      const yesterday = addDaysToKey(clientToday, -1);

      const eligibility = await checkBackfillEligibility(challengeId, clientToday);
      expect(eligibility.eligible).toBe(true);

      const tasks = await db.challengeTask.findMany({ where: { challengeId } });
      expect(tasks.length).toBe(TASK_COUNT);
      const updates = tasks.map((t) => ({
        taskId: t.id,
        completed: true,
        value: t.inputType === "NUMBER" ? 6 : 0,
      }));

      const g = globalThis as Record<string, unknown>;
      g.__txStart = undefined;
      g.__txEnd = undefined;

      const res = await saveBackfillLogs(challengeId, yesterday, clientToday, updates);
      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
      expect(res.awarded).toBeGreaterThan(0);

      // The write transaction must stay well inside Prisma's 5s interactive
      // transaction budget, so it may not issue one statement per task.
      expect(g.__txEnd, "saveBackfillLogs should run a write transaction").toBeDefined();
      const txMs = (g.__txEnd as number) - (g.__txStart as number);
      expect(txMs).toBeLessThan(TX_BUDGET_MS);

      const m = await db.challengeMember.findUnique({
        where: { challengeId_userId: { challengeId, userId: user.id } },
      });
      expect(m!.points).toBeGreaterThan(0);

      const logs = await db.taskLog.findMany({
        where: { userId: user.id, challengeId, isBackfill: true },
      });
      expect(logs.length).toBe(TASK_COUNT);
    },
    120_000
  );
});
