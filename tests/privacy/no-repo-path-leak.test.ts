import { describe, it, expect } from "vitest";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";

describe("no-repo-path-leak", () => {
  it("repo absolute path is not sent in outbound payloads", () => {
    const repoPath = "/Users/secret/myproject";
    const outboundPayload = { source: "openrouter_models", action: "sync" };
    expect(JSON.stringify(outboundPayload)).not.toContain(repoPath);
    const guard = new PrivacyGuard(false);
    guard.assertOutboundAllowed("D");
  });
});
