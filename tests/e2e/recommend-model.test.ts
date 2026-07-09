import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registry } from "../../src/registry/ModelRegistry.js";
import { handleRecommendModel, handleGenerateCursorGuidance } from "../../src/tools/handlers.js";
import { BenchmarkIngestService } from "../../src/benchmarks/BenchmarkIngestService.js";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";
import { GUIDANCE_DISCLAIMER } from "../../src/types/index.js";

describe("recommend_model E2E", () => {
  let planPath: string;
  let repoPath: string;

  beforeAll(() => {
    registry.load();
    const dir = mkdtempSync(path.join(tmpdir(), "modelrouter-"));
    planPath = path.join(dir, "plan.md");
    repoPath = path.join(import.meta.dirname, "../..");
    writeFileSync(planPath, "# Refactoring Task\n\nRefactor the authentication module across multiple files.\nExtract shared utilities and migrate to new API.");
  });

  it("returns schema-valid recommendation with static_seed", () => {
    const result = handleRecommendModel({ planPath, repoPath });
    expect(result.status).toBe("ok");
    expect(result.registrySnapshot.mode).toBe("static_seed");
    expect(result.recommended).toBeDefined();
    expect(result.guidance.note).toContain("Advisory only");
  });
});

describe("benchmark alias matching", () => {
  it("matches exact alias and quarantines unknown", () => {
    const ingest = new BenchmarkIngestService(new PrivacyGuard(false));
    const result = ingest.ingestFromFixture();
    expect(result.matched.length).toBeGreaterThanOrEqual(1);
    expect(result.quarantined).toContain("unknown-model-xyz");
  });
});

describe("generate_cursor_guidance", () => {
  let planPath: string;

  beforeAll(() => {
    const dir = mkdtempSync(path.join(tmpdir(), "modelrouter-guidance-"));
    planPath = path.join(dir, "plan.md");
    writeFileSync(planPath, "# CRUD API\n\nAdd REST endpoints for user management.");
  });

  it("includes disclaimer and manual steps", () => {
    const result = handleGenerateCursorGuidance({ planPath });
    expect(result.disclaimer).toBe(GUIDANCE_DISCLAIMER);
    expect(result.manualSteps.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(result)).not.toMatch(/apply|enforce|bind/i);
  });
});

describe("internal validation", () => {
  it("returns disabled by default", async () => {
    const { handleValidate } = await import("../../src/tools/handlers.js");
    // handleValidate not exported - use InternalTaskRunner directly
    const { InternalTaskRunner } = await import("../../src/validation/InternalTaskRunner.js");
    const { PrivacyGuard } = await import("../../src/privacy/PrivacyGuard.js");
    const runner = new InternalTaskRunner(new PrivacyGuard());
    expect(runner.validate({}).status).toBe("disabled");
    expect(runner.validate({ validation: { enabled: true } }).code).toBe("MISSING_API_KEYS");
  });
});
