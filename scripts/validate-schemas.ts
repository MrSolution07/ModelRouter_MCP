import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = path.join(root, "schemas");

const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
addFormats(ajv);

for (const file of readdirSync(schemasDir).filter((f) => f.endsWith(".json"))) {
  const schema = JSON.parse(readFileSync(path.join(schemasDir, file), "utf-8"));
  ajv.addSchema(schema, file);
}

let failed = 0;

const modelFiles = globSync("data/models/**/*.json", { cwd: root }).filter((f) => !f.includes("_seed-provenance"));
const validateProfile = ajv.getSchema("model-profile.schema.json") ?? ajv.getSchema("./model-profile.schema.json");
if (!validateProfile) {
  console.error("model-profile.schema.json not loaded");
  process.exit(1);
}

for (const file of modelFiles) {
  const data = JSON.parse(readFileSync(path.join(root, file), "utf-8"));
  if (!validateProfile(data)) {
    console.error(`FAIL ${file}:`, validateProfile.errors);
    failed++;
  } else {
    console.log(`OK   ${file}`);
  }
}

// Validate calibration files exist
const calibrationFiles = [
  "data/calibration/normalization-bounds.json",
  "data/calibration/scoring-weights.json",
  "data/calibration/confidence-weights.json",
  "data/calibration/task-signals.json",
];
for (const file of calibrationFiles) {
  readFileSync(path.join(root, file), "utf-8");
  console.log(`OK   ${file}`);
}

if (failed > 0) {
  console.error(`\n${failed} validation error(s)`);
  process.exit(1);
}

console.log("\nAll schemas and seed models valid.");
