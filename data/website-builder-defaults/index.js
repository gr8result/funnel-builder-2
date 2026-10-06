import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_SLUGS_PATH = path.join(DIR, "template-slugs.json");
const BLOCK_DEFAULTS_PATH = path.join(DIR, "block-defaults.json");

function templateDir(templateSlug) {
  return path.join(DIR, "template-overrides", templateSlug);
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readTemplateSlugs() {
  return (await readJson(TEMPLATE_SLUGS_PATH, [])) || [];
}

async function writeTemplateSlugs(slugs) {
  await writeJson(TEMPLATE_SLUGS_PATH, slugs);
}

async function readPageOrder(templateSlug) {
  return (await readJson(path.join(templateDir(templateSlug), "page-order.json"), [])) || [];
}

async function readTemplateOverride(templateSlug) {
  const meta = await readJson(path.join(templateDir(templateSlug), "meta.json"), {
    updatedAt: null,
    globalNavBlock: null,
    globalFooterBlock: null,
  });
  const pageOrder = await readPageOrder(templateSlug);
  const pageBlocks = {};
  for (const entry of pageOrder) {
    pageBlocks[entry.pageName] = await readJson(
      path.join(templateDir(templateSlug), "pages", `${entry.file}.json`),
      []
    );
  }
  return {
    updatedAt: meta.updatedAt ?? null,
    pageBlocks,
    globalNavBlock: meta.globalNavBlock ?? null,
    globalFooterBlock: meta.globalFooterBlock ?? null,
  };
}

/** Reconstructs the exact original { templateOverrides, blockDefaults } envelope. */
export async function readWebsiteBuilderDefaults() {
  const templateSlugs = await readTemplateSlugs();
  const templateOverrides = {};
  for (const slug of templateSlugs) {
    templateOverrides[slug] = await readTemplateOverride(slug);
  }
  const blockDefaults = (await readJson(BLOCK_DEFAULTS_PATH, {})) || {};
  return { templateOverrides, blockDefaults };
}

export async function getTemplateOverride(templateSlug) {
  const slugs = await readTemplateSlugs();
  if (!slugs.includes(templateSlug)) return null;
  return readTemplateOverride(templateSlug);
}

export async function getBlockDefaults() {
  return (await readJson(BLOCK_DEFAULTS_PATH, {})) || {};
}

function slugifyPageName(name) {
  return (
    String(name)
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page"
  );
}

async function ensureTemplateRegistered(templateSlug) {
  const slugs = await readTemplateSlugs();
  if (!slugs.includes(templateSlug)) {
    await writeTemplateSlugs([...slugs, templateSlug]);
  }
}

async function writeMeta(templateSlug, { updatedAt, globalNavBlock, globalFooterBlock }) {
  const current = await readJson(path.join(templateDir(templateSlug), "meta.json"), {
    updatedAt: null,
    globalNavBlock: null,
    globalFooterBlock: null,
  });
  const next = {
    updatedAt: updatedAt ?? current.updatedAt ?? null,
    globalNavBlock: globalNavBlock !== undefined ? globalNavBlock : current.globalNavBlock ?? null,
    globalFooterBlock:
      globalFooterBlock !== undefined ? globalFooterBlock : current.globalFooterBlock ?? null,
  };
  await writeJson(path.join(templateDir(templateSlug), "meta.json"), next);
  return next;
}

/** Merges one page's blocks into a template override (mirrors the "save-template-page" API action). */
export async function saveTemplatePage(templateSlug, pageName, blocks, globalNavBlock, globalFooterBlock) {
  await ensureTemplateRegistered(templateSlug);
  const pageOrder = await readPageOrder(templateSlug);
  let entry = pageOrder.find((item) => item.pageName === pageName);
  if (!entry) {
    entry = { pageName, file: await uniquePageFile(templateSlug, pageName, pageOrder) };
    pageOrder.push(entry);
    await writeJson(path.join(templateDir(templateSlug), "page-order.json"), pageOrder);
  }
  await writeJson(path.join(templateDir(templateSlug), "pages", `${entry.file}.json`), blocks);
  const meta = await writeMeta(templateSlug, {
    updatedAt: new Date().toISOString(),
    globalNavBlock,
    globalFooterBlock,
  });
  return readTemplateOverrideFromParts(templateSlug, pageOrder, meta);
}

/** Replaces every page's blocks in one call (mirrors the "save-template-site" API action). */
export async function saveTemplateSite(templateSlug, pageBlocksObject, globalNavBlock, globalFooterBlock) {
  await ensureTemplateRegistered(templateSlug);
  const pageNames = Object.keys(pageBlocksObject || {});
  const pageOrder = [];
  const usedFiles = new Set();
  for (const pageName of pageNames) {
    const file = await uniquePageFile(templateSlug, pageName, pageOrder, usedFiles);
    pageOrder.push({ pageName, file });
    usedFiles.add(file);
    await writeJson(path.join(templateDir(templateSlug), "pages", `${file}.json`), pageBlocksObject[pageName]);
  }
  await writeJson(path.join(templateDir(templateSlug), "page-order.json"), pageOrder);
  const meta = await writeMeta(templateSlug, {
    updatedAt: new Date().toISOString(),
    globalNavBlock,
    globalFooterBlock,
  });
  return readTemplateOverrideFromParts(templateSlug, pageOrder, meta);
}

export async function saveBlockDefault(blockType, props) {
  const blockDefaults = (await readJson(BLOCK_DEFAULTS_PATH, {})) || {};
  blockDefaults[blockType] = props;
  await writeJson(BLOCK_DEFAULTS_PATH, blockDefaults);
  return blockDefaults;
}

async function uniquePageFile(templateSlug, pageName, pageOrder, extraUsed) {
  const used = new Set(pageOrder.map((entry) => entry.file));
  if (extraUsed) for (const file of extraUsed) used.add(file);
  const base = slugifyPageName(pageName);
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

async function readTemplateOverrideFromParts(templateSlug, pageOrder, meta) {
  const pageBlocks = {};
  for (const entry of pageOrder) {
    pageBlocks[entry.pageName] = await readJson(
      path.join(templateDir(templateSlug), "pages", `${entry.file}.json`),
      []
    );
  }
  return {
    updatedAt: meta.updatedAt ?? null,
    pageBlocks,
    globalNavBlock: meta.globalNavBlock ?? null,
    globalFooterBlock: meta.globalFooterBlock ?? null,
  };
}
