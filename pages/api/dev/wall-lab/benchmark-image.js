import fs from "fs";
import path from "path";

const BENCHMARK_IMAGE_PATH = "C:\\Users\\grant\\Downloads\\Screenshot 2026-08-04 091547.png";

export default function handler(req, res) {
  if (!fs.existsSync(BENCHMARK_IMAGE_PATH)) {
    res.status(404).json({ error: "Benchmark PNG not found.", path: BENCHMARK_IMAGE_PATH });
    return;
  }

  const image = fs.readFileSync(BENCHMARK_IMAGE_PATH);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Wall-Lab-Source", path.basename(BENCHMARK_IMAGE_PATH));
  res.status(200).send(image);
}
