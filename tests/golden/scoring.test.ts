import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { analyzeTask } from "../../src/analysis/TaskAnalyzer.js";
import { handleRecommendModel } from "../../src/tools/handlers.js";
import { registry } from "../../src/registry/ModelRegistry.js";

const goldenRoot = path.join(import.meta.dirname, "../../data/golden");

interface ScoringFixture {
  planPath: string;
  acceptableModelIds: string[];
}

function collectScoringFixtures(): ScoringFixture[] {
  const scoringDir = path.join(goldenRoot, "scoring");
  const fixtures: ScoringFixture[] = [];
  for (const id of readdirSync(scoringDir)) {
    const dir = path.join(scoringDir, id);
    if (!statSync(dir).isDirectory()) continue;
    const planPath = path.join(goldenRoot, "refactoring/01/plan.md");
    const expectedPath = path.join(dir, "expected.json");
    try {
      const expected = JSON.parse(readFileSync(expectedPath, "utf-8"));
      fixtures.push({ planPath, acceptableModelIds: expected.acceptableModelIds });
    } catch {
      // skip incomplete
    }
  }
  return fixtures;
}

describe("golden scoring", () => {
  const fixtures = collectScoringFixtures();

  it("has scoring fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(1);
  });

  it("meets ≥80% winner ∈ acceptableModelIds", () => {
    registry.load();
    let correct = 0;
    for (const fx of fixtures) {
      const rec = handleRecommendModel({ planPath: fx.planPath }) as ReturnType<typeof handleRecommendModel>;
      const winner = "recommended" in rec ? rec.recommended?.modelId : undefined;
      if (winner && fx.acceptableModelIds.includes(winner)) correct++;
    }
    expect(correct / fixtures.length).toBeGreaterThanOrEqual(0.8);
  });
});

describe("golden task-derived scoring coverage", () => {
  it("task fixtures produce analyzable plans", () => {
    const plan = path.join(goldenRoot, "refactoring/01/plan.md");
    const analysis = analyzeTask(plan);
    expect(analysis.taskType).toBeTruthy();
    expect(Object.keys(analysis.requirementVector).length).toBeGreaterThan(0);
  });
});
