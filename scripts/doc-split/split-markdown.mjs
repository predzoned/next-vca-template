import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INDEX_FILE_NAME = "README.md";
const DEFAULT_MAX_CHUNK_CHARS = 12_000;
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/;
const NUMBERED_TITLE_PATTERN = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/;
const CODE_FENCE_PATTERN = /^```/;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\([^)]*\)/g;
const ID_PATTERN = /\b(?:[A-Z]{1,4}-[A-Z]{2,6}-\d+|[DQ]-\d+)\b/g;
const SECTION_MENTION_PATTERN = /\b([Ss]ection) (\d+)\b/g;
const ID_DEFINITION_PATTERNS = [
  /^#{1,6}\s+([A-Z]{1,4}-[A-Z]{2,6}-\d+|[DQ]-\d+)\b/,
  /^[-*]\s+\**([A-Z]{1,4}-[A-Z]{2,6}-\d+|[DQ]-\d+)\b/,
  /^\|\s*([A-Z]{1,4}-[A-Z]{2,6}-\d+|[DQ]-\d+)\s*\|/,
];

export function buildChunks(markdown, options = {}) {
  const maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const document = parseDocument(markdown);
  const chunks = planChunks(document.sections, maxChunkChars);
  const linkTargets = collectLinkTargets(chunks);

  const files = new Map();
  files.set(INDEX_FILE_NAME, renderIndex(document, chunks));
  chunks.forEach((chunk, position) => {
    files.set(
      chunk.fileName,
      renderChunk(chunk, chunks, position, linkTargets),
    );
  });
  return files;
}

export function splitMarkdown({
  sourcePath,
  outDir,
  force = false,
  ...options
}) {
  const markdown = readFileSync(sourcePath, "utf8");
  const files = buildChunks(markdown, options);
  const existingFiles = [...files.keys()].filter((fileName) =>
    existsSync(join(outDir, fileName)),
  );

  if (existingFiles.length > 0 && !force) {
    return { outcome: "blocked", existingFiles, fileNames: [] };
  }

  mkdirSync(outDir, { recursive: true });
  for (const [fileName, content] of files) {
    writeFileSync(join(outDir, fileName), content);
  }
  return { outcome: "written", existingFiles, fileNames: [...files.keys()] };
}

function parseDocument(markdown) {
  const lines = markdown.split("\n");
  const root = { level: 0, heading: "", bodyLines: [], children: [] };
  const openSections = [root];
  let insideCodeFence = false;

  for (const line of lines) {
    if (CODE_FENCE_PATTERN.test(line)) {
      insideCodeFence = !insideCodeFence;
    }
    const headingMatch = insideCodeFence ? null : line.match(HEADING_PATTERN);
    if (!headingMatch) {
      openSections.at(-1).bodyLines.push(line);
      continue;
    }
    const section = createSection(headingMatch[1].length, headingMatch[2]);
    while (openSections.at(-1).level >= section.level) {
      openSections.pop();
    }
    openSections.at(-1).children.push(section);
    openSections.push(section);
  }

  const titleSection = root.children.find((section) => section.level === 1);
  return {
    title: titleSection?.heading ?? "",
    tagline: joinTrimmed(titleSection?.bodyLines ?? root.bodyLines),
    sections: flattenToTopLevel(root),
  };
}

function createSection(level, heading) {
  const numberedMatch = heading.match(NUMBERED_TITLE_PATTERN);
  return {
    level,
    heading,
    number: numberedMatch?.[1] ?? null,
    title: numberedMatch?.[2] ?? heading,
    bodyLines: [],
    children: [],
  };
}

function flattenToTopLevel(root) {
  return root.children.flatMap((section) =>
    section.level === 1 ? section.children : [section],
  );
}

function planChunks(sections, maxChunkChars) {
  const chunks = [];
  sections.forEach((section, position) => {
    const fallbackNumber = String(position + 1);
    const chunkSize = renderSectionLines(section).join("\n").length;
    const shouldSplit =
      section.children.length > 0 && chunkSize > maxChunkChars;

    const parentChunk = createChunk(
      section,
      fallbackNumber,
      shouldSplit ? [] : null,
      null,
    );
    chunks.push(parentChunk);
    if (!shouldSplit) {
      return;
    }
    section.children.forEach((child, childPosition) => {
      const childChunk = createChunk(
        child,
        `${fallbackNumber}.${childPosition + 1}`,
        null,
        parentChunk,
      );
      parentChunk.childChunks.push(childChunk);
      chunks.push(childChunk);
    });
  });
  return chunks;
}

function createChunk(section, fallbackNumber, childChunks, parentChunk) {
  return {
    section,
    fileName: buildFileName(section, fallbackNumber),
    childChunks,
    parentChunk,
  };
}

function buildFileName(section, fallbackNumber) {
  const number = section.number ?? fallbackNumber;
  const [major, ...minors] = number.split(".");
  const prefix = [major.padStart(2, "0"), ...minors].join("-");
  const titleWithoutParenthetical = section.title.replace(/\s*\([^)]*\)/g, "");
  return `${prefix}-${slugify(titleWithoutParenthetical)}.md`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function renderSectionLines(section) {
  return [
    `${"#".repeat(section.level)} ${section.heading}`,
    ...section.bodyLines,
    ...section.children.flatMap(renderSectionLines),
  ];
}

function collectLinkTargets(chunks) {
  const idTargets = new Map();
  const sectionTargets = new Map();

  for (const chunk of chunks) {
    if (chunk.section.number && !chunk.parentChunk) {
      sectionTargets.set(chunk.section.number, chunk.fileName);
    }
    for (const line of chunkContentLines(chunk)) {
      const definedId = findDefinedId(line);
      if (definedId && !idTargets.has(definedId)) {
        idTargets.set(definedId, buildIdTarget(line, chunk.fileName));
      }
    }
  }
  return { idTargets, sectionTargets };
}

function chunkContentLines(chunk) {
  if (chunk.childChunks) {
    return [`## ${chunk.section.heading}`, ...chunk.section.bodyLines];
  }
  return renderSectionLines(chunk.section);
}

function findDefinedId(line) {
  for (const pattern of ID_DEFINITION_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function buildIdTarget(line, fileName) {
  const headingMatch = line.match(HEADING_PATTERN);
  return headingMatch ? `${fileName}#${slugify(headingMatch[2])}` : fileName;
}

function renderChunk(chunk, chunks, position, linkTargets) {
  const promoteBy = chunk.section.level - 1;
  const bodyLines = chunkContentLines(chunk)
    .map((line) => promoteHeading(line, promoteBy))
    .map((line) => linkReferences(line, chunk.fileName, linkTargets));
  const childLinks = chunk.childChunks
    ? [
        "## In this section",
        "",
        ...chunk.childChunks.map((child) => `- ${linkTo(child)}`),
      ]
    : [];

  return `${[
    renderNavigation(chunks, position),
    "",
    joinTrimmed(bodyLines),
    ...(childLinks.length > 0 ? ["", ...childLinks] : []),
  ].join("\n")}\n`;
}

function promoteHeading(line, promoteBy) {
  const headingMatch = line.match(HEADING_PATTERN);
  if (!headingMatch) {
    return line;
  }
  const level = Math.max(1, headingMatch[1].length - promoteBy);
  return `${"#".repeat(level)} ${headingMatch[2]}`;
}

function linkReferences(line, currentFileName, { idTargets, sectionTargets }) {
  if (HEADING_PATTERN.test(line)) {
    return line;
  }
  return replaceOutsideLinks(line, (text) =>
    text
      .replace(ID_PATTERN, (id) => {
        const target = idTargets.get(id);
        return target && !target.startsWith(currentFileName)
          ? `[${id}](${target})`
          : id;
      })
      .replace(SECTION_MENTION_PATTERN, (mention, word, number) => {
        const target = sectionTargets.get(number);
        return target && target !== currentFileName
          ? `[${word} ${number}](${target})`
          : mention;
      }),
  );
}

function replaceOutsideLinks(line, transform) {
  let result = "";
  let lastIndex = 0;
  for (const match of line.matchAll(MARKDOWN_LINK_PATTERN)) {
    result += transform(line.slice(lastIndex, match.index)) + match[0];
    lastIndex = match.index + match[0].length;
  }
  return result + transform(line.slice(lastIndex));
}

function renderNavigation(chunks, position) {
  const chunk = chunks[position];
  const parts = [`[Index](${INDEX_FILE_NAME})`];
  if (chunk.parentChunk) {
    parts.push(`Up: ${linkTo(chunk.parentChunk)}`);
  }
  if (position > 0) {
    parts.push(`Previous: ${linkTo(chunks[position - 1])}`);
  }
  if (position < chunks.length - 1) {
    parts.push(`Next: ${linkTo(chunks[position + 1])}`);
  }
  return parts.join(" · ");
}

function linkTo(chunk) {
  return `[${chunk.section.heading}](${chunk.fileName})`;
}

function renderIndex(document, chunks) {
  const topLevelChunks = chunks.filter((chunk) => !chunk.parentChunk);
  const mapLines = topLevelChunks.flatMap((chunk) =>
    renderMapEntry(chunk, chunks, 0),
  );

  return `${[
    `# ${document.title}`,
    "",
    document.tagline,
    "",
    "This index maps the document, one file per section, so a reader can load only what a task needs. Open the sections that matter, then follow the links inside them for anything they mention.",
    "",
    "## Sections",
    "",
    ...mapLines,
  ].join("\n")}\n`;
}

function renderMapEntry(chunk, chunks, depth) {
  const indent = "  ".repeat(depth);
  return [
    `${indent}- ${linkTo(chunk)}`,
    ...chunk.section.children.flatMap((child) =>
      renderMapChild(child, chunk.fileName, chunks, depth + 1),
    ),
  ];
}

function renderMapChild(section, fileName, chunks, depth) {
  const ownChunk = chunks.find((chunk) => chunk.section === section);
  if (ownChunk) {
    return renderMapEntry(ownChunk, chunks, depth);
  }
  const indent = "  ".repeat(depth);
  return [
    `${indent}- [${section.heading}](${fileName}#${slugify(section.heading)})`,
    ...section.children.flatMap((child) =>
      renderMapChild(child, fileName, chunks, depth + 1),
    ),
  ];
}

function joinTrimmed(lines) {
  return lines.join("\n").trim();
}
