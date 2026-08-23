import Head from "next/head";
import { useRouter } from "next/router";
import EstimateBuilderWorkbook from "../../../components/estimate-builder/EstimateBuilderWorkbook";

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
  const mode = typeof router.query.mode === "string" ? router.query.mode : "";
  const recentId = typeof router.query.recentId === "string" ? router.query.recentId : "";
  const organisationId = typeof router.query.organisationId === "string" ? router.query.organisationId : "";
  const initialPage = routePageFromRouter(router);

  return (
    <>
      <Head><title>{previewMode ? "Estimate Builder Preview" : "Estimate Builder"}</title></Head>
      <main style={styles.page}>
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
