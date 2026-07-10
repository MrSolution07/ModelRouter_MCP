import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrivacyGuard } from "../../privacy/PrivacyGuard.js";
import type { HttpPort } from "../../ports/HttpPort.js";
import { registry } from "../../registry/ModelRegistry.js";
import { createProvenance, registryWriter } from "../../registry/RegistryWriter.js";
import { useFixtures } from "../../utils/env.js";
import { getPackagedDataDir } from "../../utils/paths.js";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

function findByOpenRouterAlias(openRouterId: string) {
  return registry.getModels().find((m) => m.aliases.includes(openRouterId));
}

export class OpenRouterAdapter extends BaseAdapter {
  get sourceId() {
    return "openrouter_models";
  }

  async sync(): Promise<SyncSourceResult> {
    try {
      this.privacyGuard.assertOutboundAllowed("D");

      let data: { data: Array<{ id: string; pricing?: { prompt: string; completion: string } }> };
      if (useFixtures()) {
        const fixture = path.join(getPackagedDataDir(), "sync", "fixtures", "openrouter-models.json");
        data = JSON.parse(readFileSync(fixture, "utf-8"));
      } else {
        const res = await this.http.request({ url: OPENROUTER_URL, payloadClass: "D" });
        if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
        data = res.body as typeof data;
      }

      let fieldsUpdated = 0;
      let modelsUpdated = 0;
      for (const entry of data.data ?? []) {
        const model = findByOpenRouterAlias(entry.id);
        if (!model || !entry.pricing) continue;

        const provenance = createProvenance("openrouter_api", {
          sourceUrl: OPENROUTER_URL,
          confidence: 0.9,
          license: "API ToS",
        });

        const input = parseFloat(entry.pricing.prompt) * 1_000_000;
        const output = parseFloat(entry.pricing.completion) * 1_000_000;
        registryWriter.updatePricing(model.id, input, output, provenance);
        fieldsUpdated += 2;
        modelsUpdated++;
      }

      return {
        sourceId: this.sourceId,
        syncStatus: "success",
        modelsUpdated,
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
