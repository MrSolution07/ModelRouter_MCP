import { describe, it, expect, beforeAll } from "vitest";
import { registry } from "../../src/registry/ModelRegistry.js";
import { normalizeValue, scoreModels } from "../../src/scoring/ScoringEngine.js";

describe("normalization-clip", () => {
  beforeAll(() => registry.load());

  it("clips when raw cost exceeds normalization max bound", () => {
    const { normalized, clipped } = normalizeValue(9.99, 0, 5.0);
    expect(clipped).toBe(true);
    expect(normalized).toBe(1);
  });

  it("scoreModels emits NORMALIZATION_CLIPPED for high-cost estimates", () => {
    const models = registry.getModels().map((m) => ({
      ...m,
      context: {
        maxInputTokens: { value: 500_000, provenance: m.context.maxInputTokens.provenance },
        maxOutputTokens: { value: 100_000, provenance: m.context.maxOutputTokens.provenance },
      },
      pricing: {
        ...m.pricing,
        inputPerMillion: { value: 50, provenance: m.pricing.inputPerMillion.provenance },
        outputPerMillion: { value: 50, provenance: m.pricing.outputPerMillion.provenance },
      },
    }));
    const vector = { coding: 8, reasoning: 7, planning: 6, longContext: 3, vision: 0, speed: 5, costSensitivity: 3 };
    const result = scoreModels(models, vector, {}, 100_000, 10);
    expect(result.warnings).toContain("NORMALIZATION_CLIPPED");
  });
});
