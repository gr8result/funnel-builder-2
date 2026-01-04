// lib/emailDB.js
import { supabaseAdmin } from "./supabaseAdmin";

/** Upsert a subscriber under user_id */
export async function upsertSubscriber({ user_id, email, name }) {
  const lower = String(email || "").toLowerCase().trim();
  if (!lower) throw new Error("email required");

  const { data: found } = await supabaseAdmin
    .from("subscribers")
    .select("id")
    .eq("user_id", user_id)
    .ilike("email", lower)
    .maybeSingle();

  if (found?.id) {
    const { error } = await supabaseAdmin
      .from("subscribers")
      .update({ name: name || null, email })
      .eq("id", found.id);
    if (error) throw error;
    return found.id;
  }

  const ins = await supabaseAdmin
    .from("subscribers")
    .insert({ user_id, email, name: name || null })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  return ins.data.id;
}

/** Ensure a list exists by id (or throw) */
export async function assertList({ list_id }) {
  const { data, error } = await supabaseAdmin
    .from("email_lists")
    .select("id,user_id")
    .eq("id", list_id)
    .maybeSingle();
  if (error || !data) throw new Error("List not found");
  return data;
}

/** Add subscriber to list (idempotent) */
export async function addToList({ list_id, subscriber_id }) {
  const { data: exists } = await supabaseAdmin
    .from("list_subscribers")
    .select("id")
    .eq("list_id", list_id)
    .eq("subscriber_id", subscriber_id)
    .maybeSingle();
  if (exists?.id) return exists.id;
  const ins = await supabaseAdmin
    .from("list_subscribers")
    .insert({ list_id, subscriber_id })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  return ins.data.id;
}

/** Get or create tag ids by names under user */
export async function getOrCreateTags({ user_id, tagNames = [] }) {
  const names = (tagNames || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (names.length === 0) return [];

  // fetch existing
  const { data: existing } = await supabaseAdmin
    .from("tags")
    .select("id,name")
    .eq("user_id", user_id);

  const toInsert = [];
  const ids = [];
  for (const name of names) {
    const found = (existing || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (found) ids.push(found.id);
    else toInsert.push(name);
  }

  if (toInsert.length) {
    const ins = await supabaseAdmin
      .from("tags")
      .insert(toInsert.map((name) => ({ user_id, name })))
      .select("id");
    if (ins.error) throw ins.error;
    ids.push(...ins.data.map((r) => r.id));
  }
  return ids;
}

/** Attach tags to a subscriber (idempotent) */
export async function tagSubscriber({ subscriber_id, tag_ids = [] }) {
  if (!tag_ids.length) return;
  // fetch current
  const { data: current } = await supabaseAdmin
    .from("subscriber_tags")
    .select("tag_id")
    .eq("subscriber_id", subscriber_id);

  const currentIds = new Set((current || []).map((x) => x.tag_id));
  const newOnes = tag_ids.filter((id) => !currentIds.has(id));
  if (!newOnes.length) return;

  const ins = await supabaseAdmin
    .from("subscriber_tags")
    .insert(newOnes.map((tag_id) => ({ subscriber_id, tag_id })));
  if (ins.error) throw ins.error;
}

/** Resolve a segment to subscriber rows (by lists + tags) */
export async function resolveSegment({ user_id, list_ids = [], tag_any = [], tag_all = [] }) {
  // base set: all of owner's subscribers
  let query = supabaseAdmin
    .from("subscribers")
    .select("id,email", { count: "exact" })
    .eq("user_id", user_id);

  // Filter by lists (ANY)
  if (list_ids && list_ids.length) {
    query = supabaseAdmin
      .rpc("exec_raw", {
        query: `
        select s.id, s.email
        from subscribers s
        join list_subscribers ls on ls.subscriber_id = s.id
        where s.user_id = $1
          and ls.list_id = any($2::uuid[])
        group by s.id, s.email;
      `,
        params: [user_id, list_ids],
      });
  }

  const { data: base, error } = await query;
  if (error) throw error;
  let set = new Map((base || []).map((r) => [r.id, r.email]));

  // tag_any (OR)
  if (tag_any && tag_any.length) {
    const { data } = await supabaseAdmin
      .rpc("exec_raw", {
        query: `
        select distinct s.id, s.email
        from subscribers s
        join subscriber_tags st on st.subscriber_id = s.id
        where s.user_id = $1 and st.tag_id = any($2::uuid[]);
      `,
        params: [user_id, tag_any],
      });
    const anySet = new Map((data || []).map((r) => [r.id, r.email]));
    // intersect with base if base came from lists; else use anySet
    set = set.size ? new Map([...set].filter(([id]) => anySet.has(id))) : anySet;
  }

  // tag_all (AND)
  if (tag_all && tag_all.length) {
    const { data } = await supabaseAdmin
      .rpc("exec_raw", {
        query: `
        select s.id, s.email
        from subscribers s
        where s.user_id = $1
          and not exists (
            select 1 from unnest($2::uuid[]) t(tag_id)
            where not exists (
              select 1 from subscriber_tags st where st.subscriber_id = s.id and st.tag_id = t.tag_id
            )
          );
      `,
        params: [user_id, tag_all],
      });
    const allSet = new Map((data || []).map((r) => [r.id, r.email]));
    set = set.size ? new Map([...set].filter(([id]) => allSet.has(id))) : allSet;
  }

  return [...set.entries()].map(([id, email]) => ({ id, email }));
}
