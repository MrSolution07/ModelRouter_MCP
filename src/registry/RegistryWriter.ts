import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import type { ModelProfile, Provenance, ProvenanceField } from "../types/index.js";
import { atomicWriteJson } from "../utils/atomicWrite.js";
import { getPackagedDataDir, getUserDataDir } from "../utils/paths.js";

export function createProvenance(
  source: Provenance["source"],
  overrides: Partial<Provenance> = {},
): Provenance {
  const now = new Date().toISOString();
  return {
    source,
    sourceUrl: null,
    retrievedAt: now,
    lastVerified: now,
    confidence: 0.3,
    license: null,
    ...overrides,
  };
}

export function provenanceField<T>(value: T, source: Provenance["source"], overrides?: Partial<Provenance>): ProvenanceField<T> {
  return { value, provenance: createProvenance(source, overrides) };
}

export class RegistryWriter {
  private modelPathIndex = new Map<string, string>();

  private packagedModelsDir(): string {
    return path.join(getPackagedDataDir(), "models");
  }

  private userModelsDir(): string {
    return path.join(getUserDataDir(), "models");
  }

  indexModels(): void {
    this.modelPathIndex.clear();
    const userDir = this.userModelsDir();
    const files = globSync("**/*.json", { cwd: userDir, absolute: true }).filter(
      (f) => !f.endsWith("_seed-provenance.json"),
    );
    for (const file of files) {
      const profile = JSON.parse(readFileSync(file, "utf-8")) as ModelProfile;
      this.modelPathIndex.set(profile.id, file);
    }
  }

  getModelPath(modelId: string): string | undefined {
    if (this.modelPathIndex.size === 0) this.indexModels();

    const existing = this.modelPathIndex.get(modelId);
    if (existing) return existing;

    const packagedFiles = globSync("**/*.json", { cwd: this.packagedModelsDir(), absolute: true }).filter(
      (f) => !f.endsWith("_seed-provenance.json"),
    );
    for (const packagedFile of packagedFiles) {
      const profile = JSON.parse(readFileSync(packagedFile, "utf-8")) as ModelProfile;
      if (profile.id !== modelId) continue;
      const rel = path.relative(this.packagedModelsDir(), packagedFile);
      const userFile = path.join(this.userModelsDir(), rel);
      mkdirSync(path.dirname(userFile), { recursive: true });
      copyFileSync(packagedFile, userFile);
      this.modelPathIndex.set(modelId, userFile);
      return userFile;
    }
    return undefined;
  }

  private writeProfile(filePath: string, profile: ModelProfile): void {
    atomicWriteJson(filePath, profile);
  }

  updateCapability(
    modelId: string,
    dimension: string,
    value: number,
    provenance: Provenance,
  ): boolean {
    const filePath = this.getModelPath(modelId);
    if (!filePath) return false;

    const profile = JSON.parse(readFileSync(filePath, "utf-8")) as ModelProfile;
    profile.capabilities[dimension] = { value, provenance };
    this.writeProfile(filePath, profile);
    return true;
  }

  updatePricing(
    modelId: string,
    inputPerMillion: number,
    outputPerMillion: number,
    provenance: Provenance,
    unknown = false,
  ): boolean {
    const filePath = this.getModelPath(modelId);
    if (!filePath) return false;

    const profile = JSON.parse(readFileSync(filePath, "utf-8")) as ModelProfile;
    profile.pricing = {
      inputPerMillion: { value: inputPerMillion, provenance },
      outputPerMillion: { value: outputPerMillion, provenance },
      currency: "USD",
      unknown,
    };
    this.writeProfile(filePath, profile);
    return true;
  }

  updateBenchmarks(
    modelId: string,
    benchmarks: NonNullable<ModelProfile["benchmarks"]>,
    capabilityUpdates: Record<string, { value: number; provenance: Provenance }>,
  ): boolean {
    const filePath = this.getModelPath(modelId);
    if (!filePath) return false;

    const profile = JSON.parse(readFileSync(filePath, "utf-8")) as ModelProfile;
    profile.benchmarks = benchmarks;
    for (const [dim, field] of Object.entries(capabilityUpdates)) {
      profile.capabilities[dim] = field;
    }
    this.writeProfile(filePath, profile);
    return true;
  }

  writeQuarantine(dir: string, filename: string, payload: unknown): void {
    const fullDir = path.join(getUserDataDir(), dir);
    atomicWriteJson(path.join(fullDir, filename), payload);
  }
}

export const registryWriter = new RegistryWriter();
