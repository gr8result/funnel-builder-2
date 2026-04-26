// components/vendor/VendorUserBanner.js
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase-client";

export default function VendorUserBanner() {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("full_name, business_name")
          .eq("user_id", user.id)
          .maybeSingle();

        const name = vendor?.full_name || vendor?.business_name || user.email || "Unknown";
        setDisplayName(name);
        return;
      }

      const code =
        typeof window !== "undefined" ? localStorage.getItem("xchange_user_code") : null;
      if (!code) return;

      try {
        const resp = await fetch(
          `/api/marketplace/vendor-access?code=${encodeURIComponent(code)}`
        );
        const payload = await resp.json();
        if (resp.ok && payload?.allowed && payload?.displayName) {
          setDisplayName(payload.displayName || payload.email || "Unknown");
          return;
        }
      } catch {}

      try {
        const resp = await fetch(
          `/api/marketplace/affiliate-access?code=${encodeURIComponent(code)}`
        );
        const payload = await resp.json();
        if (resp.ok && payload?.displayName) {
          setDisplayName(payload.displayName || payload.email || "Unknown");
        }
      } catch {}
    }

    load();
  }, []);

  if (!displayName) return null;

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "0 0 10px 10px",
        padding: "10px 22px",
        marginTop: -8,
        marginBottom: 20,
        fontSize: 16,
        color: "#94a3b8",
        fontWeight: 600,
        border: "1px solid #334155",
        borderTop: "none",
      }}
    >
      Logged in as:{" "}
      <span style={{ color: "#38bdf8", fontWeight: 700 }}>{displayName}</span>
    </div>
  );
}
