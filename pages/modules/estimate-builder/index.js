import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import TakeoffRecoveryPanel from "../../../components/construction-estimation/ai-plan-takeoff/TakeoffRecoveryPanel";
const EstimateBuilderWorkbook = dynamic(() => import("../../../components/estimate-builder/EstimateBuilderWorkbook"), { ssr: false });
import ClientPortalRouteBridge from "../../../Client Portal/RouteBridge";

function routePageFromRouter(router) {
  const queryPage = typeof router.query.page === "string" ? router.query.page : "";
  if (queryPage) return queryPage;
  const asPath = typeof router.asPath === "string" ? router.asPath : "";
  if (!asPath.includes("?")) return "";
  return new URLSearchParams(asPath.slice(asPath.indexOf("?") + 1)).get("page") || "";
}

export default function EstimateBuilderPage() {
  const router = useRouter();
  const previewMode = router.query.mode === "preview";
  const mode = typeof router.query.mode === "string" && router.query.mode !== "client-selection" ? router.query.mode : "";
  const recentId = typeof router.query.recentId === "string" ? router.query.recentId : "";
  const organisationId = typeof router.query.organisationId === "string" ? router.query.organisationId : "";
  const initialPage = routePageFromRouter(router);

  // Recovery is an explicit route option, never the default Takeoff interface.
  if (!router.isReady) return <p>Preparing Estimate Builder…</p>;
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
