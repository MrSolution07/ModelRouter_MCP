import pino from "pino";

const REDACT_PATHS = ["planText", "fileContent", "requirementVector", "repoPath", "planPath"];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
});
