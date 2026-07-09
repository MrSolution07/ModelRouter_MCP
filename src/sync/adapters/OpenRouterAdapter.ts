import { readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "../../utils/paths.js";
import { BaseAdapter, type SyncSourceResult } from "./BaseAdapter.js";

export class OpenRouterAdapter extends BaseAdapter {
  get sourceId() {
    return "openrouter_models";
  }

  sync(): SyncSourceResult {
    try {
      this.privacyGuard.assertOutboundAllowed("D");
      const fixture = path.join(getDataDir(), "sync", "fixtures", "openrouter-models.json");
      const data = JSON.parse(readFileSync(fixture, "utf-8"));
      return {
        sourceId: this.sourceId,
        syncStatus: "success",
        modelsUpdated: data.data?.length ?? 0,
        fieldsUpdated: 0,
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

export function matchBenchmarkAlias(
  alias: string,
  profile: { id: string; aliases: string[]; provider: string },
  otherProfiles: Array<{ id: string; provider: string }>,
): { matched: boolean; confidence: number; method: string } {
  if (alias === profile.id) return { matched: true, confidence: 1.0, method: "exact" };
  if (profile.aliases.includes(alias)) return { matched: true, confidence: 0.95, method: "alias" };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(alias);
  const np = normalize(profile.id);
  if (levenshtein(na, np) <= 2) {
    return { matched: true, confidence: 0.7, method: "fuzzy" };
  }
  return { matched: false, confidence: 0, method: "none" };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function ingestBenchmarkFixture(fixturePath: string, models: Array<{ id: string; aliases: string[]; provider: string }>) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
  const matched: string[] = [];
  const quarantined: string[] = [];

  for (const entry of fixture.entries ?? []) {
    let bestMatch: { id: string; confidence: number } | null = null;
    for (const model of models) {
      const result = matchBenchmarkAlias(entry.benchmarkModelAlias, model, models);
      if (result.matched && result.confidence >= 0.85) {
        if (!bestMatch || result.confidence > bestMatch.confidence) {
          bestMatch = { id: model.id, confidence: result.confidence };
        }
      }
    }
    if (bestMatch) matched.push(bestMatch.id);
    else quarantined.push(entry.benchmarkModelAlias);
  }

  return { matched, quarantined };
}
