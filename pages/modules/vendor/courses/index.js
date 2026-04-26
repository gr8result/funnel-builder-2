// (Removed duplicate export default and function definition at the top)
// /pages/modules/courses/vendor/index.js
// FULL REPLACEMENT
//
// ✅ Banner matches platform: icon 48px, title 48px weight 600, subtitle 18px
// ✅ Adds course cover preview images (uses courses.cover_url)
// ✅ Changes list from rows → grid cards for easy visual ID
// ✅ Removes debug marker

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ICONS from "../../../../components/iconMap";
import { supabase } from "../../../../utils/supabase-client";
import VendorUserBanner from "../../../../components/vendor/VendorUserBanner";

export default function VendorCoursesHome() {
    async function deleteCourse(courseId) {
      if (!window.confirm("Are you sure you want to delete this course? This cannot be undone.")) return;
      setDeletingId(courseId);
      try {
        const { error } = await supabase
          .from("courses")
          .delete()
          .eq("id", courseId);
        if (error) {
          console.error(error);
          alert(error.message || "Failed to delete course");
          return;
        }
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
      } finally {
        setDeletingId(null);
      }
    }
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [courses, setCourses] = useState([]);
  // Track busy state per course for delete
  const [deletingId, setDeletingId] = useState(null);

  async function ensureCourseVendorProfile(uid) {
    if (!uid) return null;

    const existing = await supabase
      .from("course_vendors")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (existing.error) {
      console.error(existing.error);
      return null;
    }

    if (existing.data?.id) {
      return existing.data;
    }

    const inserted = await supabase
      .from("course_vendors")
      .insert({ user_id: uid })
      .select("*")
      .single();

    if (inserted.error) {
      // If another request created it first, retry lookup once.
      const retry = await supabase
        .from("course_vendors")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (retry.error) {
        console.error(retry.error);
        return null;
      }

      return retry.data || null;
    }

    return inserted.data || null;
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      let uid = auth?.user?.id || null;
      let resolvedCourseVendor = null;
      if (!alive) return;

      if (!uid && typeof window !== "undefined") {
        const marketplaceCode = localStorage.getItem("xchange_user_code");
        if (marketplaceCode) {
          try {
            const accessResp = await fetch(
              `/api/marketplace/vendor-access?code=${encodeURIComponent(marketplaceCode)}`
            );
            const accessPayload = await accessResp.json();

            if (accessResp.ok && accessPayload?.allowed && accessPayload?.userId) {
              uid = accessPayload.userId;
            }

            const resp = await fetch(
              `/api/marketplace/course-vendor-context?code=${encodeURIComponent(marketplaceCode)}`
            );
            const payload = await resp.json();

            if (resp.ok && payload?.courseVendor?.id) {
              uid = payload.userId || uid || null;
              resolvedCourseVendor = payload.courseVendor;
            }
          } catch (error) {
            console.error("Marketplace course vendor fallback failed:", error);
          }
        }
      }

      setUserId(uid);

      if (!uid) {
        setVendor(null);
        setCourses([]);
        setLoading(false);
        return;
      }

      let v = resolvedCourseVendor;
      let vErr = null;

      if (!v?.id) {
        const ensuredVendor = await ensureCourseVendorProfile(uid);
        v = ensuredVendor;
        vErr = null;
      }

      if (vErr) console.error(vErr);
      if (!alive) return;

      if (!v?.id) {
        setVendor(null);
        setCourses([]);
        setLoading(false);
        return;
      }

      setVendor(v);

      // Fetch courses
      const { data: cs, error: cErr } = await supabase
        .from("courses")
        .select("*")
        .eq("vendor_id", v.id)
        .order("created_at", { ascending: false });

      if (cErr) console.error(cErr);
      if (!alive) return;

      // Fetch affiliate_products for this vendor
      const { data: aps, error: apErr } = await supabase
        .from("affiliate_products")
        .select("id,sale_price,sales_page_url,title")
        .eq("owner_user_id", uid);
      if (apErr) console.error(apErr);

      // Merge affiliate_products data into courses
      const mergedCourses = (cs || []).map(course => {
        // Try to match affiliate_product by title (or add a better matching logic if needed)
        const ap = (aps || []).find(ap => ap.title === course.title);
        return {
          ...course,
          price: ap?.sale_price ?? course.price ?? 0,
          payment_type: course.payment_type ?? 'one_time',
          info_url: course.info_url ?? '',
          sales_page_url: ap?.sales_page_url ?? course.sales_page_url ?? '',
        };
      });

      setCourses(mergedCourses);
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  async function createCourse() {
    let vendorId = vendor?.id || null;

    if (!vendorId) {
      const ensuredVendor = await ensureCourseVendorProfile(userId);
      if (ensuredVendor?.id) {
        vendorId = ensuredVendor.id;
        setVendor(ensuredVendor);
      }
    }

    if (!vendorId && typeof window !== "undefined") {
      const marketplaceCode = localStorage.getItem("xchange_user_code");
      if (marketplaceCode) {
        const resp = await fetch(
          `/api/marketplace/course-vendor-context?code=${encodeURIComponent(marketplaceCode)}`
        );
        const payload = await resp.json();

        if (resp.ok && payload?.courseVendor?.id) {
          vendorId = payload.courseVendor.id;
          setVendor(payload.courseVendor);
          if (payload.userId) setUserId(payload.userId);
        }
      }
    }

    if (!vendorId) return alert("No vendor profile found.");
    setBusy(true);
    try {
      const { data: created, error } = await supabase
        .from("courses")
        .insert({
          vendor_id: vendorId,
          title: "New Course",
          description: "",
          is_published: false,
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert(error.message || "Failed to create course");
        return;
      }

      if (!created?.id) {
        alert("Course created but missing ID. Please refresh.");
        return;
      }

      router.push(`/modules/courses/${created.id}/edit`);
    } finally {
      setBusy(false);
    }
  }

  const [descDrafts, setDescDrafts] = useState({});
  const [expandedModule, setExpandedModule] = useState(null);

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={page.iconWrap}>{ICONS.courses({ size: 48, color: "#fff" })}</div>
            <div>
              <h1 style={page.title}>Online Courses - Vendor Console</h1>
              <p style={page.subtitle}>Create and manage your courses.</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>

            <Link href="/modules/vendor">
              <button style={page.backBtn}>← Back</button>
            </Link>
          </div>
        </div>

        <VendorUserBanner />

        {/* Body */}
        <div style={page.panel}>
          {!userId ? (
            <div style={page.empty}>Please log in to access vendor tools.</div>
          ) : loading ? (
            <div style={page.empty}>Loading…</div>
          ) : !vendor?.id ? (
            <div style={page.empty}>
              No course vendor profile found for your account yet.
              <div style={{ marginTop: 10, opacity: 0.8 }}>
                Click below and the system will create your course workspace automatically.
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={createCourse}
                  disabled={busy}
                  style={{
                    ...page.primaryBtn,
                    opacity: busy ? 0.7 : 1,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Creating…" : "＋ Create First Course"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={page.row}>
                <div style={{ fontWeight: 600, fontSize: 20 }}>Your Courses</div>

                <button
                  onClick={createCourse}
                  disabled={busy}
                  style={{
                    ...page.primaryBtn,
                    opacity: busy ? 0.7 : 1,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Creating…" : "＋ Create Course"}
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={page.empty}>
                  Existing courses are hidden on this page.
                  <div style={{ marginTop: 8, opacity: 0.8 }}>
                    Click “Create Course” to build a new online course.
                  </div>
                </div>
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

  // ✅ Banner updated to match platform
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#ec4899",
    borderRadius: 12,
    padding: "18px 22px",
    marginBottom: 18,
    fontWeight: 600,
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
  title: { fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.05 },
  subtitle: { fontSize: 18, opacity: 0.9, margin: 0, marginTop: 6 },

  backBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  panel: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 14,
  },

  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  primaryBtn: {
    background: "#facc15",
    color: "#000",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 16,
    fontWeight: 600,
  },
  secondaryBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  // ✅ Grid layout with image previews
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 10,
  },

  courseCard: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 14,
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "220px 1fr",
  },

  cover: {
    width: "100%",
    height: 220,
    position: "relative",
  },

  noCoverText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    opacity: 0.85,
  },

  cardBody: { padding: 12 },

  cardTitle: { fontSize: 20, fontWeight: 600, marginBottom: 6 },

  statusText: { opacity: 0.7, fontWeight: 600 },

  cardDesc: { marginTop: 6, opacity: 0.85, fontSize: 16, lineHeight: 1.35, minHeight: 44 },

  cardActions: { display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" },

  empty: { padding: 14, opacity: 0.9 },
};

function ModuleManager({ courseId }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [editModuleId, setEditModuleId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', description: '' });

  useEffect(() => {
    async function loadModules() {
      setLoading(true);
      const { data } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true });
      setModules(data || []);
      setLoading(false);
    }
    loadModules();
  }, [courseId]);

  async function addModule() {
    if (!newModule.title.trim()) return;
    await supabase.from('course_modules').insert({ ...newModule, course_id: courseId, sort_order: modules.length + 1 });
    setNewModule({ title: '', description: '' });
    const { data } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true });
    setModules(data || []);
  }

  async function saveEditModule(id) {
    await supabase.from('course_modules').update(editDraft).eq('id', id);
    setEditModuleId(null);
    setEditDraft({ title: '', description: '' });
    const { data } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('sort_order', { ascending: true });
    setModules(data || []);
  }

  return (
    <div style={{ background: '#222', borderRadius: 8, padding: 10, marginTop: 8 }}>
      {loading ? 'Loading modules…' : (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong>Modules:</strong>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {modules.map(m => (
                <li key={m.id} style={{ marginBottom: 6 }}>
                  {editModuleId === m.id ? (
                    <div>
                      <input
                        type="text"
                        value={editDraft.title}
                        placeholder="Module title"
                        style={{ marginRight: 6, padding: 6, borderRadius: 6, border: '1px solid #334155', color: '#000', background: '#fff' }}
                        onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                      />
                      <input
                        type="text"
                        value={editDraft.description}
                        placeholder="Module description"
                        style={{ marginRight: 6, padding: 6, borderRadius: 6, border: '1px solid #334155', color: '#000', background: '#fff' }}
                        onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                      />
                      <button style={{ ...page.secondaryBtn, fontSize: 14 }} onClick={() => saveEditModule(m.id)}>Save</button>
                      <button style={{ ...page.secondaryBtn, fontSize: 14, marginLeft: 6 }} onClick={() => setEditModuleId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontWeight: 600 }}>{m.title}</span>: {m.description || ''}
                      <button style={{ ...page.secondaryBtn, fontSize: 14, marginLeft: 6 }} onClick={() => {
                        setEditModuleId(m.id);
                        setEditDraft({ title: m.title, description: m.description });
                      }}>Edit</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder="Module title"
              value={newModule.title}
              style={{ marginRight: 6, padding: 6, borderRadius: 6, border: '1px solid #334155', color: '#000', background: '#fff' }}
              onChange={e => setNewModule(n => ({ ...n, title: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Module description"
              value={newModule.description}
              style={{ marginRight: 6, padding: 6, borderRadius: 6, border: '1px solid #334155', color: '#000', background: '#fff' }}
              onChange={e => setNewModule(n => ({ ...n, description: e.target.value }))}
            />
            <button style={{ ...page.secondaryBtn, fontSize: 14 }} onClick={addModule}>Add Module</button>
          </div>
        </>
      )}
    </div>
  );
}
