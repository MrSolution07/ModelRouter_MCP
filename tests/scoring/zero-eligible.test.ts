import { describe, it, expect, beforeAll } from "vitest";
import { registry } from "../../src/registry/ModelRegistry.js";
import { scoreModels } from "../../src/scoring/ScoringEngine.js";

describe("zero eligible", () => {
  beforeAll(() => registry.load());

  it("returns error when no models have capabilities", () => {
    const empty = registry.getModels().map((m) => ({ ...m, capabilities: {} }));
    const vector = { coding: 5, reasoning: 5, planning: 5, longContext: 5, vision: 0, speed: 5, costSensitivity: 5 };
    const result = scoreModels(empty, vector, {}, 100, 1);
    expect(result.status).toBe("error");
    expect(result.code).toBe("INSUFFICIENT_REGISTRY_EVIDENCE");
  });

  it("returns no_eligible_models when all excluded", () => {
    const models = registry.getModels();
    const vector = { coding: 5, reasoning: 5, planning: 5, longContext: 5, vision: 0, speed: 5, costSensitivity: 5 };
    const result = scoreModels(models, vector, { excludedProviders: ["anthropic", "openai", "google", "deepseek", "mistral", "ollama"] }, 100, 1);
    expect(result.ranked.length).toBe(0);
  });
});
