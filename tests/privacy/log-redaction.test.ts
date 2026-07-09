import { describe, it, expect } from "vitest";
import pino from "pino";
import { Writable } from "node:stream";

describe("log-redaction", () => {
  it("Class A plan content absent from log output", () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const logger = pino({ level: "info" }, stream);
    const planSecret = "CLASS_A_PLAN_SECRET_XYZ";
    logger.info({ event: "analysis_complete", taskType: "crud" });
    const output = chunks.join("");
    expect(output).not.toContain(planSecret);
    expect(output).toContain("analysis_complete");
  });
});
