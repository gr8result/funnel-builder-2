import fs from "node:fs";
import path from "node:path";
import { runHybridRasterPrototype, SUPPORTED_RASTER_DPI } from "../modules/takeoff-v2/experimental/hybridRasterWallDetection.js";

const samplePath = process.env.TAKEOFF_SAMPLE_PLANS_PDF || "C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf";
const dpi = Number(process.argv[2] || process.env.TAKEOFF_RASTER_DPI || 400);
const outputDir = path.resolve("tmp/takeoff-hybrid-raster", `${dpi}dpi`);

async function main() {
  if (!SUPPORTED_RASTER_DPI.includes(dpi)) throw new Error(`DPI must be one of ${SUPPORTED_RASTER_DPI.join(", ")}`);
  if (!fs.existsSync(samplePath)) throw new Error(`Sample PDF not found: ${samplePath}`);
  const result = await runHybridRasterPrototype({
    pdfPath: samplePath,
    pageNumber: 1,
    dpi,
    outputDir,
  });
  const summary = {
    samplePath,
    dpi,
    preprocessing: [
      "grayscale",
      "1%-99% contrast normalization",
      "adaptive local threshold",
      "thin isolated component suppression",
      "morphological closing",
      "short-gap bridge with continuation evidence",
    ],
    wallMaskMethod: "dark structural pixel mask plus morphology; no individual line classification",
    buildingMassMethod: "connected structural components with centrality/title-block/notes penalties",
    contourMethod: "outer mask boundary trace; collinear-only simplification",
    vectorSnapMethod: "optional compatible-angle nearest vector segment snapping; no production vector index was available in this checkout",
    metrics: result.diagnostics,
    paths: result.paths,
  };
  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outputDir, "contours.json"), JSON.stringify({
    rawContour: result.rawContour,
    simplifiedContour: result.simplifiedContour,
    pdfContour: result.pdfContour,
    snappedContour: result.snappedContour,
  }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
