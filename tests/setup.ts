import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const testDir = mkdtempSync(path.join(os.tmpdir(), "modelrouter-test-"));
process.env.MODELROUTER_DATA_DIR = testDir;
process.env.MODELROUTER_USE_FIXTURES = "1";

import { afterAll } from "vitest";

afterAll(() => {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});
