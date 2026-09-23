import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildExampleContent, syncEnvExample } from "../sync-env-example.mjs";

describe("buildExampleContent", () => {
  it("keeps the layout of the local env file but never copies its values", () => {
    const envContent = [
      "# Database",
      "DATABASE_URL=postgres://user:secret@localhost:5432/app",
      "",
      "API_KEY=sk-live-123",
      "",
    ].join("\n");

    const result = buildExampleContent({ envContent, exampleContent: "" });

    expect(result).toBe(
      ["# Database", "DATABASE_URL=dummy", "", "API_KEY=dummy", ""].join("\n"),
    );
  });

  it("keeps placeholder values that already exist in the example file", () => {
    const envContent = "DATABASE_URL=postgres://real\nAPI_KEY=sk-live-123\n";
    const exampleContent = "DATABASE_URL=postgres://localhost:5432/app\n";

    const result = buildExampleContent({ envContent, exampleContent });

    expect(result).toBe(
      "DATABASE_URL=postgres://localhost:5432/app\nAPI_KEY=dummy\n",
    );
  });

  it("drops keys that are no longer in the local env file", () => {
    const envContent = "API_KEY=sk-live-123\n";
    const exampleContent = "DATABASE_URL=postgres://localhost\nAPI_KEY=\n";

    const result = buildExampleContent({ envContent, exampleContent });

    expect(result).toBe("API_KEY=\n");
  });

  it("follows the key order of the local env file", () => {
    const envContent = "B=2\nA=1\n";
    const exampleContent = "A=\nB=\n";

    const result = buildExampleContent({ envContent, exampleContent });

    expect(result).toBe("B=\nA=\n");
  });

  it("supports the export prefix and quoted values", () => {
    const envContent = 'export SECRET="with spaces"\n';

    const result = buildExampleContent({ envContent, exampleContent: "" });

    expect(result).toBe("SECRET=dummy\n");
  });

  it("always ends the output with a single newline", () => {
    const result = buildExampleContent({
      envContent: "A=1",
      exampleContent: "",
    });

    expect(result).toBe("A=dummy\n");
  });
});

describe("syncEnvExample", () => {
  let workDir;
  let envPath;
  let examplePath;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "env-sync-"));
    envPath = join(workDir, ".env");
    examplePath = join(workDir, ".env.example");
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("reports in sync and leaves the example untouched when nothing differs", () => {
    writeFileSync(envPath, "DATABASE_URL=postgres://real\n");
    writeFileSync(examplePath, "DATABASE_URL=\n");

    const report = syncEnvExample({ envPath, examplePath, write: true });

    expect(report.outcome).toBe("in-sync");
    expect(report.missingKeys).toEqual([]);
    expect(report.extraKeys).toEqual([]);
    expect(readFileSync(examplePath, "utf8")).toBe("DATABASE_URL=\n");
  });

  it("lists missing and extra keys without writing when write is false", () => {
    writeFileSync(envPath, "DATABASE_URL=postgres://real\nNEW_KEY=1\n");
    writeFileSync(examplePath, "DATABASE_URL=\nOLD_KEY=\n");

    const report = syncEnvExample({ envPath, examplePath, write: false });

    expect(report.outcome).toBe("out-of-sync");
    expect(report.missingKeys).toEqual(["NEW_KEY"]);
    expect(report.extraKeys).toEqual(["OLD_KEY"]);
    expect(readFileSync(examplePath, "utf8")).toBe("DATABASE_URL=\nOLD_KEY=\n");
  });

  it("rewrites the example file when write is true", () => {
    writeFileSync(envPath, "DATABASE_URL=postgres://real\nNEW_KEY=1\n");
    writeFileSync(examplePath, "DATABASE_URL=\nOLD_KEY=\n");

    const report = syncEnvExample({ envPath, examplePath, write: true });

    expect(report.outcome).toBe("updated");
    expect(readFileSync(examplePath, "utf8")).toBe(
      "DATABASE_URL=\nNEW_KEY=dummy\n",
    );
  });

  it("creates the example file when it does not exist yet", () => {
    writeFileSync(envPath, "DATABASE_URL=postgres://real\n");

    const report = syncEnvExample({ envPath, examplePath, write: true });

    expect(report.outcome).toBe("updated");
    expect(readFileSync(examplePath, "utf8")).toBe("DATABASE_URL=dummy\n");
  });

  it("throws when the local env file is missing", () => {
    expect(() =>
      syncEnvExample({ envPath, examplePath, write: false }),
    ).toThrow("Local env file not found");
  });
});
