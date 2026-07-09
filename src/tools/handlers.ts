import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeRepository } from "../analysis/RepoAnalyzer.js";
import { analyzeTask } from "../analysis/TaskAnalyzer.js";
import { PrivacyGuard } from "../privacy/PrivacyGuard.js";
import { registry } from "../registry/ModelRegistry.js";
import { computeConfidence, scoreModels } from "../scoring/ScoringEngine.js";
import { assertValid } from "../schemas/validator.js";
import { SyncService } from "../sync/SyncService.js";
import { TelemetryStore } from "../telemetry/TelemetryStore.js";
import { GUIDANCE_DISCLAIMER, STUB_RESPONSE, type ModelRouterConfig } from "../types/index.js";
import { InternalTaskRunner } from "../validation/InternalTaskRunner.js";
import { BenchmarkIngestService } from "../benchmarks/BenchmarkIngestService.js";

const privacyGuard = new PrivacyGuard();
const syncService = new SyncService(privacyGuard);
const telemetry = new TelemetryStore();
const internalValidation = new InternalTaskRunner(privacyGuard);

function mergeConfig(input?: ModelRouterConfig): ModelRouterConfig {
  return {
    privacyMode: false,
    excludedProviders: [],
    freeOnlyMode: false,
    localOnlyMode: false,
    allowBudgetRelaxation: false,
    preferredProviders: [],
    logPaths: false,
    validation: { enabled: false },
    ...input,
  };
}

export function handleAnalyzeTask(args: { planPath: string; repoPath?: string }) {
  const start = Date.now();
  const repoSummary = args.repoPath ? analyzeRepository(args.repoPath) : undefined;
  const analysis = analyzeTask(args.planPath, repoSummary);
  const response = {
    status: "ok" as const,
    taskType: analysis.taskType,
    complexity: analysis.complexity,
    requirementVector: analysis.requirementVector,
    signals: analysis.signals,
    calibrationStatus: "provisional" as const,
    timingMs: Date.now() - start,
  };
  assertValid("analyze-task-response.schema.json", response);
  return response;
}

export function handleAnalyzeRepository(args: { repoPath: string }) {
  const result = analyzeRepository(args.repoPath);
  const response = {
    status: "ok" as const,
    fileCount: result.fileCount,
    languages: result.languages,
    frameworks: result.frameworks,
    diffStatLines: result.diffStatLines,
    timingMs: result.timingMs,
  };
  assertValid("analyze-repository-response.schema.json", response);
  return response;
}

export function handleListModels() {
  const start = Date.now();
  const snapshot = registry.getSnapshot();
  const models = registry.getModels().map((m) => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    status: m.status,
    cursorAvailability: m.cursorAvailability,
    cursorModelId: m.cursorModelId?.value ?? null,
  }));
  const response = {
    status: "ok" as const,
    models,
    registrySnapshot: snapshot,
    count: models.length,
    timingMs: Date.now() - start,
  };
  assertValid("list-models-response.schema.json", response);
  return response;
}

export function handleGetModelProfile(args: { modelId: string }) {
  const model = registry.getModel(args.modelId);
  if (!model) {
    return { status: "error" as const, code: "MODEL_NOT_FOUND" };
  }
  return { status: "ok" as const, profile: model };
}

export function handleRecommendModel(args: {
  planPath: string;
  repoPath?: string;
  config?: ModelRouterConfig;
  alternativesCount?: number;
}) {
  const start = Date.now();
  const config = mergeConfig(args.config);
  privacyGuard.setPrivacyMode(config.privacyMode ?? false);

  if (config.privacyMode) {
    const blocked = {
      status: "blocked_by_privacy_mode" as const,
      confidence: { value: 0, factors: { evidenceCoverage: 0, scoreMargin: 0, dataFreshness: 0, validationRecency: 0, contextHeadroom: 0 }, calibrationStatus: "provisional" as const },
      estimates: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: { value: null, unknown: true }, latencyMs: { value: null, unknown: true } },
      analysis: { taskType: "", complexity: 0, requirementVector: {}, repoSummary: { fileCount: 0, languages: [], frameworks: [], diffStatLines: { added: 0, removed: 0 } } },
      evidence: [],
      warnings: [],
      registrySnapshot: registry.getSnapshot(),
      timingMs: Date.now() - start,
      guidance: { note: "Advisory only. User must manually select model in Cursor picker." },
    };
    assertValid("recommend-model-response.schema.json", blocked);
    return blocked;
  }

  const planContent = readFileSync(args.planPath, "utf-8");
  const planWords = planContent.split(/\s+/).filter(Boolean).length;
  const repoSummary = args.repoPath ? analyzeRepository(args.repoPath) : { fileCount: 0, languages: [] as string[], frameworks: [] as string[], diffStatLines: { added: 0, removed: 0 }, timingMs: 0 };
  const taskAnalysis = analyzeTask(args.planPath, repoSummary);
  const snapshot = registry.getSnapshot();
  const staleFields = registry.findStaleFields();
  const scoring = scoreModels(registry.getModels(), taskAnalysis.requirementVector, config, planWords, repoSummary.fileCount);
  const confidence = computeConfidence(scoring, staleFields.length);
  const altCount = args.alternativesCount ?? 3;

  if (scoring.status === "error") {
    const errResponse = {
      status: "error" as const,
      code: scoring.code,
      confidence: { ...confidence },
      estimates: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: { value: null, unknown: true }, latencyMs: { value: null, unknown: true } },
      analysis: { taskType: taskAnalysis.taskType, complexity: taskAnalysis.complexity, requirementVector: taskAnalysis.requirementVector, repoSummary },
      evidence: [],
      warnings: scoring.warnings,
      staleFields,
      rejectedModels: scoring.rejectedModels,
      nearestOptions: scoring.nearestOptions,
      filterConflicts: scoring.filterConflicts,
      resolutionSuggestions: scoring.resolutionSuggestions,
      registrySnapshot: snapshot,
      timingMs: Date.now() - start,
      guidance: { note: "Advisory only. User must manually select model in Cursor picker." },
    };
    assertValid("recommend-model-response.schema.json", errResponse);
    return errResponse;
  }

  const winner = scoring.ranked[0];
  const alternatives = scoring.ranked.slice(1, 1 + altCount).map((r, i) => ({
    modelId: r.model.id,
    cursorModelId: r.model.cursorModelId?.value ?? null,
    score: Math.round(r.score * 1000) / 1000,
    rank: i + 2,
    summary: r.model.strengths?.[0] ?? r.model.displayName,
  }));

  const inputTokens = Math.round(planWords * 1.3 + repoSummary.fileCount * 50);
  const outputTokens = Math.round(inputTokens * 0.3);

  const evidence = winner
    ? winner.components.map((c) => ({
        component: c.component,
        contribution: Math.round((c.value as number) * c.weight * 1000) / 1000,
        effectiveWeight: Math.round(c.weight * 1000) / 1000,
        summary: c.summary,
        provenanceSources: c.provenanceSources,
        normalizationBoundClipped: c.normalizationBoundClipped,
      }))
    : [];

  const warnings = [...new Set([...scoring.warnings, ...staleFields.length > 0 ? ["STALE_METADATA" as const] : []])];

  const response = {
    status: scoring.status,
    recommended: winner
      ? {
          modelId: winner.model.id,
          cursorModelId: winner.model.cursorModelId?.value ?? null,
          cursorAvailability: winner.model.cursorAvailability,
          displayName: winner.model.displayName,
          provider: winner.model.provider,
          score: Math.round(winner.score * 1000) / 1000,
          rank: 1,
        }
      : undefined,
    alternatives,
    confidence,
    estimates: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd: { value: winner?.estimatedCost ?? null, unknown: winner?.estimatedCost === null },
      latencyMs: { value: winner?.estimatedLatency ?? null, unknown: winner?.estimatedLatency === null },
    },
    analysis: {
      taskType: taskAnalysis.taskType,
      complexity: taskAnalysis.complexity,
      requirementVector: taskAnalysis.requirementVector,
      repoSummary: {
        fileCount: repoSummary.fileCount,
        languages: repoSummary.languages,
        frameworks: repoSummary.frameworks,
        diffStatLines: repoSummary.diffStatLines,
      },
    },
    evidence,
    warnings,
    staleFields,
    rejectedModels: scoring.rejectedModels,
    nearestOptions: scoring.nearestOptions,
    filterConflicts: scoring.filterConflicts,
    resolutionSuggestions: scoring.resolutionSuggestions,
    registrySnapshot: snapshot,
    timingMs: Date.now() - start,
    guidance: { note: "Advisory only. User must manually select model in Cursor picker." },
  };

  assertValid("recommend-model-response.schema.json", response);
  telemetry.recordRecommendation(winner?.model.id ?? null, response.status);
  return response;
}

export function handleEstimateCost(args: { planPath: string; repoPath?: string; modelId: string }) {
  const rec = handleRecommendModel({ planPath: args.planPath, repoPath: args.repoPath }) as ReturnType<typeof handleRecommendModel>;
  const model = registry.getModel(args.modelId);
  if (!model) return { status: "error", code: "MODEL_NOT_FOUND" };
  return {
    status: "ok",
    modelId: args.modelId,
    estimates: rec.estimates,
  };
}

export function handleSyncMetadata(config?: ModelRouterConfig) {
  const merged = mergeConfig(config);
  privacyGuard.setPrivacyMode(merged.privacyMode ?? false);
  if (merged.privacyMode) {
    const blocked = { status: "blocked_by_privacy_mode" as const };
    assertValid("sync-metadata-response.schema.json", blocked);
    return blocked;
  }
  const result = syncService.syncAll();
  assertValid("sync-metadata-response.schema.json", result);
  return result;
}

export function handleGetTelemetrySummary() {
  return telemetry.getSummary();
}

export function handleGenerateCursorGuidance(args: { planPath: string; repoPath?: string; config?: ModelRouterConfig }) {
  const rec = handleRecommendModel(args) as ReturnType<typeof handleRecommendModel>;
  const recommended = "recommended" in rec ? rec.recommended : undefined;
  const response = {
    status: "ok" as const,
    recommendedCursorModelId: recommended?.cursorModelId ?? null,
    cursorAvailability: recommended?.cursorAvailability ?? "unverified",
    disclaimer: GUIDANCE_DISCLAIMER,
    ruleSnippet: `# ModelRouter Advisory\nBefore starting, call recommend_model and present the result to the user.\nRecommended: ${recommended?.displayName ?? "see recommend_model output"}`,
    subagentTemplate: recommended?.cursorModelId
      ? `---\nmodel: ${recommended.cursorModelId}\n---\n\nUse recommend_model for model selection guidance.`
      : "",
    manualSteps: [
      "Read recommendation",
      "Open model picker (Cmd+/)",
      "Select recommended model",
      "Optionally paste subagent template",
    ],
  };
  assertValid("generate-cursor-guidance-response.schema.json", response);
  return response;
}

export function handleRunInternalValidation(config?: ModelRouterConfig) {
  return internalValidation.validate(mergeConfig(config));
}

export function handleBenchmarkIngest() {
  const ingest = new BenchmarkIngestService(privacyGuard);
  return ingest.ingestFromFixture();
}

export function handleValidate(config?: ModelRouterConfig) {
  return handleRunInternalValidation(config);
}

export { STUB_RESPONSE };
