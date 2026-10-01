import { posix } from "node:path";

const TEMPLATE_ONLY_PHRASES = [
  "next-vca-template",
  "this template",
  "template:detach",
  "template-detach",
  "template:try",
  "template-try",
];
const GUIDE_FILE_NAMES = ["README.md", "AGENTS.md"];
const TRAILING_SLASH_PATTERN = /\/$/;
const DOCUMENT_TITLE_PATTERN = /\b(spec|specification|requirements|prd)\b/i;
const BYLINE_PATTERN = /@\w|\b(19|20)\d{2}\b/;
const FENCE_PATTERN = /^\s*(```|~~~)/;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const HEADING_PATTERN = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const HEADING_MARKER_PATTERN = /^#{1,6}\s+/;
const LINK_TARGET_PATTERN = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const ANY_LINK_PATTERN = /\[([^\]]*)\]\([^)]*\)/g;
const RELATIVE_LINK_PATTERN = /\[([^\]]*)\]\((?![a-z][a-z0-9+.-]*:)[^)]*\)/gi;
const HREF_PATTERN = /\bhref="([^"]+)"/g;
const HTML_ANCHOR_PATTERN = /<a\s+(?:id|name)="([^"]+)"/g;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const ANCHOR_PUNCTUATION_PATTERN = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;
const LINK_TO_MARKDOWN_PATTERN = /\]\([^)]*\.md[^)]*\)/;
const DOCS_PATH_PATTERN = /`(docs\/[^`\s]+?)\/?`/g;
const README_NAME_PATTERN = /<h3 align="center">(.*)<\/h3>/;
const README_TAGLINE_PATTERN = /<p align="center">\s*\n\s*(.+)/;

/**
 * @typedef {object} ConsumerRepo
 * @property {Map<string, string>} textFiles Every text file git knows about,
 *   keyed by its POSIX path from the repo root.
 * @property {string} sourceSpec The spec exactly as the consumer pasted it.
 * @property {string} splitDir Where `pnpm doc:split` wrote the spec chunks.
 */

/**
 * Lists, in plain words, everything that leaves the consumer repo
 * inconsistent after the first-use steps. Empty means all good.
 *
 * @param {ConsumerRepo} repo
 * @returns {string[]}
 */
export function checkConsumerRepo({ textFiles, sourceSpec, splitDir }) {
  const markdownFiles = new Map(
    [...textFiles].filter(([path]) => path.endsWith(".md")),
  );
  const splitFiles = new Map(
    [...markdownFiles].filter(([path]) => path.startsWith(`${splitDir}/`)),
  );
  const guideFiles = new Map(
    [...markdownFiles].filter(([path]) => GUIDE_FILE_NAMES.includes(path)),
  );
  const filePaths = new Set(textFiles.keys());

  return [
    ...findTemplateLeftovers(textFiles),
    ...findIdentityProblems(textFiles),
    ...findBrokenLinks(markdownFiles, filePaths),
    ...findLinksInsideCode(markdownFiles),
    ...findMissingDocsPaths(guideFiles, filePaths),
    ...findSpecLocationProblems(guideFiles, filePaths, splitDir),
    ...findLostSpecLines(sourceSpec, splitFiles),
  ];
}

/**
 * The spec must live in one place, the split folder, and README.md and
 * AGENTS.md must both point there.
 *
 * @param {Map<string, string>} guideFiles
 * @param {Set<string>} filePaths
 * @param {string} splitDir
 * @returns {string[]}
 */
export function findSpecLocationProblems(guideFiles, filePaths, splitDir) {
  const singleFilePath = `${splitDir}.md`;
  const problems = filePaths.has(singleFilePath)
    ? [
        `The spec is in two places: ${singleFilePath} and ${splitDir}/. Only the split folder should remain.`,
      ]
    : [];
  for (const fileName of GUIDE_FILE_NAMES) {
    if (!guideFiles.get(fileName)?.includes(`${splitDir}/`)) {
      problems.push(`${fileName} does not point to the spec in ${splitDir}/.`);
    }
  }
  return problems;
}

/**
 * @param {Map<string, string>} textFiles
 * @returns {string[]}
 */
export function findTemplateLeftovers(textFiles) {
  return [...textFiles].flatMap(([path, content]) =>
    content
      .split("\n")
      .flatMap((line, index) =>
        TEMPLATE_ONLY_PHRASES.filter((phrase) =>
          line.toLowerCase().includes(phrase),
        ).map((phrase) => `${path}:${index + 1} still mentions "${phrase}".`),
      ),
  );
}

/**
 * The product name and tagline appear in the README and in `site.ts`; they
 * must agree, and must read like a name and a description.
 *
 * @param {Map<string, string>} textFiles
 * @returns {string[]}
 */
export function findIdentityProblems(textFiles) {
  const readme = textFiles.get("README.md") ?? "";
  const site = textFiles.get("src/app/site.ts") ?? "";
  const readmeName = README_NAME_PATTERN.exec(readme)?.[1].trim();
  const readmeTagline = README_TAGLINE_PATTERN.exec(readme)?.[1].trim();
  const siteName = readSiteConstant(site, "SITE_NAME");
  const siteTagline = readSiteConstant(site, "SITE_TAGLINE");
  const problems = [];

  if (readmeName !== siteName) {
    problems.push(
      `README.md names the product "${readmeName}" but src/app/site.ts says "${siteName}".`,
    );
  }
  if (readmeTagline !== siteTagline) {
    problems.push(
      `README.md has the tagline "${readmeTagline}" but src/app/site.ts says "${siteTagline}".`,
    );
  }
  if (DOCUMENT_TITLE_PATTERN.test(siteName ?? "")) {
    problems.push(
      `The product name "${siteName}" looks like the spec's document title, not a product name.`,
    );
  }
  if (BYLINE_PATTERN.test(siteTagline ?? "")) {
    problems.push(
      `The tagline "${siteTagline}" looks like a date or byline, not a description of the product.`,
    );
  }
  return problems;
}

function readSiteConstant(siteContent, constantName) {
  const pattern = new RegExp(
    `^export const ${constantName} =\\s*("(?:[^"\\\\]|\\\\.)*");$`,
    "m",
  );
  const literal = pattern.exec(siteContent)?.[1];
  return literal ? JSON.parse(literal) : undefined;
}

/**
 * Relative links must point at a file or folder that exists and, when they
 * name one, at a heading that exists.
 *
 * @param {Map<string, string>} markdownFiles
 * @param {Set<string>} filePaths
 * @returns {string[]}
 */
export function findBrokenLinks(markdownFiles, filePaths) {
  return [...markdownFiles].flatMap(([path, content]) => {
    const prose = removeCode(content);
    const targets = [
      ...prose.matchAll(LINK_TARGET_PATTERN),
      ...prose.matchAll(HREF_PATTERN),
    ]
      .map((match) => match[1])
      .filter((target) => !URL_SCHEME_PATTERN.test(target));

    return targets.flatMap((target) => {
      const [targetPath, anchor] = target.split("#");
      const resolvedPath = targetPath
        ? posix
            .normalize(posix.join(posix.dirname(path), targetPath))
            .replace(TRAILING_SLASH_PATTERN, "")
        : path;
      if (!pathExists(filePaths, resolvedPath)) {
        return [`${path} links to ${target}, which does not exist.`];
      }
      const targetContent = markdownFiles.get(resolvedPath);
      if (
        anchor &&
        targetContent &&
        !headingAnchors(targetContent).has(anchor)
      ) {
        return [`${path} links to ${target}, but that heading does not exist.`];
      }
      return [];
    });
  });
}

/**
 * The anchors GitHub gives each heading: lowercase, punctuation dropped,
 * spaces turned into dashes, repeats numbered.
 *
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function headingAnchors(markdown) {
  const anchors = new Set(
    [...markdown.matchAll(HTML_ANCHOR_PATTERN)].map((match) => match[1]),
  );
  const timesSeen = new Map();
  for (const line of removeCode(markdown).split("\n")) {
    const heading = HEADING_PATTERN.exec(line)?.[1];
    if (!heading) {
      continue;
    }
    const anchor = heading
      .replace(ANY_LINK_PATTERN, "$1")
      .toLowerCase()
      .replace(ANCHOR_PUNCTUATION_PATTERN, "")
      .replaceAll(" ", "-");
    const count = timesSeen.get(anchor) ?? 0;
    anchors.add(count === 0 ? anchor : `${anchor}-${count}`);
    timesSeen.set(anchor, count + 1);
  }
  return anchors;
}

/**
 * A link written inside `code` shows up as raw `[text](file.md)`.
 *
 * @param {Map<string, string>} markdownFiles
 * @returns {string[]}
 */
export function findLinksInsideCode(markdownFiles) {
  return [...markdownFiles].flatMap(([path, content]) =>
    content
      .split("\n")
      .flatMap((line, index) =>
        [...line.matchAll(INLINE_CODE_PATTERN)]
          .filter((code) => LINK_TO_MARKDOWN_PATTERN.test(code[0]))
          .map(
            (code) => `${path}:${index + 1} has a link inside code: ${code[0]}`,
          ),
      ),
  );
}

/**
 * Paths such as `docs/mvp-business-spec.md` that README.md and AGENTS.md tell
 * a reader, or an agent, to open must exist.
 *
 * @param {Map<string, string>} markdownFiles
 * @param {Set<string>} filePaths
 * @returns {string[]}
 */
export function findMissingDocsPaths(markdownFiles, filePaths) {
  return [...markdownFiles].flatMap(([path, content]) =>
    [...content.matchAll(DOCS_PATH_PATTERN)]
      .map((match) => match[1])
      .filter((docsPath) => !pathExists(filePaths, docsPath))
      .map((docsPath) => `${path} mentions ${docsPath}, which does not exist.`),
  );
}

/**
 * Every line of the pasted spec must survive the split. Heading levels and
 * the links `doc:split` adds are ignored when comparing.
 *
 * @param {string} sourceSpec
 * @param {Map<string, string>} splitFiles
 * @returns {string[]}
 */
export function findLostSpecLines(sourceSpec, splitFiles) {
  if (splitFiles.size === 0) {
    return ["The spec was not split: the split folder has no files."];
  }
  const keptLines = new Set(
    [...splitFiles.values()].flatMap((content) =>
      content.split("\n").map(normaliseSpecLine),
    ),
  );
  return sourceSpec
    .split("\n")
    .map(normaliseSpecLine)
    .filter((line) => line !== "" && !keptLines.has(line))
    .map((line) => `The split spec lost this line: ${line.slice(0, 100)}`);
}

function pathExists(filePaths, path) {
  return (
    filePaths.has(path) ||
    [...filePaths].some((filePath) => filePath.startsWith(`${path}/`))
  );
}

function normaliseSpecLine(line) {
  return line
    .replace(HEADING_MARKER_PATTERN, "")
    .replace(RELATIVE_LINK_PATTERN, "$1")
    .trim();
}

function removeCode(markdown) {
  let insideFence = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (FENCE_PATTERN.test(line)) {
        insideFence = !insideFence;
        return "";
      }
      return insideFence ? "" : line.replace(INLINE_CODE_PATTERN, "");
    })
    .join("\n");
}
