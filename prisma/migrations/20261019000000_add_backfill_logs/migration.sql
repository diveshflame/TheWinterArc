-- Backfill ("Log yesterday") support on task logs.
ALTER TABLE "task_logs" ADD COLUMN "isBackfill" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "task_logs" ADD COLUMN "originalPoints" INTEGER;
ALTER TABLE "task_logs" ADD COLUMN "awardedPoints" INTEGER;
ALTER TABLE "task_logs" ADD COLUMN "loggedAt" TIMESTAMP(3);
