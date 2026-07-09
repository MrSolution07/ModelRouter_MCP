#!/usr/bin/env tsx
import { registry } from "../src/registry/ModelRegistry.js";
import {
  handleListModels,
  handleAnalyzeTask,
  handleRecommendModel,
  handleSyncMetadata,
  handleGenerateCursorGuidance,
  handleRunInternalValidation,
} from "../src/tools/handlers.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registry.load();

const plan = path.join(root, "data/golden/refactoring/01/plan.md");
const repo = root;

console.log("=== ModelRouter MCP Smoke Test ===\n");
console.log("1. list_models:", handleListModels().count, "models");
console.log("2. analyze_task:", handleAnalyzeTask({ planPath: plan }).taskType);
const rec = handleRecommendModel({ planPath: plan, repoPath: repo, alternativesCount: 2 });
console.log("3. recommend_model:", rec.status, "→", rec.recommended?.modelId);
console.log("4. sync_metadata:", handleSyncMetadata().status);
console.log("5. validation:", handleRunInternalValidation().status);
console.log("6. guidance disclaimer present:", handleGenerateCursorGuidance({ planPath: plan }).disclaimer?.length > 0);
console.log("\nSmoke test complete.");
