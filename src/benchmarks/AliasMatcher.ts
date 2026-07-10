export function normalizeAlias(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function providerFamily(provider: string): string {
  const p = provider.toLowerCase();
  if (p === "openai" || p.startsWith("openai")) return "openai";
  if (p === "anthropic" || p.startsWith("anthropic")) return "anthropic";
  if (p.includes("google") || p === "gemini") return "google";
  if (p.includes("deepseek")) return "deepseek";
  if (p.includes("mistral")) return "mistral";
  return p;
}

export function aliasProviderFamily(alias: string): string {
  const a = alias.toLowerCase();
  if (a.includes("claude") || a.includes("anthropic")) return "anthropic";
  if (a.includes("gpt") || a.includes("openai")) return "openai";
  if (a.includes("gemini") || a.includes("google")) return "google";
  if (a.includes("deepseek")) return "deepseek";
  if (a.includes("mistral")) return "mistral";
  return "";
}

export interface AliasMatchResult {
  matched: boolean;
  confidence: number;
  method: "exact" | "alias" | "fuzzy" | "none";
  modelId?: string;
}

export function levenshtein(a: string, b: string): number {
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

export function matchBenchmarkAlias(
  alias: string,
  profile: { id: string; aliases: string[]; provider: string },
): AliasMatchResult {
  if (alias === profile.id) return { matched: true, confidence: 1.0, method: "exact", modelId: profile.id };
  if (profile.aliases.includes(alias)) return { matched: true, confidence: 0.95, method: "alias", modelId: profile.id };

  const na = normalizeAlias(alias);
  const candidates = [normalizeAlias(profile.id), ...profile.aliases.map(normalizeAlias)];
  let bestDist = Infinity;
  for (const c of candidates) {
    bestDist = Math.min(bestDist, levenshtein(na, c));
  }

  if (bestDist <= 2) {
    const sameFamily = aliasProviderFamily(alias) === providerFamily(profile.provider);
    return {
      matched: true,
      confidence: sameFamily ? 0.85 : 0.7,
      method: "fuzzy",
      modelId: profile.id,
    };
  }
  return { matched: false, confidence: 0, method: "none" };
}

export function findBestBenchmarkMatch(
  alias: string,
  models: Array<{ id: string; aliases: string[]; provider: string }>,
): AliasMatchResult {
  let best: AliasMatchResult = { matched: false, confidence: 0, method: "none" };
  for (const model of models) {
    const result = matchBenchmarkAlias(alias, model);
    if (result.matched && result.confidence > best.confidence) {
      best = result;
    }
  }
  return best;
}
