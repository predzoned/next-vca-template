#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncEnvExample } from "./sync-env-example.mjs";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const ENV_FILE_NAME = ".env";
const EXAMPLE_FILE_NAME = ".env.example";
const CHECK_FLAG = "--check";

const checkOnly = process.argv.includes(CHECK_FLAG);

const report = syncEnvExample({
  envPath: resolve(REPO_ROOT, ENV_FILE_NAME),
  examplePath: resolve(REPO_ROOT, EXAMPLE_FILE_NAME),
  write: !checkOnly,
});

const keyDetails = [
  report.missingKeys.length > 0 && `missing: ${report.missingKeys.join(", ")}`,
  report.extraKeys.length > 0 && `extra: ${report.extraKeys.join(", ")}`,
]
  .filter(Boolean)
  .join("; ");
const detailSuffix = keyDetails ? ` (${keyDetails})` : "";

const messageByOutcome = {
  "in-sync": `${EXAMPLE_FILE_NAME} is in sync with ${ENV_FILE_NAME}.`,
  "out-of-sync": `${EXAMPLE_FILE_NAME} is out of sync with ${ENV_FILE_NAME}${detailSuffix}. Run "pnpm env:sync" to fix it.`,
  updated: `Updated ${EXAMPLE_FILE_NAME} to match ${ENV_FILE_NAME}${detailSuffix}.`,
};

console.log(messageByOutcome[report.outcome]);

if (report.outcome === "out-of-sync") {
  process.exit(1);
}
