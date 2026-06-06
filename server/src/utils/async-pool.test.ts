import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./async-pool";

describe("runWithConcurrency", () => {
  it("processes every item without exceeding the worker limit", async () => {
    let active = 0;
    let maximum = 0;
    const processed: number[] = [];

    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      processed.push(item);
      active -= 1;
    });

    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(maximum).toBe(2);
  });
});
