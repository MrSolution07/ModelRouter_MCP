import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanRoots = [path.join(root, "src"), path.join(root, "scripts")];
const denylist = ["Cursor.models.list", "vscode.cursor.setModel"];

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.ts$/.test(entry.name)) files.push(full);
  }
  return files;
}

let violations = 0;
for (const scanRoot of scanRoots) {
  for (const file of walk(scanRoot)) {
    if (file.includes("lint-cursor-denylist")) continue;
    const content = readFileSync(file, "utf-8");
    for (const term of denylist) {
      if (content.includes(term)) {
        console.error(`DENYLIST VIOLATION: ${term} in ${path.relative(root, file)}`);
        violations++;
      }
    }
  }
}

if (violations > 0) process.exit(1);
console.log("No Cursor API denylist violations.");
