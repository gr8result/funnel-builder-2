// pages/api/email/subscribe.js
// Public endpoint to add a person to lists and tags.
// Body: { list_id?, email, name?, tags?: string[] | "a,b,c" }
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
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
    const { list_id = null, email = "", name = "", tags = [] } = body;
    if (!email) return res.status(400).send("Email is required");

    let user_id = null;
    if (list_id) {
      const l = await assertList({ list_id });
      user_id = l.user_id;
    } else {
      return res.status(400).send("list_id required for routing");
    }

    const subscriber_id = await upsertSubscriber({ user_id, email, name });
    if (list_id) await addToList({ list_id, subscriber_id });

    const tagArray = toTagArray(tags);
    if (tagArray.length) {
      const tagIds = await getOrCreateTags({ user_id, tagNames: tagArray });
      await tagSubscriber({ subscriber_id, tag_ids: tagIds });
    }

    return res.status(200).json({ ok: true, subscriber_id });
  } catch (e) {
    console.error("[email/subscribe] error:", e);
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
  return String(tags).split(",").map((t) => t.trim()).filter(Boolean);
}
