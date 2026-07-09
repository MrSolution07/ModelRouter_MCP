import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import type { ModelProfile, Provenance, ProvenanceField } from "../types/index.js";
import { getDataDir } from "../utils/paths.js";

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

  indexModels(): void {
    const modelsDir = path.join(getDataDir(), "models");
    const files = globSync("**/*.json", { cwd: modelsDir, absolute: true }).filter(
      (f) => !f.endsWith("_seed-provenance.json"),
    );
    for (const file of files) {
      const profile = JSON.parse(readFileSync(file, "utf-8")) as ModelProfile;
      this.modelPathIndex.set(profile.id, file);
    }
  }

  getModelPath(modelId: string): string | undefined {
    if (this.modelPathIndex.size === 0) this.indexModels();
    return this.modelPathIndex.get(modelId);
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
    writeFileSync(filePath, JSON.stringify(profile, null, 2) + "\n");
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
    writeFileSync(filePath, JSON.stringify(profile, null, 2) + "\n");
    return true;
  }

  writeQuarantine(dir: string, filename: string, payload: unknown): void {
    const fullDir = path.join(getDataDir(), dir);
    mkdirSync(fullDir, { recursive: true });
    writeFileSync(path.join(fullDir, filename), JSON.stringify(payload, null, 2) + "\n");
  }
}

export const registryWriter = new RegistryWriter();
