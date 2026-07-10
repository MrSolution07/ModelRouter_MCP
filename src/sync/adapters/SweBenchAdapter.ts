import { readFileSync } from "node:fs";
import path from "node:path";
import { BenchmarkIngestService } from "../../benchmarks/BenchmarkIngestService.js";
import { useFixtures } from "../../utils/env.js";
import { getPackagedDataDir } from "../../utils/paths.js";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";

/** Documented SWE-bench leaderboard artifact — override via sync.sourcesConfig in future. */
export const SWE_BENCH_ARTIFACT_URL =
  "https://raw.githubusercontent.com/swe-bench/experiments/main/evaluation/verified/20250820_sweagent_claude-4-sonnet-20250514/results.json";

export class SweBenchAdapter extends BaseAdapter {
  get sourceId() {
    return "swe_bench_leaderboard";
  }

  async sync(): Promise<SyncSourceResult> {
    try {
      this.privacyGuard.assertOutboundAllowed("D");
      const ingest = new BenchmarkIngestService(this.privacyGuard);

      let result;
      if (useFixtures()) {
        const fixture = path.join(getPackagedDataDir(), "benchmarks", "fixtures", "swe-bench.json");
        result = ingest.ingestFromFixture(fixture);
      } else {
        const res = await this.http.request({ url: SWE_BENCH_ARTIFACT_URL, payloadClass: "D" });
        if (!res.ok) throw new Error(`SWE-bench HTTP ${res.status}`);
        result = ingest.ingestFromBody(res.body, SWE_BENCH_ARTIFACT_URL);
      }

      return {
        sourceId: this.sourceId,
        syncStatus: result.status === "failed" ? "failed" : "success",
        modelsUpdated: result.modelsUpdated,
        fieldsUpdated: result.modelsUpdated,
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
