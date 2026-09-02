// Guards deriveJobId after its move from modules/takeoff-v2/jobSummary.js into
// lib/jobFile.ts, and the workbook helper that depends on it.
//
// lib/jobFile.ts is TypeScript and this repo has no TS runtime loader, so the
// function is extracted from source and type-stripped with the installed
// TypeScript compiler. That keeps the assertions behavioural (real calls, real
// return values) rather than string matching, while still exercising the
// exact source text that ships.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function extractFunction(source, declaration, label) {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${label} must exist (looked for: ${declaration}).`);

  // Skip the parameter list first: default values such as `workbook = {}`
  // would otherwise be mistaken for the function body.
  const parenStart = source.indexOf("(", start);
  assert.notEqual(parenStart, -1, `${label} must have a parameter list.`);

  let parenDepth = 0;
  let parenEnd = -1;
  for (let i = parenStart; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { parenEnd = i; break; }
    }
  }
  assert.notEqual(parenEnd, -1, `${label} has an unbalanced parameter list.`);

  const bodyStart = source.indexOf("{", parenEnd);
  assert.notEqual(bodyStart, -1, `${label} must have a body.`);

  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${label} has an unbalanced body.`);
}

const jobFileSource = readFileSync("lib/jobFile.ts", "utf8");
const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");

// deriveJobId now lives in lib/jobFile.ts, and nowhere else.
assert.ok(
  jobFileSource.includes("export function deriveJobId(fileName: string): string | null"),
  "lib/jobFile.ts must export a typed deriveJobId.",
);
assert.ok(
  workbookSource.includes('import { deriveJobId } from "../../lib/jobFile";'),
  "The workbook must import deriveJobId from lib/jobFile.",
);
assert.ok(
  !workbookSource.includes("modules/takeoff-v2/jobSummary"),
  "The workbook must no longer import from modules/takeoff-v2/jobSummary.js.",
);

const derivedTs = extractFunction(jobFileSource, "export function deriveJobId(", "deriveJobId")
  .replace(/^export\s+/, "");
const derivedJs = ts.transpileModule(derivedTs, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;

const engineJobIdJs = extractFunction(
  workbookSource,
  "function deriveTakeoffEngineJobId(",
  "deriveTakeoffEngineJobId",
);

// eslint-disable-next-line no-new-func -- loads the real source under test
const { deriveJobId, deriveTakeoffEngineJobId } = new Function(
  `${derivedJs}\n${engineJobIdJs}\nreturn { deriveJobId, deriveTakeoffEngineJobId };`,
)();

// --- deriveJobId behaviour ----------------------------------------------
const cases = [
  ["Johnson.gr8job", "johnson", "the .gr8job extension is stripped"],
  ["JOHNSON.GR8JOB", "johnson", "the extension match is case-insensitive"],
  ["  ", null, "whitespace-only input yields null"],
  ["", null, "empty input yields null"],
  ["!!!", null, "input with no alphanumerics yields null"],
  ["A B—C", "a-b-c", "runs of non-alphanumerics collapse to a single hyphen"],
  ["--Johnson--.gr8job", "johnson", "leading and trailing hyphens are trimmed"],
  ["Lot 42 / Smith.gr8job", "lot-42-smith", "a realistic job file name slugifies"],
];

for (const [input, expected, why] of cases) {
  assert.equal(deriveJobId(input), expected, `deriveJobId(${JSON.stringify(input)}): ${why}.`);
}

assert.equal(deriveJobId(null), null, "deriveJobId(null) must yield null, not throw.");
assert.equal(deriveJobId(undefined), null, "deriveJobId(undefined) must yield null, not throw.");

// --- the workbook fallback still holds -----------------------------------
assert.equal(
  deriveTakeoffEngineJobId({}, {}, ""),
  "estimate-builder-unsaved",
  "With every candidate empty, the workbook must fall back to estimate-builder-unsaved.",
);
assert.equal(
  deriveTakeoffEngineJobId({ openedFileName: "Johnson.gr8job" }, {}, ""),
  "johnson",
  "The workbook must derive its job id from the opened file name.",
);
assert.equal(
  deriveTakeoffEngineJobId({}, { fileName: "  " }, ""),
  "estimate-builder-unsaved",
  "A blank candidate must not win over the fallback.",
);

console.log("Job id derivation checks passed.");
