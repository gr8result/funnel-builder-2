import { useRouter } from "next/router";

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SelectionReviewPlaceholderPage() {
  const router = useRouter();
  const projectId = queryValue(router.query.projectId);
  return (
    <main className="reviewPlaceholder">
      <section>
        <h1>Review and Variations</h1>
        <p>{projectId ? "Pricing, variations and final selection review will be completed in the next stage." : "Open an existing project before reviewing selections."}</p>
      </section>
      <style jsx>{`
        .reviewPlaceholder { min-height: 100vh; display: grid; place-items: center; background: #f5f7fa; color: #172033; padding: 24px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        section { width: min(680px, 100%); background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; padding: 24px; }
        h1 { margin: 0 0 10px; font-size: 30px; letter-spacing: 0; }
        p { margin: 0; color: #596579; line-height: 1.5; }
      `}</style>
    </main>
  );
}
