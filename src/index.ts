#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registry } from "./registry/ModelRegistry.js";
import {
  STUB_RESPONSE,
  handleAnalyzeRepository,
  handleAnalyzeTask,
  handleEstimateCost,
  handleGenerateCursorGuidance,
  handleGetModelProfile,
  handleGetTelemetrySummary,
  handleListModels,
  handleRecommendModel,
  handleSyncMetadata,
} from "./tools/handlers.js";

const server = new McpServer({
  name: "modelrouter-mcp",
  version: "0.1.0",
});

registry.load();

server.tool(
  "analyze_task",
  "Analyze a plan document for task type, complexity, and requirement vector. Advisory analysis only — does not select a model.",
  { planPath: z.string(), repoPath: z.string().optional() },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(handleAnalyzeTask(args), null, 2) }],
  }),
);

server.tool(
  "analyze_repository",
  "Analyze repository metadata (file counts, languages, frameworks, diff stats). No source file contents are read.",
  { repoPath: z.string() },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(handleAnalyzeRepository(args), null, 2) }],
  }),
);

server.tool(
  "recommend_model",
  "Advisory model recommendation based on plan analysis and registry metadata. User must manually select model in Cursor picker.",
  {
    planPath: z.string(),
    repoPath: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    alternativesCount: z.number().optional(),
  },
  async (args) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          handleRecommendModel({
            planPath: args.planPath,
            repoPath: args.repoPath,
            config: args.config as Parameters<typeof handleRecommendModel>[0]["config"],
            alternativesCount: args.alternativesCount,
          }),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "estimate_cost",
  "Estimate token usage and cost for a specific model given a plan.",
  { planPath: z.string(), modelId: z.string(), repoPath: z.string().optional() },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(handleEstimateCost(args), null, 2) }],
  }),
);

server.tool(
  "list_models",
  "List all models in the registry with basic metadata.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(handleListModels(), null, 2) }],
  }),
);

server.tool(
  "get_model_profile",
  "Get full model profile with provenance for a specific model ID.",
  { modelId: z.string() },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(handleGetModelProfile(args), null, 2) }],
  }),
);

server.tool(
  "sync_metadata",
  "Sync model metadata from external sources. Blocked in privacy mode.",
  { config: z.record(z.unknown()).optional() },
  async (args) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          handleSyncMetadata(args.config as Parameters<typeof handleSyncMetadata>[0]),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "get_telemetry_summary",
  "Get local telemetry summary. Data never leaves the machine.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(handleGetTelemetrySummary(), null, 2) }],
  }),
);

server.tool(
  "generate_cursor_guidance",
  "Generate advisory Cursor guidance snippets. Does not apply or enforce model selection.",
  {
    planPath: z.string(),
    repoPath: z.string().optional(),
    config: z.record(z.unknown()).optional(),
  },
  async (args) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          handleGenerateCursorGuidance({
            planPath: args.planPath,
            repoPath: args.repoPath,
            config: args.config as Parameters<typeof handleGenerateCursorGuidance>[0]["config"],
          }),
          null,
          2,
        ),
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
