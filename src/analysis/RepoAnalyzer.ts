import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { RepoSummary } from "../types/index.js";

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".rb": "ruby",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".swift": "swift",
  ".kt": "kotlin",
};

const FRAMEWORK_MARKERS: Record<string, string[]> = {
  nextjs: ["next.config", "next/"],
  react: ["react", "jsx", "tsx"],
  vue: ["vue"],
  django: ["django"],
  fastapi: ["fastapi"],
  express: ["express"],
  nestjs: ["@nestjs"],
};

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "graphify-out"]);

function countFiles(dir: string, maxDepth = 4, depth = 0): { count: number; extensions: Map<string, number> } {
  let count = 0;
  const extensions = new Map<string, number>();
  if (depth > maxDepth) return { count, extensions };

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return { count, extensions };
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const sub = countFiles(full, maxDepth, depth + 1);
      count += sub.count;
      for (const [ext, n] of sub.extensions) extensions.set(ext, (extensions.get(ext) ?? 0) + n);
    } else if (st.isFile()) {
      count++;
      const ext = path.extname(entry).toLowerCase();
      extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
    }
  }
  return { count, extensions };
}

function detectFrameworks(repoPath: string): string[] {
  const found = new Set<string>();
  const checkFiles = ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod"];
  for (const f of checkFiles) {
    const fp = path.join(repoPath, f);
    try {
      const content = readFileSync(fp, "utf-8").toLowerCase();
      for (const [fw, markers] of Object.entries(FRAMEWORK_MARKERS)) {
        if (markers.some((m) => content.includes(m))) found.add(fw);
      }
    } catch {
      // file absent
    }
  }
  return [...found];
}

function getDiffStats(repoPath: string): { added: number; removed: number } {
  try {
    const out = execSync("git diff --stat HEAD 2>/dev/null || git diff --stat", {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 3000,
    });
    let added = 0;
    let removed = 0;
    const summary = out.split("\n").pop() ?? "";
    const match = summary.match(/(\d+) insertion.*?(\d+) deletion/);
    if (match) {
      added = parseInt(match[1], 10);
      removed = parseInt(match[2], 10);
    } else {
      const insOnly = summary.match(/(\d+) insertion/);
      const delOnly = summary.match(/(\d+) deletion/);
      if (insOnly) added = parseInt(insOnly[1], 10);
      if (delOnly) removed = parseInt(delOnly[1], 10);
    }
    return { added, removed };
  } catch {
    return { added: 0, removed: 0 };
  }
}

export function analyzeRepository(repoPath: string): RepoSummary & { timingMs: number } {
  const start = Date.now();
  const { count, extensions } = countFiles(repoPath);
  const languages = new Set<string>();
  for (const [ext, n] of extensions) {
    if (n > 0 && LANGUAGE_EXTENSIONS[ext]) languages.add(LANGUAGE_EXTENSIONS[ext]);
  }
  const frameworks = detectFrameworks(repoPath);
  const diffStatLines = getDiffStats(repoPath);
  return {
    fileCount: count,
    languages: [...languages],
    frameworks,
    diffStatLines,
    timingMs: Date.now() - start,
  };
}
