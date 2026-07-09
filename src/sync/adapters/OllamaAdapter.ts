import { BaseAdapter } from "./BaseAdapter.js";

export class OllamaAdapter extends BaseAdapter {
  get sourceId() {
    return "ollama_local";
  }

  sync() {
    try {
      this.privacyGuard.assertOutboundAllowed("D");
      return { sourceId: this.sourceId, syncStatus: "skipped" as const, modelsUpdated: 0, fieldsUpdated: 0, error: null };
    } catch (err) {
      return {
        sourceId: this.sourceId,
        syncStatus: "failed" as const,
        modelsUpdated: 0,
        fieldsUpdated: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
