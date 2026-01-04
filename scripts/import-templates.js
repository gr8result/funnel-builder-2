// scripts/import-templates.js
// Bulk-import MIT-licensed HTML email templates into templates/gallery/**,
// and mirror to public/templates/gallery/** so "View" links work immediately.

const fs = require("fs");
const path = require("path");
const https = require("https");

const root = process.cwd();
const srcRoot = path.join(root, "templates", "gallery");
const pubRoot = path.join(root, "public", "templates", "gallery");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function fetchText(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve({ ok:false, code:res.statusCode, url }); }
      let body = ""; res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ ok:true, body }));
    }).on("error", (e) => resolve({ ok:false, error:String(e), url }));
  });
}

async function fetchFirst(candidates) {
  for (const u of candidates) {
    const r = await fetchText(u);
    if (r.ok) return { ok:true, body:r.body, url:u };
  }
  return { ok:false, tried:candidates };
}

async function writeMirrored(group, rel, html) {
  const srcFile = path.join(srcRoot, group, rel);
  const pubFile = path.join(pubRoot, group, rel);
  ensureDir(path.dirname(srcFile));
  ensureDir(path.dirname(pubFile));
  fs.writeFileSync(srcFile, html, "utf8");
  fs.writeFileSync(pubFile, html, "utf8");
}

// ---------------------------------------------------------------------------
// Sources (MIT) with multiple fallback URLs where repos move or restructure.
// We intentionally avoid “inlined/” variants that frequently disappear.
// ---------------------------------------------------------------------------

const SOURCES = [
  {
    group: "cerberus",
    description: "Cerberus responsive email patterns (fluid, responsive, hybrid).",
    files: [
      { name: "cerberus-fluid.html", candidates: [
        "https://raw.githubusercontent.com/TedGoas/Cerberus/master/cerberus-fluid.html",
        "https://raw.githubusercontent.com/TedGoas/Cerberus/master/dist/cerberus-fluid.html"
      ]},
      { name: "cerberus-responsive.html", candidates: [
        "https://raw.githubusercontent.com/TedGoas/Cerberus/master/cerberus-responsive.html",
        "https://raw.githubusercontent.com/TedGoas/Cerberus/master/dist/cerberus-responsive.html"
      ]},
      { name: "cerberus-hybrid.html", candidates: [
        "https://raw.githubusercontent.com/TedGoas/Cerberus/master/cerberus-hybrid.html",
        "https://raw.githubusercontent.com/TedGoas/Cerberus/master/dist/cerberus-hybrid.html"
      ]},
    ],
  },

  {
    group: "lee",
    description: "Lee Munroe’s responsive HTML email template.",
    files: [
      { name: "email.html", candidates: [
        "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/email.html",
        "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/dist/index.html",
      ]},
      { name: "email-inlined.html", candidates: [
        "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/dist/email-inlined.html",
        "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/dist/index.html",
      ]},
    ],
  },

  {
    group: "mailgun",
    description: "Mailgun transactional templates (originals).",
    files: [
      { name: "action.html", candidates: [
        "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/action.html",
      ]},
      { name: "alert.html", candidates: [
        "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/alert.html",
      ]},
      { name: "billing.html", candidates: [
        "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/billing.html",
      ]},
      { name: "newsletter.html", candidates: [
        "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/newsletter.html",
      ]},
      { name: "password-reset.html", candidates: [
        "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/password-reset.html",
      ]},
      { name: "simple.html", candidates: [
        "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/simple.html",
      ]},
    ],
  },

  {
    group: "antwort",
    description: "Antwort responsive column layouts (2-col & 3-col).",
    files: [
      { name: "antwort-2col.html", candidates: [
        "https://raw.githubusercontent.com/InterNations/antwort/master/dist/antwort_2col.html",
        "https://raw.githubusercontent.com/InterNations/antwort/master/antwort_2col.html",
      ]},
      { name: "antwort-3col.html", candidates: [
        "https://raw.githubusercontent.com/InterNations/antwort/master/dist/antwort_3col.html",
        "https://raw.githubusercontent.com/InterNations/antwort/master/antwort_3col.html",
      ]},
    ],
  },

  // Extra reliable source with many base layouts (MIT): Sendwithus/Templates
  {
    group: "sendwithus",
    description: "Sendwithus MIT base templates.",
    files: [
      { name: "password_reset.html", candidates: [
        "https://raw.githubusercontent.com/sendwithus/templates/master/templates/password_reset.html",
      ]},
      { name: "receipt.html", candidates: [
        "https://raw.githubusercontent.com/sendwithus/templates/master/templates/receipt.html",
      ]},
      { name: "welcome.html", candidates: [
        "https://raw.githubusercontent.com/sendwithus/templates/master/templates/welcome.html",
      ]},
    ],
  },

  // Foundation for Emails starter can move; include multiple candidates.
  {
    group: "foundation",
    description: "Foundation for Emails starter (dist-ish build).",
    files: [
      { name: "starter.html", candidates: [
        "https://raw.githubusercontent.com/foundation/foundation-emails-template/master/dist/index.html",
        "https://raw.githubusercontent.com/foundation/foundation-emails-template/master/src/pages/index.html",
      ]},
    ],
  },
];

async function main() {
  console.log("Importing email templates into:");
  console.log("  -", srcRoot);
  console.log("  -", pubRoot);
  console.log("");

  ensureDir(srcRoot); ensureDir(pubRoot);

  let ok = 0, fail = 0;

  for (const src of SOURCES) {
    console.log(`› Source: ${src.group} — ${src.description}`);
    for (const f of src.files) {
      const r = await fetchFirst(f.candidates);
      if (!r.ok) {
        fail++;
        console.error(`  ✗ ${src.group}/${f.name}  (fetch failed: ${r.tried.join(" | ")})`);
        continue;
      }
      const banner = [
        "<!--",
        ` Imported from: ${r.url}`,
        ` Group: ${src.group}`,
        " License: MIT (source project)",
        " Note: You may remove this comment from outgoing emails.",
        "-->\n",
      ].join("\n");

      await writeMirrored(src.group, f.name, banner + r.body);
      ok++;
      console.log(`  ✓ ${src.group}/${f.name}`);
    }
    console.log("");
  }

  console.log(`Done. Imported ${ok} file(s); ${fail} failed.`);
  console.log("Tip: refresh /modules/email/templates/all — new templates will appear by folder.");
}

main().catch((e) => {
  console.error("Importer crashed:", e);
  process.exit(1);
});
