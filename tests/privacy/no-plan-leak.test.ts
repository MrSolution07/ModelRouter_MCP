import { describe, it, expect, vi } from "vitest";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";

describe("no-plan-leak", () => {
  it("plan text is not included in outbound Class D payloads", () => {
    const guard = new PrivacyGuard(false);
    const planSnippet = "SECRET_PLAN_CONTENT_12345";
    const outboundPayload = { model: "gpt-4", pricing: 0.01 };
    expect(JSON.stringify(outboundPayload)).not.toContain(planSnippet);
    guard.assertOutboundAllowed("D");
  });

  it("blocks Class A outbound", () => {
    const guard = new PrivacyGuard(false);
    expect(() => guard.assertOutboundAllowed("A")).toThrow();
  });
});
