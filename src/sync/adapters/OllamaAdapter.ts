import { readFileSync } from "node:fs";
import path from "node:path";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";
import { useFixtures } from "../../utils/env.js";
import { getPackagedDataDir } from "../../utils/paths.js";

const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";

export class OllamaAdapter extends BaseAdapter {
  get sourceId() {
    return "ollama_local";
  }

  async sync(): Promise<SyncSourceResult> {
    try {
      this.privacyGuard.assertOutboundAllowed("D");

      if (useFixtures()) {
        return { sourceId: this.sourceId, syncStatus: "skipped", modelsUpdated: 0, fieldsUpdated: 0, error: null };
      }

      const res = await this.http.request({ url: OLLAMA_TAGS_URL, payloadClass: "D" });
      if (!res.ok) {
        return { sourceId: this.sourceId, syncStatus: "skipped", modelsUpdated: 0, fieldsUpdated: 0, error: null };
      }

      const body = res.body as { models?: Array<{ name: string }> };
      const count = body.models?.length ?? 0;
      return {
        sourceId: this.sourceId,
        syncStatus: count > 0 ? "success" : "skipped",
        modelsUpdated: count,
        fieldsUpdated: 0,
        error: null,
      };
    } catch {
      return { sourceId: this.sourceId, syncStatus: "skipped", modelsUpdated: 0, fieldsUpdated: 0, error: null };
    }
  }
}
