import { describe, it, expect, beforeAll } from "vitest";
import { registry } from "../../src/registry/ModelRegistry.js";

describe("staleFields", () => {
  beforeAll(() => registry.load());

  it("reports stale capability fields older than 30 days", () => {
    const stale = registry.findStaleFields(30);
    expect(stale.length).toBeGreaterThan(0);
    expect(stale[0]).toHaveProperty("modelId");
    expect(stale[0]).toHaveProperty("ageDays");
    expect(stale[0].ageDays).toBeGreaterThan(30);
  });
});
