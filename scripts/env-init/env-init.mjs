#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyEnvExample } from "./copy-env-example.mjs";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const SOURCE_FILE_NAME = ".env.example";
const TARGET_FILE_NAME = ".env";
const FORCE_FLAG = "--force";

const force = process.argv.includes(FORCE_FLAG);

const outcome = copyEnvExample({
  sourcePath: resolve(REPO_ROOT, SOURCE_FILE_NAME),
  targetPath: resolve(REPO_ROOT, TARGET_FILE_NAME),
  force,
});

const messageByOutcome = {
  created: `Created ${TARGET_FILE_NAME} from ${SOURCE_FILE_NAME}.`,
  overwritten: `Overwrote ${TARGET_FILE_NAME} with ${SOURCE_FILE_NAME}.`,
  skipped: `${TARGET_FILE_NAME} already exists. Run again with ${FORCE_FLAG} to overwrite it.`,
};

console.log(messageByOutcome[outcome]);
