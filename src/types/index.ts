export type PayloadClass = "A" | "B" | "C" | "D" | "E";

export type ProvenanceSource =
  | "openrouter_api"
  | "cursor_api"
  | "provider_docs"
  | "benchmark_ingest"
  | "internal_validation"
  | "manual_curated";

export interface Provenance {
  source: ProvenanceSource;
  sourceUrl: string | null;
  retrievedAt: string;
  lastVerified: string;
  confidence: number;
  license: string | null;
}

export interface ProvenanceField<T> {
  value: T;
  provenance: Provenance;
}

export interface ModelProfile {
  id: string;
  cursorModelId?: ProvenanceField<string>;
  cursorAvailability: "verified" | "documented" | "unverified" | "not_applicable";
  provider: string;
  displayName: string;
  status: "preview" | "active" | "deprecated" | "unavailable";
  statusChangedAt: string;
  version: string;
  releaseDate?: string | null;
  deprecatedAt?: string | null;
  availability: {
    regions: string[];
    requiresMaxMode: boolean;
    tier: "free" | "standard" | "premium";
  };
  pricing: {
    inputPerMillion: ProvenanceField<number>;
    outputPerMillion: ProvenanceField<number>;
    currency: string;
    unknown: boolean;
  };
  context: {
    maxInputTokens: ProvenanceField<number>;
    maxOutputTokens: ProvenanceField<number>;
  };
  features: Record<string, ProvenanceField<boolean>>;
  capabilities: Record<string, ProvenanceField<number>>;
  benchmarks?: Array<{
    name: string;
    rawScore: number;
    normalizedScore: number;
    mappedDimensions: string[];
    benchmarkModelAlias: string;
    provenance: Provenance;
  }>;
  latency: {
    p50Ms: ProvenanceField<number>;
  };
  aliases: string[];
  validationStatus: "ok" | "degraded";
  limitations?: string[];
  strengths?: string[];
}

export interface ModelRouterConfig {
  privacyMode?: boolean;
  excludedProviders?: string[];
  freeOnlyMode?: boolean;
  localOnlyMode?: boolean;
  maxBudget?: number | null;
  allowBudgetRelaxation?: boolean;
  preferredProviders?: string[];
  logPaths?: boolean;
  validation?: {
    enabled?: boolean;
    apiKeys?: Record<string, string>;
  };
  sync?: {
    enabled?: boolean;
    sources?: string[];
  };
}

export interface RequirementVector {
  [dimension: string]: number;
}

export interface TaskAnalysis {
  taskType: string;
  complexity: number;
  requirementVector: RequirementVector;
  signals: Array<{ signal: string; weight: number; matched: boolean }>;
}

export interface RepoSummary {
  fileCount: number;
  languages: string[];
  frameworks: string[];
  diffStatLines: { added: number; removed: number };
}

export interface RegistrySnapshot {
  id: string;
  loadedAt: string;
  mode: "static_seed" | "synced";
}

export const STUB_RESPONSE = { status: "not_implemented" as const, _fixture: true };

export const GUIDANCE_DISCLAIMER =
  "Cursor may ignore subagent model field. Rules do not control model picker. User must confirm model switch.";
