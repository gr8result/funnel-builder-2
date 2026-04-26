const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ICON_SIZE = 64;
const SOCIAL_DIR = path.join(process.cwd(), "public", "email-assets", "social");

async function main() {
  const svgFiles = fs.readdirSync(SOCIAL_DIR).filter((name) => name.toLowerCase().endsWith(".svg"));
  if (!svgFiles.length) {
    throw new Error(`No SVG files found in ${SOCIAL_DIR}`);
  }

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: ICON_SIZE, height: ICON_SIZE, deviceScaleFactor: 1 });

    for (const file of svgFiles) {
      const svg = fs.readFileSync(path.join(SOCIAL_DIR, file), "utf8");
      const html = `<!doctype html>
<html>
<body style="margin:0;width:${ICON_SIZE}px;height:${ICON_SIZE}px;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;">
${svg.replace("<svg ", `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" preserveAspectRatio="xMidYMid meet" `)}
</body>
</html>`;

      await page.setContent(html, { waitUntil: "load" });
      await page.screenshot({
        path: path.join(SOCIAL_DIR, file.replace(/\.svg$/i, ".png")),
        omitBackground: true,
        clip: { x: 0, y: 0, width: ICON_SIZE, height: ICON_SIZE },
      });

      process.stdout.write(`generated ${file.replace(/\.svg$/i, ".png")}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});