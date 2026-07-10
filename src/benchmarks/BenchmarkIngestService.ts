import { readFileSync } from "node:fs";
import path from "node:path";
import { findBestBenchmarkMatch } from "./AliasMatcher.js";
import { registry } from "../registry/ModelRegistry.js";
import { createProvenance, registryWriter } from "../registry/RegistryWriter.js";
import { getPackagedDataDir } from "../utils/paths.js";
import type { ModelProfile, Provenance } from "../types/index.js";
import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";

export interface BenchmarkIngestResult {
  status: "ok" | "partial" | "failed";
  matched: string[];
  quarantined: string[];
  modelsUpdated: number;
}

interface BenchmarkPayload {
  benchmark: string;
  entries: Array<{ benchmarkModelAlias: string; rawScore: number; normalizedScore: number }>;
}

function normalizePayload(body: unknown): BenchmarkPayload {
  if (!body || typeof body !== "object") throw new Error("Invalid benchmark payload");
  const obj = body as Record<string, unknown>;
  if (Array.isArray(obj.entries)) {
    return {
      benchmark: (obj.benchmark as string) ?? "swe-bench-verified",
      entries: obj.entries as BenchmarkPayload["entries"],
    };
  }
  throw new Error("Benchmark payload missing entries array");
}

export class BenchmarkIngestService {
  private privacyGuard: PrivacyGuard;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
  }

  ingestFromFixture(fixturePath?: string): BenchmarkIngestResult {
    const fixture = fixturePath ?? path.join(getPackagedDataDir(), "benchmarks", "fixtures", "swe-bench.json");
    const data = JSON.parse(readFileSync(fixture, "utf-8"));
    return this.ingestFromBody(data, fixture);
  }

  ingestFromBody(body: unknown, sourceUrl: string): BenchmarkIngestResult {
    this.privacyGuard.assertOutboundAllowed("D");
    const data = normalizePayload(body);

    const models = registry.getModels().map((m) => ({ id: m.id, aliases: m.aliases, provider: m.provider }));
    const matched: string[] = [];
    const quarantined: string[] = [];
    let modelsUpdated = 0;

    const byModel = new Map<string, { entries: BenchmarkPayload["entries"]; provenance: Provenance }>();

    for (const entry of data.entries ?? []) {
      const match = findBestBenchmarkMatch(entry.benchmarkModelAlias, models);
      if (match.matched && match.confidence >= 0.85 && match.modelId) {
        const provenance = createProvenance("benchmark_ingest", {
          sourceUrl,
          confidence: match.confidence,
          license: "research",
        });
        const bucket = byModel.get(match.modelId) ?? { entries: [], provenance };
        bucket.entries.push(entry);
        byModel.set(match.modelId, bucket);
      } else {
        quarantined.push(entry.benchmarkModelAlias);
        registryWriter.writeQuarantine(
          "benchmarks/unmatched",
          `${entry.benchmarkModelAlias.replace(/[^a-z0-9-_]/gi, "_")}.json`,
          { ...entry, benchmark: data.benchmark, quarantinedAt: new Date().toISOString() },
        );
      }
    }

    for (const [modelId, bucket] of byModel) {
      const model = registry.getModel(modelId);
      if (!model) continue;

      const benchmarks: NonNullable<ModelProfile["benchmarks"]> = bucket.entries.map((entry) => ({
        name: data.benchmark,
        rawScore: entry.rawScore,
        normalizedScore: entry.normalizedScore,
        mappedDimensions: ["coding"],
        benchmarkModelAlias: entry.benchmarkModelAlias,
        provenance: bucket.provenance,
      }));

      const capabilityUpdates: Record<string, { value: number; provenance: Provenance }> = {};
      const best = bucket.entries.reduce((a, b) => (b.normalizedScore > a.normalizedScore ? b : a));
      capabilityUpdates.coding = { value: best.normalizedScore, provenance: bucket.provenance };

      const updated = registryWriter.updateBenchmarks(modelId, benchmarks, capabilityUpdates);
      if (updated) {
        matched.push(modelId);
        modelsUpdated++;
        registry.applyInMemoryBenchmarks(modelId, benchmarks, capabilityUpdates);
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
