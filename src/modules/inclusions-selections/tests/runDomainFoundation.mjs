import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const currentFile = fileURLToPath(import.meta.url);
const testsDir = path.dirname(currentFile);
const moduleRoot = path.resolve(testsDir, "..");
const repoRoot = path.resolve(moduleRoot, "..", "..", "..");
const outRoot = path.join(repoRoot, "tmp", "inclusions-selections-domain-tests");

function collectTypeScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(fullPath);
    return entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
fs.writeFileSync(path.join(outRoot, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2));

for (const sourcePath of collectTypeScriptFiles(moduleRoot)) {
  const relativePath = path.relative(moduleRoot, sourcePath);
  const outputPath = path.join(outRoot, relativePath).replace(/\.ts$/, ".js");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  fs.writeFileSync(outputPath, transpiled.outputText);
}

await import(pathToFileURL(path.join(outRoot, "tests", "domainFoundation.test.js")).href);
await import(pathToFileURL(path.join(outRoot, "tests", "createAreasStage.test.js")).href);
await import(pathToFileURL(path.join(outRoot, "tests", "templateStage.test.js")).href);
await import(pathToFileURL(path.join(outRoot, "tests", "selectionWorkspace.test.js")).href);
await import(pathToFileURL(path.join(outRoot, "tests", "selectionReview.test.js")).href);
await import(pathToFileURL(path.join(outRoot, "tests", "selectionApprovalStage.test.js")).href);
await import(pathToFileURL(path.join(outRoot, "tests", "selectionDocumentsExport.test.js")).href);
console.log("Inclusions selections domain foundation tests passed.");
