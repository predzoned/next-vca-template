import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Biome checks that a file name is kebab-case or PascalCase, but not which one.
// AGENTS.md ties the choice to what the file exports, so this test parses each file.

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;
const HOOK_NAME = /^use[A-Z]/;

type ExpectedCase = "PascalCase" | "camelCase" | "kebab-case";

type NamingViolation = {
  file: string;
  expected: ExpectedCase;
  exports: string[];
};

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    return entry.isDirectory() ? listSourceFiles(entryPath) : [entryPath];
  });
}

function isTypeScript(filePath: string): boolean {
  return /\.tsx?$/.test(filePath);
}

function isTestFile(filePath: string): boolean {
  return filePath.includes("__tests__");
}

function isFrameworkOrGeneratedFile(filePath: string): boolean {
  const relativePath = relative(SRC_DIR, filePath);
  const isNextRoutingFile =
    relativePath.startsWith("app/") &&
    !relativePath.startsWith("app/_components/");
  const isShadcnFile = relativePath.startsWith("kernel/ui/");
  return isNextRoutingFile || isShadcnFile;
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}

function exportedNames(sourceFile: ts.SourceFile): string[] {
  const names: string[] = [];
  sourceFile.forEachChild((node) => {
    if (ts.isExportDeclaration(node)) {
      const isNamedList =
        node.exportClause !== undefined && ts.isNamedExports(node.exportClause);
      names.push(
        ...(isNamedList
          ? node.exportClause.elements.map((e) => e.name.text)
          : ["*"]),
      );
      return;
    }
    if (ts.isExportAssignment(node)) {
      names.push("default");
      return;
    }
    if (!isExported(node)) return;
    if (ts.isVariableStatement(node)) {
      names.push(
        ...node.declarationList.declarations.map((d) =>
          d.name.getText(sourceFile),
        ),
      );
      return;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      names.push(node.name?.text ?? "default");
    }
  });
  return names;
}

function expectedCaseFor(exports: string[]): ExpectedCase {
  if (exports.length !== 1) return "kebab-case";
  const [onlyExport] = exports;
  if (HOOK_NAME.test(onlyExport)) return "camelCase";
  if (PASCAL_CASE.test(onlyExport)) return "PascalCase";
  return "kebab-case";
}

function fileNameWithoutExtension(filePath: string): string {
  return basename(filePath).replace(/\.tsx?$/, "");
}

function matchesCase(name: string, expected: ExpectedCase): boolean {
  if (expected === "PascalCase") return PASCAL_CASE.test(name);
  if (expected === "camelCase") return CAMEL_CASE.test(name);
  return KEBAB_CASE.test(name);
}

function findNamingViolation(filePath: string): NamingViolation | null {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const exports = exportedNames(sourceFile);
  const expected = expectedCaseFor(exports);
  if (matchesCase(fileNameWithoutExtension(filePath), expected)) return null;
  return { file: relative(SRC_DIR, filePath), expected, exports };
}

describe("file naming", () => {
  it("uses PascalCase for a single class, type, interface or component, camelCase for a hook, kebab-case otherwise", () => {
    const violations = listSourceFiles(SRC_DIR)
      .filter(isTypeScript)
      .filter(
        (filePath) =>
          !isTestFile(filePath) && !isFrameworkOrGeneratedFile(filePath),
      )
      .map(findNamingViolation)
      .filter((violation) => violation !== null);

    expect(violations).toEqual([]);
  });
});
