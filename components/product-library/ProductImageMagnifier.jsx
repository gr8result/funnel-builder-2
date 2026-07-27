import { useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { isValidProductUrl } from "../../lib/product-library/urlValidation";
import { VERIFICATION_STATUSES } from "../../lib/product-library/constants";

function verificationLabel(status) {
  return VERIFICATION_STATUSES.find((entry) => entry.value === status)?.label || "Unverified";
}

// The separate "enlarge" action — distinct from clicking the image/name,
// which opens the real supplier page in a new tab. This only ever enlarges
// the product's own stored image (or the clean placeholder) inside the
// platform; it never enlarges an unrelated stock photo.
export default function ProductImageMagnifier({
  imageUrl,
  name,
  brand,
  model,
  colour,
  finish,
  supplier,
  verificationStatus,
  productUrl,
  triggerClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const urlCheck = isValidProductUrl(productUrl);

  return (
    <>
      <button
        type="button"
        className={`magnifier-trigger ${triggerClassName}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label="Enlarge product image"
        title="Enlarge image"
      >
        <Search size={14} />
      </button>

      {open && (
        <div className="magnifier-backdrop" onClick={() => setOpen(false)}>
          <div className="magnifier-dialog" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="magnifier-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            {imageUrl ? (
              <img src={imageUrl} alt={name || "Product"} className="magnifier-image" />
            ) : (
              <div className="magnifier-placeholder">Exact product image not yet available</div>
            )}
            <div className="magnifier-details">
              <h3>{name || "Product"}</h3>
              <dl>
                {brand && <><dt>Brand</dt><dd>{brand}</dd></>}
                {model && <><dt>Model</dt><dd>{model}</dd></>}
                {colour && <><dt>Colour</dt><dd>{colour}</dd></>}
                {finish && <><dt>Finish</dt><dd>{finish}</dd></>}
                {supplier && <><dt>Supplier</dt><dd>{supplier}</dd></>}
                <dt>Verification</dt>
                <dd>
                  <span className={`verification-badge ${verificationStatus || "unverified"}`}>
                    {verificationLabel(verificationStatus)}
                  </span>
                </dd>
              </dl>
              {urlCheck.ok && !urlCheck.empty ? (
                <a className="magnifier-website" href={urlCheck.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> View Product Website
                </a>
              ) : (
                <p className="magnifier-no-website">Product website not available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .magnifier-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: rgba(15, 23, 42, 0.75);
          color: #fff;
          cursor: pointer;
        }
        .magnifier-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(2, 6, 23, 0.72);
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .magnifier-dialog {
          width: min(640px, 92vw);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          color: #071827;
          border-radius: 12px;
          padding: 20px;
          position: relative;
          display: grid;
          gap: 14px;
        }
        .magnifier-close {
          position: absolute;
          top: 10px;
          right: 12px;
          background: transparent;
          border: 0;
          font-size: 22px;
          cursor: pointer;
          color: #64748b;
          line-height: 1;
        }
        .magnifier-image {
          width: 100%;
          max-height: 46vh;
          object-fit: contain;
          border-radius: 8px;
          background: #f1f5f9;
        }
        .magnifier-placeholder {
          display: grid;
          place-items: center;
          height: 220px;
          border-radius: 8px;
          background: #eef1f5;
          border: 1px dashed #cbd5e1;
          color: #64748b;
          font-weight: 600;
        }
        .magnifier-details h3 {
          margin: 0 0 8px;
        }
        .magnifier-details dl {
          display: grid;
          grid-template-columns: max-content 1fr;
          gap: 4px 14px;
          margin: 0 0 10px;
        }
        .magnifier-details dt {
          color: #64748b;
          font-weight: 600;
        }
        .magnifier-details dd {
          margin: 0;
        }
        .verification-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #e2e8f0;
          color: #334155;
        }
        .verification-badge.exact_model_verified {
          background: #dcfce7;
          color: #166534;
        }
        .verification-badge.model_family_only {
          background: #fef3c7;
          color: #92400e;
        }
        .verification-badge.image_unavailable,
        .verification-badge.link_broken,
        .verification-badge.discontinued {
          background: #fee2e2;
          color: #991b1b;
        }
        .magnifier-website {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #1d4ed8;
          font-weight: 700;
          text-decoration: none;
        }
        .magnifier-website:hover {
          text-decoration: underline;
        }
        .magnifier-no-website {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }
      `}</style>
    </>
  );
}
