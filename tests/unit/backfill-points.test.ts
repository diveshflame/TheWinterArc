import { describe, it } from "vitest";
import { runPointsBackfill } from "@/lib/backfill-points";

describe("Points Backfill Runner", () => {
  it("runs points backfill cleanly", async () => {
    await runPointsBackfill();
  });
});
