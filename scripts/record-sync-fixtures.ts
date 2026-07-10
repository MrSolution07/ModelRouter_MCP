#!/usr/bin/env tsx
/** Maintainer tool: record live sync fixtures from external endpoints (requires network). */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data/sync/fixtures");

async function main() {
  mkdirSync(outDir, { recursive: true });

  const orRes = await fetch("https://openrouter.ai/api/v1/models");
  if (orRes.ok) {
    const body = await orRes.json();
    writeFileSync(path.join(outDir, "openrouter-models.json"), JSON.stringify(body, null, 2) + "\n");
    console.log("Wrote openrouter-models.json");
  } else {
    console.warn(`OpenRouter fetch failed: ${orRes.status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
