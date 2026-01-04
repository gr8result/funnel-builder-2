// /pages/api/email/templates/list.js
// Lists templates from Supabase Storage:
// - Public:  bucket "email-assets"      folder "templates" (recursive-ish: we scan one level deep)
// - User:    bucket "email-user-assets" folder "<userId>/finished-emails"  (your screenshot)
//
// Returns: { ok:true, public:[...], user:[...] }
// Each item: { id, scope, name, htmlPath, previewPath, previewUrl }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PUBLIC_BUCKET = "email-assets";
const PUBLIC_ROOT = "templates";

const USER_BUCKET = "email-user-assets";
const USER_ROOT = "finished-emails"; // path is: <userId>/finished-emails

function sb() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env vars");
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function isHtml(name = "") {
  return String(name).toLowerCase().endsWith(".html");
}
function isPng(name = "") {
  return String(name).toLowerCase().endsWith(".png");
}
function baseName(filename = "") {
  return String(filename).replace(/\.(html|png)$/i, "");
}

async function listFolder(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).list(path, {
    limit: 200,
    offset: 0,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw error;
  return data || [];
}

function publicUrl(client, bucket, fullPath) {
  const { data } = client.storage.from(bucket).getPublicUrl(fullPath);
  return data?.publicUrl || null;
}

// PUBLIC templates can have subfolders. We do:
// - list templates/
// - for each folder inside templates/, list templates/<folder>/
async function listPublicTemplates(client) {
  const top = await listFolder(client, PUBLIC_BUCKET, PUBLIC_ROOT);

  const folders = top.filter((x) => x && !x.id && x.name); // Supabase list returns folders with id=null sometimes
  const filesTop = top.filter((x) => x && x.name && (isHtml(x.name) || isPng(x.name)));

  const allFiles = [...filesTop];

  // one-level deep folders
  for (const f of folders) {
    const folderPath = `${PUBLIC_ROOT}/${f.name}`;
    try {
      const inner = await listFolder(client, PUBLIC_BUCKET, folderPath);
      inner
        .filter((x) => x && x.name && (isHtml(x.name) || isPng(x.name)))
        .forEach((x) => allFiles.push({ ...x, __folder: f.name }));
    } catch {
      // ignore
    }
  }

  // group html + png by basename (within folder)
  const map = new Map();
  for (const f of allFiles) {
    const folder = f.__folder ? `${PUBLIC_ROOT}/${f.__folder}` : PUBLIC_ROOT;
    const fullPath = `${folder}/${f.name}`;
    const key = `${folder}/${baseName(f.name)}`;

    const cur = map.get(key) || { folder, base: baseName(f.name), htmlPath: null, previewPath: null };
    if (isHtml(f.name)) cur.htmlPath = fullPath;
    if (isPng(f.name)) cur.previewPath = fullPath;
    map.set(key, cur);
  }

  const out = [];
  for (const [, v] of map.entries()) {
    if (!v.htmlPath) continue;
    const name = v.base;
    const previewUrl = v.previewPath ? publicUrl(client, PUBLIC_BUCKET, v.previewPath) : null;

    out.push({
      id: `public:${v.htmlPath}`,
      scope: "public",
      name,
      htmlPath: v.htmlPath,
      previewPath: v.previewPath,
      previewUrl,
    });
  }

  // newest first (best effort)
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function listUserTemplates(client, userId) {
  const folder = `${userId}/${USER_ROOT}`;
  const files = await listFolder(client, USER_BUCKET, folder);

  const relevant = files.filter((x) => x?.name && (isHtml(x.name) || isPng(x.name)));

  const map = new Map();
  for (const f of relevant) {
    const fullPath = `${folder}/${f.name}`;
    const key = `${folder}/${baseName(f.name)}`;
    const cur = map.get(key) || { base: baseName(f.name), htmlPath: null, previewPath: null };
    if (isHtml(f.name)) cur.htmlPath = fullPath;
    if (isPng(f.name)) cur.previewPath = fullPath;
    map.set(key, cur);
  }

  const out = [];
  for (const [, v] of map.entries()) {
    if (!v.htmlPath) continue;
    const name = v.base;
    const previewUrl = v.previewPath ? publicUrl(client, USER_BUCKET, v.previewPath) : null;

    out.push({
      id: `user:${v.htmlPath}`,
      scope: "user",
      name,
      htmlPath: v.htmlPath,
      previewPath: v.previewPath,
      previewUrl,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export default async function handler(req, res) {
  try {
    const client = sb();

    // IMPORTANT: we require userId for user templates, but public can be listed without it.
    const userId = req.query?.userId ? String(req.query.userId) : null;

    const publicTemplates = await listPublicTemplates(client);
    const userTemplates = userId ? await listUserTemplates(client, userId) : [];

    return res.status(200).json({
      ok: true,
      public: publicTemplates,
      user: userTemplates,
      buckets: {
        public: { bucket: PUBLIC_BUCKET, root: PUBLIC_ROOT },
        user: { bucket: USER_BUCKET, root: USER_ROOT },
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "list failed" });
  }
}
