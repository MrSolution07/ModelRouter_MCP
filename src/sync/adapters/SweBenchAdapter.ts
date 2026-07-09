import { readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "../../utils/paths.js";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";
import { BenchmarkIngestService } from "../../benchmarks/BenchmarkIngestService.js";

export class SweBenchAdapter extends BaseAdapter {
  get sourceId() {
    return "swe_bench_leaderboard";
  }

  sync(): SyncSourceResult {
    try {
      this.privacyGuard.assertOutboundAllowed("D");
      const ingest = new BenchmarkIngestService(this.privacyGuard);
      const fixture = path.join(getDataDir(), "benchmarks", "fixtures", "swe-bench.json");
      const result = ingest.ingestFromFixture(fixture);
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
