import { describe, it, expect, beforeAll } from "vitest";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";
import { InternalTaskRunner } from "../../src/validation/InternalTaskRunner.js";
import { registry } from "../../src/registry/ModelRegistry.js";

describe("internal validation", () => {
  beforeAll(() => registry.load());

  it("returns disabled by default", () => {
    const runner = new InternalTaskRunner(new PrivacyGuard());
    expect(runner.validate({}).status).toBe("disabled");
  });

  it("returns MISSING_API_KEYS when enabled without keys", () => {
    const runner = new InternalTaskRunner(new PrivacyGuard());
    const result = runner.validate({ validation: { enabled: true } });
    expect(result.status).toBe("error");
    expect(result.code).toBe("MISSING_API_KEYS");
  });

  it("runs fixture task and updates registry with internal_validation provenance", () => {
    const runner = new InternalTaskRunner(new PrivacyGuard(false));
    const result = runner.validate({ validation: { enabled: true, apiKeys: { openai: "test-key" } } });
    expect(result.status).toBe("ok");
    expect(result.tasksRun).toBe(1);
    expect(result.modelsUpdated?.length).toBeGreaterThanOrEqual(1);
    const modelId = result.modelsUpdated![0];
    const model = registry.getModel(modelId);
    const coding = model?.capabilities.coding;
    expect(coding?.provenance.source).toBe("internal_validation");
  });
});
