// ============================================
// /components/email/editor/TemplatePickerModal.js
// FULL FILE — picks templates from Supabase Storage directly
//
// Public templates:
//   bucket: email-assets
//   root:   templates/**   (find .html; preview .png if exists)
//
// User templates:
//   bucket: email-user-assets
//   root:   <uid>/finished-emails/**   (find .html; preview .png if exists)
//
// NOTE: Supabase list() is not recursive; we do a small depth crawl.
// ============================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../utils/supabase-client";

const isFolder = (x) => !x?.id && !x?.metadata;
const isHtml = (n) => String(n || "").toLowerCase().endsWith(".html");
const isPng = (n) => String(n || "").toLowerCase().endsWith(".png");

async function getUserIdSafe() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

async function listFolder(bucket, prefix) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 500,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  return data || [];
}

// crawl: root + 1 level folders + 2nd level folders (enough for your templates/future etc)
async function crawlHtmlTemplates(bucket, rootPrefix, maxDepth = 2) {
  const results = [];
  const queue = [{ prefix: rootPrefix, depth: 0 }];

  while (queue.length) {
    const { prefix, depth } = queue.shift();
    const items = await listFolder(bucket, prefix);

    const files = items.filter((x) => !isFolder(x));
    const folders = items.filter(isFolder);

    // map for previews in this folder
    const pngSet = new Set(files.filter((f) => isPng(f.name)).map((f) => f.name.toLowerCase()));

    for (const f of files) {
      if (!isHtml(f.name)) continue;
      const base = f.name.replace(/\.html$/i, "");
      const previewName = `${base}.png`.toLowerCase();
      const previewPath = pngSet.has(previewName) ? `${prefix}/${base}.png` : null;

      results.push({
        name: f.name,
        path: `${prefix}/${f.name}`,
        previewPath,
      });
    }

    if (depth < maxDepth) {
      for (const folder of folders) {
        queue.push({ prefix: `${prefix}/${folder.name}`, depth: depth + 1 });
      }
    }
  }

  return results;
}

function publicUrl(bucket, path) {
  if (!path) return null;
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

export default function TemplatePickerModal({ onClose, onPicked, setStatus, config }) {
  const { USER_BUCKET, PUBLIC_BUCKET, PUBLIC_ROOT, USER_ROOT } = config || {};

  const [tab, setTab] = useState("public");
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);

  const [publicItems, setPublicItems] = useState([]);
  const [userItems, setUserItems] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);

        const userId = await getUserIdSafe();
        if (!alive) return;
        setUid(userId);

        // Public
        const pub = await crawlHtmlTemplates(PUBLIC_BUCKET, PUBLIC_ROOT, 2);
        if (!alive) return;
        setPublicItems(pub);

        // User (only if logged in)
        if (userId) {
          const userPrefix = `${userId}/${USER_ROOT}`;
          const usr = await crawlHtmlTemplates(USER_BUCKET, userPrefix, 2);
          if (!alive) return;
          setUserItems(usr);
        } else {
          setUserItems([]);
        }

        setStatus?.(`Templates loaded ✅ public:${pub.length} user:${userId ? "…" : 0}`);
      } catch (e) {
        setStatus?.(`Templates load failed ❌ ${e?.message || "unknown"}`);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [PUBLIC_BUCKET, PUBLIC_ROOT, USER_BUCKET, USER_ROOT, setStatus]);

  const items = tab === "public" ? publicItems : userItems;

  const cards = useMemo(() => {
    const bucket = tab === "public" ? PUBLIC_BUCKET : USER_BUCKET;

    return items.map((it) => {
      const previewUrl = it.previewPath ? publicUrl(bucket, it.previewPath) : null;
      return { ...it, previewUrl };
    });
  }, [items, tab, PUBLIC_BUCKET, USER_BUCKET]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 9999,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "min(1400px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "#0b1120",
          border: "1px solid rgba(148,163,184,0.18)",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#e5e7eb" }}>Import Template</div>
          <button type="button" onClick={onClose} style={chipBtn("#111827")}>Close</button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setTab("public")} style={tabBtn(tab === "public")}>Public</button>
          <button type="button" onClick={() => setTab("user")} style={tabBtn(tab === "user")} disabled={!uid}>
            User
          </button>
          {!uid && <div style={{ color: "#9ca3af", fontSize: 13 }}>Log in to see user templates.</div>}
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div style={{ color: "#9ca3af" }}>Loading…</div>
          ) : cards.length === 0 ? (
            <div style={{ color: "#9ca3af" }}>No templates found.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
              {cards.map((it) => (
                <button
                  key={it.path}
                  type="button"
                  onClick={() =>
                    onPicked({
                      scope: tab === "public" ? "public" : "user",
                      path: it.path,
                      name: it.name,
                    })
                  }
                  style={{
                    background: "#111827",
                    border: "1px solid rgba(148,163,184,0.18)",
                    borderRadius: 14,
                    padding: 10,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  title="Click to import"
                >
                  <div style={{ fontWeight: 900, color: "#e5e7eb", marginBottom: 8, fontSize: 14 }}>
                    {it.name}
                  </div>

                  {it.previewUrl ? (
                    <img
                      src={it.previewUrl}
                      alt={it.name}
                      style={{
                        width: "100%",
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 10,
                        display: "block",
                        background: "#0b1220",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 140,
                        borderRadius: 10,
                        background: "#0b1220",
                        display: "grid",
                        placeItems: "center",
                        color: "#9ca3af",
                        fontWeight: 900,
                      }}
                    >
                      No preview
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af", wordBreak: "break-all" }}>
                    {tab === "public" ? `email-assets/${PUBLIC_ROOT}` : `${USER_BUCKET}/<uid>/${USER_ROOT}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* UI helpers */
function chipBtn(bg) {
  return {
    background: bg,
    color: "#f9fafb",
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.35)",
    whiteSpace: "nowrap",
  };
}

function tabBtn(active) {
  return {
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    background: active ? "linear-gradient(135deg,#22c55e,#3b82f6,#a855f7)" : "#111827",
    color: active ? "#0b1220" : "#f9fafb",
    opacity: 1,
  };
}
