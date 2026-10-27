import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildChunks, splitMarkdown, writeChunks } from "../split-markdown.mjs";

const SPEC = [
  "# Bakery Orders",
  "",
  "Take and track orders for a small bakery.",
  "",
  "## 1. Overview",
  "",
  "Read F-MENU-1 and BR-GEN-1 (D-3). See Section 3 and [F-MENU-1](x.md).",
  "",
  "### 1.1 Summary",
  "",
  "Short.",
  "",
  "## 2. Modules",
  "",
  "Intro to modules.",
  "",
  "### 2.1 Menu (MENU)",
  "",
  "#### F-MENU-1 Add a cake",
  "",
  "Shows it on the menu. See BR-GEN-1.",
  "",
  "- BR-MENU-1 Rule one.",
  "",
  "### 2.2 Onboarding (ON)",
  "",
  "#### F-ON-1 Set up",
  "",
  "Mentions F-MENU-1 and BR-MENU-1 and D-3.",
  "",
  "## 3. Rules",
  "",
  "- BR-GEN-1 **Any customer.** Never F-ON-1.",
  "",
  "| # | Where | Default |",
  "| --- | --- | --- |",
  "| D-3 | F-MENU-1 | Three |",
  "",
].join("\n");

const options = { maxChunkChars: 150 };

describe("buildChunks", () => {
  const files = buildChunks(SPEC, options);
  const names = [...files.keys()];

  it("makes one file per top-level section and an index", () => {
    expect(names).toEqual([
      "README.md",
      "01-overview.md",
      "02-modules.md",
      "02-1-menu.md",
      "02-2-onboarding.md",
      "03-rules.md",
    ]);
  });

  it("keeps a small section whole, even when it has subsections", () => {
    expect(files.get("01-overview.md")).toContain("## 1.1 Summary");
  });

  it("splits a large section by subsection and links the parent to its children", () => {
    const parent = files.get("02-modules.md");
    expect(parent).toContain("Intro to modules.");
    expect(parent).toContain("- [2.1 Menu (MENU)](02-1-menu.md)");
    expect(parent).toContain("- [2.2 Onboarding (ON)](02-2-onboarding.md)");
    expect(parent).not.toContain("F-MENU-1 Add a cake");
  });

  it("promotes headings so every chunk starts at level one", () => {
    const child = files.get("02-1-menu.md");
    expect(child).toContain("\n# 2.1 Menu (MENU)\n");
    expect(child).toContain("\n## F-MENU-1 Add a cake\n");
  });

  it("adds index, previous, next and parent navigation", () => {
    expect(files.get("01-overview.md")).toContain(
      "[Index](README.md) · Next: [2. Modules](02-modules.md)",
    );
    expect(files.get("02-1-menu.md")).toContain(
      "[Index](README.md) · Up: [2. Modules](02-modules.md) · Previous: [2. Modules](02-modules.md) · Next: [2.2 Onboarding (ON)](02-2-onboarding.md)",
    );
    expect(files.get("03-rules.md")).toContain(
      "[Index](README.md) · Previous: [2.2 Onboarding (ON)](02-2-onboarding.md)",
    );
    expect(files.get("03-rules.md")).not.toContain("Next:");
  });

  it("links ids to the chunk that defines them, with an anchor for headings", () => {
    const overview = files.get("01-overview.md");
    expect(overview).toContain(
      "Read [F-MENU-1](02-1-menu.md#f-menu-1-add-a-cake)",
    );
    expect(overview).toContain(
      "and [BR-GEN-1](03-rules.md) ([D-3](03-rules.md))",
    );
    expect(overview).toContain("See [Section 3](03-rules.md)");
    const onboarding = files.get("02-2-onboarding.md");
    expect(onboarding).toContain("[BR-MENU-1](02-1-menu.md)");
  });

  it("leaves existing links, headings and same-chunk mentions alone", () => {
    expect(files.get("01-overview.md")).toContain("[F-MENU-1](x.md).");
    const menu = files.get("02-1-menu.md");
    expect(menu).toContain("## F-MENU-1 Add a cake");
    expect(menu).toContain("- BR-MENU-1 Rule one.");
    const rules = files.get("03-rules.md");
    expect(rules).toContain(
      "| D-3 | [F-MENU-1](02-1-menu.md#f-menu-1-add-a-cake) | Three |",
    );
    expect(rules).toContain("- BR-GEN-1 **Any customer.**");
  });

  it("writes an index with the title, tagline and a nested map down to feature ids", () => {
    const index = files.get("README.md");
    expect(index).toContain("# Bakery Orders");
    expect(index).toContain("Take and track orders for a small bakery.");
    expect(index).toContain("- [1. Overview](01-overview.md)");
    expect(index).toContain("  - [1.1 Summary](01-overview.md#11-summary)");
    expect(index).toContain("- [2. Modules](02-modules.md)");
    expect(index).toContain("  - [2.1 Menu (MENU)](02-1-menu.md)");
    expect(index).toContain(
      "    - [F-MENU-1 Add a cake](02-1-menu.md#f-menu-1-add-a-cake)",
    );
  });

  it("ends every file with a single newline", () => {
    for (const content of files.values()) {
      expect(content.endsWith("\n")).toBe(true);
      expect(content.endsWith("\n\n")).toBe(false);
    }
  });
});

describe("splitMarkdown", () => {
  let workDir;
  let sourcePath;
  let outDir;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "doc-split-"));
    sourcePath = join(workDir, "spec.md");
    outDir = join(workDir, "spec");
    writeFileSync(sourcePath, SPEC);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("writes the chunks and leaves the source file alone", () => {
    const report = splitMarkdown({ sourcePath, outDir, ...options });

    expect(report.outcome).toBe("written");
    expect(readdirSync(outDir).sort()).toEqual([
      "01-overview.md",
      "02-1-menu.md",
      "02-2-onboarding.md",
      "02-modules.md",
      "03-rules.md",
      "README.md",
    ]);
    expect(readFileSync(join(outDir, "README.md"), "utf8")).toContain(
      "# Bakery Orders",
    );
    expect(readFileSync(sourcePath, "utf8")).toBe(SPEC);
  });

  it("splits markdown passed as text, without a source file", () => {
    const report = writeChunks({ markdown: SPEC, outDir, ...options });

    expect(report.outcome).toBe("written");
    expect(readFileSync(join(outDir, "03-rules.md"), "utf8")).toContain(
      "# 3. Rules",
    );
  });

  it("refuses to overwrite files that already exist", () => {
    splitMarkdown({ sourcePath, outDir, ...options });
    writeFileSync(join(outDir, "03-rules.md"), "edited by hand\n");

    const report = splitMarkdown({ sourcePath, outDir, ...options });

    expect(report.outcome).toBe("blocked");
    expect(report.existingFiles).toContain("03-rules.md");
    expect(readFileSync(join(outDir, "03-rules.md"), "utf8")).toBe(
      "edited by hand\n",
    );
  });

  it("overwrites existing files when forced", () => {
    splitMarkdown({ sourcePath, outDir, ...options });
    writeFileSync(join(outDir, "03-rules.md"), "edited by hand\n");

    const report = splitMarkdown({
      sourcePath,
      outDir,
      force: true,
      ...options,
    });

    expect(report.outcome).toBe("written");
    expect(readFileSync(join(outDir, "03-rules.md"), "utf8")).toContain(
      "# 3. Rules",
    );
  });
});
