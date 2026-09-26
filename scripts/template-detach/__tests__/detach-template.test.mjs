import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  detachAgents,
  detachPackageJson,
  detachReadme,
  parseRepoSlug,
  parseSpec,
} from "../detach-template.mjs";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const TEMPLATE_README = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
const TEMPLATE_AGENTS = readFileSync(resolve(REPO_ROOT, "AGENTS.md"), "utf8");
const TEMPLATE_PACKAGE_JSON = readFileSync(
  resolve(REPO_ROOT, "package.json"),
  "utf8",
);

const PROJECT = {
  name: "Bakery Orders",
  tagline: "Take and track orders for a small bakery.",
  about:
    "Take and track orders for a small bakery.\n\nStaff enter orders at the counter and the kitchen sees them live.",
  owner: "jane-doe",
  repo: "bakery-orders",
  authorName: "Jane Doe",
};

const SPEC = `<!-- helper comment -->
# Bakery Orders

Take and track orders for a small bakery.

Staff enter orders at the counter and the kitchen sees them live.

## Users

- Counter staff
`;

describe("parseRepoSlug", () => {
  it.each([
    ["https://github.com/jane-doe/bakery-orders.git"],
    ["https://github.com/jane-doe/bakery-orders"],
    ["git@github.com:jane-doe/bakery-orders.git"],
    ["ssh://git@github.com/jane-doe/bakery-orders.git"],
    ["jane-doe/bakery-orders"],
  ])("reads owner and repo from %s", (input) => {
    expect(parseRepoSlug(input)).toEqual({
      owner: "jane-doe",
      repo: "bakery-orders",
    });
  });

  it("returns null when there is no owner/repo pair", () => {
    expect(parseRepoSlug("")).toBeNull();
    expect(parseRepoSlug("bakery-orders")).toBeNull();
  });
});

describe("parseSpec", () => {
  it("takes the name from the title and the description from the intro", () => {
    expect(parseSpec(SPEC)).toEqual({
      name: PROJECT.name,
      tagline: PROJECT.tagline,
      about: PROJECT.about,
    });
  });

  it("treats a spec with only comments and blank lines as empty", () => {
    expect(() => parseSpec("<!-- fill me in -->\n\n")).toThrow("is empty");
  });

  it("requires a title heading", () => {
    expect(() => parseSpec("Just some text.\n")).toThrow("# Title");
  });

  it("requires at least one paragraph before the first section", () => {
    expect(() => parseSpec("# Bakery Orders\n\n## Users\n\ntext\n")).toThrow(
      "paragraph",
    );
  });
});

describe("detachAgents", () => {
  it("replaces the template paragraph with a pointer to the spec", () => {
    const result = detachAgents(TEMPLATE_AGENTS);

    expect(result).not.toMatch(/template/i);
    expect(result).toContain("docs/mvp-business-spec.md");
    expect(result).toContain("# This is NOT the Next.js you know");
  });

  it("throws when the template paragraph is already gone", () => {
    expect(() => detachAgents(detachAgents(TEMPLATE_AGENTS))).toThrow(
      "AGENTS.md",
    );
  });
});

describe("detachReadme", () => {
  const result = detachReadme(TEMPLATE_README, PROJECT);

  it("leaves nothing that talks about the template", () => {
    expect(result).not.toMatch(/template/i);
    expect(result).not.toContain("predzoned");
    expect(result).not.toContain("next-vca");
    expect(result).not.toContain("Peraman");
  });

  it("keeps the readme layout", () => {
    for (const marker of [
      "<!-- PROJECT SHIELDS -->",
      "<!-- TABLE OF CONTENTS -->",
      "## About The Project",
      "### Architecture",
      "## Getting Started",
      "## Usage",
      "## Contributing",
      "## License",
      "## Contact",
      "<!-- MARKDOWN LINKS & IMAGES -->",
    ]) {
      expect(result).toContain(marker);
    }
  });

  it("puts the project name, tagline and description in place", () => {
    expect(result).toContain('<h3 align="center">Bakery Orders</h3>');
    expect(result).toContain("Take and track orders for a small bakery.");
    expect(result).toContain(
      "Staff enter orders at the counter and the kitchen sees them live.",
    );
    expect(result).toContain("(./docs/mvp-business-spec.md)");
  });

  it("points every link at the new repository", () => {
    expect(result).toContain(
      "https://github.com/jane-doe/bakery-orders/issues/new?labels=bug",
    );
    expect(result).toContain(
      "https://img.shields.io/github/stars/jane-doe/bakery-orders.svg",
    );
    expect(result).toContain(
      "git clone https://github.com/jane-doe/bakery-orders.git",
    );
    expect(result).toContain("cd bakery-orders");
    expect(result).not.toContain("gh repo create");
  });

  it("names the author in the contact section", () => {
    expect(result).toContain(
      "Jane Doe - [@jane-doe](https://github.com/jane-doe)",
    );
  });

  it("drops the detach script from the scripts list", () => {
    expect(result).not.toContain("template:detach");
    expect(result).toContain("pnpm env:check");
  });

  it("throws when a template phrase is already gone", () => {
    expect(() => detachReadme(result, PROJECT)).toThrow("README.md");
  });
});

describe("detachPackageJson", () => {
  const result = detachPackageJson(TEMPLATE_PACKAGE_JSON, PROJECT);
  const parsed = JSON.parse(result);

  it("renames the package after the repository", () => {
    expect(parsed.name).toBe("bakery-orders");
  });

  it("removes the detach script", () => {
    expect(parsed.scripts["template:detach"]).toBeUndefined();
    expect(parsed.scripts["env:init"]).toBeDefined();
  });

  it("keeps two-space indentation and a trailing newline", () => {
    expect(result.startsWith('{\n  "name"')).toBe(true);
    expect(result.endsWith("}\n")).toBe(true);
  });
});
