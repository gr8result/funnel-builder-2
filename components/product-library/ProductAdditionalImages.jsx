import { useRef, useState } from "react";
import { uploadSharedMediaLibraryAsset } from "../../lib/website-builder/mediaAssets";

export default function ProductAdditionalImages({ supabase, userId, imageUrls, onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const urls = Array.isArray(imageUrls) ? imageUrls : [];

  async function handleFiles(files) {
    const list = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!list.length || !userId) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of list) {
        const asset = await uploadSharedMediaLibraryAsset(supabase, userId, file, { tag: "product-library-gallery" });
        uploaded.push(asset.src);
      }
      onChange([...urls, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError?.message || "Upload failed.");
    }
    setUploading(false);
  }

  function removeAt(index) {
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <div className="additional-images">
      {urls.length > 0 && (
        <div className="grid">
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} className="thumb">
              <img src={url} alt="" loading="lazy" />
              <button type="button" onClick={() => removeAt(index)} aria-label="Remove image">×</button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? "Uploading..." : "Add Images"}
      </button>

      <style jsx>{`
        .additional-images {
          display: grid;
          gap: 10px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
          gap: 8px;
        }
        .thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          background: #0b1626;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .thumb button {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.75);
          color: #fecaca;
          padding: 0;
          line-height: 1;
          font-size: 14px;
        }
        button {
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          cursor: pointer;
          font-weight: 800;
          padding: 8px 12px;
          width: fit-content;
        }
        button.ghost {
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #e5eefb;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .error {
          margin: 0;
          color: #fca5a5;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
