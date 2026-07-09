import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getProjectRoot(): string {
  return path.resolve(__dirname, "../..");
}

export function getDataDir(): string {
  return path.join(getProjectRoot(), "data");
}

export function getSchemasDir(): string {
  return path.join(getProjectRoot(), "schemas");
}
