import { describe, it, expect, beforeAll } from "vitest";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";
import { BenchmarkIngestService } from "../../src/benchmarks/BenchmarkIngestService.js";
import { findBestBenchmarkMatch } from "../../src/benchmarks/AliasMatcher.js";
import { registry } from "../../src/registry/ModelRegistry.js";
import path from "node:path";
import { existsSync } from "node:fs";
import { getUserDataDir } from "../../src/utils/paths.js";

describe("benchmark ingest", () => {
  beforeAll(() => registry.load());

  it("matches ≥1 model from fixture", () => {
    const models = registry.getModels().map((m) => ({ id: m.id, aliases: m.aliases, provider: m.provider }));
    const match = findBestBenchmarkMatch("anthropic-claude-sonnet", models);
    expect(match.matched).toBe(true);
    expect(match.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("quarantines unmatched aliases", () => {
    const guard = new PrivacyGuard(false);
    const ingest = new BenchmarkIngestService(guard);
    const result = ingest.ingestFromFixture();
    expect(result.matched.length).toBeGreaterThanOrEqual(1);
    expect(result.quarantined).toContain("unknown-model-xyz");
    const quarantineFile = path.join(getUserDataDir(), "benchmarks/unmatched/unknown-model-xyz.json");
    expect(existsSync(quarantineFile)).toBe(true);
  });
});
