import Head from "next/head";
import { useRef } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import TakeoffRecoveryPanel from "../../../components/construction-estimation/ai-plan-takeoff/TakeoffRecoveryPanel";
const EstimateBuilderWorkbook = dynamic(() => import("../../../components/estimate-builder/EstimateBuilderWorkbook"), { ssr: false });
const ProductLibraryPage = dynamic(() => import("../builders/product-library"), {
  ssr: false,
  loading: () => <p role="status">Loading Product Library...</p>,
});
import ClientPortalRouteBridge from "../../../client-portal/RouteBridge";
import { useHydrated } from "../../../hooks/useHydrated";

function routePageFromRouter(router) {
  const queryPage = typeof router.query.page === "string" ? router.query.page : "";
  if (queryPage) return queryPage;
  const asPath = typeof router.asPath === "string" ? router.asPath : "";
  if (!asPath.includes("?")) return "";
  return new URLSearchParams(asPath.slice(asPath.indexOf("?") + 1)).get("page") || "";
}

export default function EstimateBuilderPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const workbookHostStarted = useRef(false);
  const previewMode = router.query.mode === "preview";
  const mode = typeof router.query.mode === "string" && router.query.mode !== "client-selection" ? router.query.mode : "";
  const recentId = typeof router.query.recentId === "string" ? router.query.recentId : "";
  const organisationId = typeof router.query.organisationId === "string" ? router.query.organisationId : "";
  const initialPage = routePageFromRouter(router);

  // Recovery is an explicit route option, never the default Takeoff interface.
  // Gate on `hydrated` too so the first client render still matches the server's
  // placeholder; router.isReady alone is already true on that render and swapping
  // straight to the workbook breaks hydration.
  if (!hydrated || !router.isReady) return <p>Preparing Estimate Builder…</p>;
  if (router.query.safeMode === "1") {
    return <TakeoffRecoveryPanel />;
  }

  if (initialPage === "clientPortal") {
    return (
      <>
        <Head><title>Client Portal</title></Head>
        <ClientPortalRouteBridge />
      </>
    );
  }

  // The shared catalogue does not require a saved estimate. Mount it independently
  // so another tab's job-save lock or a large takeoff cannot block browsing, and
  // browsing never restores or autosaves the user's active job as a side effect.
  // Selection/preview/file-opening modes still need the complete workbook host.
  //
  // Deliberately NOT gated on `!workbookHostStarted.current`: once the full
  // workbook has mounted once in a tab (e.g. the user visited Takeoff first),
  // that ref stays true for the tab's lifetime, so navigating to Product
  // Library afterwards was silently falling through to the heavy workbook
  // host below - and with it, useProjectEstimateInstanceSync's document lock
  // acquisition, surfacing "Another tab is still saving or signing in" purely
  // from opening the catalogue. Browsing Product Library should never need
  // that lock, so this bypass applies on every visit, not just the first.
  if (initialPage === "productLibrary" && !mode && router.query.mode !== "client-selection") {
    return (
      <>
        <Head><title>Product Library</title></Head>
        <main style={styles.page}>
          <ProductLibraryPage embeddedInEstimateBuilder />
        </main>
      </>
    );
  }

  // Keep an already-mounted workbook alive across sidebar navigation so pending
  // in-memory edits retain their existing autosave lifecycle and job context.
  workbookHostStarted.current = true;
  return (
    <>
      <Head><title>{previewMode ? "Estimate Builder Preview" : "Estimate Builder"}</title></Head>
      <main style={styles.page}>
        {initialPage === "aiPlanTakeoff" && (
          <a href="/modules/estimate-builder?page=aiPlanTakeoff&safeMode=1" style={{ display: "inline-block", marginBottom: 12 }}>Recover Takeoff</a>
        )}
        <EstimateBuilderWorkbook previewMode={previewMode} mode={mode} recentId={recentId} organisationId={organisationId} initialPage={initialPage} />
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 8% 0%, rgba(37, 99, 235, 0.10), transparent 28%), radial-gradient(circle at 88% 8%, rgba(20, 184, 166, 0.12), transparent 30%), #f6f8fb",
    color: "#0f172a",
    padding: 22,
  },
};
