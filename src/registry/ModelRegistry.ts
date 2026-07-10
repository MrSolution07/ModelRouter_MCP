import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import type { ModelProfile, ProvenanceField, RegistrySnapshot } from "../types/index.js";
import { getPackagedDataDir, getUserDataDir } from "../utils/paths.js";
import { assertValid } from "../schemas/validator.js";

const PROVENANCE_REQUIRED_PATHS = [
  "pricing.inputPerMillion",
  "pricing.outputPerMillion",
  "context.maxInputTokens",
  "context.maxOutputTokens",
  "latency.p50Ms",
] as const;

const STALE_SCALAR_PATHS = [
  "pricing.inputPerMillion",
  "pricing.outputPerMillion",
  "latency.p50Ms",
  "cursorModelId",
] as const;

function getAtPath(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function assertProvenanceField(value: unknown, path: string): void {
  if (!value || typeof value !== "object" || !("value" in value) || !("provenance" in value)) {
    throw new Error(`Model profile field ${path} must be a ProvenanceField wrapper`);
  }
  const pf = value as ProvenanceField<unknown>;
  if (!pf.provenance?.source || pf.provenance.confidence === undefined) {
    throw new Error(`Model profile field ${path} missing provenance metadata`);
  }
}

function collectModelFiles(dir: string): string[] {
  if (!dir) return [];
  try {
    return globSync("**/*.json", { cwd: dir, absolute: true }).filter((f) => !f.endsWith("_seed-provenance.json"));
  } catch {
    return [];
  }
}

export class ModelRegistry {
  private models: ModelProfile[] = [];
  private snapshot: RegistrySnapshot | null = null;
  private loadedAt = 0;

  load(mode: "static_seed" | "synced" = "static_seed"): RegistrySnapshot {
    const packagedDir = path.join(getPackagedDataDir(), "models");
    const userDir = path.join(getUserDataDir(), "models");

    const byId = new Map<string, { profile: ModelProfile; file: string }>();
    for (const file of collectModelFiles(packagedDir)) {
      const raw = JSON.parse(readFileSync(file, "utf-8")) as ModelProfile;
      byId.set(raw.id, { profile: raw, file });
    }
    for (const file of collectModelFiles(userDir)) {
      const raw = JSON.parse(readFileSync(file, "utf-8")) as ModelProfile;
      byId.set(raw.id, { profile: raw, file });
    }

    const hash = createHash("sha256");
    this.models = [];

    for (const { profile: raw, file } of [...byId.values()].sort((a, b) => a.profile.id.localeCompare(b.profile.id))) {
      this.validateProfile(raw, file);
      assertValid("model-profile.schema.json", raw);
      this.models.push(raw);
      hash.update(readFileSync(file));
    }

    const now = new Date().toISOString();
    this.snapshot = {
      id: hash.digest("hex").slice(0, 16),
      loadedAt: now,
      mode,
    };
    this.loadedAt = Date.now();
    return this.snapshot;
  }

  private validateProfile(profile: ModelProfile, file: string): void {
    for (const p of PROVENANCE_REQUIRED_PATHS) {
      const val = getAtPath(profile as unknown as Record<string, unknown>, p);
      assertProvenanceField(val, `${profile.id}.${p}`);
    }
    for (const [dim, field] of Object.entries(profile.capabilities ?? {})) {
      assertProvenanceField(field, `${profile.id}.capabilities.${dim}`);
      const conf = (field as ProvenanceField<number>).provenance.confidence;
      const src = (field as ProvenanceField<number>).provenance.source;
      if (conf > 0.5 && !["benchmark_ingest", "internal_validation", "cursor_api"].includes(src)) {
        throw new Error(`${file}: capabilities.${dim} confidence > 0.5 requires benchmark/internal/cursor source`);
      }
    }
  }

  getModels(): ModelProfile[] {
    if (!this.snapshot) this.load();
    return [...this.models];
  }

  getModel(id: string): ModelProfile | undefined {
    return this.getModels().find((m) => m.id === id);
  }

  getSnapshot(): RegistrySnapshot {
    if (!this.snapshot) this.load();
    return this.snapshot!;
  }

  getLoadTimeMs(): number {
    return this.loadedAt > 0 ? Date.now() - this.loadedAt : 0;
  }

  findStaleFields(maxAgeDays = 30): Array<{ modelId: string; field: string; lastVerified: string; ageDays: number }> {
    const stale: Array<{ modelId: string; field: string; lastVerified: string; ageDays: number }> = [];
    const now = Date.now();

    const checkField = (model: ModelProfile, fieldPath: string, field: ProvenanceField<unknown> | undefined) => {
      if (!field?.provenance?.lastVerified) return;
      const lv = new Date(field.provenance.lastVerified).getTime();
      const ageDays = (now - lv) / (1000 * 60 * 60 * 24);
      if (ageDays > maxAgeDays) {
        stale.push({
          modelId: model.id,
          field: fieldPath,
          lastVerified: field.provenance.lastVerified,
          ageDays: Math.round(ageDays),
        });
      }
    };

    for (const model of this.getModels()) {
      for (const [dim, field] of Object.entries(model.capabilities)) {
        checkField(model, `capabilities.${dim}`, field);
      }
      for (const p of STALE_SCALAR_PATHS) {
        const val = getAtPath(model as unknown as Record<string, unknown>, p);
        if (val && typeof val === "object" && "provenance" in val) {
          checkField(model, p, val as ProvenanceField<unknown>);
        }
      }
    }
    return stale;
  }

  applyInMemoryUpdate(
    modelId: string,
    fieldPath: string,
    value: number,
    provenance: import("../types/index.js").Provenance,
  ): void {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) return;
    if (fieldPath.startsWith("capabilities.")) {
      const dim = fieldPath.replace("capabilities.", "");
      model.capabilities[dim] = { value, provenance };
    }
    if (this.snapshot) {
      this.snapshot.mode = "synced";
    }
  }

  applyInMemoryBenchmarks(
    modelId: string,
    benchmarks: NonNullable<ModelProfile["benchmarks"]>,
    capabilityUpdates: Record<string, { value: number; provenance: import("../types/index.js").Provenance }>,
  ): void {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) return;
    model.benchmarks = benchmarks;
    for (const [dim, field] of Object.entries(capabilityUpdates)) {
      model.capabilities[dim] = field;
    }
    if (this.snapshot) {
      this.snapshot.mode = "synced";
    }
  }

  reload(): RegistrySnapshot {
    return this.load(this.snapshot?.mode ?? "static_seed");
  }
}

export const registry = new ModelRegistry();
