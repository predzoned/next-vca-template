#!/usr/bin/env node
import { resolve } from "node:path";
import { splitMarkdown } from "./split-markdown.mjs";

const FORCE_FLAG = "--force";
const USAGE = `Usage: pnpm doc:split <source.md> <out-dir> [${FORCE_FLAG}]

Splits one markdown file into a folder of linked section files plus a README.md index.
The source file is left untouched; delete it yourself once you are happy with the result.
Existing files in <out-dir> are never overwritten unless you pass ${FORCE_FLAG}.`;

const positionalArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== FORCE_FLAG);
const force = process.argv.includes(FORCE_FLAG);
const [sourceArgument, outDirArgument] = positionalArguments;

if (!sourceArgument || !outDirArgument) {
  console.error(USAGE);
  process.exit(1);
}

const report = splitMarkdown({
  sourcePath: resolve(sourceArgument),
  outDir: resolve(outDirArgument),
  force,
});

if (report.outcome === "blocked") {
  console.error(
    `${outDirArgument}/ already has: ${report.existingFiles.join(", ")}. Pass ${FORCE_FLAG} to overwrite them.`,
  );
  process.exit(1);
}

console.log(
  `Wrote ${report.fileNames.length} files to ${outDirArgument}/. Start at ${outDirArgument}/README.md.`,
);
