// /pages/checkout/success.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";

export default function CheckoutSuccess() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Finalizing your subscription...");

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;
    let redirectTimer = null;

    const finalize = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const user = sessionData?.session?.user;
        if (!user || !token) {
          setStatusText("Payment confirmed. Please sign in again to apply your plan.");
          redirectTimer = setTimeout(() => { router.replace("/login"); }, 3000);
          return;
        }

        const emailPlanTier =
          typeof router.query.emailPlan === "string" ? router.query.emailPlan : null;
        const smsPlanTier =
          typeof router.query.smsPlan === "string" ? router.query.smsPlan : null;
        const calendarPlanTier =
          typeof router.query.calendarPlan === "string" ? router.query.calendarPlan : null;
        const socialPlanTier =
          typeof router.query.socialPlan === "string" ? router.query.socialPlan : null;
        const basePlan =
          typeof router.query.plan === "string" ? router.query.plan : null;
        const selectedModules =
          typeof router.query.selected === "string"
            ? router.query.selected.split(",").filter(Boolean)
            : [];

        // Use server-side API to write plan tiers (bypasses RLS, uses admin key)
        const applyRes = await fetch("/api/billing/apply-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            basePlan: basePlan || null,
            emailPlan: emailPlanTier || null,
            smsPlan: smsPlanTier || null,
            calendarPlan: calendarPlanTier || null,
            socialPlan: socialPlanTier || null,
            selectedModules,
          }),
        });

        if (!applyRes.ok) {
          const err = await applyRes.json().catch(() => ({}));
          throw new Error(err.error || "Plan activation failed");
        }

        const redirectTarget = "/billing";

        if (!cancelled) {
          setStatusText("Subscription activated. Redirecting to Billing...");
        }

        redirectTimer = setTimeout(() => {
          router.replace(redirectTarget);
        }, 2200);
      } catch (err) {
        console.error("Error finalizing plan on success page:", err);
        if (!cancelled) {
          setStatusText("Payment confirmed, but plan sync is delayed. Redirecting...");
        }
        redirectTimer = setTimeout(() => {
          router.replace("/billing");
        }, 2200);
      }
    };

    finalize();

    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router.isReady, router.query.emailPlan, router.query.smsPlan, router.query.calendarPlan]);

  return (
    <div className="wrap">
      <div className="card">
        <h1>✅ Payment Confirmed</h1>
        <p>Your subscription has been activated successfully.</p>
        <p>{statusText}</p>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #fff;
        }
        .card {
          background: #111827;
          border: 1px solid #333;
          padding: 40px;
          border-radius: 12px;
          text-align: center;
          width: 90%;
          max-width: 500px;
        }
        h1 {
          color: #22c55e;
          font-size: 26px;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}
