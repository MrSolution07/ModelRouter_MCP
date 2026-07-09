import { readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "../../utils/paths.js";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";
import { createProvenance, registryWriter } from "../../registry/RegistryWriter.js";
import { registry } from "../../registry/ModelRegistry.js";

export class OpenRouterAdapter extends BaseAdapter {
  get sourceId() {
    return "openrouter_models";
  }

  sync(): SyncSourceResult {
    try {
      this.privacyGuard.assertOutboundAllowed("D");
      const fixture = path.join(getDataDir(), "sync", "fixtures", "openrouter-models.json");
      const data = JSON.parse(readFileSync(fixture, "utf-8")) as {
        data: Array<{ id: string; pricing?: { prompt: string; completion: string } }>;
      };

      let fieldsUpdated = 0;
      for (const entry of data.data ?? []) {
        const model = registry.getModels().find((m) => m.aliases.includes(entry.id) || m.id.includes(entry.id.split("/").pop() ?? ""));
        if (!model || !entry.pricing) continue;

        const provenance = createProvenance("openrouter_api", {
          sourceUrl: "https://openrouter.ai/api/v1/models",
          confidence: 0.9,
          license: "API ToS",
        });

        const input = parseFloat(entry.pricing.prompt) * 1_000_000;
        const output = parseFloat(entry.pricing.completion) * 1_000_000;
        registryWriter.updatePricing(model.id, input, output, provenance);
        fieldsUpdated += 2;
      }

      return {
        sourceId: this.sourceId,
        syncStatus: "success",
        modelsUpdated: data.data?.length ?? 0,
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
