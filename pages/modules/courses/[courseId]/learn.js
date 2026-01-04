import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";
import styles from "../../../../styles/email-crm.module.css";

const baseBlue = "#2297c5";

export default function CourseLearnPage() {
  const router = useRouter();
  const { courseId } = router.query;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState(null);
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [entitlements, setEntitlements] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);

  const hasFullAccess = useMemo(
    () => entitlements.some((e) => e.entitlement_type === "full_course"),
    [entitlements]
  );

  const unlockedModuleIds = useMemo(() => {
    if (hasFullAccess) return new Set(modules.map((m) => m.id));
    const set = new Set();
    entitlements
      .filter((e) => e.entitlement_type === "module" && e.module_id)
      .forEach((e) => set.add(e.module_id));
    return set;
  }, [entitlements, hasFullAccess, modules]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!courseId) return;
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;
      if (!alive) return;
      setUserId(uid);

      const { data: courseData, error: courseErr } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (courseErr) {
        console.error(courseErr);
        setLoading(false);
        return;
      }

      const { data: moduleData, error: modErr } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      if (modErr) console.error(modErr);

      const moduleIds = (moduleData || []).map((m) => m.id);
      let lessonsMap = {};
      if (moduleIds.length) {
        const { data: lessonsData, error: lessonErr } = await supabase
          .from("course_lessons")
          .select("*")
          .in("module_id", moduleIds)
          .order("sort_order", { ascending: true });

        if (lessonErr) console.error(lessonErr);
        lessonsMap = (lessonsData || []).reduce((acc, lesson) => {
          acc[lesson.module_id] = acc[lesson.module_id] || [];
          acc[lesson.module_id].push(lesson);
          return acc;
        }, {});
      }

      let entData = [];
      if (uid) {
        const { data: ent, error: entErr } = await supabase
          .from("course_entitlements")
          .select("*")
          .eq("course_id", courseId)
          .eq("user_id", uid);

        if (entErr) console.error(entErr);
        entData = ent || [];
      }

      if (!alive) return;

      setCourse(courseData);
      setModules(moduleData || []);
      setLessonsByModule(lessonsMap);
      setEntitlements(entData);

      setActiveLesson(findFirstUnlockedLesson(moduleData || [], lessonsMap, entData));
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [courseId]);

  function isModuleUnlocked(moduleId) {
    if (hasFullAccess) return true;
    return unlockedModuleIds.has(moduleId);
  }

  function findFirstUnlockedLesson(mods, lessonsMap, ents) {
    const full = (ents || []).some((e) => e.entitlement_type === "full_course");
    const unlocked = new Set();
    if (!full) {
      (ents || [])
        .filter((e) => e.entitlement_type === "module" && e.module_id)
        .forEach((e) => unlocked.add(e.module_id));
    }

    for (const m of mods) {
      const ok = full || unlocked.has(m.id);
      if (!ok) continue;
      const lessons = lessonsMap[m.id] || [];
      if (lessons.length) return lessons[0];
    }
    return null;
  }

  // ✅ Correct + safe checkout starter
  async function startCheckout({ scope, moduleId }) {
    try {
      setBusy(true);

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        alert("Please log in first.");
        return;
      }

      // ✅ IMPORTANT: API routes are /api/..., NOT /pages/api/...
      const res = await fetch("/api/courses/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId, scope, moduleId }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Checkout failed");
        return;
      }

      if (json?.url) window.location.href = json.url;
      else alert("No checkout URL returned.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ padding: 18 }}>Loading course…</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ padding: 18 }}>Course not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrap}>
      {/* Banner */}
      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "0 auto",
          background: baseBlue,
          color: "#fff",
          borderRadius: 14,
          padding: "18px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
            {course.title || "Course"}
          </div>
          <div style={{ fontSize: 16, opacity: 0.95, marginTop: 6 }}>
            {hasFullAccess
              ? "Access: Full course unlocked"
              : userId
              ? "Access: Module-by-module unlock"
              : "Login required to purchase/unlock"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/pages/store/dashboard"
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            ← Dashboard
          </Link>

          {!hasFullAccess && (
            <button
              onClick={() => startCheckout({ scope: "full_course" })}
              disabled={!userId || busy}
              style={{
                background: "#fff",
                color: baseBlue,
                border: "none",
                padding: "10px 14px",
                borderRadius: 10,
                fontWeight: 800,
                cursor: !userId || busy ? "not-allowed" : "pointer",
                opacity: !userId || busy ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {busy ? "Please wait…" : "Unlock Full Course"}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "14px auto 0",
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 14,
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e7e7e7",
            padding: 12,
            height: "calc(100vh - 210px)",
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
            Modules
          </div>

          {modules.map((m) => {
            const unlocked = isModuleUnlocked(m.id);
            const lessons = lessonsByModule[m.id] || [];

            return (
              <div
                key={m.id}
                style={{
                  border: "1px solid #ededed",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 10,
                  background: unlocked ? "#fff" : "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>
                    {m.title || "Untitled Module"}
                    {!unlocked ? (
                      <span style={{ marginLeft: 8, fontWeight: 800, color: "#f43f5e" }}>
                        🔒 Locked
                      </span>
                    ) : (
                      <span style={{ marginLeft: 8, fontWeight: 800, color: "#16a34a" }}>
                        ✅ Open
                      </span>
                    )}
                  </div>

                  {!unlocked && userId && (
                    <button
                      onClick={() => startCheckout({ scope: "module", moduleId: m.id })}
                      disabled={busy}
                      style={{
                        background: "#facc15",
                        border: "none",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontWeight: 900,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.7 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {busy ? "…" : "Unlock"}
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {lessons.map((l) => {
                    const disabled = !unlocked;
                    const isActive = activeLesson?.id === l.id;

                    return (
                      <button
                        key={l.id}
                        disabled={disabled}
                        onClick={() => setActiveLesson(l)}
                        style={{
                          textAlign: "left",
                          borderRadius: 10,
                          border: "1px solid #efefef",
                          padding: "10px 10px",
                          background: isActive ? "rgba(34,151,197,0.10)" : "#fff",
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.55 : 1,
                          fontWeight: 700,
                        }}
                      >
                        {l.title || "Lesson"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Player */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e7e7e7",
            padding: 14,
            height: "calc(100vh - 210px)",
            overflow: "auto",
          }}
        >
          {!activeLesson ? (
            <div style={{ padding: 14, opacity: 0.8 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                No unlocked lesson selected
              </div>
              <div style={{ marginTop: 8 }}>
                Unlock a module (or the full course), then pick a lesson.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                {activeLesson.title || "Lesson"}
              </div>

              <div style={{ marginTop: 8, opacity: 0.75 }}>
                Type: {activeLesson.content_type || "unknown"}
              </div>

              <div style={{ marginTop: 14 }}>
                {activeLesson.content_type === "video" ? (
                  <video
                    controls
                    style={{ width: "100%", borderRadius: 12, border: "1px solid #eee" }}
                    src={activeLesson.content_url || ""}
                  />
                ) : activeLesson.content_type === "pdf" ? (
                  <iframe
                    title="PDF"
                    src={activeLesson.content_url || ""}
                    style={{
                      width: "100%",
                      height: "75vh",
                      borderRadius: 12,
                      border: "1px solid #eee",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 14,
                      minHeight: 220,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {activeLesson.content_url
                      ? `HTML/Text lesson (next step: render stored HTML safely).\n\nContent URL:\n${activeLesson.content_url}`
                      : "No lesson content yet."}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
