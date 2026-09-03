/**
 * Legacy entry point retained so bookmarks and integrations do not break.
 * The new page builder owns this workflow now.
 */
export async function getServerSideProps({ resolvedUrl }) {
  const query = resolvedUrl.includes("?") ? resolvedUrl.slice(resolvedUrl.indexOf("?")) : "";

  return {
    redirect: {
      destination: `/modules/page-builder${query}`,
      permanent: false,
    },
  };
}

export default function LegacyEstimateBuilderPage() {
  return null;
}
