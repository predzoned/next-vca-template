import { copyFileSync, existsSync } from "node:fs";

/**
 * @typedef {"created" | "overwritten" | "skipped"} CopyEnvExampleOutcome
 */

/**
 * Copies the example env file to the local env file.
 * The local env file is left untouched unless `force` is true.
 *
 * @param {{ sourcePath: string; targetPath: string; force?: boolean }} options
 * @returns {CopyEnvExampleOutcome}
 */
export function copyEnvExample({ sourcePath, targetPath, force = false }) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const targetAlreadyExists = existsSync(targetPath);
  if (targetAlreadyExists && !force) {
    return "skipped";
  }

  copyFileSync(sourcePath, targetPath);
  return targetAlreadyExists ? "overwritten" : "created";
}
