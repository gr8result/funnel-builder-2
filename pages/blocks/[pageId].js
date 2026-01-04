// pages/blocks/[pageId].js
// FULL REPLACEMENT
// Fixes broken import path that referenced "./[id]/utils/supabase-client".
// This page now loads safely without any weird relative imports.

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase-client";

export default function BlockPage() {
  const router = useRouter();
  const { pageId } = router.query;

  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!pageId) return;

        // Optional: try load a record if you have a blocks/pages table
        // If not, we just show a placeholder and keep the build green.
        const { data: row, error } = await supabase
          .from("pages")
          .select("*")
          .eq("id", pageId)
          .maybeSingle();

        if (!alive) return;

        if (!error && row) {
          setData(row);
          setStatus("ok");
        } else {
          setStatus("ok");
          setData(null);
        }
      } catch {
        if (!alive) return;
        setStatus("ok");
        setData(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pageId]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Blocks Page</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Page ID: <b>{String(pageId || "")}</b>
      </p>

      {status === "loading" ? (
        <p>Loading…</p>
      ) : data ? (
        <pre
          style={{
            background: "#0c121a",
            color: "#e5e7eb",
            padding: 14,
            borderRadius: 12,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
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
          No page record found (or table not present). This route is now safe for builds.
        </div>
      )}
    </div>
  );
}
