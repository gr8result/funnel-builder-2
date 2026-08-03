import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.WALL_LAB_BASE_URL || "http://localhost:3000";
const outputDir = path.join(process.cwd(), "tmp", "wall-lab");

async function screenshotElement(page, selector, fileName) {
  const element = await page.waitForSelector(selector, { timeout: 60000 });
  await element.screenshot({ path: path.join(outputDir, fileName) });
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: "new",
    timeout: 90000,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/dev/wall-lab`, { waitUntil: "networkidle2", timeout: 90000 });
    await page.waitForFunction(() => document.body.innerText.includes("PNG benchmark analysed"), { timeout: 90000 });

    await screenshotElement(page, '[data-testid="wall-lab-original"]', "01-original-png.png");
    await screenshotElement(page, '[data-testid="wall-lab-candidates"]', "02-detected-wall-candidates.png");
    await screenshotElement(page, '[data-testid="wall-lab-accepted"]', "03-accepted-structural-walls.png");
    await screenshotElement(page, '[data-testid="wall-lab-rejected"]', "04-rejected-geometry.png");

    const accepted = await page.$('[data-testid="wall-lab-accepted"]');
    const box = await accepted.boundingBox();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.12);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.12);
    await page.screenshot({ path: path.join(outputDir, "05-hover-and-selected-wall.png"), fullPage: true });

    await page.waitForFunction(
      () => document.body.innerText.includes("PDF comparison analysed") || document.body.innerText.includes("PDF comparison failed"),
      { timeout: 90000 }
    );
    await screenshotElement(page, '[data-testid="wall-lab-pdf-detected"]', "06-pdf-comparison.png");

    const summary = await page.evaluate(() => {
      const text = document.body.innerText;
      const selectedCount = document.querySelectorAll(".selected-wall").length;
      const hoverCount = document.querySelectorAll(".hover-wall").length;
      return { text, selectedCount, hoverCount };
    });

    if (summary.hoverCount > 1 || summary.selectedCount > 1) {
      throw new Error(`Expected one hovered/selected wall at most, got hover=${summary.hoverCount}, selected=${summary.selectedCount}`);
    }

    console.log(JSON.stringify({
      route: `${baseUrl}/dev/wall-lab`,
      screenshots: [
        "tmp/wall-lab/01-original-png.png",
        "tmp/wall-lab/02-detected-wall-candidates.png",
        "tmp/wall-lab/03-accepted-structural-walls.png",
        "tmp/wall-lab/04-rejected-geometry.png",
        "tmp/wall-lab/05-hover-and-selected-wall.png",
        "tmp/wall-lab/06-pdf-comparison.png",
      ],
      hoverCount: summary.hoverCount,
      selectedCount: summary.selectedCount,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
