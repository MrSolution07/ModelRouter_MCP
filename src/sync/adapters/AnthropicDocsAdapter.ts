import { readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "../../utils/paths.js";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";
import { createProvenance, registryWriter } from "../../registry/RegistryWriter.js";
import { registry } from "../../registry/ModelRegistry.js";

export class AnthropicDocsAdapter extends BaseAdapter {
  get sourceId() {
    return "anthropic_docs";
  }

  sync(): SyncSourceResult {
    try {
      this.privacyGuard.assertOutboundAllowed("D");
      const fixture = path.join(getDataDir(), "sync", "fixtures", "anthropic-docs.json");
      const data = JSON.parse(readFileSync(fixture, "utf-8")) as {
        models: Array<{ id: string; inputPerMillion: number; outputPerMillion: number; unknown?: boolean }>;
      };

      let fieldsUpdated = 0;
      for (const entry of data.models ?? []) {
        const model = registry.getModel(entry.id);
        if (!model) continue;

        const provenance = createProvenance("provider_docs", {
          sourceUrl: "https://docs.anthropic.com",
          confidence: 0.85,
          license: "provider ToS",
        });

        if (entry.unknown) {
          // Keep existing values per plan — never delete on failure
          continue;
        }

        registryWriter.updatePricing(model.id, entry.inputPerMillion, entry.outputPerMillion, provenance);
        fieldsUpdated += 2;
      }

      return {
        sourceId: this.sourceId,
        syncStatus: "success",
        modelsUpdated: data.models?.length ?? 0,
        fieldsUpdated,
        error: null,
      };
    } catch (err) {
      return {
        sourceId: this.sourceId,
        syncStatus: "failed",
        modelsUpdated: 0,
        fieldsUpdated: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
