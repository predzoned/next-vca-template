const TEMPLATE_REPO_SLUG = "predzoned/next-vca-template";
const SPEC_FILE_PATH = "docs/mvp-business-spec.md";
const DETACH_SCRIPT_NAME = "template:detach";
const THIS_FILE_PATH = "scripts/template-detach/detach-template.mjs";

const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const TITLE_HEADING_PATTERN = /^# (.+)$/m;
const SECTION_HEADING_PATTERN = /^## /m;
const PARAGRAPH_BREAK_PATTERN = /\n\s*\n/;
const REPO_SLUG_PATTERN = /([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

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
 * Applies every replacement in order and fails loudly when a phrase is not
 * found, so a README or AGENTS.md edit in the template cannot silently leave
 * template-only text in the consumer repo.
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
    if (!found) {
      throw new Error(
        `${fileName} no longer contains "${label}". Update ${THIS_FILE_PATH} to match the current file.`,
      );
    }
    return typeof find === "string"
      ? current.replaceAll(find, () => replace)
      : current.replace(find, () => replace);
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
 * @param {string} packageJsonContent
 * @param {Pick<ProjectDetails, "repo">} project
 * @returns {string}
 */
export function detachPackageJson(packageJsonContent, { repo }) {
  const packageJson = JSON.parse(packageJsonContent);
  packageJson.name = repo;
  delete packageJson.scripts[DETACH_SCRIPT_NAME];
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}
