import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  detachAgents,
  detachLicense,
  detachPackageJson,
  detachReadme,
  detachSite,
  detachSpec,
  parseRepoSlug,
  parseSpec,
} from "../detach-template.mjs";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const readRepoFile = (fileName) =>
  readFileSync(resolve(REPO_ROOT, fileName), "utf8");
const TEMPLATE_README = readRepoFile("README.md");
const TEMPLATE_AGENTS = readRepoFile("AGENTS.md");
const TEMPLATE_LICENSE = readRepoFile("LICENSE");
const TEMPLATE_SITE = readRepoFile("src/app/site.ts");
const TEMPLATE_SPEC = readRepoFile("docs/mvp-business-spec.md");
const TEMPLATE_PACKAGE_JSON = readRepoFile("package.json");

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
  const result = detachAgents(TEMPLATE_AGENTS);

  it("replaces the template paragraph with a pointer to the spec", () => {
    expect(result).not.toMatch(/template/i);
    expect(result).toContain("docs/mvp-business-spec.md");
    expect(result).toContain("# This is NOT the Next.js you know");
  });

  it("is a no-op when run again", () => {
    expect(detachAgents(result)).toBe(result);
  });

  it("throws when the template paragraph was edited away", () => {
    const edited = TEMPLATE_AGENTS.replace(
      /^This is a GitHub repository template.*$/m,
      "Some other opening line.",
    );
    expect(() => detachAgents(edited)).toThrow("AGENTS.md");
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

  it("drops the detach script from the scripts list and the layout tree", () => {
    expect(result).not.toContain("template:detach");
    expect(result).toContain("pnpm env:check");
    expect(result).toContain("site.ts");
  });

  it("is a no-op when run again", () => {
    expect(detachReadme(result, PROJECT)).toBe(result);
  });

  it("throws when a template phrase was edited away", () => {
    const edited = TEMPLATE_README.replace(
      '<h3 align="center">next-vca-template</h3>',
      '<h3 align="center">Something else</h3>',
    );
    expect(() => detachReadme(edited, PROJECT)).toThrow("README.md");
  });
});

describe("detachSite", () => {
  const result = detachSite(TEMPLATE_SITE, PROJECT);

  it("rewrites the site name and tagline", () => {
    expect(result).toContain('export const SITE_NAME = "Bakery Orders";');
    expect(result).toContain(
      'export const SITE_TAGLINE = "Take and track orders for a small bakery.";',
    );
    expect(result).not.toContain("next-vca-template");
    expect(result).not.toContain("template:detach");
  });

  it("wraps a long tagline the way the formatter would", () => {
    const tagline =
      "Take and track orders for a small bakery, from the counter to the kitchen.";
    expect(detachSite(TEMPLATE_SITE, { ...PROJECT, tagline })).toContain(
      `export const SITE_TAGLINE =\n  "${tagline}";`,
    );
  });

  it("escapes quotes in the values", () => {
    expect(
      detachSite(TEMPLATE_SITE, { ...PROJECT, name: 'Jane\'s "Bakery"' }),
    ).toContain('export const SITE_NAME = "Jane\'s \\"Bakery\\"";');
  });

  it("is a no-op when run again", () => {
    expect(detachSite(result, PROJECT)).toBe(result);
  });
});

describe("detachSpec", () => {
  it("drops the helper comment that explains the detach script", () => {
    const spec = `${TEMPLATE_SPEC}\n# Bakery Orders\n\nTake orders.\n`;
    expect(detachSpec(spec)).toBe("# Bakery Orders\n\nTake orders.\n");
  });

  it("keeps a comment of the author's own", () => {
    expect(detachSpec(SPEC)).toBe(SPEC);
  });

  it("is a no-op when run again", () => {
    const once = detachSpec(`${TEMPLATE_SPEC}\n# Bakery Orders\n\nText.\n`);
    expect(detachSpec(once)).toBe(once);
  });
});

describe("detachLicense", () => {
  const result = detachLicense(TEMPLATE_LICENSE, { ...PROJECT, year: 2030 });

  it("names the author and the year on the copyright line", () => {
    expect(result).toContain("Copyright (c) 2030 Jane Doe\n");
    expect(result).not.toContain("Peraman");
    expect(result).toContain("MIT License");
  });

  it("is a no-op when run again", () => {
    expect(detachLicense(result, { ...PROJECT, year: 2030 })).toBe(result);
  });

  it("throws when the copyright line is gone", () => {
    expect(() =>
      detachLicense("MIT License\n\nNo copyright line.\n", {
        ...PROJECT,
        year: 2030,
      }),
    ).toThrow("LICENSE");
  });
});

describe("detachPackageJson", () => {
  const result = detachPackageJson(TEMPLATE_PACKAGE_JSON, PROJECT);
  const parsed = JSON.parse(result);

  it("renames the package and points repository at the new repo", () => {
    expect(parsed.name).toBe("bakery-orders");
    expect(parsed.repository).toEqual({
      type: "git",
      url: "git+https://github.com/jane-doe/bakery-orders.git",
    });
  });

  it("removes the detach script", () => {
    expect(parsed.scripts["template:detach"]).toBeUndefined();
    expect(parsed.scripts["env:init"]).toBeDefined();
  });

  it("keeps two-space indentation and a trailing newline", () => {
    expect(result.startsWith('{\n  "name"')).toBe(true);
    expect(result.endsWith("}\n")).toBe(true);
  });

  it("is a no-op when run again", () => {
    expect(detachPackageJson(result, PROJECT)).toBe(result);
  });
});
