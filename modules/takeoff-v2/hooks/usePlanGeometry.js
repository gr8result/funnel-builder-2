import { useEffect, useState } from "react";
import { getPlanGeometry } from "../geometry/planGeometryService.js";

/** Loads (and caches, per pdf.js document+page) the plan-geometry snap index. */
export function usePlanGeometry(pdfDocument, pageNumber) {
  const [geometry, setGeometry] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfDocument || !pageNumber) {
      setGeometry(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    getPlanGeometry(pdfDocument, pageNumber)
      .then((result) => { if (!cancelled) setGeometry(result); })
      .catch(() => { if (!cancelled) setGeometry(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pdfDocument, pageNumber]);

  return { geometry, loading };
}
