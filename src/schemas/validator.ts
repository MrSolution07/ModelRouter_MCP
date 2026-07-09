import { Ajv, type ErrorObject } from "ajv";
import addFormats from "ajv-formats/dist/index.js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getSchemasDir } from "../utils/paths.js";

let ajvInstance: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({ allErrors: true, strict: false, validateSchema: false });
    (addFormats as unknown as (ajv: Ajv) => void)(ajvInstance);
    const schemasDir = getSchemasDir();
    for (const file of readdirSync(schemasDir).filter((f) => f.endsWith(".json"))) {
      const schema = JSON.parse(readFileSync(path.join(schemasDir, file), "utf-8"));
      ajvInstance.addSchema(schema, file);
    }
  }
  return ajvInstance;
}

export function validateAgainstSchema(schemaName: string, data: unknown): { valid: boolean; errors?: string[] } {
  const ajv = getAjv();
  const validate = ajv.getSchema(schemaName) ?? ajv.getSchema(`./${schemaName}`);
  if (!validate) {
    return { valid: false, errors: [`Schema not found: ${schemaName}`] };
  }
  const valid = validate(data);
  if (valid) return { valid: true };
  return {
    valid: false,
    errors: (validate.errors ?? []).map((e: ErrorObject) => `${e.instancePath} ${e.message}`),
  };
}

export function assertValid(schemaName: string, data: unknown): void {
  const result = validateAgainstSchema(schemaName, data);
  if (!result.valid) {
    throw new Error(`Schema validation failed for ${schemaName}: ${result.errors?.join("; ")}`);
  }
}
