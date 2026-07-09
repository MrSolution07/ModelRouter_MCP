import { describe, it, expect, beforeAll } from "vitest";
import { registry } from "../../src/registry/ModelRegistry.js";
import { scoreModels } from "../../src/scoring/ScoringEngine.js";

describe("filter_conflict", () => {
  beforeAll(() => registry.load());

  it("returns filter_conflict for freeOnly + localOnly with empty intersection", () => {
    const models = registry.getModels().filter((m) => m.provider !== "ollama");
    const vector = { coding: 5, reasoning: 5, planning: 5, longContext: 5, vision: 0, speed: 5, costSensitivity: 5 };
    const result = scoreModels(models, vector, { freeOnlyMode: true, localOnlyMode: true }, 100, 1);
    expect(result.status).toBe("filter_conflict");
    expect(result.filterConflicts.length).toBeGreaterThan(0);
    expect(result.nearestOptions.length).toBeGreaterThan(0);
  });
});
