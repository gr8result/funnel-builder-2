// pages/api/track/render-thumbnail.js
// FULL REPLACEMENT
// Removes chrome-aws-lambda dependency (fixes build error). Uses puppeteer if installed.

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });

  const { html = "", width = 1200, height = 630 } = req.body || {};
  if (!html || typeof html !== "string") {
    return json(res, 400, { ok: false, error: "html is required" });
  }

  // Lazy load puppeteer/puppeteer-core so the app can still build without it
  let puppeteer = null;
  try {
    const reqq = eval("require"); // eslint-disable-line no-eval
    puppeteer = reqq("puppeteer");
  } catch {
    try {
      const reqq = eval("require"); // eslint-disable-line no-eval
      puppeteer = reqq("puppeteer-core");
    } catch {
      puppeteer = null;
    }
  }

  if (!puppeteer) {
    return json(res, 501, {
      ok: false,
      error:
        "Thumbnail rendering disabled: install puppeteer (or puppeteer-core) to enable this endpoint.",
    });
  }

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new",
    });

    const page = await browser.newPage();
    await page.setViewport({ width: Number(width) || 1200, height: Number(height) || 630 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const buf = await page.screenshot({ type: "png" });
    await browser.close();

    res.setHeader("Content-Type", "image/png");
    res.status(200).send(buf);
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || String(e) });
  }
}
