const TEMPLATE_REPO_SLUG = "predzoned/next-vca-template";
const SPEC_FILE_PATH = "docs/mvp-business-spec.md";
const DETACH_SCRIPT_NAME = "template:detach";
const THIS_FILE_PATH = "scripts/template-detach/detach-template.mjs";
const MAX_LINE_WIDTH = 80;

const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const LEADING_HTML_COMMENT_PATTERN = /^\s*<!--[\s\S]*?-->\s*/;
const TITLE_HEADING_PATTERN = /^# (.+)$/m;
const SECTION_HEADING_PATTERN = /^## /m;
const PARAGRAPH_BREAK_PATTERN = /\n\s*\n/;
const REPO_SLUG_PATTERN = /([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
const COPYRIGHT_LINE_PATTERN = /^Copyright \(c\) \d{4} .*$/m;

/**
 * @typedef {object} ProjectDetails
 * @property {string} name Product name, shown as the README title.
 * @property {string} tagline One line under the title.
 * @property {string} about One or more paragraphs for "About The Project".
 * @property {string} owner GitHub user or organisation.
 * @property {string} repo GitHub repository name.
 * @property {string} authorName Person listed under "Contact".
 */

/**
 * @param {string} remoteUrlOrSlug e.g. `git@github.com:owner/repo.git` or `owner/repo`
 * @returns {{ owner: string; repo: string } | null}
 */
export function parseRepoSlug(remoteUrlOrSlug) {
  const match = REPO_SLUG_PATTERN.exec(remoteUrlOrSlug.trim());
  return match ? { owner: match[1], repo: match[2] } : null;
}

/**
 * Reads the product name and description from the MVP spec.
 * The first `# Title` is the name; the paragraphs between it and the first
 * `## Section` are the description.
 *
 * @param {string} specContent
 * @returns {Pick<ProjectDetails, "name" | "tagline" | "about">}
 */
export function parseSpec(specContent) {
  const content = specContent.replace(HTML_COMMENT_PATTERN, "");
  if (content.trim() === "") {
    throw new Error(
      `${SPEC_FILE_PATH} is empty. Write the MVP spec first, then run "pnpm ${DETACH_SCRIPT_NAME}" again.`,
    );
  }

  const titleMatch = TITLE_HEADING_PATTERN.exec(content);
  if (!titleMatch) {
    throw new Error(
      `${SPEC_FILE_PATH} needs a "# Title" heading with the product name.`,
    );
  }

  const afterTitle = content.slice(titleMatch.index + titleMatch[0].length);
  const sectionMatch = SECTION_HEADING_PATTERN.exec(afterTitle);
  const intro = sectionMatch
    ? afterTitle.slice(0, sectionMatch.index)
    : afterTitle;
  const paragraphs = intro
    .split(PARAGRAPH_BREAK_PATTERN)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    throw new Error(
      `${SPEC_FILE_PATH} needs at least one paragraph between the "# Title" and the first "## Section"; it becomes the README description.`,
    );
  }

  return {
    name: titleMatch[1].trim(),
    tagline: paragraphs[0].replace(/\s*\n\s*/g, " "),
    about: paragraphs.join("\n\n"),
  };
}

/**
 * Applies every replacement in order. A replacement whose phrase is gone is
 * skipped when its result is already in place (so running twice is harmless)
 * and fails loudly otherwise, so a README or AGENTS.md edit in the template
 * cannot silently leave template-only text in the consumer repo.
 *
 * @param {string} fileName
 * @param {string} content
 * @param {Array<{ label: string; find: string | RegExp; replace: string }>} replacements
 * @returns {string}
 */
function replaceEach(fileName, content, replacements) {
  return replacements.reduce((current, { label, find, replace }) => {
    const found =
      typeof find === "string" ? current.includes(find) : find.test(current);
    if (found) {
      return typeof find === "string"
        ? current.replaceAll(find, () => replace)
        : current.replace(find, () => replace);
    }
    if (current.includes(replace)) {
      return current;
    }
    throw new Error(
      `${fileName} no longer contains "${label}". Update ${THIS_FILE_PATH} to match the current file.`,
    );
  }, content);
}

/**
 * @param {string} agentsContent
 * @returns {string}
 */
export function detachAgents(agentsContent) {
  return replaceEach("AGENTS.md", agentsContent, [
    {
      label: "the template paragraph",
      find: /^This is a GitHub repository template.*$/m,
      replace: `The product spec lives in \`${SPEC_FILE_PATH}\`. Read it before planning a feature or writing business logic.`,
    },
  ]);
}

/**
 * @param {string} readmeContent
 * @param {ProjectDetails} project
 * @returns {string}
 */
export function detachReadme(readmeContent, project) {
  const { name, tagline, about, owner, repo, authorName } = project;
  const repoUrl = `https://github.com/${owner}/${repo}`;

  return replaceEach("README.md", readmeContent, [
    {
      label: "the template repository slug",
      find: TEMPLATE_REPO_SLUG,
      replace: `${owner}/${repo}`,
    },
    {
      label: "the template title",
      find: '<h3 align="center">next-vca-template</h3>',
      replace: `<h3 align="center">${name}</h3>`,
    },
    {
      label: "the template tagline",
      find: /^ {4}A Next\.js starter organized as vertical slices.*$/m,
      replace: `    ${tagline}`,
    },
    {
      label: "the template description",
      find: /^`next-vca-template` is a GitHub repository template.*$/m,
      replace: `${about}\n\nRead the full spec in [\`${SPEC_FILE_PATH}\`](./${SPEC_FILE_PATH}).`,
    },
    {
      label: "the getting-started introduction",
      find: /^Follow these steps to create your own project from this template.*$/m,
      replace: "Follow these steps to run the project on your computer.",
    },
    {
      label: "the 'Use this template' installation step",
      find: /^1\. Create a new repo from this template\.[\s\S]*?\n {3}```\n/m,
      replace: `1. Clone the repository\n   \`\`\`sh\n   git clone ${repoUrl}.git\n   cd ${repo}\n   \`\`\`\n`,
    },
    {
      label: `the "pnpm ${DETACH_SCRIPT_NAME}" script line`,
      find: /^pnpm template:detach.*\n/m,
      replace: "",
    },
    {
      label: "the site.ts layout comment",
      find: /^│ {3}├── site\.ts .*$/m,
      replace:
        "│   ├── site.ts               # product name and tagline for the layout and home page",
    },
    {
      label: "the contributing sentence",
      find: "make this template better",
      replace: "make this project better",
    },
    {
      label: "the template author",
      find: /^Frederick Angelo E\. Peraman .*$/m,
      replace: `${authorName} - [@${owner}](https://github.com/${owner})`,
    },
  ]);
}

/**
 * Formats `export const NAME = "value";` the way Biome would: on one line when
 * it fits, otherwise with the value on its own indented line.
 *
 * @param {string} constantName
 * @param {string} value
 * @returns {string}
 */
function formatStringConstant(constantName, value) {
  const literal = JSON.stringify(value);
  const oneLine = `export const ${constantName} = ${literal};`;
  return oneLine.length <= MAX_LINE_WIDTH
    ? oneLine
    : `export const ${constantName} =\n  ${literal};`;
}

/**
 * Rewrites the product name and tagline in `src/app/site.ts`, whatever their
 * current values, so the running app stops showing the template's name.
 *
 * @param {string} siteContent
 * @param {Pick<ProjectDetails, "name" | "tagline">} project
 * @returns {string}
 */
export function detachSite(siteContent, { name, tagline }) {
  return replaceEach("src/app/site.ts", siteContent, [
    {
      label: "the SITE_NAME constant",
      find: /^export const SITE_NAME =\s*"(?:[^"\\]|\\.)*";$/m,
      replace: formatStringConstant("SITE_NAME", name),
    },
    {
      label: "the SITE_TAGLINE constant",
      find: /^export const SITE_TAGLINE =\s*"(?:[^"\\]|\\.)*";$/m,
      replace: formatStringConstant("SITE_TAGLINE", tagline),
    },
    {
      label: `the "pnpm ${DETACH_SCRIPT_NAME}" comment`,
      find: /^\/\/ `pnpm template:detach` rewrites.*\n/m,
      replace: "",
    },
  ]);
}

/**
 * Drops the helper comment at the top of the spec, which explains the detach
 * script that no longer exists once the repo is detached.
 *
 * @param {string} specContent
 * @returns {string}
 */
export function detachSpec(specContent) {
  const leadingComment = LEADING_HTML_COMMENT_PATTERN.exec(specContent);
  const isDetachHelp = leadingComment?.[0].includes(DETACH_SCRIPT_NAME);
  return isDetachHelp
    ? specContent.slice(leadingComment[0].length)
    : specContent;
}

/**
 * Puts the consumer's author and the current year on the MIT copyright line,
 * whatever it says now.
 *
 * @param {string} licenseContent
 * @param {Pick<ProjectDetails, "authorName"> & { year: number }} project
 * @returns {string}
 */
export function detachLicense(licenseContent, { authorName, year }) {
  return replaceEach("LICENSE", licenseContent, [
    {
      label: "the copyright line",
      find: COPYRIGHT_LINE_PATTERN,
      replace: `Copyright (c) ${year} ${authorName}`,
    },
  ]);
}

/**
 * @param {string} packageJsonContent
 * @param {Pick<ProjectDetails, "owner" | "repo">} project
 * @returns {string}
 */
export function detachPackageJson(packageJsonContent, { owner, repo }) {
  const packageJson = JSON.parse(packageJsonContent);
  packageJson.name = repo;
  packageJson.repository = {
    type: "git",
    url: `git+https://github.com/${owner}/${repo}.git`,
  };
  delete packageJson.scripts[DETACH_SCRIPT_NAME];
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}
