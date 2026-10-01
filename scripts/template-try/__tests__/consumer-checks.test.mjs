import { describe, expect, it } from "vitest";
import {
  checkConsumerRepo,
  findBrokenLinks,
  findIdentityProblems,
  findLinksInsideCode,
  findLostSpecLines,
  findMissingDocsPaths,
  findSpecLocationProblems,
  findTemplateLeftovers,
  headingAnchors,
} from "../consumer-checks.mjs";

const README = `<a id="readme-top"></a>
<div align="center">
  <h3 align="center">Bakery Orders</h3>

  <p align="center">
    Take and track orders for a small bakery.
    <br />
  </p>
</div>

Read the full spec in [\`docs/spec/\`](./docs/spec/README.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>
`;

const AGENTS =
  "The product spec lives in `docs/spec/`. Open its index, `docs/spec/README.md`.\n";

const SITE = `export const SITE_NAME = "Bakery Orders";
export const SITE_TAGLINE =
  "Take and track orders for a small bakery.";
`;

const SPEC = `# Bakery Orders

Take and track orders for a small bakery.

## 1. Orders

See F-ORD-1.

### F-ORD-1 Take an order

- BR-ORD-1 An order needs an item.
`;

const SPLIT_FILES = new Map([
  [
    "docs/spec/README.md",
    "# Bakery Orders\n\nTake and track orders for a small bakery.\n\n- [1. Orders](01-orders.md)\n",
  ],
  [
    "docs/spec/01-orders.md",
    "[Index](README.md)\n\n# 1. Orders\n\nSee [F-ORD-1](01-orders.md#f-ord-1-take-an-order).\n\n## F-ORD-1 Take an order\n\n- BR-ORD-1 An order needs an item.\n",
  ],
]);

describe("checkConsumerRepo", () => {
  it("finds nothing wrong in a consistent repo", () => {
    const textFiles = new Map([
      ["README.md", README],
      ["AGENTS.md", AGENTS],
      ["src/app/site.ts", SITE],
      ...SPLIT_FILES,
    ]);

    expect(
      checkConsumerRepo({ textFiles, sourceSpec: SPEC, splitDir: "docs/spec" }),
    ).toEqual([]);
  });
});

describe("findSpecLocationProblems", () => {
  const guideFiles = new Map([
    ["README.md", README],
    ["AGENTS.md", AGENTS],
  ]);
  const splitPaths = new Set(SPLIT_FILES.keys());

  it("accepts a spec that lives only in the split folder", () => {
    expect(
      findSpecLocationProblems(guideFiles, splitPaths, "docs/spec"),
    ).toEqual([]);
  });

  it("reports the single file left next to the split folder", () => {
    const filePaths = new Set([...splitPaths, "docs/spec.md"]);
    expect(
      findSpecLocationProblems(guideFiles, filePaths, "docs/spec"),
    ).toEqual([
      "The spec is in two places: docs/spec.md and docs/spec/. Only the split folder should remain.",
    ]);
  });

  it("reports a guide that does not point to the split folder", () => {
    const stale = new Map([
      ["README.md", README],
      ["AGENTS.md", "The product spec lives in `docs/spec.md`.\n"],
    ]);
    expect(findSpecLocationProblems(stale, splitPaths, "docs/spec")).toEqual([
      "AGENTS.md does not point to the spec in docs/spec/.",
    ]);
  });
});

describe("findTemplateLeftovers", () => {
  it("names the file and line of each template-only phrase", () => {
    const textFiles = new Map([
      ["README.md", "# App\n\nBuilt from This Template.\n"],
      ["package.json", '{ "name": "next-vca-template" }\n'],
    ]);

    expect(findTemplateLeftovers(textFiles)).toEqual([
      'README.md:3 still mentions "this template".',
      'package.json:1 still mentions "next-vca-template".',
    ]);
  });
});

describe("findIdentityProblems", () => {
  const withSite = (site) =>
    new Map([
      ["README.md", README],
      ["src/app/site.ts", site],
    ]);

  it("accepts a name and tagline that match, even when the tagline wraps", () => {
    expect(findIdentityProblems(withSite(SITE))).toEqual([]);
  });

  it("accepts a short tagline", () => {
    const tagline = "Your Love Visualizer";
    const textFiles = new Map([
      [
        "README.md",
        README.replace("Take and track orders for a small bakery.", tagline),
      ],
      [
        "src/app/site.ts",
        `export const SITE_NAME = "Bakery Orders";
export const SITE_TAGLINE = "${tagline}";
`,
      ],
    ]);
    expect(findIdentityProblems(textFiles)).toEqual([]);
  });

  it("reports a README and site.ts that disagree", () => {
    const site = SITE.replace('"Bakery Orders"', '"Cake Orders"');
    expect(findIdentityProblems(withSite(site))).toEqual([
      'README.md names the product "Bakery Orders" but src/app/site.ts says "Cake Orders".',
    ]);
  });

  it("reports a document title used as the product name", () => {
    const readme = README.replace(
      "Bakery Orders",
      "Bakery Orders: Business Specification",
    );
    const site = SITE.replace(
      '"Bakery Orders"',
      '"Bakery Orders: Business Specification"',
    );
    const textFiles = new Map([
      ["README.md", readme],
      ["src/app/site.ts", site],
    ]);

    expect(findIdentityProblems(textFiles)).toEqual([
      'The product name "Bakery Orders: Business Specification" looks like the spec\'s document title, not a product name.',
    ]);
  });

  it("reports a date or byline used as the tagline", () => {
    const byline = "Sep 25, 2026 · @Frederick";
    const textFiles = new Map([
      [
        "README.md",
        README.replace("Take and track orders for a small bakery.", byline),
      ],
      [
        "src/app/site.ts",
        SITE.replace("Take and track orders for a small bakery.", byline),
      ],
    ]);

    expect(findIdentityProblems(textFiles)).toEqual([
      `The tagline "${byline}" looks like a date or byline, not a description of the product.`,
    ]);
  });
});

describe("headingAnchors", () => {
  it("follows GitHub's rules, including repeated headings", () => {
    const anchors = headingAnchors(
      "# 1.1 Product summary\n## F-DATA-1 App lock (removed)\n## Notes\n## Notes\n",
    );
    expect([...anchors]).toEqual([
      "11-product-summary",
      "f-data-1-app-lock-removed",
      "notes",
      "notes-1",
    ]);
  });

  it("ignores headings inside code blocks and adds html anchors", () => {
    const anchors = headingAnchors(
      '<a id="top"></a>\n```sh\n# not a heading\n```\n',
    );
    expect([...anchors]).toEqual(["top"]);
  });
});

describe("findBrokenLinks", () => {
  const filePaths = new Set(["README.md", "docs/a.md", "docs/split/b.md"]);
  const check = (content) =>
    findBrokenLinks(
      new Map([
        ["README.md", content],
        ["docs/a.md", "# A title\n"],
      ]),
      filePaths,
    );

  it("accepts links to files, folders, headings and html anchors", () => {
    expect(
      check(
        '<a id="top"></a>\n[a](docs/a.md#a-title) [split](./docs/split/) [up](#top) [web](https://x.dev/y.md)\n',
      ),
    ).toEqual([]);
  });

  it("reports a missing file and a missing heading", () => {
    expect(check("[gone](docs/gone.md) [a](docs/a.md#nope)\n")).toEqual([
      "README.md links to docs/gone.md, which does not exist.",
      "README.md links to docs/a.md#nope, but that heading does not exist.",
    ]);
  });

  it("ignores links shown as code", () => {
    expect(check("```md\n[gone](docs/gone.md)\n```\n`[x](y.md)`\n")).toEqual(
      [],
    );
  });
});

describe("findLinksInsideCode", () => {
  it("reports a link that would render as raw text", () => {
    const markdownFiles = new Map([
      ["docs/a.md", "Use `[F-1](b.md#f-1)` here.\n"],
    ]);
    expect(findLinksInsideCode(markdownFiles)).toEqual([
      "docs/a.md:1 has a link inside code: `[F-1](b.md#f-1)`",
    ]);
  });
});

describe("findMissingDocsPaths", () => {
  it("reports docs paths that point at nothing, and accepts folders", () => {
    const markdownFiles = new Map([
      ["AGENTS.md", "Read `docs/spec.md`, then `docs/split/`.\n"],
    ]);
    expect(
      findMissingDocsPaths(markdownFiles, new Set(["docs/split/README.md"])),
    ).toEqual(["AGENTS.md mentions docs/spec.md, which does not exist."]);
  });
});

describe("findLostSpecLines", () => {
  it("ignores heading levels and the links doc:split adds", () => {
    expect(findLostSpecLines(SPEC, SPLIT_FILES)).toEqual([]);
  });

  it("reports a line no split file kept", () => {
    const spec = `${SPEC}\nA rule that went missing.\n`;
    expect(findLostSpecLines(spec, SPLIT_FILES)).toEqual([
      "The split spec lost this line: A rule that went missing.",
    ]);
  });

  it("reports a split that wrote nothing", () => {
    expect(findLostSpecLines(SPEC, new Map())).toEqual([
      "The spec was not split: the split folder has no files.",
    ]);
  });
});
