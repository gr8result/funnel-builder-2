import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const API_BASE = "https://api.sendgrid.com/v3";

const SENDGRID_KEY =
  process.env.SENDGRID_API_KEY ||
  process.env.SENDGRID_API_KEY_SERVER ||
  process.env.SENDGRID_KEY ||
  process.env.SENDGRID_PRIVATE_KEY ||
  "";

const ENV_SUBUSER =
  process.env.SENDGRID_SUBUSER ||
  process.env.SENDGRID_ON_BEHALF_OF ||
  process.env.SENDGRID_ON_BEHALF ||
  "";

if (!SENDGRID_KEY) {
  console.error("Missing SendGrid API key in env.");
  console.error(
    "Set one of: SENDGRID_API_KEY, SENDGRID_API_KEY_SERVER, SENDGRID_KEY, SENDGRID_PRIVATE_KEY"
  );
  process.exit(1);
}

function sanitizeName(input) {
  return String(input || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function getOutDir() {
  const arg = process.argv.find((a) => a.startsWith("--out="));
  const raw = arg ? arg.split("=")[1] : "email/sendgrid-export";
  return path.resolve(process.cwd(), raw);
}

function getGenerationFilter() {
  const arg = process.argv.find((a) => a.startsWith("--generation="));
  const value = (arg ? arg.split("=")[1] : "all").toLowerCase();
  if (["all", "dynamic", "legacy"].includes(value)) return value;
  return "all";
}

function getSubuser() {
  const arg = process.argv.find((a) => a.startsWith("--subuser="));
  const cli = arg ? arg.split("=")[1] : "";
  return String(cli || ENV_SUBUSER || "").trim();
}

function getHeaders(subuser) {
  const headers = {
    Authorization: `Bearer ${SENDGRID_KEY}`,
    "Content-Type": "application/json",
  };

  if (subuser) {
    headers["On-Behalf-Of"] = subuser;
  }

  return headers;
}

async function sgFetch(urlPath, { subuser = "", required = true } = {}) {
  const url = urlPath.startsWith("http") ? urlPath : `${API_BASE}${urlPath}`;

  const res = await fetch(url, { method: "GET", headers: getHeaders(subuser) });

  if (!res.ok) {
    const body = await res.text();
    if (!required) {
      return { ok: false, status: res.status, error: body, data: null };
    }
    throw new Error(`SendGrid ${res.status}: ${body}`);
  }

  return { ok: true, status: res.status, data: await res.json(), error: null };
}

async function listTemplates(generationFilter, subuser) {
  const all = [];
  const params = new URLSearchParams({ page_size: "200" });
  if (generationFilter !== "all") {
    params.set("generations", generationFilter);
  }

  let nextUrl = `${API_BASE}/templates?${params.toString()}`;

  while (nextUrl) {
    const response = await sgFetch(nextUrl, { subuser });
    const payload = response.data;
    const result = Array.isArray(payload?.result) ? payload.result : [];
    all.push(...result);

    const relNext = payload?._metadata?.next;
    nextUrl = relNext ? (relNext.startsWith("http") ? relNext : `${API_BASE}${relNext}`) : null;
  }

  return all;
}

async function listDesigns(subuser) {
  const res = await sgFetch("/designs?page_size=200", { subuser, required: false });
  if (!res.ok) return [];
  const data = res.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.designs)) return data.designs;
  return [];
}

async function listSingleSends(subuser) {
  const res = await sgFetch("/marketing/singlesends?page_size=200", {
    subuser,
    required: false,
  });
  if (!res.ok) return [];
  const data = res.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.singlesends)) return data.singlesends;
  return [];
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function exportTransactionalTemplates({ outDir, generationFilter, subuser }) {
  console.log(`Loading ${generationFilter} transactional templates from SendGrid...`);
  const templates = await listTemplates(generationFilter, subuser);
  console.log(`Found ${templates.length} transactional templates.`);

  const summary = [];

  for (const template of templates) {
    const fullRes = await sgFetch(`/templates/${template.id}`, { subuser });
    const full = fullRes.data;

    const baseName = sanitizeName(full.name || template.name || template.id);
    const templateDir = path.join(outDir, "transactional", `${baseName}-${template.id}`);
    await fs.mkdir(templateDir, { recursive: true });

    await writeJson(path.join(templateDir, "template.json"), full);

    const versions = Array.isArray(full.versions) ? full.versions : [];
    const versionSummary = [];

    for (const version of versions) {
      const vName = sanitizeName(version.name || version.id);
      const prefix = `${vName}-${version.id}`;

      const htmlPath = path.join(templateDir, `${prefix}.html`);
      const txtPath = path.join(templateDir, `${prefix}.txt`);
      const metaPath = path.join(templateDir, `${prefix}.json`);

      await fs.writeFile(htmlPath, version.html_content || "", "utf8");
      await fs.writeFile(txtPath, version.plain_content || "", "utf8");
      await writeJson(metaPath, version);

      versionSummary.push({
        id: version.id,
        name: version.name || null,
        active: Number(version.active || 0) === 1,
        subject: version.subject || null,
        html: path.basename(htmlPath),
        text: path.basename(txtPath),
        json: path.basename(metaPath),
      });
    }

    await writeJson(path.join(templateDir, "index.json"), {
      id: full.id,
      name: full.name,
      generation: full.generation,
      updated_at: full.updated_at,
      version_count: versions.length,
      versions: versionSummary,
    });

    summary.push({
      type: "transactional-template",
      id: full.id,
      name: full.name,
      folder: path.relative(process.cwd(), templateDir).replaceAll("\\", "/"),
      versions: versions.length,
    });

    console.log(`Exported template: ${full.name} (${versions.length} versions)`);
  }

  return summary;
}

async function exportDesigns({ outDir, subuser }) {
  console.log("Loading design library assets from SendGrid...");
  const designs = await listDesigns(subuser);
  console.log(`Found ${designs.length} designs.`);

  const summary = [];

  for (const design of designs) {
    const detailRes = await sgFetch(`/designs/${design.id}`, {
      subuser,
      required: false,
    });
    const full = detailRes.ok ? detailRes.data : design;

    const baseName = sanitizeName(full.name || design.name || design.id);
    const designDir = path.join(outDir, "designs", `${baseName}-${design.id}`);
    await fs.mkdir(designDir, { recursive: true });

    await writeJson(path.join(designDir, "design.json"), full);

    const html = full?.html_content || full?.content || "";
    const plain = full?.plain_content || "";
    if (html) await fs.writeFile(path.join(designDir, "design.html"), html, "utf8");
    if (plain) await fs.writeFile(path.join(designDir, "design.txt"), plain, "utf8");

    summary.push({
      type: "design",
      id: full.id || design.id,
      name: full.name || design.name || null,
      folder: path.relative(process.cwd(), designDir).replaceAll("\\", "/"),
      versions: 1,
    });
  }

  return summary;
}

async function exportSingleSends({ outDir, subuser }) {
  console.log("Loading marketing single sends from SendGrid...");
  const items = await listSingleSends(subuser);
  console.log(`Found ${items.length} single sends.`);

  const summary = [];

  for (const item of items) {
    const baseName = sanitizeName(item.name || item.id);
    const itemDir = path.join(outDir, "single-sends", `${baseName}-${item.id}`);
    await fs.mkdir(itemDir, { recursive: true });

    await writeJson(path.join(itemDir, "single-send.json"), item);

    const html = item?.email_config?.html_content || "";
    const plain = item?.email_config?.plain_content || "";
    if (html) await fs.writeFile(path.join(itemDir, "single-send.html"), html, "utf8");
    if (plain) await fs.writeFile(path.join(itemDir, "single-send.txt"), plain, "utf8");

    summary.push({
      type: "single-send",
      id: item.id,
      name: item.name || null,
      folder: path.relative(process.cwd(), itemDir).replaceAll("\\", "/"),
      versions: 1,
    });
  }

  return summary;
}

async function main() {
  const outDir = getOutDir();
  const generationFilter = getGenerationFilter();
  const subuser = getSubuser();
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Export folder: ${outDir}`);
  if (subuser) {
    console.log(`Using SendGrid subuser context: ${subuser}`);
  } else {
    console.log("Using primary SendGrid account context (no subuser override).");
  }

  const exported = [];

  exported.push(
    ...(await exportTransactionalTemplates({ outDir, generationFilter, subuser }))
  );
  exported.push(...(await exportDesigns({ outDir, subuser })));
  exported.push(...(await exportSingleSends({ outDir, subuser })));

  await writeJson(path.join(outDir, "manifest.json"), {
    exported_at: new Date().toISOString(),
    subuser: subuser || null,
    item_count: exported.length,
    items: exported,
  });

  if (exported.length === 0) {
    console.log("No templates or marketing assets found for this account context.");
    console.log("Try setting SENDGRID_SUBUSER in .env.local or pass --subuser=<name>.");
  }

  console.log(`Done. Exported ${exported.length} items.`);
}

main().catch((err) => {
  console.error("Export failed:", err.message || err);
  process.exit(1);
});
