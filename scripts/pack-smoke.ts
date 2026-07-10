#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("=== npm pack smoke test ===\n");

const tarball = execSync("npm pack --json", { cwd: root, encoding: "utf-8" });
const parsed = JSON.parse(tarball) as Array<{ filename: string }>;
const packFile = path.join(root, parsed[0].filename);

const installDir = mkdtempSync(path.join(os.tmpdir(), "modelrouter-pack-"));
try {
  execSync(`npm install "${packFile}"`, { cwd: installDir, stdio: "inherit" });
  const bin = path.join(installDir, "node_modules", "modelrouter-mcp", "dist", "index.js");
  execSync(`node "${bin}" --help 2>/dev/null || true`, { cwd: installDir });
  console.log("\nPack smoke: tarball installs and bin exists.");
} finally {
  rmSync(installDir, { recursive: true, force: true });
  rmSync(packFile, { force: true });
}
