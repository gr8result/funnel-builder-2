// /pages/modules/courses/vendor/[courseId]/pricing.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";
import styles from "../../../../styles/email-crm.module.css";

const baseBlue = "#2297c5";

const money = (cents = 0, currency = "AUD") => {
  const v = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(v);
  } catch {
    return `${currency || "AUD"} ${v.toFixed(2)}`;
  }
};

export default function CoursePricingPage() {
  const router = useRouter();
  const { courseId } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState(null);
  const [vendorId, setVendorId] = useState(null);

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [pricingRows, setPricingRows] = useState([]);

  // Full course pricing form
  const [fullPriceDollars, setFullPriceDollars] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [fullActive, setFullActive] = useState(true);

  const pricingByModule = useMemo(() => {
    const map = {};
    (pricingRows || []).forEach((p) => {
      if (p.scope === "module" && p.module_id) map[p.module_id] = p;
      if (p.scope === "full_course") {
        // keep currency aligned with full course price if present
      }
    });
    return map;
  }, [pricingRows]);

  const fullRow = useMemo(
    () => (pricingRows || []).find((p) => p.scope === "full_course") || null,
    [pricingRows]
  );

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

      // vendor
      const { data: v, error: vErr } = await supabase
        .from("course_vendors")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (vErr) console.error(vErr);
      if (!v?.id) {
        setLoading(false);
        return;
      }
      setVendorId(v.id);

      // course (must belong to vendor)
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
      setCourse(c);

      // modules
      const { data: mod, error: mErr } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      if (mErr) console.error(mErr);
      setModules(mod || []);

      // pricing
      const { data: pr, error: pErr } = await supabase
        .from("course_pricing")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });

      if (pErr) console.error(pErr);
      setPricingRows(pr || []);

      // hydrate full form from existing row
      const full = (pr || []).find((x) => x.scope === "full_course");
      if (full) {
        setCurrency(full.currency || "AUD");
        setFullActive(!!full.is_active);
        setFullPriceDollars(((full.price_cents || 0) / 100).toFixed(2));
      } else {
        setCurrency("AUD");
        setFullActive(true);
        setFullPriceDollars("");
      }

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const canSaveFull = useMemo(() => {
    if (!userId || !vendorId || !courseId) return false;
    if (!fullPriceDollars.trim()) return true; // allow clearing price
    const n = Number(fullPriceDollars);
    return Number.isFinite(n) && n >= 0;
  }, [userId, vendorId, courseId, fullPriceDollars]);

  async function saveFullCoursePrice() {
    if (!canSaveFull) return;

    setSaving(true);
    try {
      const dollars = fullPriceDollars.trim() ? Number(fullPriceDollars) : null;
      const cents = dollars === null ? 0 : Math.round(dollars * 100);

      if (!fullRow) {
        // create row (only if user entered a price)
        if (dollars === null) return;

        const { data: created, error } = await supabase
          .from("course_pricing")
          .insert({
            course_id: courseId,
            scope: "full_course",
            module_id: null,
            price_cents: cents,
            currency,
            is_active: fullActive,
          })
          .select("*")
          .single();

        if (error) {
          console.error(error);
          alert(error.message || "Failed to save full course price");
          return;
        }

        setPricingRows((prev) => [...prev, created]);
      } else {
        // update
        const { data: updated, error } = await supabase
          .from("course_pricing")
          .update({
            price_cents: cents,
            currency,
            is_active: fullActive,
          })
          .eq("id", fullRow.id)
          .select("*")
          .single();

        if (error) {
          console.error(error);
          alert(error.message || "Failed to update full course price");
          return;
        }

        setPricingRows((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveModulePrice(moduleId, dollarsStr, active) {
    if (!userId || !vendorId || !courseId || !moduleId) return;

    const dollars = dollarsStr.trim() ? Number(dollarsStr) : null;
    if (dollarsStr.trim() && (!Number.isFinite(dollars) || dollars < 0)) {
      alert("Module price must be a valid number (0 or more).");
      return;
    }

    const cents = dollars === null ? 0 : Math.round(dollars * 100);
    const existing = pricingByModule[moduleId];

    setSaving(true);
    try {
      if (!existing) {
        if (dollars === null) return; // no price entered
        const { data: created, error } = await supabase
          .from("course_pricing")
          .insert({
            course_id: courseId,
            scope: "module",
            module_id: moduleId,
            price_cents: cents,
            currency,
            is_active: !!active,
          })
          .select("*")
          .single();

        if (error) {
          console.error(error);
          alert(error.message || "Failed to save module price");
          return;
        }

        setPricingRows((prev) => [...prev, created]);
      } else {
        const { data: updated, error } = await supabase
          .from("course_pricing")
          .update({
            price_cents: cents,
            currency,
            is_active: !!active,
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) {
          console.error(error);
          alert(error.message || "Failed to update module price");
          return;
        }

        setPricingRows((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ padding: 18 }}>Loading pricing…</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ padding: 18 }}>Please log in to manage pricing.</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={styles.pageWrap}>
        <div style={{ padding: 18 }}>Course not found (or not yours).</div>
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
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>
            Course Pricing
          </div>
          <div style={{ fontSize: 16, opacity: 0.95, marginTop: 6 }}>
            {course.title || "Untitled Course"} • Set full-course and module prices
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/pages/modules/courses/vendor/${courseId}/edit`}
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            ← Back to Editor
          </Link>

          <Link
            href={`/pages/modules/courses/${courseId}/learn`}
            style={{
              background: "#fff",
              color: baseBlue,
              padding: "10px 14px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            Preview Player →
          </Link>
        </div>
      </div>

      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "14px auto 0",
          display: "grid",
          gridTemplateColumns: "520px 1fr",
          gap: 14,
        }}
      >
        {/* Full course price */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e7e7e7",
            padding: 14,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
            Full Course Price
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Currency</div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 10,
                  border: "1px solid #e6e6e6",
                  fontSize: 16,
                  outline: "none",
                }}
              >
                <option value="AUD">AUD</option>
                <option value="USD">USD</option>
                <option value="NZD">NZD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Price (dollars)</div>
              <input
                value={fullPriceDollars}
                onChange={(e) => setFullPriceDollars(e.target.value)}
                placeholder="e.g. 199.00"
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 10,
                  border: "1px solid #e6e6e6",
                  fontSize: 16,
                  outline: "none",
                }}
              />
              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                Stored as cents. Current:{" "}
                <b>{fullPriceDollars.trim() ? money(Math.round(Number(fullPriceDollars) * 100), currency) : "—"}</b>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={fullActive}
                onChange={(e) => setFullActive(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontWeight: 900 }}>Active (available for purchase)</span>
            </label>

            <button
              onClick={saveFullCoursePrice}
              disabled={!canSaveFull || saving}
              style={{
                width: "100%",
                background: "#facc15",
                border: "none",
                padding: "12px 12px",
                borderRadius: 10,
                fontWeight: 900,
                cursor: !canSaveFull || saving ? "not-allowed" : "pointer",
                opacity: !canSaveFull || saving ? 0.65 : 1,
              }}
            >
              {saving ? "Saving…" : fullRow ? "Update Full Course Price" : "Save Full Course Price"}
            </button>

            {fullRow && (
              <div style={{ padding: 10, borderRadius: 12, border: "1px solid #eee", opacity: 0.9 }}>
                <div style={{ fontWeight: 900 }}>Current Full Course Price</div>
                <div style={{ marginTop: 6 }}>
                  {money(fullRow.price_cents, fullRow.currency)}{" "}
                  <span style={{ opacity: 0.75 }}>• {fullRow.is_active ? "Active" : "Inactive"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Module prices */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e7e7e7",
            padding: 14,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
            Module Prices
          </div>

          {modules.length === 0 ? (
            <div style={{ padding: 10, opacity: 0.75 }}>
              No modules found yet. Add modules in the course editor first.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {modules.map((m) => {
                const row = pricingByModule[m.id];
                const [value, setValue] = useState(
                  row ? ((row.price_cents || 0) / 100).toFixed(2) : ""
                );
                const [active, setActive] = useState(row ? !!row.is_active : true);

                // Because hooks can't be used conditionally in real React,
                // we handle this block using an inline component below.
                return null;
              })}

              {/* Inline component to avoid hook rules */}
              {modules.map((m) => (
                <ModulePriceCard
                  key={m.id}
                  module={m}
                  currency={currency}
                  existingRow={pricingByModule[m.id] || null}
                  saving={saving}
                  onSave={saveModulePrice}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline component so we can use hooks safely per module row */
function ModulePriceCard({ module, currency, existingRow, saving, onSave }) {
  const [priceDollars, setPriceDollars] = useState(
    existingRow ? ((existingRow.price_cents || 0) / 100).toFixed(2) : ""
  );
  const [active, setActive] = useState(existingRow ? !!existingRow.is_active : true);

  useEffect(() => {
    // keep in sync if rows load/update
    setPriceDollars(existingRow ? ((existingRow.price_cents || 0) / 100).toFixed(2) : "");
    setActive(existingRow ? !!existingRow.is_active : true);
  }, [existingRow?.id]);

  const valid =
    !priceDollars.trim() || (Number.isFinite(Number(priceDollars)) && Number(priceDollars) >= 0);

  return (
    <div
      style={{
        border: "1px solid #ededed",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>{module.title || "Untitled Module"}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Price (dollars)</div>
          <input
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="e.g. 49.00"
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: 10,
              border: "1px solid #e6e6e6",
              fontSize: 16,
              outline: "none",
            }}
          />
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            {existingRow ? (
              <>
                Current: <b>{money(existingRow.price_cents, existingRow.currency)}</b>
              </>
            ) : (
              <span>Not set yet.</span>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 900 }}>Active</span>
          </label>

          <button
            onClick={() => onSave(module.id, priceDollars, active)}
            disabled={!valid || saving}
            style={{
              width: "100%",
              background: "#facc15",
              border: "none",
              padding: "12px 12px",
              borderRadius: 10,
              fontWeight: 900,
              cursor: !valid || saving ? "not-allowed" : "pointer",
              opacity: !valid || saving ? 0.65 : 1,
            }}
          >
            {saving ? "Saving…" : existingRow ? "Update Module Price" : "Save Module Price"}
          </button>
        </div>
      </div>

      <div style={{ opacity: 0.7, fontSize: 13 }}>
        Checkout uses currency <b>{currency}</b> for this course.
      </div>
    </div>
  );
}
