import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function QuoteProposalBuilderRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/modules/estimate-builder");
  }, [router]);

  return (
    <>
      <Head>
        <title>Quote Proposal Builder</title>
      </Head>
      <main style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Inter, Arial, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Opening Quote Proposal Builder...</h1>
          <p style={{ marginTop: 10, color: "#64748b" }}>The production builder is inside the Estimate Builder workbook.</p>
        </div>
      </main>
    </>
  );
}
