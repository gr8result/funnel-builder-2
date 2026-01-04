// /pages/modules/courses/[courseId]/edit.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ICONS from "../../../../components/iconMap";
import { supabase } from "../../../../utils/supabase-client";

export default function CourseEditor() {
  const router = useRouter();
  const { courseId } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState(null);
  const [vendor, setVendor] = useState(null);

  const [course, setCourse] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!courseId) return;
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;
      if (!alive) return;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: v } = await supabase
        .from("course_vendors")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (!alive) return;
      setVendor(v || null);

      if (!v?.id) {
        setLoading(false);
        return;
      }

      const { data: c, error: cErr } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .eq("vendor_id", v.id)
        .single();

      if (cErr) {
        console.error(cErr);
        setLoading(false);
        return;
      }

      if (!alive) return;

      setCourse(c);
      setTitle(c.title || "");
      setDescription(c.description || "");
      setCoverUrl(c.cover_url || "");
      setPublished(!!c.is_published);

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [courseId]);

  async function saveCourse() {
    if (!course?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("courses")
        .update({
          title,
          description,
          cover_url: coverUrl || null,
          is_published: !!published,
        })
        .eq("id", course.id);

      if (error) {
        console.error(error);
        alert(error.message || "Failed to save course");
        return;
      }

      alert("Saved ✅");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={page.iconWrap}>
              {ICONS.courses({ size: 32, color: "#fff" })}
            </div>
            <div>
              <h1 style={page.title}>Course Editor</h1>
              <p style={page.subtitle}>Edit title, description, cover & publish status.</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/modules/courses/vendor">
              <button style={page.backBtn}>← Vendor Console</button>
            </Link>
            <Link href="/modules/courses">
              <button style={page.backBtn}>← Marketplace</button>
            </Link>
            <Link href="/dashboard">
              <button style={page.backBtn}>← Dashboard</button>
            </Link>
          </div>
        </div>

        <div style={page.panel}>
          {!userId ? (
            <div style={page.empty}>Please log in.</div>
          ) : loading ? (
            <div style={page.empty}>Loading…</div>
          ) : !vendor?.id ? (
            <div style={page.empty}>No vendor profile found for your account.</div>
          ) : !course ? (
            <div style={page.empty}>Course not found (or not yours).</div>
          ) : (
            <>
              <div style={page.formGrid}>
                <div>
                  <div style={page.label}>Course Title</div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} style={page.input} />
                </div>

                <div>
                  <div style={page.label}>Cover Image URL (optional)</div>
                  <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} style={page.input} />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={page.label}>Description</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={page.textarea}
                  />
                </div>

                <label style={page.checkRow}>
                  <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                  <span style={{ fontWeight: 900 }}>
                    Published (shows in Marketplace)
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={saveCourse} disabled={saving} style={page.primaryBtn}>
                  {saving ? "Saving…" : "Save"}
                </button>

                <Link href={`/modules/courses/${courseId}/pricing`}>
                  <button style={page.secondaryBtn}>Pricing →</button>
                </Link>

                <Link href={`/modules/courses/${courseId}/learn`}>
                  <button style={page.secondaryBtn}>Preview Player →</button>
                </Link>
              </div>

              <div style={{ marginTop: 14, opacity: 0.7, fontSize: 12 }}>
                Debug marker: <b>COURSE-EDIT-v2</b>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },

  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#ec4899",
    borderRadius: 12,
    padding: "18px 22px",
    marginBottom: 18,
    fontWeight: 700,
    gap: 14,
  },
  iconWrap: {
    background: "rgba(255,255,255,0.18)",
    borderRadius: "50%",
    padding: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, margin: 0 },
  subtitle: { fontSize: 15, opacity: 0.9, margin: 0, marginTop: 4 },

  backBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  panel: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 14,
  },

  empty: { padding: 14, opacity: 0.9 },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  label: { fontWeight: 900, marginBottom: 6 },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    fontSize: 16,
    outline: "none",
    background: "#0b1220",
    color: "#fff",
  },

  textarea: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    fontSize: 16,
    outline: "none",
    background: "#0b1220",
    color: "#fff",
    minHeight: 140,
    resize: "vertical",
  },

  checkRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 6 },

  primaryBtn: {
    background: "#facc15",
    color: "#000",
    border: "none",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
