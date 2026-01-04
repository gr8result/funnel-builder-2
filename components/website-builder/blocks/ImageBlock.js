import { useState } from "react";
import { sectionStyle, editableStyle } from "./_blockStyles";
import { supabase } from "../../../utils/supabase-client";

const BUCKET = "public-assets"; // change if you want: "website-assets"
const FOLDER = "website-builder";

export default function ImageBlock({ block, theme, onUpdateProps }) {
  const p = block.props || {};
  const url = (p.imageUrl || "").trim();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function handlePick(file) {
    setErr("");
    if (!file) return;
    try {
      setUploading(true);

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png";
      const path = `${FOLDER}/${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl || "";

      if (!publicUrl) throw new Error("Failed to get public URL.");

      onUpdateProps({ imageUrl: publicUrl, imageAlt: file.name || "Image" });
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section style={sectionStyle(block, theme)}>
      <h3
        contentEditable
        suppressContentEditableWarning
        style={{
          ...editableStyle(theme),
          fontSize: 18,
          fontWeight: 950,
          margin: 0,
        }}
        onBlur={(e) => onUpdateProps({ heading: e.currentTarget.textContent || "" })}
      >
        {p.heading || "Image"}
      </h3>

      <div style={{ height: 10 }} />

      <div style={styles.row}>
        <label style={styles.fileBtn}>
          {uploading ? "Uploading..." : "Upload Image"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePick(f);
              e.target.value = "";
            }}
          />
        </label>

        <select
          value={p.imageWidth || "100%"}
          onChange={(e) => onUpdateProps({ imageWidth: e.target.value })}
          style={styles.select}
        >
          <option value="100%">100%</option>
          <option value="75%">75%</option>
          <option value="50%">50%</option>
        </select>

        <button
          type="button"
          style={styles.smallBtn}
          onClick={() => onUpdateProps({ imageUrl: "" })}
        >
          Clear
        </button>
      </div>

      {err ? <div style={styles.err}>{err}</div> : null}

      <div style={{ height: 12 }} />

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={p.imageAlt || "Image"}
          style={{
            width: p.imageWidth || "100%",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            display: "block",
          }}
        />
      ) : (
        <div style={styles.placeholder}>No image yet — upload one above.</div>
      )}
    </section>
  );
}

const styles = {
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  fileBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    userSelect: "none",
  },
  select: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "white",
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  },
  smallBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  err: {
    marginTop: 10,
    color: "#fecaca",
    background: "rgba(244,63,94,0.12)",
    border: "1px solid rgba(244,63,94,0.25)",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
  },
  placeholder: {
    height: 160,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: 800,
  },
};
