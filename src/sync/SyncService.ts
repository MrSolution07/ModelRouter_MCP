import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";
import { registry } from "../registry/ModelRegistry.js";
import { OpenRouterAdapter } from "./adapters/OpenRouterAdapter.js";
import { OllamaAdapter } from "./adapters/OllamaAdapter.js";

export class SyncService {
  private privacyGuard: PrivacyGuard;
  private adapters;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
    this.adapters = [new OpenRouterAdapter(privacyGuard), new OllamaAdapter(privacyGuard)];
  }

  syncAll() {
    const start = Date.now();
    const sources = this.adapters.map((a) => a.sync());
    const staleFields = registry.findStaleFields();
    const snapshot = registry.getSnapshot();
    const anySuccess = sources.some((s) => s.syncStatus === "success");
    const allFailed = sources.every((s) => s.syncStatus === "failed");

    return {
      status: allFailed ? ("failed" as const) : anySuccess ? ("ok" as const) : ("partial" as const),
      sources,
      staleFields,
      registrySnapshot: snapshot,
      timingMs: Date.now() - start,
    };
  }
}
