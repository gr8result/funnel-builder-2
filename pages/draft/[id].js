// pages/draft/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import supabase from "../../utils/supabase-client";

export default function DraftPageById() {
  const { query } = useRouter();
  const id = query.id;
  const [html, setHtml] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("html")
        .eq("id", String(id))
        .single();
      if (error || !data) return setMissing(true);
      setHtml(data.html || "");
    })();
  }, [id]);

  if (missing) return <main style={{ padding:24 }}><h1>Not found</h1><p>This draft page doesn’t exist.</p></main>;
  if (html == null) return <main style={{ padding:24 }}><p>Loading…</p></main>;

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ minHeight: "100vh", background: "#fff", color: "#000" }}
    />
  );
}
