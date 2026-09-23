import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyEnvExample } from "../copy-env-example.mjs";

const EXAMPLE_CONTENT = "# comment\nDATABASE_URL=postgres://localhost\n";
const EXISTING_CONTENT = "DATABASE_URL=postgres://my-real-db\n";

describe("copyEnvExample", () => {
  let workDir;
  let sourcePath;
  let targetPath;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "env-init-"));
    sourcePath = join(workDir, ".env.example");
    targetPath = join(workDir, ".env");
    writeFileSync(sourcePath, EXAMPLE_CONTENT);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("creates the target file with the same content as the source", () => {
    const outcome = copyEnvExample({ sourcePath, targetPath });

    expect(outcome).toBe("created");
    expect(readFileSync(targetPath, "utf8")).toBe(EXAMPLE_CONTENT);
  });

  it("leaves an existing target file untouched by default", () => {
    writeFileSync(targetPath, EXISTING_CONTENT);

    const outcome = copyEnvExample({ sourcePath, targetPath });

    expect(outcome).toBe("skipped");
    expect(readFileSync(targetPath, "utf8")).toBe(EXISTING_CONTENT);
  });

  it("overwrites an existing target file when force is true", () => {
    writeFileSync(targetPath, EXISTING_CONTENT);

    const outcome = copyEnvExample({ sourcePath, targetPath, force: true });

    expect(outcome).toBe("overwritten");
    expect(readFileSync(targetPath, "utf8")).toBe(EXAMPLE_CONTENT);
  });

  it("throws when the source file is missing", () => {
    rmSync(sourcePath);

    expect(() => copyEnvExample({ sourcePath, targetPath })).toThrow(
      "Source file not found",
    );
  });
});
