#!/usr/bin/env tsx
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.MODELROUTER_DATA_DIR) {
  process.env.MODELROUTER_DATA_DIR = mkdtempSync(path.join(tmpdir(), "modelrouter-smoke-"));
}
if (!process.env.MODELROUTER_USE_FIXTURES) {
  process.env.MODELROUTER_USE_FIXTURES = "1";
}

const { registry } = await import("../src/registry/ModelRegistry.js");
const {
  handleListModels,
  handleAnalyzeTask,
  handleRecommendModel,
  handleSyncMetadata,
  handleGenerateCursorGuidance,
  handleRunInternalValidation,
} = await import("../src/tools/handlers.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registry.load();

const plan = path.join(root, "data/golden/refactoring/01/plan.md");
const repo = root;

console.log("=== ModelRouter MCP Smoke Test ===\n");
console.log("1. list_models:", handleListModels().count, "models");
console.log("2. analyze_task:", handleAnalyzeTask({ planPath: plan }).taskType);
const rec = handleRecommendModel({ planPath: plan, repoPath: repo, alternativesCount: 2 });
console.log("3. recommend_model:", rec.status, "→", "recommended" in rec ? rec.recommended?.modelId : undefined);
console.log("4. sync_metadata:", (await handleSyncMetadata()).status);
console.log("5. validation:", handleRunInternalValidation().status);
console.log("6. guidance disclaimer present:", handleGenerateCursorGuidance({ planPath: plan }).disclaimer?.length > 0);
console.log("\nSmoke test complete.");
