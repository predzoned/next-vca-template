import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Biome can restrict what a file imports, but it cannot require an import,
// a directive or an export name. These conventions from AGENTS.md live here instead.

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));
const FEATURES_DIR = join(SRC_DIR, "features");
const APP_API_DIR = join(SRC_DIR, "app", "api");

const SERVER_ONLY_IMPORT = 'import "server-only";';
const USE_SERVER_DIRECTIVE = '"use server";';
const EXPORTED_DECLARATION =
  /^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm;
const EXPORTED_LIST = /^export\s+\{([^}]*)\}/gm;
const ROUTE_REEXPORT_ONLY =
  /^(export\{[^}]+\}from"@\/features\/[\w-]+\/routes";)+$/;

function listSlices(): string[] {
  return readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
    .map((entry) => entry.name);
}

function listFilesRecursively(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });
}

function isProductionTypeScript(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.includes("__tests__");
}

function existingFiles(filePaths: string[]): string[] {
  return filePaths.filter((filePath) => existsSync(filePath));
}

function readSource(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function relativeToSrc(filePath: string): string {
  return relative(SRC_DIR, filePath);
}

function exportedNames(source: string): string[] {
  const declared = [...source.matchAll(EXPORTED_DECLARATION)].map(
    (match) => match[1],
  );
  const listed = [...source.matchAll(EXPORTED_LIST)].flatMap((match) =>
    match[1]
      .split(",")
      .map(
        (entry) =>
          entry
            .trim()
            .split(/\s+as\s+/)
            .at(-1) ?? "",
      )
      .filter((name) => name.length > 0),
  );
  return [...declared, ...listed];
}

function exportedNamesOf(filePath: string): string[] {
  return existsSync(filePath) ? exportedNames(readSource(filePath)) : [];
}

function stripCommentsAndWhitespace(source: string): string {
  return source.replace(/\/\/.*$/gm, "").replace(/\s+/g, "");
}

describe.each(listSlices())("features/%s", (slice) => {
  const sliceDir = join(FEATURES_DIR, slice);
  const actionsPath = join(sliceDir, "actions.ts");
  const routesPath = join(sliceDir, "routes.ts");
  const queriesPath = join(sliceDir, "ui", "queries.ts");

  it("infra/, server.ts, actions.ts and routes.ts import server-only", () => {
    const serverSideFiles = [
      ...listFilesRecursively(join(sliceDir, "infra")).filter(
        isProductionTypeScript,
      ),
      ...existingFiles([join(sliceDir, "server.ts"), actionsPath, routesPath]),
    ];
    const missingServerOnly = serverSideFiles
      .filter((filePath) => !readSource(filePath).includes(SERVER_ONLY_IMPORT))
      .map(relativeToSrc);

    expect(missingServerOnly).toEqual([]);
  });

  it.runIf(existsSync(actionsPath))(
    'actions.ts starts with "use server"',
    () => {
      expect(
        readSource(actionsPath).trimStart().startsWith(USE_SERVER_DIRECTIVE),
      ).toBe(true);
    },
  );

  it("actions.ts exports are named <verb><Noun>Action", () => {
    const badlyNamed = exportedNamesOf(actionsPath).filter(
      (name) => !name.endsWith("Action"),
    );
    expect(badlyNamed).toEqual([]);
  });

  it("routes.ts exports are named <verb><Noun>Route", () => {
    const badlyNamed = exportedNamesOf(routesPath).filter(
      (name) => !name.endsWith("Route"),
    );
    expect(badlyNamed).toEqual([]);
  });

  it("ui/queries.ts exposes actions without the Action suffix", () => {
    const stillSuffixed = exportedNamesOf(queriesPath).filter((name) =>
      name.endsWith("Action"),
    );
    expect(stillSuffixed).toEqual([]);
  });
});

describe("app/api", () => {
  it("route.ts files only re-export handlers from a slice's routes.ts", () => {
    const offendingRoutes = listFilesRecursively(APP_API_DIR)
      .filter((filePath) => filePath.endsWith("route.ts"))
      .filter(
        (filePath) =>
          !ROUTE_REEXPORT_ONLY.test(
            stripCommentsAndWhitespace(readSource(filePath)),
          ),
      )
      .map(relativeToSrc);

    expect(offendingRoutes).toEqual([]);
  });
});
