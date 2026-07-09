import { describe, it, expect } from "vitest";
import { PrivacyGuard, PrivacyBlockedError } from "../../src/privacy/PrivacyGuard.js";
import { handleSyncMetadata } from "../../src/tools/handlers.js";

describe("privacy-mode-blocks", () => {
  it("blocks sync in privacy mode", () => {
    const result = handleSyncMetadata({ privacyMode: true });
    expect(result.status).toBe("blocked_by_privacy_mode");
  });

  it("PrivacyGuard throws in privacy mode", () => {
    const guard = new PrivacyGuard(true);
    expect(() => guard.assertOutboundAllowed("D")).toThrow(PrivacyBlockedError);
  });
});
