import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const FORBIDDEN = [/claude-sonnet/i, /gpt-4o/i, /gemini-pro/i, /deepseek-coder/i, /gpt-4o-mini/i, /claude-haiku/i];

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

describe("no model IDs in src", () => {
  it("scoring and analysis modules do not hardcode model IDs", () => {
    const srcDir = path.join(import.meta.dirname, "../../src");
    const checkDirs = ["scoring", "analysis"];
    for (const sub of checkDirs) {
      for (const file of walk(path.join(srcDir, sub))) {
        const content = readFileSync(file, "utf-8");
        for (const pattern of FORBIDDEN) {
          expect(content).not.toMatch(pattern);
        }
      }
    }
  });
});
