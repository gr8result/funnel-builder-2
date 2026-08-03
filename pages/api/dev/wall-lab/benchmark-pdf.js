import fs from "fs";
import path from "path";

const BENCHMARK_PDF_PATH = "C:\\Users\\grant\\Downloads\\SAMPLE PLANS.pdf";

export default function handler(req, res) {
  if (!fs.existsSync(BENCHMARK_PDF_PATH)) {
    res.status(404).json({ error: "Benchmark PDF not found.", path: BENCHMARK_PDF_PATH });
    return;
  }

  const pdf = fs.readFileSync(BENCHMARK_PDF_PATH);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Wall-Lab-Source", path.basename(BENCHMARK_PDF_PATH));
  res.status(200).send(pdf);
}
