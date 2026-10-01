#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkConsumerRepo } from "./consumer-checks.mjs";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const SPEC_FILE_NAME = "docs/mvp-business-spec.md";
const SPLIT_DIR_NAME = "docs/mvp-business-spec";
const TRY_REPO_URL = "https://github.com/example-owner/example-app.git";
const OUT_FLAG = "--out";
const FULL_FLAG = "--full";
const NULL_CHARACTER = "\u0000";
const USAGE = `Usage: pnpm template:try <spec.md> [${OUT_FLAG} <empty-dir>] [${FULL_FLAG}]

Copies this template, uncommitted changes included, into a new git repo and runs
the first-use steps the way a consumer would:
  1. copy <spec.md> to ${SPEC_FILE_NAME}
  2. pnpm template:detach (which also splits the spec into ${SPLIT_DIR_NAME}/)
Then it checks that README.md, AGENTS.md, src/app/site.ts and the spec docs agree.
${FULL_FLAG} also installs dependencies and runs lint, typecheck, test and build there.
Each step is committed in the copy, so "git log -p" there shows what it changed.`;

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {{ succeeded: boolean; output: string }}
 */
function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    succeeded: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

/**
 * Runs a fixed command line through the shell, which is what lets Windows find
 * `pnpm.cmd`. Never pass untrusted text here.
 *
 * @param {string} commandLine
 * @param {string} cwd
 * @returns {{ succeeded: boolean; output: string }}
 */
function run(commandLine, cwd) {
  const result = spawnSync(commandLine, { cwd, shell: true, encoding: "utf8" });
  return {
    succeeded: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function commitAll(message, cwd) {
  git(["add", "--all"], cwd);
  return git(
    [
      "-c",
      "user.name=template-try",
      "-c",
      "user.email=template-try@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--no-verify",
      "--allow-empty",
      `--message=${message}`,
    ],
    cwd,
  );
}

function readArguments() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf(OUT_FLAG);
  const outValueIndex = outIndex === -1 ? -1 : outIndex + 1;
  const specPath = args.find(
    (arg, index) => !arg.startsWith("--") && index !== outValueIndex,
  );
  return {
    specPath,
    outDir: outValueIndex === -1 ? null : args[outValueIndex],
    full: args.includes(FULL_FLAG),
  };
}

function prepareTryDir(outDir) {
  if (!outDir) {
    return mkdtempSync(join(tmpdir(), "template-try-"));
  }
  const tryDir = resolve(outDir);
  if (existsSync(tryDir) && readdirSync(tryDir).length > 0) {
    throw new Error(`${outDir} is not empty. Pick a new or empty folder.`);
  }
  mkdirSync(tryDir, { recursive: true });
  return tryDir;
}

/**
 * Copies what "Use this template" would copy: every file git tracks or would
 * track, as it is on disk now.
 */
function copyTemplate(tryDir) {
  const filePaths = git(
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    REPO_ROOT,
  )
    .output.split(NULL_CHARACTER)
    .filter((filePath) => filePath && existsSync(join(REPO_ROOT, filePath)));
  for (const filePath of filePaths) {
    mkdirSync(dirname(join(tryDir, filePath)), { recursive: true });
    copyFileSync(join(REPO_ROOT, filePath), join(tryDir, filePath));
  }
  git(["init", "--quiet", "--initial-branch=main"], tryDir);
  commitAll("Initial commit from the template", tryDir);
  git(["remote", "add", "origin", TRY_REPO_URL], tryDir);
}

function readTextFiles(tryDir) {
  const filePaths = git(["ls-files", "-z"], tryDir).output.split(
    NULL_CHARACTER,
  );
  return new Map(
    filePaths
      .filter(Boolean)
      .map((filePath) => [
        filePath,
        readFileSync(join(tryDir, filePath), "utf8"),
      ])
      .filter(([, content]) => !content.includes(NULL_CHARACTER)),
  );
}

function runSteps(tryDir, specPath) {
  const steps = [
    {
      title: `1. Copy the spec to ${SPEC_FILE_NAME}`,
      perform: () => {
        copyFileSync(specPath, join(tryDir, SPEC_FILE_NAME));
        return { succeeded: true, output: "" };
      },
    },
    {
      title: "2. pnpm template:detach",
      perform: () => run("pnpm template:detach", tryDir),
    },
  ];

  for (const { title, perform } of steps) {
    const result = perform();
    console.log(`${result.succeeded ? "✓" : "✗"} ${title}`);
    if (!result.succeeded) {
      console.log(indent(result.output));
      return false;
    }
    commitAll(title, tryDir);
  }
  return true;
}

function runProjectChecks(tryDir) {
  const commandLines = [
    "pnpm install --frozen-lockfile",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm build",
  ];
  return commandLines
    .map((commandLine) => {
      const result = run(commandLine, tryDir);
      console.log(`${result.succeeded ? "✓" : "✗"} ${commandLine}`);
      return result.succeeded
        ? null
        : `${commandLine} failed:\n${result.output}`;
    })
    .filter(Boolean);
}

function indent(text) {
  return text.replace(/^/gm, "    ");
}

function tryTemplate() {
  const { specPath, outDir, full } = readArguments();
  if (!specPath) {
    console.error(USAGE);
    process.exit(1);
  }
  const resolvedSpecPath = resolve(specPath);
  if (!existsSync(resolvedSpecPath)) {
    throw new Error(`Spec not found: ${specPath}`);
  }

  const tryDir = prepareTryDir(outDir);
  console.log(`Trying the template in ${tryDir}\n`);
  copyTemplate(tryDir);
  if (!runSteps(tryDir, resolvedSpecPath)) {
    process.exit(1);
  }

  const problems = [
    ...checkConsumerRepo({
      textFiles: readTextFiles(tryDir),
      sourceSpec: readFileSync(resolvedSpecPath, "utf8"),
      splitDir: SPLIT_DIR_NAME,
    }),
    ...(full ? runProjectChecks(tryDir) : []),
  ];

  console.log(
    problems.length === 0
      ? "\nAll checks passed."
      : `\n${problems.length} problem(s) found:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
  );
  console.log(`\nInspect the result with: cd "${tryDir}" && git log -p`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

try {
  tryTemplate();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
