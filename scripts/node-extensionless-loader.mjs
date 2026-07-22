import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Node's ESM resolver has no knowledge of tsconfig.json "paths" — only Next.js's
// webpack/tsc pipeline understands those. Tests run via `node --test` need this
// loader to understand the same @/, @modules/, @shared/ aliases the app build
// resolves, or alias imports work everywhere except the test runner.
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
let aliasMap = null;

function loadAliasMap() {
  if (aliasMap) return aliasMap;
  aliasMap = [];
  try {
    const raw = readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8");
    const json = JSON.parse(raw.replace(/^﻿/, ""));
    const baseUrl = json?.compilerOptions?.baseUrl || ".";
    const paths = json?.compilerOptions?.paths || {};
    for (const [pattern, targets] of Object.entries(paths)) {
      const prefix = pattern.replace(/\*$/, "");
      const target = (targets?.[0] || "").replace(/\*$/, "");
      aliasMap.push({ prefix, target: path.resolve(repoRoot, baseUrl, target) });
    }
  } catch {
    // tsconfig.json missing/unreadable — fall back to no aliases rather than fail every import.
  }
  return aliasMap;
}

function resolveAlias(specifier) {
  for (const { prefix, target } of loadAliasMap()) {
    if (specifier.startsWith(prefix)) {
      return path.join(target, specifier.slice(prefix.length));
    }
  }
  return null;
}

function candidateUrl(basePath) {
  for (const candidate of [basePath, `${basePath}.js`, `${basePath}.mjs`, `${basePath}.cjs`, path.join(basePath, "index.js")]) {
    if (!existsSync(candidate)) continue;
    try {
      if (statSync(candidate).isDirectory()) continue;
    } catch {
      continue;
    }
    return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  const aliasTarget = resolveAlias(specifier);
  if (aliasTarget) {
    const url = candidateUrl(aliasTarget);
    if (url) {
      return { url, shortCircuit: true };
    }
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
    if (!isRelative || !["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(error?.code)) {
      throw error;
    }

    const parentDir = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : process.cwd();
    const basePath = specifier.startsWith("/")
      ? specifier
      : path.resolve(parentDir, specifier);

    for (const candidate of [`${basePath}.js`, `${basePath}.mjs`, `${basePath}.cjs`, path.join(basePath, "index.js")]) {
      if (existsSync(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }

    throw error;
  }
}
