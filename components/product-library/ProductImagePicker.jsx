import { useRef, useState } from "react";
import { uploadSharedMediaLibraryAsset } from "../../lib/website-builder/mediaAssets";

export default function ProductImagePicker({ supabase, userId, imageUrl, requiresImage, onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const asset = await uploadSharedMediaLibraryAsset(supabase, userId, file, { tag: "product-library" });
      onChange(asset.src, { storagePath: asset.storage_path || "" });
    } catch (uploadError) {
      setError(uploadError?.message || "Upload failed.");
    }
    setUploading(false);
  }

  return (
    <div className="image-picker">
      <div
        className={dragActive ? "drop-zone active" : "drop-zone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Product" className="preview" />
        ) : requiresImage ? (
          <div className="placeholder required">
            <span>Image required</span>
            <small>Drag an image here or upload one below</small>
          </div>
        ) : (
          <div className="placeholder optional">
            <span>No Product Image Available</span>
            <small>Optional for this item type</small>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading..." : imageUrl ? "Replace Image" : "Upload Image"}
        </button>
        {imageUrl && (
          <button type="button" className="ghost" onClick={() => onChange("", {})}>
            Remove Image
          </button>
        )}
      </div>

      <style jsx>{`
        .image-picker {
          display: grid;
          gap: 10px;
        }
        .drop-zone {
          display: grid;
          place-items: center;
          min-height: 160px;
          border: 1px dashed rgba(148, 163, 184, 0.4);
          border-radius: 10px;
          background: #0b1626;
          overflow: hidden;
        }
        .drop-zone.active {
          border-color: #38bdf8;
          background: rgba(14, 165, 233, 0.1);
        }
        .preview {
          width: 100%;
          height: 220px;
          object-fit: contain;
          background: #0b1626;
        }
        .placeholder {
          display: grid;
          justify-items: center;
          gap: 4px;
          padding: 24px;
          text-align: center;
          color: #93a4bd;
        }
        .placeholder.required span {
          color: #fbbf24;
          font-weight: 800;
        }
        .placeholder span {
          font-weight: 700;
        }
        .placeholder small {
          font-size: 12px;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        button {
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          cursor: pointer;
          font-weight: 800;
          padding: 9px 12px;
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
