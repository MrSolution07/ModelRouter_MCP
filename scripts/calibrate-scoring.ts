#!/usr/bin/env tsx
/**
 * Maintainer tool: grid-search scoring weights against golden scoring fixtures.
 * Caps weight changes at ±0.05 per component from baseline.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreModels } from "../src/scoring/ScoringEngine.js";
import { registry } from "../src/registry/ModelRegistry.js";
import { analyzeTask } from "../src/analysis/TaskAnalyzer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const calDir = path.join(root, "data/calibration");
const goldenPlan = path.join(root, "data/golden/refactoring/01/plan.md");
const expected = JSON.parse(
  readFileSync(path.join(root, "data/golden/scoring/refactoring-basic/expected.json"), "utf-8"),
) as { acceptableModelIds: string[] };

const MAX_DELTA = 0.05;

function loadWeights() {
  return JSON.parse(readFileSync(path.join(calDir, "scoring-weights.json"), "utf-8")) as Record<string, { weight: number }>;
}

function evaluate(weights: Record<string, { weight: number }>): number {
  const wfile = path.join(calDir, "scoring-weights.json");
  const original = readFileSync(wfile, "utf-8");
  writeFileSync(wfile, JSON.stringify({ ...weights, calibrationStatus: "provisional" }, null, 2) + "\n");

  registry.load();
  const analysis = analyzeTask(goldenPlan);
  const result = scoreModels(registry.getModels(), analysis.requirementVector, {}, 500, 10);
  const winner = result.ranked[0]?.model.id;
  writeFileSync(wfile, original);

  return winner && expected.acceptableModelIds.includes(winner) ? 1 : 0;
}

function main() {
  const baseline = loadWeights();
  const keys = Object.keys(baseline).filter((k) => k !== "calibrationStatus");
  let bestScore = evaluate(baseline);
  let best = { ...baseline };

  for (const key of keys) {
    for (const delta of [-MAX_DELTA, MAX_DELTA]) {
      const trial = JSON.parse(JSON.stringify(baseline)) as typeof baseline;
      trial[key].weight = Math.max(0.05, Math.min(0.5, trial[key].weight + delta));
      const total = keys.reduce((s, k) => s + trial[k].weight, 0);
      for (const k of keys) trial[k].weight = trial[k].weight / total;
      const score = evaluate(trial);
      if (score > bestScore) {
        bestScore = score;
        best = trial;
      }
    }
  }

  writeFileSync(
    path.join(calDir, "scoring-weights.json"),
    JSON.stringify({ ...best, calibrationStatus: bestScore >= 1 ? "validated" : "provisional" }, null, 2) + "\n",
  );
  console.log(`Calibration pass rate: ${bestScore * 100}% — status: ${bestScore >= 1 ? "validated" : "provisional"}`);
}

main();
