import { useEffect, useState } from "react";

/**
 * False during SSR and on the client's very first (hydration) render, then true.
 *
 * Use this to gate any branch that would otherwise render a different tree on the
 * server than on the client's first render - most commonly `router.isReady`, which
 * is always false while prerendering but is already true on the first client render
 * of an automatically statically optimized page with no query string. Branching on
 * it directly makes the server and client disagree and React fails to hydrate.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

export default useHydrated;
