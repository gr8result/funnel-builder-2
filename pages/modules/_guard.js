// /pages/modules/_guard.js
// FULL REPLACEMENT
//
// Next.js treats anything in /pages as a route, so this file MUST have a default export.
// At the same time, many module pages import guard helpers from here.
// This file provides BOTH:
//  - default export (harmless) so Next build passes
//  - named exports: useModuleGuard, Locked, requireUser, withGuard

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";

// ✅ default export to satisfy Next page rules
export default function _GuardPage() {
  return null;
}

// -------------------- UI helpers --------------------

export function Locked({
  title = "Locked",
  message = "You don't have access to this module on your current plan.",
  actionLabel = "Go to Billing",
  actionHref = "/billing",
}) {
  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 24 }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 20,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
        <p style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.5 }}>
          {message}
        </p>
        <a
          href={actionHref}
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {actionLabel}
        </a>
      </div>
    </div>
  );
}

// -------------------- auth / guard helpers --------------------

export async function requireUser(router) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      router?.replace?.("/login");
      return null;
    }
    return data.user;
  } catch (e) {
    router?.replace?.("/login");
    return null;
  }
}

/**
 * useModuleGuard(moduleId)
 * Returns:
 *  - loading: boolean
 *  - allowed: boolean
 *  - user: user|null
 *
 * NOTE: This is a LIGHT guard for build/runtime stability.
 * Hook up real entitlement logic later (DB/Stripe).
 */
export function useModuleGuard(moduleId) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [user, setUser] = useState(null);

  const mod = useMemo(() => String(moduleId || "").trim(), [moduleId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);

      const u = await requireUser(router);
      if (!alive) return;

      if (!u) {
        setUser(null);
        setAllowed(false);
        setLoading(false);
        return;
      }

      setUser(u);

      // Default allow for now (prevents breaking builds)
      // If you later add real checks, flip allowed based on entitlements.
      setAllowed(true);
      setLoading(false);
    })().catch(() => {
      if (!alive) return;
      setAllowed(true);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [router, mod]);

  return { loading, allowed, user };
}

export function withGuard(Page) {
  return function GuardedPage(props) {
    return <Page {...props} />;
  };
}
