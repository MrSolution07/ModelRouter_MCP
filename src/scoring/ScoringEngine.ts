import { readFileSync } from "node:fs";
import path from "node:path";
import type { ModelProfile, ModelRouterConfig, ProvenanceField, RequirementVector } from "../types/index.js";
import { getPackagedDataDir } from "../utils/paths.js";

interface NormalizationBounds {
  costUsd: { min: number; max: number };
  latencyMs: { min: number; max: number };
}

interface ScoringWeights {
  [key: string]: { weight: number };
}

interface ConfidenceWeights {
  [key: string]: { weight: number };
}

export interface ScoreComponent {
  component: string;
  value: number | null;
  weight: number;
  summary: string;
  provenanceSources: string[];
  normalizationBoundClipped: boolean;
}

export interface ScoredModel {
  model: ModelProfile;
  score: number;
  components: ScoreComponent[];
  rejected?: string;
  estimatedCost: number | null;
  estimatedLatency: number | null;
}

export interface ScoringResult {
  ranked: ScoredModel[];
  rejectedModels: Array<{ modelId: string; reason: string }>;
  nearestOptions: Array<{ modelId: string; reason: string; relaxationApplied: string }>;
  status: "ok" | "no_eligible_models" | "filter_conflict" | "error";
  warnings: string[];
  filterConflicts: string[];
  resolutionSuggestions: string[];
  code?: string;
}

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(getPackagedDataDir(), "calibration", file), "utf-8")) as T;
}

export function getCalibrationStatus(): "provisional" | "validated" {
  const weights = loadJson<{ calibrationStatus?: string }>("scoring-weights.json");
  return weights.calibrationStatus === "validated" ? "validated" : "provisional";
}

export function normalizeValue(value: number, min: number, max: number): { normalized: number; clipped: boolean } {
  const clipped = value > max || value < min;
  const clamped = Math.max(min, Math.min(max, value));
  return { normalized: (clamped - min) / (max - min), clipped };
}

function normalize(value: number, min: number, max: number): { normalized: number; clipped: boolean } {
  return normalizeValue(value, min, max);
}

function cosineSimilarity(a: RequirementVector, b: Record<string, ProvenanceField<number>>): { score: number; sources: string[]; lowEvidence: boolean } {
  const sources: string[] = [];
  let dot = 0;
  let magA = 0;
  let magB = 0;
  let hasLowEvidence = false;
  let dimCount = 0;

  for (const [dim, reqVal] of Object.entries(a)) {
    const field = b[dim];
    if (!field) continue;
    const conf = field.provenance.confidence;
    if (conf < 0.1) continue;
    let weight = 1;
    if (conf < 0.5) {
      weight = 0.5;
      hasLowEvidence = true;
    }
    const bVal = field.value * weight;
    dot += reqVal * bVal;
    magA += reqVal * reqVal;
    magB += bVal * bVal;
    sources.push(field.provenance.source);
    dimCount++;
  }

  if (dimCount === 0) return { score: 0, sources: [], lowEvidence: true };
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return { score: denom === 0 ? 0 : dot / denom, sources, lowEvidence: hasLowEvidence };
}

function contextFitness(requiredTokens: number, maxTokens: number): number {
  if (maxTokens === 0) return 0;
  const ratio = requiredTokens / maxTokens;
  if (ratio > 1) return 0;
  if (ratio <= 1.2) return 0.5;
  if (ratio <= 2) return 0.8;
  return 1.0;
}

function estimateTokens(planWords: number, repoFiles: number): { input: number; output: number } {
  const input = Math.round(planWords * 1.3 + repoFiles * 50);
  const output = Math.round(input * 0.3);
  return { input, output: output };
}

function estimateCost(model: ModelProfile, inputTokens: number, outputTokens: number): number | null {
  if (model.pricing.unknown) return null;
  const inputCost = (inputTokens / 1_000_000) * model.pricing.inputPerMillion.value;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.outputPerMillion.value;
  return inputCost + outputCost;
}

interface FilterOptions {
  maxBudget?: number | null;
  freeOnly?: boolean;
  localOnly?: boolean;
  excludedProviders?: string[];
  relaxBudget?: boolean;
  relaxFreeOnly?: boolean;
  relaxLocalOnly?: boolean;
}

function passesFilters(model: ModelProfile, opts: FilterOptions, estimatedCost: number | null, contextFit: number): string | null {
  if (model.status === "deprecated" || model.status === "unavailable") return "deprecated";
  if (opts.excludedProviders?.includes(model.provider)) return "provider_excluded";
  if (contextFit === 0) return "context_insufficient";
  if (opts.freeOnly && model.availability.tier !== "free") return "budget_exceeded";
  if (opts.localOnly && !model.availability.regions.includes("local")) return "provider_excluded";
  if (opts.maxBudget != null && opts.maxBudget > 0) {
    if (estimatedCost === null) return "pricing_unknown_under_budget";
    if (estimatedCost > opts.maxBudget) return "budget_exceeded";
  }
  return null;
}

function scoreModel(
  model: ModelProfile,
  requirementVector: RequirementVector,
  config: ModelRouterConfig,
  inputTokens: number,
  outputTokens: number,
  bounds: NormalizationBounds,
  weights: ScoringWeights,
): { components: ScoreComponent[]; totalScore: number; estimatedCost: number | null; estimatedLatency: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const { score: capScore, sources: capSources, lowEvidence } = cosineSimilarity(requirementVector, model.capabilities);
  if (lowEvidence) warnings.push("LOW_CAPABILITY_EVIDENCE");

  const estimatedCost = estimateCost(model, inputTokens, outputTokens);
  const estimatedLatency = model.latency.p50Ms.value;

  let costEff: number | null = null;
  let costClipped = false;
  if (!model.pricing.unknown && estimatedCost !== null) {
    const { normalized, clipped } = normalize(estimatedCost, bounds.costUsd.min, bounds.costUsd.max);
    costEff = 1 - normalized;
    costClipped = clipped;
    if (clipped) warnings.push("NORMALIZATION_CLIPPED");
  } else {
    warnings.push("PRICING_UNKNOWN");
  }

  const ctxFit = contextFitness(inputTokens + outputTokens, model.context.maxInputTokens.value);
  const { normalized: latNorm, clipped: latClipped } = normalize(estimatedLatency, bounds.latencyMs.min, bounds.latencyMs.max);
  const latScore = 1 - latNorm;
  if (latClipped) warnings.push("NORMALIZATION_CLIPPED");

  let benchScore: number | null = null;
  const benchSources: string[] = [];
  if (model.benchmarks && model.benchmarks.length > 0) {
    benchScore = model.benchmarks.reduce((s, b) => s + b.normalizedScore, 0) / model.benchmarks.length / 10;
    benchSources.push("benchmark_ingest");
  }

  let prefAlign: number | null = null;
  if (config.preferredProviders?.includes(model.provider)) {
    prefAlign = 1.0;
  }

  const reliability = model.validationStatus === "degraded" ? 0.5 : 0.7;

  const rawComponents: ScoreComponent[] = [
    { component: "capabilityMatch", value: capScore, weight: weights.capabilityMatch?.weight ?? 0.3, summary: `Capability cosine: ${capScore.toFixed(3)}`, provenanceSources: capSources, normalizationBoundClipped: false },
    { component: "costEfficiency", value: costEff, weight: weights.costEfficiency?.weight ?? 0.15, summary: costEff !== null ? `Cost efficiency: ${costEff.toFixed(3)}` : "Pricing unknown", provenanceSources: ["provider_docs"], normalizationBoundClipped: costClipped },
    { component: "contextFitness", value: ctxFit, weight: weights.contextFitness?.weight ?? 0.15, summary: `Context headroom: ${ctxFit}`, provenanceSources: ["provider_docs"], normalizationBoundClipped: false },
    { component: "latencyScore", value: latScore, weight: weights.latencyScore?.weight ?? 0.1, summary: `Latency score: ${latScore.toFixed(3)}`, provenanceSources: ["manual_curated"], normalizationBoundClipped: latClipped },
    { component: "reliability", value: reliability, weight: weights.reliability?.weight ?? 0.1, summary: `Reliability: ${reliability}`, provenanceSources: ["manual_curated"], normalizationBoundClipped: false },
    { component: "benchmarkSignal", value: benchScore, weight: weights.benchmarkSignal?.weight ?? 0.1, summary: benchScore !== null ? `Benchmark: ${benchScore.toFixed(3)}` : "No benchmarks", provenanceSources: benchSources, normalizationBoundClipped: false },
    { component: "preferenceAlignment", value: prefAlign, weight: weights.preferenceAlignment?.weight ?? 0.1, summary: prefAlign !== null ? "Preferred provider" : "No preference", provenanceSources: [], normalizationBoundClipped: false },
  ];

  const active = rawComponents.filter((c) => c.value !== null);
  const totalWeight = active.reduce((s, c) => s + c.weight, 0);
  let totalScore = 0;
  for (const c of active) {
    c.weight = c.weight / totalWeight;
    totalScore += c.weight * (c.value as number);
  }

  if (model.validationStatus === "degraded") warnings.push("MODEL_DEGRADED");
  if (model.cursorAvailability === "unverified") warnings.push("CURSOR_ID_UNVERIFIED");

  return { components: active, totalScore, estimatedCost, estimatedLatency, warnings };
}

export function scoreModels(
  models: ModelProfile[],
  requirementVector: RequirementVector,
  config: ModelRouterConfig,
  planWords: number,
  repoFiles: number,
): ScoringResult {
  const bounds = loadJson<NormalizationBounds>("normalization-bounds.json");
  const weights = loadJson<ScoringWeights>("scoring-weights.json");
  const { input, output } = estimateTokens(planWords, repoFiles);
  const warnings: string[] = [];
  const rejectedModels: Array<{ modelId: string; reason: string }> = [];

  const hasAnyCapability = models.some((m) => Object.keys(m.capabilities).length > 0);
  if (!hasAnyCapability) {
    return { ranked: [], rejectedModels: [], nearestOptions: [], status: "error", warnings: ["INSUFFICIENT_REGISTRY_EVIDENCE"], filterConflicts: [], resolutionSuggestions: [], code: "INSUFFICIENT_REGISTRY_EVIDENCE" };
  }

  function runPass(opts: FilterOptions): ScoredModel[] {
    const scored: ScoredModel[] = [];
    for (const model of models) {
      const { components, totalScore, estimatedCost, estimatedLatency, warnings: mw } = scoreModel(model, requirementVector, config, input, output, bounds, weights);
      const ctxFit = components.find((c) => c.component === "contextFitness")?.value ?? 0;
      const reject = passesFilters(model, opts, estimatedCost, ctxFit as number);
      if (reject) {
        rejectedModels.push({ modelId: model.id, reason: reject });
        continue;
      }
      scored.push({ model, score: totalScore, components, estimatedCost, estimatedLatency });
      warnings.push(...mw);
    }
    return scored.sort((a, b) => b.score - a.score);
  }

  // Pass 1 — strict
  let ranked = runPass({
    maxBudget: config.maxBudget,
    freeOnly: config.freeOnlyMode,
    localOnly: config.localOnlyMode,
    excludedProviders: config.excludedProviders,
  });
  if (ranked.length > 0) {
    return { ranked, rejectedModels, nearestOptions: [], status: "ok", warnings: [...new Set(warnings)], filterConflicts: [], resolutionSuggestions: [] };
  }

  const nearestOptions: ScoringResult["nearestOptions"] = [];

  // Pass 2 — relax budget
  if (config.maxBudget != null) {
    ranked = runPass({ freeOnly: config.freeOnlyMode, localOnly: config.localOnlyMode, excludedProviders: config.excludedProviders, relaxBudget: true });
    if (ranked.length > 0) {
      for (const r of ranked.slice(0, 3)) {
        nearestOptions.push({ modelId: r.model.id, reason: "Exceeds budget but otherwise eligible", relaxationApplied: "budget" });
      }
      if (config.allowBudgetRelaxation) {
        return { ranked, rejectedModels, nearestOptions, status: "ok", warnings: [...new Set(warnings)], filterConflicts: [], resolutionSuggestions: [] };
      }
      return { ranked: [], rejectedModels, nearestOptions, status: "no_eligible_models", warnings: [...new Set(warnings)], filterConflicts: [], resolutionSuggestions: ["Increase maxBudget or set allowBudgetRelaxation: true"] };
    }
  }

  // Pass 3 — relax freeOnly
  if (config.freeOnlyMode) {
    ranked = runPass({ localOnly: config.localOnlyMode, excludedProviders: config.excludedProviders, relaxFreeOnly: true });
    if (ranked.length > 0) {
      for (const r of ranked.slice(0, 3)) nearestOptions.push({ modelId: r.model.id, reason: "Not free tier", relaxationApplied: "freeOnly" });
      return { ranked: [], rejectedModels, nearestOptions, status: "no_eligible_models", warnings: [...new Set(warnings)], filterConflicts: [], resolutionSuggestions: ["Disable freeOnlyMode"] };
    }
  }

  // Pass 4 — relax localOnly
  if (config.localOnlyMode) {
    ranked = runPass({ excludedProviders: config.excludedProviders, relaxLocalOnly: true });
    if (ranked.length > 0) {
      for (const r of ranked.slice(0, 3)) nearestOptions.push({ modelId: r.model.id, reason: "Not local", relaxationApplied: "localOnly" });
      const filterConflicts: string[] = [];
      if (config.freeOnlyMode && config.localOnlyMode) {
        filterConflicts.push("freeOnlyMode + localOnlyMode may have empty intersection");
      }
      return {
        ranked: [],
        rejectedModels,
        nearestOptions,
        status: filterConflicts.length > 0 ? "filter_conflict" : "no_eligible_models",
        warnings: [...new Set(warnings)],
        filterConflicts,
        resolutionSuggestions: filterConflicts.length > 0 ? ["Relax freeOnlyMode or localOnlyMode"] : ["Disable localOnlyMode"],
      };
    }
  }

  const filterConflicts: string[] = [];
  if (config.freeOnlyMode && config.localOnlyMode) {
    filterConflicts.push("freeOnlyMode + localOnlyMode may have empty intersection");
  }

  return {
    ranked: [],
    rejectedModels,
    nearestOptions,
    status: filterConflicts.length > 0 ? "filter_conflict" : "no_eligible_models",
    warnings: [...new Set(warnings)],
    filterConflicts,
    resolutionSuggestions: filterConflicts.length > 0 ? ["Relax freeOnlyMode or localOnlyMode"] : ["Review filter configuration"],
  };
}

export function computeConfidence(
  scoring: ScoringResult,
  staleFieldCount: number,
): { value: number; factors: Record<string, number>; calibrationStatus: "provisional" | "validated" } {
  const weights = loadJson<ConfidenceWeights>("confidence-weights.json");
  const top = scoring.ranked[0];
  const second = scoring.ranked[1];

  const evidenceCoverage = top ? Math.min(0.6, top.components.filter((c) => c.provenanceSources.length > 0).length / 5) : 0;
  const scoreMargin = top && second ? Math.min(1, top.score - second.score) : top ? 0.5 : 0;
  const dataFreshness = Math.max(0, 1 - staleFieldCount * 0.1);
  const validationRecency = top?.model.validationStatus === "ok" ? 0.8 : 0.4;
  const ctxComp = top?.components.find((c) => c.component === "contextFitness");
  const contextHeadroom = (ctxComp?.value as number) ?? 0;

  const factors = { evidenceCoverage, scoreMargin, dataFreshness, validationRecency, contextHeadroom };
  let value = 0;
  for (const [k, v] of Object.entries(factors)) {
    value += v * (weights[k]?.weight ?? 0.2);
  }

  if (scoring.warnings.includes("LOW_CAPABILITY_EVIDENCE")) {
    value = Math.min(value, 0.6);
  }

  return { value: Math.round(value * 1000) / 1000, factors, calibrationStatus: getCalibrationStatus() };
}
