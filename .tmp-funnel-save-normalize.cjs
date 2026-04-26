require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");
const supabase = createClient(url, key, { auth: { persistSession: false } });

function cleanRule(rule) {
  const original = rule;
  const positionMatch = rule.match(/position:\s*([^;]+)/i);
  const position = (positionMatch?.[1] || "").trim().toLowerCase();
  const transformMatch = rule.match(/transform:\s*([^;]+)/i);
  if (!transformMatch) return { rule, changed: false };

  const rawTransform = transformMatch[1];
  let deltaX = 0;
  let deltaY = 0;
  [...rawTransform.matchAll(/translateX\(\s*(-?\d+(?:\.\d+)?)px\s*\)/gi)].forEach((m) => { deltaX += parseFloat(m[1] || "0") || 0; });
  [...rawTransform.matchAll(/translateY\(\s*(-?\d+(?:\.\d+)?)px\s*\)/gi)].forEach((m) => { deltaY += parseFloat(m[1] || "0") || 0; });
  [...rawTransform.matchAll(/translate\(\s*(-?\d+(?:\.\d+)?)px(?:\s*,\s*(-?\d+(?:\.\d+)?)px)?\s*\)/gi)].forEach((m) => {
    deltaX += parseFloat(m[1] || "0") || 0;
    deltaY += parseFloat(m[2] || "0") || 0;
  });

  const cleanedTransform = rawTransform
    .replace(/translateX\(\s*-?\d+(?:\.\d+)?px\s*\)/gi, "")
    .replace(/translateY\(\s*-?\d+(?:\.\d+)?px\s*\)/gi, "")
    .replace(/translate\(\s*-?\d+(?:\.\d+)?px(?:\s*,\s*-?\d+(?:\.\d+)?px)?\s*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if ((position === "absolute" || position === "fixed") && (deltaX || deltaY)) {
    const leftMatch = rule.match(/left:\s*(-?\d+(?:\.\d+)?)px/i);
    const topMatch = rule.match(/top:\s*(-?\d+(?:\.\d+)?)px/i);
    const nextLeft = (parseFloat(leftMatch?.[1] || "0") || 0) + deltaX;
    const nextTop = (parseFloat(topMatch?.[1] || "0") || 0) + deltaY;
    if (leftMatch) rule = rule.replace(/left:\s*-?\d+(?:\.\d+)?px/i, `left:${Math.round(nextLeft * 100) / 100}px`);
    if (topMatch) rule = rule.replace(/top:\s*-?\d+(?:\.\d+)?px/i, `top:${Math.round(nextTop * 100) / 100}px`);
  }

  if (cleanedTransform) {
    rule = rule.replace(/transform:\s*([^;]+)/i, `transform:${cleanedTransform}`);
  } else {
    rule = rule.replace(/transform:\s*([^;]+);?/i, "");
  }

  return { rule, changed: rule !== original };
}

function normalizeContent(content) {
  if (!content || !content.includes("<style>")) return { content, changed: false };
  let changed = false;
  const next = content.replace(/#[-_a-zA-Z0-9]+\s*\{[^}]*\}/g, (match) => {
    const body = match.slice(match.indexOf("{") + 1, -1);
    const { rule, changed: ruleChanged } = cleanRule(body);
    if (ruleChanged) changed = true;
    return `${match.slice(0, match.indexOf("{") + 1)}${rule}}`;
  });
  return { content: next, changed };
}

(async () => {
  const funnelId = "5abbf73a-32f2-46dc-a3b7-0f3b56fa53c0";
  const { data: steps, error } = await supabase.from("funnel_steps").select("id,title,content").eq("funnel_id", funnelId).order("order_index", { ascending: true });
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
})();
