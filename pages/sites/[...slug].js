// /pages/sites/[...slug].js
// Reads: website_pages.content_json.blocks
// URL: /sites/<slug>

import Head from "next/head";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

function clamp(n, a, b) {
  const x = Number(n);
  if (Number.isNaN(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function Block({ b }) {
  if (!b) return null;

  if (b.type === "heading") {
    return (
      <div
        style={{
          fontSize: clamp(b.size, 18, 90),
          fontWeight: 950,
          color: b.color || "#0b1220",
          textAlign: b.align || "left",
          marginBottom: 14,
        }}
      >
        {b.text || "Heading"}
      </div>
    );
  }

  if (b.type === "text") {
    return (
      <div
        style={{
          fontSize: clamp(b.size, 12, 42),
          lineHeight: 1.6,
          color: b.color || "#0b1220",
          textAlign: b.align || "left",
          marginBottom: 14,
          whiteSpace: "pre-wrap",
        }}
      >
        {b.text || "Text"}
      </div>
    );
  }

  if (b.type === "button") {
    return (
      <div style={{ textAlign: b.align || "left", margin: "10px 0 16px" }}>
        <a
          href={b.href || "#"}
          style={{
            display: "inline-block",
            padding: "12px 18px",
            borderRadius: 12,
            textDecoration: "none",
            fontWeight: 950,
            background: b.bg || "#2297c5",
            color: b.fg || "#06121d",
          }}
        >
          {b.text || "Button"}
        </a>
      </div>
    );
  }

  if (b.type === "image") {
    return (
      <div style={{ textAlign: b.align || "left", margin: "10px 0 18px" }}>
        {b.src ? (
          <img
            src={b.src}
            alt={b.alt || ""}
            style={{ maxWidth: "100%", borderRadius: clamp(b.radius, 0, 40) }}
          />
        ) : null}
      </div>
    );
  }

  if (b.type === "divider") {
    return (
      <div
        style={{
          height: b.thickness || 1,
          background: b.color || "rgba(11,18,32,0.18)",
          borderRadius: 999,
          margin: "16px 0",
        }}
      />
    );
  }

  if (b.type === "spacer") {
    return <div style={{ height: clamp(b.height, 0, 240) }} />;
  }

  if (b.type === "columns") {
    const cols = clamp(b.cols || 2, 2, 4);
    const gap = clamp(b.gap || 16, 0, 60);
    const columns = Array.isArray(b.columns) ? b.columns : [];
    const safeCols = Array.from({ length: cols }).map((_, i) =>
      Array.isArray(columns[i]) ? columns[i] : []
    );

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap,
          margin: "10px 0 18px",
        }}
      >
        {safeCols.map((colBlocks, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            {colBlocks.map((cb) => (
              <Block key={cb?.id || `${i}-${Math.random()}`} b={cb} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (b.type === "form") {
    const fields = Array.isArray(b.fields) ? b.fields : [];
    return (
      <div
        style={{
          margin: "10px 0 18px",
          padding: 18,
          borderRadius: 18,
          border: "1px solid rgba(11,18,32,0.10)",
          background: "rgba(255,255,255,0.92)",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 26, marginBottom: 6, color: "#0b1220" }}>
          {b.title || "Form"}
        </div>
        <div style={{ color: "rgba(11,18,32,0.75)", fontWeight: 800, marginBottom: 14 }}>
          {b.description || ""}
        </div>

        {/* NOTE: This renders a simple form UI.
            Wire this to your real capture endpoint later (e.g. /api/website/lead-capture). */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert("Form submit wiring is next step (API endpoint).");
          }}
          style={{ display: "grid", gap: 10 }}
        >
          {fields.map((f) => (
            <div key={f.id} style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 900, color: "rgba(11,18,32,0.85)" }}>
                {f.label || "Field"} {f.required ? "*" : ""}
              </label>
              <input
                name={f.name || "field"}
                type={f.type === "email" ? "email" : "text"}
                required={!!f.required}
                placeholder={f.type === "email" ? "you@email.com" : "Type here..."}
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(11,18,32,0.15)",
                  fontSize: 16,
                }}
              />
            </div>
          ))}

          <button
            type="submit"
            style={{
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              fontWeight: 950,
              fontSize: 16,
              background: "#2297c5",
              color: "#06121d",
              cursor: "pointer",
            }}
          >
            {b.submitText || "Submit"}
          </button>
        </form>
      </div>
    );
  }

  if (b.type === "faq") {
    const items = Array.isArray(b.items) ? b.items : [];
    return (
      <div
        style={{
          margin: "10px 0 18px",
          padding: 18,
          borderRadius: 18,
          border: "1px solid rgba(11,18,32,0.10)",
          background: "rgba(255,255,255,0.92)",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 26, marginBottom: 10, color: "#0b1220" }}>
          {b.title || "FAQ"}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it, idx) => (
            <details
              key={it.id || `${idx}-${Math.random()}`}
              open={!!b.openFirst && idx === 0}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(11,18,32,0.10)",
                padding: 12,
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 950, color: "#0b1220" }}>
                {it.q || "Question"}
              </summary>
              <div style={{ marginTop: 8, color: "rgba(11,18,32,0.8)", fontWeight: 800, whiteSpace: "pre-wrap" }}>
                {it.a || "Answer"}
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export async function getServerSideProps(ctx) {
  const slugArr = ctx.params?.slug || [];
  const slug = slugArr.join("/").replace(/^\/+/, "");

  const { data, error } = await supabase
    .from("website_pages")
    .select("title, slug, content_json")
    .eq("slug", slug)
    .limit(1);

  if (error) return { notFound: true };
  const row = data?.[0] || null;
  if (!row) return { notFound: true };

  const blocks = row?.content_json?.blocks || [];
  const canvasWidth = row?.content_json?.canvasWidth || 1200;

  return {
    props: {
      title: row.title || slug,
      slug,
      canvasWidth: Number(canvasWidth) || 1200,
      blocks: Array.isArray(blocks) ? blocks : [],
    },
  };
}

export default function SitePage({ title, canvasWidth, blocks }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ background: "#ffffff", minHeight: "100vh" }}>
        <div
          style={{
            width: "100%",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              width: canvasWidth,
              maxWidth: "100%",
              margin: "0 auto",
              padding: 24,
              fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial",
            }}
          >
            {blocks.map((b) => (
              <Block key={b.id || Math.random()} b={b} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
