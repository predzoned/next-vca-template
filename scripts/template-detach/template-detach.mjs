#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detachAgents,
  detachPackageJson,
  detachReadme,
  parseRepoSlug,
  parseSpec,
} from "./detach-template.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const SPEC_FILE_NAME = "docs/mvp-business-spec.md";
const README_FILE_NAME = "README.md";
const AGENTS_FILE_NAME = "AGENTS.md";
const PACKAGE_JSON_FILE_NAME = "package.json";
const REPO_FLAG = "--repo";

/**
 * @param {string[]} args
 * @returns {{ succeeded: boolean; output: string }}
 */
function git(args) {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  return {
    succeeded: result.status === 0,
    output: (result.stdout ?? "").trim(),
  };
}

function readRepoSlug() {
  const flagIndex = process.argv.indexOf(REPO_FLAG);
  const fromFlag = flagIndex === -1 ? null : process.argv[flagIndex + 1];
  const remote = git(["remote", "get-url", "origin"]);
  const candidate = fromFlag ?? (remote.succeeded ? remote.output : "");
  const slug = parseRepoSlug(candidate);
  if (!slug) {
    throw new Error(
      `Could not tell which GitHub repository this is. Add a git remote named "origin" or run again with ${REPO_FLAG} owner/name.`,
    );
  }
  return slug;
}

function readAuthorName(fallback) {
  const userName = git(["config", "user.name"]);
  return userName.succeeded && userName.output ? userName.output : fallback;
}

function readRepoFile(fileName) {
  const filePath = resolve(REPO_ROOT, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${fileName}`);
  }
  return readFileSync(filePath, "utf8");
}

function writeRepoFile(fileName, content) {
  writeFileSync(resolve(REPO_ROOT, fileName), content);
}

function detach() {
  const spec = parseSpec(readRepoFile(SPEC_FILE_NAME));
  const { owner, repo } = readRepoSlug();
  const project = { ...spec, owner, repo, authorName: readAuthorName(owner) };

  const readme = detachReadme(readRepoFile(README_FILE_NAME), project);
  const agents = detachAgents(readRepoFile(AGENTS_FILE_NAME));
  const packageJson = detachPackageJson(
    readRepoFile(PACKAGE_JSON_FILE_NAME),
    project,
  );

  writeRepoFile(README_FILE_NAME, readme);
  writeRepoFile(AGENTS_FILE_NAME, agents);
  writeRepoFile(PACKAGE_JSON_FILE_NAME, packageJson);
  rmSync(SCRIPT_DIR, { recursive: true, force: true });

  console.log(
    [
      `Detached from the template as ${owner}/${repo} (${project.name}).`,
      `Updated ${README_FILE_NAME}, ${AGENTS_FILE_NAME} and ${PACKAGE_JSON_FILE_NAME}; removed scripts/template-detach/.`,
      'Review the changes with "git diff", then commit them.',
    ].join("\n"),
  );
}

try {
  detach();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
