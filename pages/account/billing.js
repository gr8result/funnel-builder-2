import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabase-client";

const PLAN_LABELS = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  professional: "Professional",
};

export default function AccountBilling() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) { setLoading(false); return; }

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, current_period_end")
        .eq("account_id", userId)
        .maybeSingle();

      setPlan(sub || null);
      setLoading(false);
    })();
  }, []);

  const planLabel = plan?.plan_id ? (PLAN_LABELS[plan.plan_id] || plan.plan_id) : "Free";
  const renewDate = plan?.current_period_end
    ? new Date(plan.current_period_end).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#f9fafb" }}>Billing &amp; Plan</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#9ca3af" }}>Your current subscription details</p>

      {loading ? (
        <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Loading…</div>
      ) : (
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Current plan</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb" }}>{planLabel}</div>
              {plan?.status && (
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: plan.status === "active" ? "#064e3b" : "#1f2937",
                    color: plan.status === "active" ? "#6ee7b7" : "#9ca3af",
                  }}>
                    {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                  </span>
                </div>
              )}
              {renewDate && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
                  Renews {renewDate}
                </div>
              )}
            </div>
            <Link href="/billing">
              <button style={{
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
                Manage Plan
              </button>
            </Link>
          </div>

          {(!plan || plan.plan_id === "free") && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #1f2937" }}>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 12px" }}>
                Upgrade to unlock more features, higher limits, and priority support.
              </p>
              <Link href="/billing">
                <button style={{
                  background: "transparent", color: "#60a5fa", border: "1px solid #2563eb",
                  borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                  View Plans →
                </button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
