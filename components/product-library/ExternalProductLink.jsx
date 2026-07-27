import { ExternalLink } from "lucide-react";
import { isValidProductUrl } from "../../lib/product-library/urlValidation";

// Wraps a product image/name so clicking it opens the real supplier or
// manufacturer product page in a new tab — never the current tab, so an
// in-progress selections session is never navigated away from or lost.
// When no valid URL is stored, renders the same children as plain,
// non-interactive content — never a guessed or fabricated link.
export default function ExternalProductLink({ url, children, className = "", showIcon = true }) {
  const check = isValidProductUrl(url);
  if (!check.ok || check.empty) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a
      className={`external-product-link ${className}`}
      href={check.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title="Open the product page in a new tab"
    >
      {children}
      {showIcon && <ExternalLink size={12} className="external-product-link-icon" aria-hidden="true" />}
      <style jsx>{`
        .external-product-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: inherit;
          text-decoration: none;
        }
        .external-product-link:hover {
          text-decoration: underline;
        }
        .external-product-link-icon {
          flex-shrink: 0;
          opacity: 0.75;
        }
      `}</style>
    </a>
  );
}
