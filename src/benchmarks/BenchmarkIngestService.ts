import { readFileSync } from "node:fs";
import path from "node:path";
import { findBestBenchmarkMatch } from "./AliasMatcher.js";
import { registry } from "../registry/ModelRegistry.js";
import { createProvenance, registryWriter } from "../registry/RegistryWriter.js";
import { getDataDir } from "../utils/paths.js";
import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";

export interface BenchmarkIngestResult {
  status: "ok" | "partial" | "failed";
  matched: string[];
  quarantined: string[];
  modelsUpdated: number;
}

export class BenchmarkIngestService {
  private privacyGuard: PrivacyGuard;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
  }

  ingestFromFixture(fixturePath?: string): BenchmarkIngestResult {
    this.privacyGuard.assertOutboundAllowed("D");

    const fixture = fixturePath ?? path.join(getDataDir(), "benchmarks", "fixtures", "swe-bench.json");
    const data = JSON.parse(readFileSync(fixture, "utf-8")) as {
      benchmark: string;
      entries: Array<{ benchmarkModelAlias: string; rawScore: number; normalizedScore: number }>;
    };

    const models = registry.getModels().map((m) => ({ id: m.id, aliases: m.aliases, provider: m.provider }));
    const matched: string[] = [];
    const quarantined: string[] = [];
    let modelsUpdated = 0;

    for (const entry of data.entries ?? []) {
      const match = findBestBenchmarkMatch(entry.benchmarkModelAlias, models);
      if (match.matched && match.confidence >= 0.85 && match.modelId) {
        const provenance = createProvenance("benchmark_ingest", {
          sourceUrl: fixture,
          confidence: match.confidence,
          license: "research",
        });
        const updated = registryWriter.updateCapability(match.modelId, "coding", entry.normalizedScore, provenance);
        if (updated) {
          matched.push(match.modelId);
          modelsUpdated++;
          registry.applyInMemoryUpdate(match.modelId, "capabilities.coding", entry.normalizedScore, provenance);
        }
      } else {
        quarantined.push(entry.benchmarkModelAlias);
        registryWriter.writeQuarantine(
          "benchmarks/unmatched",
          `${entry.benchmarkModelAlias.replace(/[^a-z0-9-_]/gi, "_")}.json`,
          { ...entry, benchmark: data.benchmark, quarantinedAt: new Date().toISOString() },
        );
      }
    }

    return {
      status: modelsUpdated > 0 ? "ok" : quarantined.length > 0 ? "partial" : "failed",
      matched,
      quarantined,
      modelsUpdated,
    };
  }
}
