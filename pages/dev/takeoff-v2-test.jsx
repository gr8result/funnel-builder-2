// Unauthenticated dev entry point for Takeoff Engine V2, matching the existing
// convention (pages/dev/takeoff-engine-test.jsx, pages/dev/plan-import-test.js):
// components/Layout.js treats any /dev/* path as isAdminRoute, which is exempt
// from the protected-route login redirect. The spec-compliant route lives at
// pages/modules/takeoff-v2/index.js and is correctly login-gated like the rest of
// /modules/* — this route exists only so the standalone module can be exercised
// and screenshot-tested without a Supabase session.
import TakeoffV2Page from "../../modules/takeoff-v2/components/TakeoffV2Page.jsx";

export default function TakeoffV2DevTestRoute() {
  return <TakeoffV2Page />;
}
