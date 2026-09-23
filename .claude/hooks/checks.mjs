#!/usr/bin/env node
// Stop hook: format, lint, type-check, test, and verify env files when Claude
// finishes.
//
// Formatting is auto-applied (biome format --write). If linting (biome check),
// type checking (tsc --noEmit), tests (vitest) or the env sync check fail, the
// stop is blocked and the errors are fed back to Claude so it fixes them before
// finishing.
//
// Written in Node (not bash) so it runs the same on Mac, Linux and Windows
// without extra tools such as jq.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const STDIN_FILE_DESCRIPTOR = 0;
const ENV_FILE_NAME = ".env";
const CHECKED_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|json|css)"?$/;

function readHookInput() {
  try {
    return JSON.parse(readFileSync(STDIN_FILE_DESCRIPTOR, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Runs a fixed command line through the shell, which is what lets Windows find
 * `pnpm.cmd`. Never pass untrusted text here.
 *
 * @param {string} commandLine
 * @returns {{ succeeded: boolean; output: string }}
 */
function run(commandLine) {
  const result = spawnSync(commandLine, { shell: true, encoding: "utf8" });
  return {
    succeeded: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function hasUncommittedCheckedFiles() {
  const status = run("git status --porcelain");
  return (
    status.succeeded &&
    status.output
      .split(/\r?\n/)
      .some((line) => CHECKED_FILE_PATTERN.test(line.trimEnd()))
  );
}

// Avoid infinite loops: if we already blocked once this turn, allow the stop.
if (readHookInput().stop_hook_active === true) {
  process.exit(0);
}

if (process.env.CLAUDE_PROJECT_DIR) {
  process.chdir(process.env.CLAUDE_PROJECT_DIR);
}

const blockingChecks = [];

// .env is gitignored, so git status cannot tell us it changed. Run this check
// unconditionally, but only once .env exists (it is created by `pnpm env:init`).
if (existsSync(ENV_FILE_NAME)) {
  blockingChecks.push({
    title: "Env sync check (pnpm env:check)",
    commandLine: "pnpm env:check",
  });
}

// Only run the code checks when there are uncommitted changes to files they
// care about (biome + tsc territory). If nothing relevant changed — docs,
// images, config tweaks, or a clean tree — skip them.
if (hasUncommittedCheckedFiles()) {
  // Auto-format (writes changes; non-blocking).
  run("pnpm format");

  blockingChecks.push(
    { title: "Lint (biome check)", commandLine: "pnpm lint" },
    {
      title: "Type check (next typegen + tsc --noEmit)",
      commandLine: "pnpm typecheck",
    },
    { title: "Tests (vitest)", commandLine: "pnpm test" },
  );
}

const failureReports = blockingChecks.flatMap(({ title, commandLine }) => {
  const result = run(commandLine);
  return result.succeeded ? [] : [`### ${title} failed:\n${result.output}`];
});

if (failureReports.length > 0) {
  console.log(
    JSON.stringify({
      decision: "block",
      reason: `Checks failed before finishing. Fix these, then I'll re-check:\n\n${failureReports.join("\n\n")}`,
    }),
  );
}
