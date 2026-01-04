// /lib/blocks.js
// Lightweight block system + template library for Funnels.
// Exports:
//   - LIBRARY: { key: { name, description, blocks } }
//   - renderBlocks(blocks): string -> HTML

// Simple id
const uid = () => Math.random().toString(36).slice(2, 9);

// Defaults (note: we use Australian spelling "colour" in props)
const DEFAULTS = {
  hero:    () => ({ heading: "Your Big Promise", sub: "One clear sentence that tells visitors what they get.", align: "centre", bg: "#0f1116", colour: "#eaeaea" }),
  text:    () => ({ html: "<p>Write something compelling here.</p>", align: "left", colour: "#d1d5db" }),
  image:   () => ({ url: "", alt: "image", width: 960, height: 540, rounded: true }),
  button:  () => ({ label: "Get started", href: "#", style: "primary" }),
  form_short: () => ({ heading: "Get updates", sub: "No spam. Unsubscribe anytime.", fields: ["name","email"], submit: "Send", bg: "#111827" }),
  form_long:  () => ({ heading: "Get started", sub: "Tell us a bit about you.", fields: ["name","email","phone","company","message"], submit: "Continue", bg: "#111827" }),
  features:   () => ({ items: ["Fast to launch", "Mobile ready", "A/B test friendly"], columns: 3 }),
  testimonial:() => ({ quote: "This changed our business overnight.", author: "Happy Customer", role: "Founder" }),
  faq:        () => ({ items: [{ q:"What do I get?", a:"A complete funnel ready to launch." }, { q:"Can I cancel?", a:"Yes, anytime." }] }),
  section:    () => ({ heading: "Custom section", bg: "#0f1116" }),
};

// Template helpers
const H = (heading, sub="") => ({ id: uid(), type: "hero", props: { ...DEFAULTS.hero(), heading, sub, align: "centre" }});
const T = (html) => ({ id: uid(), type: "text", props: { ...DEFAULTS.text(), html }});
const I = (url="", alt="image") => ({ id: uid(), type: "image", props: { ...DEFAULTS.image(), url, alt }});
const B = (label="Learn more", href="#") => ({ id: uid(), type: "button", props: { label, href, style: "primary" }});
const FS = () => ({ id: uid(), type: "form_short", props: DEFAULTS.form_short() });
const FL = () => ({ id: uid(), type: "form_long",  props: DEFAULTS.form_long() });
const FEAT = (items) => ({ id: uid(), type: "features", props: { items, columns: Math.min(4, Math.max(1, items.length)) }});
const TESTI = () => ({ id: uid(), type: "testimonial", props: DEFAULTS.testimonial() });
const FAQ = () => ({ id: uid(), type: "faq", props: DEFAULTS.faq() });
const SEC = (heading) => ({ id: uid(), type: "section", props: { ...DEFAULTS.section(), heading }});

// Public library
export const LIBRARY = {
  optin_short: {
    name: "Opt-in (short)",
    description: "Hero + short form + features",
    blocks: [
      H("Free Guide: Double Your Leads", "Get the 5-step playbook in your inbox."),
      FS(),
      FEAT(["Fast to launch", "Mobile ready", "A/B test friendly"]),
    ],
  },
  optin_long: {
    name: "Opt-in (long)",
    description: "Hero + benefits + long form + FAQ",
    blocks: [
      H("Build funnels faster", "A simple, effective system for landing pages."),
      T("<h2>What you'll learn</h2><ul><li>Design that converts</li><li>Copy that sells</li><li>Traffic that scales</li></ul>"),
      FL(),
      TESTI(),
      FAQ(),
    ],
  },
  sales_page: {
    name: "Sales page",
    description: "Hero + proof + CTA",
    blocks: [
      H("Launch your product with confidence", "Everything you need to sell online."),
      FEAT(["Checkout ready","Mobile-first","Blazing fast"]),
      T("<h2>Why it works</h2><p>We focus your visitor on the one next step you want.</p>"),
      I("", "Product shot"),
      B("Buy now", "#checkout"),
      FAQ(),
    ],
  },
  webinar: {
    name: "Webinar registration",
    description: "Hero + bullets + short form",
    blocks: [
      H("Free training: 3 secrets to scale", "Live this Thursday — limited seats."),
      T("<ul><li>Secret #1</li><li>Secret #2</li><li>Secret #3</li></ul>"),
      FS(),
    ],
  },
  thank_you: {
    name: "Thank-you / Delivery",
    description: "Confirmation + next step",
    blocks: [
      H("You're in!", "Check your email for the download."),
      T("<p>While you wait, join our community:</p>"),
      B("Join the community", "#community"),
    ],
  },
  product_checkout: {
    name: "Product checkout (simple)",
    description: "Pitch + CTA button (hook up later)",
    blocks: [
      H("Get the full course", "Instant access + updates included."),
      T("<p>Secure checkout. 30-day money-back guarantee.</p>"),
      B("Proceed to checkout", "#checkout"),
      FAQ(),
    ],
  },
};

// Rendering utilities
function esc(s=""){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

export function renderBlocks(blocks = []) {
  const parts = [];
  for (const b of blocks) {
    const p = b.props || {};
    switch (b.type) {
      case "hero":
        parts.push(`
<section style="padding:48px 16px;background:${p.bg};color:${p.colour}">
  <div style="max-width:960px;margin:0 auto;text-align:${p.align==='centre'?'center':p.align}">
    <h1 style="margin:0 0 8px">${esc(p.heading||"")}</h1>
    <p style="color:#9aa0a6;margin:0">${esc(p.sub||"")}</p>
  </div>
</section>`);
        break;
      case "text":
        parts.push(`<section style="padding:24px 16px"><div style="max-width:860px;margin:0 auto;text-align:${p.align};color:${p.colour}">${p.html||""}</div></section>`);
        break;
      case "image":
        parts.push(`
<section style="padding:24px 16px">
  <div style="max-width:${p.width||960}px;margin:0 auto;${p.rounded?'border-radius:12px;overflow:hidden;':''}">
    <img src="${esc(p.url||"")}" alt="${esc(p.alt||"")}" style="width:100%;height:auto;display:block" />
  </div>
</section>`);
        break;
      case "button":
        parts.push(`
<section style="padding:12px 16px">
  <div style="max-width:860px;margin:0 auto">
    <a href="${esc(p.href||"#")}" style="display:inline-block;padding:12px 16px;border-radius:10px;text-decoration:none;
      ${p.style==='primary'
        ? 'background:#2563eb;color:#fff'
        : 'border:1px solid #2b3040;color:#111'}">${esc(p.label||"Click")}</a>
  </div>
</section>`);
        break;
      case "form_short":
      case "form_long": {
        const wantLong = b.type === "form_long";
        const fields = Array.isArray(p.fields) ? p.fields : (wantLong ? DEFAULTS.form_long().fields : DEFAULTS.form_short().fields);
        const inputs = fields.map(f => {
          const label = f[0].toUpperCase()+f.slice(1);
          const type = f === "email" ? "email" : (f === "phone" ? "tel" : "text");
          const rows = (f === "message") ? 4 : null;
          return rows
            ? `<label style="display:block;margin:6px 0;color:#374151">${esc(label)}<textarea name="${esc(f)}" rows="${rows}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #2b3040;background:#F9FAFB;color:#111"></textarea></label>`
            : `<label style="display:block;margin:6px 0;color:#374151">${esc(label)}<input type="${type}" name="${esc(f)}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #2b3040;background:#F9FAFB;color:#111"/></label>`;
        }).join("");
        parts.push(`
<section style="padding:32px 16px;background:${p.bg||"#111827"}">
  <form style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
    <h3 style="margin:0 0 6px;color:#111">${esc(p.heading||"")}</h3>
    <p style="margin:0 0 8px;color:#6b7280">${esc(p.sub||"")}</p>
    ${inputs}
    <button type="submit" style="margin-top:10px;padding:10px 14px;border:none;border-radius:10px;background:#22a06b;color:#fff;cursor:pointer">${esc(p.submit||"Submit")}</button>
  </form>
</section>`);
        break;
      }
      case "features": {
        const cols = Math.min(4, Math.max(1, Number(p.columns||3)));
        const items = (p.items||[]).map(it => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;color:#111">${esc(it)}</div>`).join("");
        parts.push(`<section style="padding:24px 16px"><div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:12px;max-width:960px;margin:0 auto">${items}</div></section>`);
        break;
      }
      case "testimonial":
        parts.push(`
<section style="padding:32px 16px"><div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
  <blockquote style="margin:0;color:#111;font-size:18px">“${esc(p.quote||"") }”</blockquote>
  <div style="margin-top:8px;color:#6b7280">— ${esc(p.author||"")}${p.role?', '+esc(p.role):''}</div>
</div></section>`);
        break;
      case "faq": {
        const rows = (p.items||[]).map(it => `
  <details style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px">
    <summary style="cursor:pointer;color:#111">${esc(it.q||"")}</summary>
    <div style="margin-top:8px;color:#6b7280">${esc(it.a||"")}</div>
  </details>`).join("");
        parts.push(`<section style="padding:24px 16px"><div style="display:grid;gap:10px;max-width:860px;margin:0 auto">${rows}</div></section>`);
        break;
      }
      case "section":
        parts.push(`<section style="padding:24px 16px;background:${b.props?.bg||"#0f1116"}"><div style="max-width:960px;margin:0 auto;color:#eaeaea"><h3>${esc(b.props?.heading||"")}</h3></div></section>`);
        break;
      default: break;
    }
  }
  return parts.join("\n");
}
