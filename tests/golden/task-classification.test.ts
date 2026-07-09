import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { analyzeTask } from "../../src/analysis/TaskAnalyzer.js";

const goldenRoot = path.join(import.meta.dirname, "../../data/golden");

function collectFixtures(): Array<{ planPath: string; expected: { taskType: string; complexityRange: { min: number; max: number } } }> {
  const fixtures: Array<{ planPath: string; expected: { taskType: string; complexityRange: { min: number; max: number } } }> = [];
  for (const category of readdirSync(goldenRoot)) {
    if (category === "README.md" || category === "scoring") continue;
    const catDir = path.join(goldenRoot, category);
    for (const id of readdirSync(catDir)) {
      const dir = path.join(catDir, id);
      const planPath = path.join(dir, "plan.md");
      const expectedPath = path.join(dir, "expected.json");
      try {
        readFileSync(planPath, "utf-8");
        const expected = JSON.parse(readFileSync(expectedPath, "utf-8"));
        fixtures.push({ planPath, expected });
      } catch {
        // skip incomplete fixtures
      }
    }
  }
  return fixtures;
}

describe("golden task classification", () => {
  const fixtures = collectFixtures();

  it("has at least 30 fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
  });

  it("meets ≥85% task type accuracy", () => {
    let correct = 0;
    for (const fx of fixtures) {
      const result = analyzeTask(fx.planPath);
      if (result.taskType === fx.expected.taskType) correct++;
    }
    const accuracy = correct / fixtures.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.85);
  });

  it("meets ≥80% complexity within ±1 of range", () => {
    let inRange = 0;
    for (const fx of fixtures) {
      const result = analyzeTask(fx.planPath);
      const { min, max } = fx.expected.complexityRange;
      if (result.complexity >= min - 1 && result.complexity <= max + 1) inRange++;
    }
    expect(inRange / fixtures.length).toBeGreaterThanOrEqual(0.8);
  });
});
