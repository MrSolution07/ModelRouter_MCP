import { readFileSync } from "node:fs";
import path from "node:path";
import type { RequirementVector, TaskAnalysis } from "../types/index.js";
import { getPackagedDataDir } from "../utils/paths.js";

interface TaskSignalsConfig {
  version: string;
  calibrationStatus: string;
  taskTypes: string[];
  requirementDimensions: string[];
  signals: Record<string, { keywords: string[]; vector: RequirementVector }>;
  complexitySignals: Record<string, { maxWords?: number; maxFiles?: number; minWords?: number; minFiles?: number; score: number }>;
}

let cachedSignals: TaskSignalsConfig | null = null;

function loadSignals(): TaskSignalsConfig {
  if (!cachedSignals) {
    const file = path.join(getPackagedDataDir(), "calibration", "task-signals.json");
    cachedSignals = JSON.parse(readFileSync(file, "utf-8")) as TaskSignalsConfig;
  }
  return cachedSignals;
}

export function analyzeTask(planPath: string, repoSummary?: { fileCount: number }): TaskAnalysis {
  const content = readFileSync(planPath, "utf-8").toLowerCase();
  const signals = loadSignals();
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const fileCount = repoSummary?.fileCount ?? 0;

  let bestType = "ambiguous";
  let bestScore = 0;
  const matchedSignals: TaskAnalysis["signals"] = [];

  for (const [taskType, config] of Object.entries(signals.signals)) {
    let matches = 0;
    for (const kw of config.keywords) {
      const matched = content.includes(kw.toLowerCase());
      if (matched) matches++;
      matchedSignals.push({ signal: `${taskType}:${kw}`, weight: 1 / config.keywords.length, matched });
    }
    const score = matches / config.keywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestType = taskType;
    }
  }

  if (bestScore === 0) bestType = "ambiguous";

  const typeComplexityBase: Record<string, number> = {
    trivial_docs: 2,
    crud: 4,
    multi_file_feature: 6,
    refactoring: 6,
    architecture: 8,
    security: 7,
    ambiguous: 5,
    monorepo: 6,
  };

  let wordComplexity = 5;
  if (wordCount <= (signals.complexitySignals.low?.maxWords ?? 200) && fileCount <= (signals.complexitySignals.low?.maxFiles ?? 2)) {
    wordComplexity = signals.complexitySignals.low?.score ?? 2;
  } else if (wordCount <= (signals.complexitySignals.medium?.maxWords ?? 800) && fileCount <= (signals.complexitySignals.medium?.maxFiles ?? 8)) {
    wordComplexity = signals.complexitySignals.medium?.score ?? 5;
  } else if (wordCount <= (signals.complexitySignals.high?.maxWords ?? 2000) && fileCount <= (signals.complexitySignals.high?.maxFiles ?? 20)) {
    wordComplexity = signals.complexitySignals.high?.score ?? 8;
  } else {
    wordComplexity = signals.complexitySignals.veryHigh?.score ?? 10;
  }

  const typeBase = typeComplexityBase[bestType] ?? 5;
  const complexity = Math.min(10, Math.max(typeBase, wordComplexity));

  const baseVector = { ...signals.signals[bestType]?.vector ?? signals.signals.ambiguous!.vector };
  const scale = 0.8 + complexity / 25;
  const requirementVector: RequirementVector = {};
  for (const [dim, val] of Object.entries(baseVector)) {
    requirementVector[dim] = Math.min(10, Math.round(val * scale * 10) / 10);
  }

  return { taskType: bestType, complexity, requirementVector, signals: matchedSignals.filter((s) => s.matched) };
}
