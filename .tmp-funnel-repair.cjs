require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Missing Supabase env for repair");
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function normalizeContent(content) {
  if (!content || !content.includes("data-shape-block")) return { content, changed: false };
  const ids = [...content.matchAll(/<(?:div|span)[^>]*data-shape-block="true"[^>]*id="([^"]+)"/gi)].map((m) => m[1]);
  let next = content;
  let changed = false;

  for (const id of ids) {
    const ruleRe = new RegExp(`#${id}\\s*\\{([^}]*)\\}`, "i");
    const match = next.match(ruleRe);
    if (!match) continue;

    let rule = match[1];
    const leftMatch = rule.match(/left:\s*(-?\d+(?:\.\d+)?)px/i);
    const topMatch = rule.match(/top:\s*(-?\d+(?:\.\d+)?)px/i);

    let deltaX = 0;
    let deltaY = 0;
    [...rule.matchAll(/translateX\(\s*(-?\d+(?:\.\d+)?)px\s*\)/gi)].forEach((m) => { deltaX += parseFloat(m[1] || "0") || 0; });
    [...rule.matchAll(/translateY\(\s*(-?\d+(?:\.\d+)?)px\s*\)/gi)].forEach((m) => { deltaY += parseFloat(m[1] || "0") || 0; });
    [...rule.matchAll(/translate\(\s*(-?\d+(?:\.\d+)?)px(?:\s*,\s*(-?\d+(?:\.\d+)?)px)?\s*\)/gi)].forEach((m) => {
      deltaX += parseFloat(m[1] || "0") || 0;
      deltaY += parseFloat(m[2] || "0") || 0;
    });

    if (!deltaX && !deltaY) continue;

    const left = (parseFloat(leftMatch?.[1] || "0") || 0) + deltaX;
    const top = (parseFloat(topMatch?.[1] || "0") || 0) + deltaY;

    rule = leftMatch ? rule.replace(/left:\s*-?\d+(?:\.\d+)?px/i, `left:${Math.round(left * 100) / 100}px`) : `${rule};left:${Math.round(left * 100) / 100}px`;
    rule = topMatch ? rule.replace(/top:\s*-?\d+(?:\.\d+)?px/i, `top:${Math.round(top * 100) / 100}px`) : `${rule};top:${Math.round(top * 100) / 100}px`;
    rule = rule
      .replace(/translateX\([^)]*\)/gi, "")
      .replace(/translateY\([^)]*\)/gi, "")
      .replace(/translate\([^)]*\)/gi, "")
      .replace(/transform:\s*;/gi, "")
      .replace(/\s{2,}/g, " ");

    next = next.replace(ruleRe, `#${id}{${rule}}`);
    changed = true;
  }

  return { content: next, changed };
}

(async () => {
  const funnelId = "5abbf73a-32f2-46dc-a3b7-0f3b56fa53c0";
  const { data: steps, error } = await supabase
    .from("funnel_steps")
    .select("id,title,content")
    .eq("funnel_id", funnelId)
    .order("order_index", { ascending: true });
  if (error) throw error;

  let changedCount = 0;
  for (const step of steps || []) {
    const result = normalizeContent(step.content || "");
    if (!result.changed) continue;
    const upd = await supabase.from("funnel_steps").update({ content: result.content }).eq("id", step.id);
    if (upd.error) throw upd.error;
    console.log(`normalized: ${step.title || step.id}`);
    changedCount += 1;
  }
  console.log(`changedCount=${changedCount}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
