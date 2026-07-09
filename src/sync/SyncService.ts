import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";
import { registry } from "../registry/ModelRegistry.js";
import { OpenRouterAdapter } from "./adapters/OpenRouterAdapter.js";
import { OllamaAdapter } from "./adapters/OllamaAdapter.js";
import { SweBenchAdapter } from "./adapters/SweBenchAdapter.js";
import { AnthropicDocsAdapter } from "./adapters/AnthropicDocsAdapter.js";

export class SyncService {
  private privacyGuard: PrivacyGuard;
  private adapters;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
    this.adapters = [
      new OpenRouterAdapter(privacyGuard),
      new OllamaAdapter(privacyGuard),
      new SweBenchAdapter(privacyGuard),
      new AnthropicDocsAdapter(privacyGuard),
    ];
  }

  getAdapters() {
    return this.adapters;
  }

  syncAll() {
    const start = Date.now();
    const sources = this.adapters.map((a) => a.sync());
    registry.reload();
    const staleFields = registry.findStaleFields();
    const snapshot = registry.getSnapshot();
    const anySuccess = sources.some((s) => s.syncStatus === "success");
    const allFailed = sources.every((s) => s.syncStatus === "failed");

    return {
      status: allFailed ? ("failed" as const) : anySuccess ? ("ok" as const) : ("partial" as const),
      sources,
      staleFields,
      registrySnapshot: { ...snapshot, mode: anySuccess ? ("synced" as const) : snapshot.mode },
      timingMs: Date.now() - start,
    };
  }
}
