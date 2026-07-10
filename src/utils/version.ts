import { readFileSync } from "node:fs";
import path from "node:path";
import { getProjectRoot } from "./paths.js";

let cachedVersion: string | null = null;

export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion;
  const pkg = JSON.parse(readFileSync(path.join(getProjectRoot(), "package.json"), "utf-8")) as { version: string };
  cachedVersion = pkg.version;
  return cachedVersion;
}
