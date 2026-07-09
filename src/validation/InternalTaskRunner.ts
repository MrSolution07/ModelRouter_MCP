import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";
import type { ModelRouterConfig } from "../types/index.js";

export class InternalTaskRunner {
  private privacyGuard: PrivacyGuard;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
  }

  validate(config: ModelRouterConfig) {
    if (!config.validation?.enabled) {
      return { status: "disabled" as const };
    }

    const keys = config.validation.apiKeys ?? {};
    const hasKeys = Object.values(keys).some((k) => k && k.length > 0);
    if (!hasKeys) {
      return { status: "error" as const, code: "MISSING_API_KEYS" };
    }

    this.privacyGuard.assertOutboundAllowed("D");
    return {
      status: "ok" as const,
      tasksRun: 1,
      note: "Internal validation is opt-in and not marketed as continuous validation",
    };
  }
}
