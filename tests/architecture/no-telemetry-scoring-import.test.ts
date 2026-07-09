import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("no-telemetry-scoring-import", () => {
  it("ScoringEngine does not import TelemetryStore", () => {
    const scoringSrc = readFileSync(path.join(import.meta.dirname, "../../src/scoring/ScoringEngine.ts"), "utf-8");
    expect(scoringSrc).not.toContain("TelemetryStore");
    expect(scoringSrc).not.toContain("telemetry");
  });

  it("ModelRegistry does not import TelemetryStore", () => {
    const registrySrc = readFileSync(path.join(import.meta.dirname, "../../src/registry/ModelRegistry.ts"), "utf-8");
    expect(registrySrc).not.toContain("TelemetryStore");
  });
});
