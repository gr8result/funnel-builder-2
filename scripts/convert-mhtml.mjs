// /scripts/convert-mhtml.js
// ✅ Converts .mhtml files to plain .html for GrapesJS
import fs from "fs";
import path from "path";
import mhtml2html from "mhtml2html";

const inputDir = "./mhtml";
const outputDir = "./converted-html";
fs.mkdirSync(outputDir, { recursive: true });

for (const file of fs.readdirSync(inputDir)) {
  if (!file.endsWith(".mhtml")) continue;
  const content = fs.readFileSync(path.join(inputDir, file), "utf-8");
  const html = mhtml2html(content);
  const outName = file.replace(".mhtml", ".html");
  fs.writeFileSync(path.join(outputDir, outName), html, "utf-8");
  console.log(`✅ Converted ${file} → ${outName}`);
}
