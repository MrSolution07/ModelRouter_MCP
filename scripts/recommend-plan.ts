#!/usr/bin/env tsx
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registry } from "../src/registry/ModelRegistry.js";
import {
  handleAnalyzeTask,
  handleRecommendModel,
  handleGenerateCursorGuidance,
} from "../src/tools/handlers.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const planArg = process.argv[2];
const plan = planArg
  ? path.resolve(planArg)
  : path.join(root, ".cursor/plans/modelrouter_mcp_master_plan_4108216d.plan.md");
const repo = process.argv[3] ? path.resolve(process.argv[3]) : root;

registry.load();

const task = handleAnalyzeTask({ planPath: plan, repoPath: repo });
const rec = handleRecommendModel({ planPath: plan, repoPath: repo, alternativesCount: 5 });
const guidance = handleGenerateCursorGuidance({ planPath: plan, repoPath: repo });

console.log(JSON.stringify({ task, rec, guidance }, null, 2));
