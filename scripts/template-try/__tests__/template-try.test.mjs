import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = resolve(
  fileURLToPath(import.meta.url),
  "../../template-try.mjs",
);
const END_TO_END_TIMEOUT_MS = 60_000;

const SPEC = `# Bakery Orders

Take and track orders for a small bakery, from the counter to the kitchen.

Staff enter orders at the counter and the kitchen sees them live.

## 1. Users

Counter staff take orders (F-ORD-1).

## 2. Features

### F-ORD-1 Take an order

- BR-ORD-1 An order needs at least one item. See Section 1.
`;

describe("template:try", () => {
  let workDir;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "template-try-test-"));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it(
    "runs the first-use steps on a copy of the template and finds it consistent",
    () => {
      const specPath = join(workDir, "spec.md");
      const tryDir = join(workDir, "app");
      writeFileSync(specPath, SPEC);

      const result = spawnSync(
        process.execPath,
        [SCRIPT_PATH, specPath, "--out", tryDir],
        { encoding: "utf8" },
      );

      expect(result.stdout + result.stderr).toContain("All checks passed.");
      expect(result.status).toBe(0);
      expect(existsSync(join(tryDir, "docs/mvp-business-spec/README.md"))).toBe(
        true,
      );
      expect(existsSync(join(tryDir, "docs/mvp-business-spec.md"))).toBe(false);
      expect(existsSync(join(tryDir, "scripts/template-detach"))).toBe(false);
      expect(existsSync(join(tryDir, "scripts/template-try"))).toBe(false);
    },
    END_TO_END_TIMEOUT_MS,
  );

  it("refuses a folder that already has files", () => {
    writeFileSync(join(workDir, "keep.txt"), "mine\n");

    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, join(workDir, "keep.txt"), "--out", workDir],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not empty");
  });
});
