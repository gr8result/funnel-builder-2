// pages/api/forms/submit.js
// Accepts public POSTs from any page form.
// 1) Archives the submission
// 2) Upserts subscriber under the owner (user_id inferred from list)
// 3) Adds to list (optional)
// 4) Applies tags (optional)
// 5) Sends notification (optional)
// Hidden fields expected: funnel_id, step_id, list_id, notify_to, success_url, tags (comma/array)

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmail } from "../../../lib/sendEmail";
import {
  upsertSubscriber,
  assertList,
  addToList,
  getOrCreateTags,
  tagSubscriber,
} from "../../../lib/emailDB";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const body = normalise(req.body);
    const {
      funnel_id = null,
      step_id = null,
      list_id = null,
      notify_to = "",
      success_url = "",
      name = "",
      email = "",
      tags = [],
      ...rest
    } = body;

    if (!email) return res.status(400).send("Email is required");

    // Find owner via list (simple and reliable)
    let user_id = null;
    if (list_id) {
      const l = await assertList({ list_id });
      user_id = l.user_id;
    }

    // 1) archive
    await supabaseAdmin.from("form_submissions").insert({
      user_id,
      funnel_id,
      step_id,
      list_id,
      name: name || null,
      email,
      payload: rest || {},
    });

    // If we don’t know the owner, we still accept the submission (archive-only).
    if (user_id) {
      // 2) upsert subscriber
      const subscriber_id = await upsertSubscriber({ user_id, email, name });

      // 3) add to list (optional)
      if (list_id) await addToList({ list_id, subscriber_id });

      // 4) tags (optional)
      const tagArray = toTagArray(tags);
      if (tagArray.length) {
        const tagIds = await getOrCreateTags({ user_id, tagNames: tagArray });
        await tagSubscriber({ subscriber_id, tag_ids: tagIds });
      }
    }

    // 5) notify (optional)
    if (notify_to) {
      await safeNotify(notify_to, {
        subject: "New signup",
        html: renderEmail({ name, email, rest, tags }),
      });
    }

    if (success_url) {
      res.setHeader("Location", success_url);
      return res.status(302).end();
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[forms/submit] error:", e);
    return res.status(500).send("Server error");
  }
}

function normalise(body) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (Array.isArray(v)) out[k] = v[0];
    else out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
function toTagArray(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
function renderEmail({ name, email, rest, tags }) {
  const pre = esc(JSON.stringify(rest || {}, null, 2));
  const tg = Array.isArray(tags) ? tags.join(", ") : String(tags || "");
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;padding:12px">
    <h2 style="margin:0 0 8px 0;">New signup</h2>
    <p><strong>Name:</strong> ${esc(name || "")}</p>
    <p><strong>Email:</strong> ${esc(email || "")}</p>
    <p><strong>Tags:</strong> ${esc(tg)}</p>
    <pre style="background:#f6f7f9;padding:12px;border-radius:8px;white-space:pre-wrap">${pre}</pre>
  </div>`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}
async function safeNotify(to, { subject, html }) {
  try { await sendEmail({ to, subject, html }); } catch (e) { console.warn("notify failed:", e?.message); }
}
