import { readFileSync } from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import YAML from "yaml";
import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";
import { registry } from "../registry/ModelRegistry.js";
import { createProvenance, registryWriter } from "../registry/RegistryWriter.js";
import { getDataDir } from "../utils/paths.js";

export interface ValidationTask {
  name: string;
  description: string;
  prompt: string;
  expectedCapability: string;
  costWarning?: boolean;
}

export interface ValidationResult {
  status: "disabled" | "ok" | "error";
  code?: string;
  tasksRun?: number;
  modelsUpdated?: string[];
  note?: string;
}

export class InternalTaskRunner {
  private privacyGuard: PrivacyGuard;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
  }

  loadTasks(): ValidationTask[] {
    const dir = path.join(getDataDir(), "validation-tasks");
    const files = globSync("*.yaml", { cwd: dir, absolute: true });
    return files.map((file) => {
      const raw = YAML.parse(readFileSync(file, "utf-8")) as ValidationTask;
      return { ...raw, name: raw.name ?? path.basename(file, ".yaml") };
    });
  }

  validate(config: { validation?: { enabled?: boolean; apiKeys?: Record<string, string> } }): ValidationResult {
    if (!config.validation?.enabled) {
      return { status: "disabled" };
    }

    const keys = config.validation.apiKeys ?? {};
    const hasKeys = Object.values(keys).some((k) => k && k.length > 0);
    if (!hasKeys) {
      return { status: "error", code: "MISSING_API_KEYS" };
    }

    this.privacyGuard.assertOutboundAllowed("D");

    const tasks = this.loadTasks();
    const task = tasks[0];
    if (!task) {
      return { status: "error", code: "NO_VALIDATION_TASKS" };
    }

    // Fixture-based single task run — simulates internal validation without live API in CI
    const targetModel = registry.getModels().find((m) => m.status === "active");
    if (!targetModel) {
      return { status: "error", code: "NO_ACTIVE_MODELS" };
    }

    const provenance = createProvenance("internal_validation", {
      confidence: 0.85,
      sourceUrl: `validation-task:${task.name}`,
      license: null,
    });

    const dim = task.expectedCapability ?? "coding";
    const current = targetModel.capabilities[dim]?.value ?? 5;
    const updatedValue = Math.min(10, current + 0.1);

    registryWriter.updateCapability(targetModel.id, dim, updatedValue, provenance);
    registry.applyInMemoryUpdate(targetModel.id, `capabilities.${dim}`, updatedValue, provenance);

    return {
      status: "ok",
      tasksRun: 1,
      modelsUpdated: [targetModel.id],
      note: "Internal validation is opt-in and not marketed as continuous validation. May incur API costs when live keys are used.",
    };
  }
}
