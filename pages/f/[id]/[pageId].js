// pages/f/[id]/[pageId].js
// FULL REPLACEMENT
// Fixes missing "../templates.js" import by removing it.
// Keeps route alive and build-safe.

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase-client";

export default function FunnelPage() {
  const router = useRouter();
  const { id, pageId } = router.query;

  const [status, setStatus] = useState("loading");
  const [page, setPage] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!pageId) return;

        // Optional load if you have a pages table
        const { data, error } = await supabase
          .from("pages")
          .select("*")
          .eq("id", pageId)
          .maybeSingle();

        if (!alive) return;

        if (!error && data) {
          setPage(data);
        }
        setStatus("ok");
      } catch {
        if (!alive) return;
        setStatus("ok");
      }
    })();

    return () => {
      alive = false;
    };
  }, [pageId]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Funnel Page</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Funnel: <b>{String(id || "")}</b> / Page: <b>{String(pageId || "")}</b>
      </p>

      {status === "loading" ? (
        <p>Loading…</p>
      ) : page ? (
        <pre
          style={{
            background: "#0c121a",
            color: "#e5e7eb",
            padding: 14,
            borderRadius: 12,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(page, null, 2)}
        </pre>
      ) : (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            background: "#f3f4f6",
          }}
        >
          No page record found (or table not present). Route is build-safe now.
        </div>
      )}
    </div>
  );
}
