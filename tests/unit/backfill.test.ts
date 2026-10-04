import { describe, it } from "vitest";
import { runLeagueBackfill } from "@/lib/backfill-leagues";

describe("League Backfill Runner", () => {
  it("runs backfill cleanly", async () => {
    await runLeagueBackfill();
  });
});
