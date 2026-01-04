// /pages/modules/courses/vendor/index.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ICONS from "../../../../components/iconMap";
import { supabase } from "../../../../utils/supabase-client";

export default function VendorCoursesHome() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;
      if (!alive) return;

      setUserId(uid);

      if (!uid) {
        setVendor(null);
        setCourses([]);
        setLoading(false);
        return;
      }

      const { data: v, error: vErr } = await supabase
        .from("course_vendors")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (vErr) console.error(vErr);
      if (!alive) return;

      if (!v?.id) {
        setVendor(null);
        setCourses([]);
        setLoading(false);
        return;
      }

      setVendor(v);

      const { data: cs, error: cErr } = await supabase
        .from("courses")
        .select("id,title,description,is_published,created_at")
        .eq("vendor_id", v.id)
        .order("created_at", { ascending: false });

      if (cErr) console.error(cErr);
      if (!alive) return;

      setCourses(cs || []);
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  async function createCourse() {
    if (!vendor?.id) return alert("No vendor profile found.");
    setBusy(true);
    try {
      const { data: created, error } = await supabase
        .from("courses")
        .insert({
          vendor_id: vendor.id,
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

      // ✅ Correct path in YOUR tree:
      // /pages/modules/courses/[courseId]/edit.js
      router.push(`/modules/courses/${created.id}/edit`);
    } finally {
      setBusy(false);
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
              <h1 style={page.title}>Vendor Console</h1>
              <p style={page.subtitle}>Create and manage your courses.</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/modules/courses">
              <button style={page.backBtn}>← Marketplace</button>
            </Link>
            <Link href="/dashboard">
              <button style={page.backBtn}>← Dashboard</button>
            </Link>
          </div>
        </div>

        {/* Body */}
        <div style={page.panel}>
          {!userId ? (
            <div style={page.empty}>
              Please log in to access vendor tools.
            </div>
          ) : loading ? (
            <div style={page.empty}>Loading…</div>
          ) : !vendor?.id ? (
            <div style={page.empty}>
              No vendor profile found for your account.
              <div style={{ marginTop: 10, opacity: 0.8 }}>
                If you want, I’ll give you a simple “Become a Vendor” button/page next.
              </div>
            </div>
          ) : (
            <>
              <div style={page.row}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Your Courses</div>

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

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {courses.length === 0 ? (
                  <div style={page.empty}>
                    You haven’t created any courses yet.
                    <div style={{ marginTop: 8, opacity: 0.8 }}>
                      Click “Create Course” to begin.
                    </div>
                  </div>
                ) : (
                  courses.map((c) => (
                    <div key={c.id} style={page.courseCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {c.title || "Untitled Course"}{" "}
                            <span style={{ opacity: 0.7, fontWeight: 800 }}>
                              {c.is_published ? "• Published" : "• Draft"}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
                            {c.description ? c.description.slice(0, 140) : "No description yet."}
                            {c.description && c.description.length > 140 ? "…" : ""}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <Link href={`/modules/courses/${c.id}/edit`}>
                            <button style={page.secondaryBtn}>Edit →</button>
                          </Link>
                          <Link href={`/modules/courses/${c.id}/pricing`}>
                            <button style={page.secondaryBtn}>Pricing →</button>
                          </Link>
                          <Link href={`/modules/courses/${c.id}/learn`}>
                            <button style={page.secondaryBtn}>Preview →</button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: 14, opacity: 0.7, fontSize: 12 }}>
                Debug marker: <b>VENDOR-CONSOLE-v2</b>
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
    fontSize: 14,
    fontWeight: 900,
  },
  secondaryBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  courseCard: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 12,
  },

  empty: { padding: 14, opacity: 0.9 },
};
