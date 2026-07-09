/**
 * Optional maintainer script — NOT called by MCP runtime.
 * Verifies seed cursorModelId values against GET https://api.cursor.com/v1/models
 * when CURSOR_API_KEY is set. Failure is non-blocking.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = process.env.CURSOR_API_KEY;

async function main() {
  if (!apiKey) {
    console.log("CURSOR_API_KEY not set — skipping verification (non-blocking)");
    process.exit(0);
  }

  const res = await fetch("https://api.cursor.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    console.warn(`Cursor API returned ${res.status} — seeds keep cursorAvailability: documented`);
    process.exit(0);
  }

  const body = (await res.json()) as { items?: Array<{ id: string }> };
  const apiIds = new Set((body.items ?? []).map((i) => i.id));
  const modelFiles = globSync("data/models/**/*.json", { cwd: root }).filter((f) => !f.includes("_seed-provenance"));

  for (const file of modelFiles) {
    const profile = JSON.parse(readFileSync(path.join(root, file), "utf-8"));
    const cursorId = profile.cursorModelId?.value;
    if (!cursorId || cursorId === "example-cursor-model-id") continue;
    if (apiIds.has(cursorId)) {
      console.log(`VERIFIED ${profile.id}: ${cursorId}`);
    } else {
      console.warn(`UNVERIFIED ${profile.id}: ${cursorId} not in Cursor API`);
    }
  }
}

main().catch((err) => {
  console.warn("verify-cursor-ids failed (non-blocking):", err);
  process.exit(0);
});
