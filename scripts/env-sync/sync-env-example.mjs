import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Matches a `KEY=value` line, with an optional `export ` prefix.
 * Group 1 is the key, group 2 is everything after the first `=`.
 */
const ENV_ASSIGNMENT_PATTERN =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

/** Placeholder value given to keys that are new to the example file. */
const NEW_KEY_PLACEHOLDER = "dummy";

/**
 * @typedef {"in-sync" | "out-of-sync" | "updated"} EnvSyncOutcome
 */

/**
 * @typedef {object} EnvSyncReport
 * @property {EnvSyncOutcome} outcome
 * @property {string[]} missingKeys Keys present in the local env file but not in the example.
 * @property {string[]} extraKeys Keys present in the example but not in the local env file.
 */

/**
 * @param {string} content
 * @returns {Map<string, string>} keys in file order, mapped to the raw text after `=`
 */
function parseEnvAssignments(content) {
  const assignments = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = ENV_ASSIGNMENT_PATTERN.exec(line);
    if (match) {
      assignments.set(match[1], match[2]);
    }
  }
  return assignments;
}

/**
 * Rebuilds the example file from the local env file.
 * Comments and blank lines are copied from the local env file as-is.
 * Every `KEY=value` line keeps its key but takes the placeholder value already
 * present in the example file, or `NEW_KEY_PLACEHOLDER` for new keys, so real
 * secrets never leak into the example.
 *
 * @param {{ envContent: string; exampleContent: string }} options
 * @returns {string}
 */
export function buildExampleContent({ envContent, exampleContent }) {
  const placeholderByKey = parseEnvAssignments(exampleContent);

  const lines = envContent.split(/\r?\n/).map((line) => {
    const match = ENV_ASSIGNMENT_PATTERN.exec(line);
    if (!match) {
      return line;
    }
    const key = match[1];
    return `${key}=${placeholderByKey.get(key) ?? NEW_KEY_PLACEHOLDER}`;
  });

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/**
 * Compares the example file against the local env file and, when `write` is
 * true, rewrites the example file so it matches.
 *
 * @param {{ envPath: string; examplePath: string; write: boolean }} options
 * @returns {EnvSyncReport}
 */
export function syncEnvExample({ envPath, examplePath, write }) {
  if (!existsSync(envPath)) {
    throw new Error(`Local env file not found: ${envPath}`);
  }

  const envContent = readFileSync(envPath, "utf8");
  const exampleContent = existsSync(examplePath)
    ? readFileSync(examplePath, "utf8")
    : "";

  const envKeys = [...parseEnvAssignments(envContent).keys()];
  const exampleKeys = [...parseEnvAssignments(exampleContent).keys()];
  const missingKeys = envKeys.filter((key) => !exampleKeys.includes(key));
  const extraKeys = exampleKeys.filter((key) => !envKeys.includes(key));

  const expectedContent = buildExampleContent({ envContent, exampleContent });
  if (expectedContent === exampleContent) {
    return { outcome: "in-sync", missingKeys, extraKeys };
  }

  if (!write) {
    return { outcome: "out-of-sync", missingKeys, extraKeys };
  }

  writeFileSync(examplePath, expectedContent);
  return { outcome: "updated", missingKeys, extraKeys };
}
