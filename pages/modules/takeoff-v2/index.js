// Thin Pages Router wrapper — Next.js requires the physical route file here; the
// real implementation lives in modules/takeoff-v2/.
//
// Dev-only for now: deliberately does not call useModuleGuard (pages/modules/_guard.js).
// Unlinked from nav, no production data, direct-URL-only. Add the guard back before
// this is reconnected to the real app (Phase 12 of the takeoff-v2 rebuild plan).
import TakeoffV2Page from "../../../modules/takeoff-v2/components/TakeoffV2Page.jsx";

export default function TakeoffV2Route() {
  return <TakeoffV2Page />;
}
