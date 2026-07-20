import { useMemo } from "react";
import { StandardInclusionsSheet } from "../../components/estimate-builder/EstimateBuilderWorkbook";

export default function StandardInclusionsV2QaPage() {
  const workbook = useMemo(() => ({
    id: "qa-standard-inclusions-v2-workbook",
    builderId: "qa-standard-inclusions-v2-tenant",
    ownerUserId: "qa-standard-inclusions-v2-user",
    page: "standardInclusions",
    openedFileName: "standard-inclusions-v2-qa",
  }), []);

  return (
    <main style={{ minHeight: "100vh", background: "#eef2f7", padding: 18 }}>
      <StandardInclusionsSheet sheet={{ workbook, previewMode: false }} />
    </main>
  );
}

StandardInclusionsV2QaPage.disableLayout = true;
