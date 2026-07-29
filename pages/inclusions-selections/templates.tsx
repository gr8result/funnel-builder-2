import { useRouter } from "next/router";

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SelectionTemplatesPlaceholderPage() {
  const router = useRouter();
  const projectId = queryValue(router.query.projectId);
  return (
    <main className="placeholderPage">
      <section>
        <h1>Selection Templates</h1>
        <p>{projectId ? "Create Selection Areas is complete for this project. Template assignment is the next stage and has not been built yet." : "Open an existing project before assigning selection templates."}</p>
      </section>
      <style jsx>{`
        .placeholderPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #f6f8fb;
          color: #182033;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 24px;
        }
        section {
          width: min(640px, 100%);
          background: #ffffff;
          border: 1px solid #dfe5ee;
          border-radius: 8px;
          padding: 24px;
        }
        h1 {
          margin: 0 0 10px;
          font-size: 30px;
          letter-spacing: 0;
        }
        p {
          margin: 0;
          color: #5b6578;
          line-height: 1.5;
        }
      `}</style>
    </main>
  );
}
