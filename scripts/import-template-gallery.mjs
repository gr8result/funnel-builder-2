import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const root = process.cwd();
const pubRoot = path.join(root, "public", "templates", "gallery");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function fetchText(url) {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve({ ok: false, code: res.statusCode, url });
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          resolve({ ok: true, body, url });
        });
      })
      .on("error", (e) => resolve({ ok: false, error: String(e), url }));
  });
}

async function fetchFirst(candidates) {
  for (const url of candidates) {
    const r = await fetchText(url);
    if (r.ok) return r;
  }
  return { ok: false };
}

async function writeTemplate(group, fileName, html, sourceUrl) {
  const filePath = path.join(pubRoot, group, fileName);
  ensureDir(path.dirname(filePath));
  const banner = [
    "<!--",
    ` Imported from: ${sourceUrl}`,
    ` Group: ${group}`,
    " License: MIT (source project)",
    "-->",
    "",
  ].join("\n");
  fs.writeFileSync(filePath, banner + html, "utf8");
}

const SOURCES = [
  {
    group: "cerberus",
    files: [
      {
        name: "cerberus-fluid.html",
        candidates: [
          "https://raw.githubusercontent.com/TedGoas/Cerberus/master/cerberus-fluid.html",
          "https://raw.githubusercontent.com/TedGoas/Cerberus/master/dist/cerberus-fluid.html",
        ],
      },
      {
        name: "cerberus-responsive.html",
        candidates: [
          "https://raw.githubusercontent.com/TedGoas/Cerberus/master/cerberus-responsive.html",
          "https://raw.githubusercontent.com/TedGoas/Cerberus/master/dist/cerberus-responsive.html",
        ],
      },
      {
        name: "cerberus-hybrid.html",
        candidates: [
          "https://raw.githubusercontent.com/TedGoas/Cerberus/master/cerberus-hybrid.html",
          "https://raw.githubusercontent.com/TedGoas/Cerberus/master/dist/cerberus-hybrid.html",
        ],
      },
    ],
  },
  {
    group: "mailgun",
    files: [
      {
        name: "action.html",
        candidates: [
          "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/action.html",
        ],
      },
      {
        name: "alert.html",
        candidates: [
          "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/alert.html",
        ],
      },
      {
        name: "billing.html",
        candidates: [
          "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/billing.html",
        ],
      },
      {
        name: "newsletter.html",
        candidates: [
          "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/newsletter.html",
        ],
      },
      {
        name: "password-reset.html",
        candidates: [
          "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/password-reset.html",
        ],
      },
      {
        name: "simple.html",
        candidates: [
          "https://raw.githubusercontent.com/mailgun/transactional-email-templates/master/templates/simple.html",
        ],
      },
    ],
  },
  {
    group: "sendwithus",
    files: [
      {
        name: "password_reset.html",
        candidates: [
          "https://raw.githubusercontent.com/sendwithus/templates/master/templates/password_reset.html",
        ],
      },
      {
        name: "receipt.html",
        candidates: [
          "https://raw.githubusercontent.com/sendwithus/templates/master/templates/receipt.html",
        ],
      },
      {
        name: "welcome.html",
        candidates: [
          "https://raw.githubusercontent.com/sendwithus/templates/master/templates/welcome.html",
        ],
      },
    ],
  },
  {
    group: "lee",
    files: [
      {
        name: "email.html",
        candidates: [
          "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/email.html",
          "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/dist/index.html",
        ],
      },
      {
        name: "email-inlined.html",
        candidates: [
          "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/dist/email-inlined.html",
          "https://raw.githubusercontent.com/leemunroe/responsive-html-email-template/master/dist/index.html",
        ],
      },
    ],
  },
];

async function main() {
  ensureDir(pubRoot);

  let ok = 0;
  let fail = 0;

  console.log(`Importing templates into ${pubRoot}`);

  for (const src of SOURCES) {
    for (const f of src.files) {
      const r = await fetchFirst(f.candidates);
      if (!r.ok) {
        fail++;
        console.log(`FAIL ${src.group}/${f.name}`);
        continue;
      }

      await writeTemplate(src.group, f.name, r.body, r.url);
      ok++;
      console.log(`OK   ${src.group}/${f.name}`);
    }
  }

  console.log(`Done. Imported ${ok}, failed ${fail}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
