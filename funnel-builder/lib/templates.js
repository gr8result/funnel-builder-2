// /lib/templates.js
// Four richer templates with real sections and opt-in form (name/email/phone).

export const TEMPLATES = [
  {
    id: "optin-short",
    name: "Opt-in (Short)",
    category: "Opt-in",
    tags: ["lead", "short"],
    html: doc(`
<section style="padding:70px 0;background:#0f172a;color:#eaeaea">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:1.2fr .8fr;gap:20px;align-items:center">
    <div>
      <h1 style="font-size:42px;margin:0 0 8px">Get the free guide</h1>
      <p style="color:#9aa0a6;margin:0 0 16px">Learn the 5 steps to <strong>double your conversions</strong> in 14 days.</p>
      <ul style="color:#cbd5e1;line-height:1.7;margin:0 0 16px;padding-left:18px">
        <li>Copy blocks that actually sell</li>
        <li>What to put above the fold</li>
        <li>One call-to-action that works</li>
      </ul>
      <form method="post" style="display:grid;gap:10px;max-width:460px">
        <input name="name" placeholder="Your name"  style="${inp}"/>
        <input name="email" type="email" placeholder="Your email" style="${inp}"/>
        <input name="phone" placeholder="Your phone" style="${inp}"/>
        <button type="submit" style="${btnPrim}">Send me the guide</button>
      </form>
    </div>
    <div><img src="https://placehold.co/760x520" style="max-width:100%;border-radius:14px;display:block"/></div>
  </div>
</section>
<section style="padding:40px 0;background:#0b1220;color:#cbd5e1">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    ${feature("Fast to launch")}
    ${feature("Mobile friendly")}
    ${feature("Designed to convert")}
  </div>
</section>
<style>
  a { color:#8ab4f8 }
</style>
`)
  },
  {
    id: "optin-long",
    name: "Opt-in (Long)",
    category: "Opt-in",
    tags: ["lead", "long"],
    html: doc(`
<section style="padding:70px 0;background:#0f172a;color:#eaeaea;text-align:center">
  <div style="max-width:820px;margin:0 auto;padding:0 16px">
    <h1 style="font-size:44px;margin:0 0 10px">Your headline that promises a result</h1>
    <p style="color:#9aa0a6;margin:0 0 16px">Follow this simple framework to get <strong>predictable growth</strong>.</p>
    <img src="https://placehold.co/1000x420" style="max-width:100%;border-radius:14px;display:block;margin:16px auto"/>
  </div>
</section>
<section style="padding:48px 0;background:#0b1220;color:#cbd5e1">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    ${feature("Step-by-step playbooks")}
    ${feature("Battle-tested copy")}
    ${feature("Real examples")}
  </div>
</section>
<section style="padding:48px 0;background:#0f172a;color:#eaeaea">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center">
    <div>
      <h2 style="margin:0 0 8px">What you’ll get</h2>
      <ul style="line-height:1.8;color:#cbd5e1;padding-left:18px">
        <li>Short scripts you can paste into your funnel</li>
        <li>Structure for headlines, leads, and CTAs</li>
        <li>Checklist to review before publishing</li>
      </ul>
    </div>
    <div>
      <form method="post" style="display:grid;gap:10px;max-width:460px">
        <input name="name" placeholder="Your name"  style="${inp}"/>
        <input name="email" type="email" placeholder="Your email" style="${inp}"/>
        <input name="phone" placeholder="Your phone" style="${inp}"/>
        <button type="submit" style="${btnPrim}">Get instant access</button>
      </form>
    </div>
  </div>
</section>
`)
  },
  {
    id: "sales-short",
    name: "Sales (Short)",
    category: "Sales",
    tags: ["checkout", "short"],
    html: doc(`
<section style="padding:70px 0;background:#0f172a;color:#eaeaea">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:1.1fr .9fr;gap:20px;align-items:center">
    <div>
      <h1 style="font-size:40px;margin:0 0 8px">Launch your offer today</h1>
      <p style="color:#9aa0a6;margin:0 0 16px">Everything you need to sell online—pages, email, and payments.</p>
      <ul style="line-height:1.8;color:#cbd5e1;padding-left:18px">
        <li>Beautiful pages that convert</li>
        <li>Built-in email for follow-ups</li>
        <li>One-click checkout</li>
      </ul>
      <a href="#" style="${btnPrim}display:inline-block;text-decoration:none">Buy now</a>
    </div>
    <div><img src="https://placehold.co/760x520" style="max-width:100%;border-radius:14px;display:block"/></div>
  </div>
</section>
<section style="padding:36px 0;background:#0b1220;color:#cbd5e1">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    ${feature("30-day guarantee")}
    ${feature("Secure payments")}
    ${feature("Instant access")}
  </div>
</section>
`)
  },
  {
    id: "sales-long",
    name: "Sales (Long)",
    category: "Sales",
    tags: ["checkout", "long"],
    html: doc(`
<section style="padding:70px 0;background:#0f172a;color:#eaeaea;text-align:center">
  <div style="max-width:820px;margin:0 auto;padding:0 16px">
    <h1 style="font-size:44px;margin:0 0 10px">Turn visitors into customers</h1>
    <p style="color:#9aa0a6;margin:0 0 16px">Proven structure for a long-form sales page.</p>
    <a href="#" style="${btnPrim}display:inline-block;text-decoration:none">Get started</a>
  </div>
</section>
<section style="padding:48px 0;background:#0b1220;color:#cbd5e1">
  <div style="max-width:960px;margin:0 auto;padding:0 16px">
    <h2>The problem</h2>
    <p>Paint the picture of the pain and missed opportunities…</p>
    <h2 style="margin-top:24px">The solution</h2>
    <p>Introduce your product and how it directly addresses the pain…</p>
  </div>
</section>
<section style="padding:48px 0;background:#0f172a;color:#eaeaea">
  <div style="max-width:960px;margin:0 auto;padding:0 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    ${feature("Feature A")}
    ${feature("Feature B")}
    ${feature("Feature C")}
  </div>
</section>
<section style="padding:48px 0;background:#0b1220;color:#cbd5e1;text-align:center">
  <h2>Ready?</h2>
  <p>Add your guarantee or risk-reversal here.</p>
  <a href="#" style="${btnPrim}display:inline-block;text-decoration:none">Buy now</a>
</section>
`)
  }
];

export function templateCategories() {
  return [...new Set(TEMPLATES.map(t => t.category))];
}

// small helpers
const inp = "border:1px solid #233044;border-radius:10px;padding:12px 14px;background:#0f172a;color:#eaeaea";
const btnPrim = "background:#2d6cdf;color:#fff;border:none;border-radius:10px;padding:12px 14px;";

function feature(title) {
  return `<div style="background:#0f172a;border:1px solid #1f2937;border-radius:12px;padding:14px"><strong>${title}</strong><p style="color:#9aa0a6;margin:6px 0 0">Short supportive line.</p></div>`;
}
function doc(body) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${body}</body></html>`;
}
