import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let bootstrapped = false;

export function getProjectRoot(): string {
  return path.resolve(__dirname, "../..");
}

/** Read-only packaged data: seeds, calibration, schemas, sync fixtures. */
export function getPackagedDataDir(): string {
  return path.join(getProjectRoot(), "data");
}

/** Writable user cache: models/, benchmarks/unmatched/, sync-state.json. */
export function getUserDataDir(): string {
  const override = process.env.MODELROUTER_DATA_DIR;
  const dir = override ? path.resolve(override) : path.join(os.homedir(), ".modelrouter");
  if (!bootstrapped) {
    bootstrapUserDataDir(dir);
    bootstrapped = true;
  }
  return dir;
}

/** @deprecated Use getPackagedDataDir() or getUserDataDir() explicitly. */
export function getDataDir(): string {
  return getPackagedDataDir();
}

export function getSchemasDir(): string {
  return path.join(getProjectRoot(), "schemas");
}

export function bootstrapUserDataDir(userDir?: string): void {
  const target = userDir ?? (process.env.MODELROUTER_DATA_DIR ? path.resolve(process.env.MODELROUTER_DATA_DIR) : path.join(os.homedir(), ".modelrouter"));
  const userModels = path.join(target, "models");
  const packagedModels = path.join(getPackagedDataDir(), "models");

  mkdirSync(path.join(target, "benchmarks", "unmatched"), { recursive: true });

  const hasModels =
    existsSync(userModels) &&
    readdirSync(userModels, { withFileTypes: true }).some((e) => e.isDirectory() || e.name.endsWith(".json"));

  if (!hasModels) {
    mkdirSync(userModels, { recursive: true });
    cpSync(packagedModels, userModels, { recursive: true });
  }
}
