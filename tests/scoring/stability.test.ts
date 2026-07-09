import { describe, it, expect, beforeAll } from "vitest";
import { registry } from "../../src/registry/ModelRegistry.js";
import { scoreModels } from "../../src/scoring/ScoringEngine.js";
import type { ModelProfile } from "../../src/types/index.js";

function decoyModel(i: number): ModelProfile {
  const base = registry.getModels()[0];
  return {
    ...base,
    id: `decoy-${i}`,
    displayName: `Decoy ${i}`,
    capabilities: {
      coding: { value: 3 + (i % 5), provenance: { source: "manual_curated", sourceUrl: null, retrievedAt: "2026-01-01T00:00:00.000Z", lastVerified: "2026-01-01T00:00:00.000Z", confidence: 0.3, license: null } },
      reasoning: { value: 3, provenance: { source: "manual_curated", sourceUrl: null, retrievedAt: "2026-01-01T00:00:00.000Z", lastVerified: "2026-01-01T00:00:00.000Z", confidence: 0.3, license: null } },
      planning: { value: 3, provenance: { source: "manual_curated", sourceUrl: null, retrievedAt: "2026-01-01T00:00:00.000Z", lastVerified: "2026-01-01T00:00:00.000Z", confidence: 0.3, license: null } },
    },
  };
}

describe("stability", () => {
  beforeAll(() => registry.load());

  it("winner score unchanged when decoy models added", () => {
    const vector = { coding: 9, reasoning: 8, planning: 7, longContext: 6, vision: 0, speed: 4, costSensitivity: 3 };
    const base = scoreModels(registry.getModels(), vector, {}, 500, 10);
    const withDecoys = scoreModels([...registry.getModels(), ...Array.from({ length: 10 }, (_, i) => decoyModel(i))], vector, {}, 500, 10);
    const baseScore = base.ranked[0]?.score ?? 0;
    const decoyScore = withDecoys.ranked[0]?.score ?? 0;
    expect(Math.abs(baseScore - decoyScore)).toBeLessThanOrEqual(0.001);
  });
});
