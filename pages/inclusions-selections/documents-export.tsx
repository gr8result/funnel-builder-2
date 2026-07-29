export default function SelectionDocumentsExportPlaceholderPage() {
  return (
    <main className="documentsExportPlaceholder">
      <section>
        <h1>Documents and Export</h1>
        <p>Approved selection schedules, final documents and Estimate Builder export will be completed in the next stage.</p>
      </section>
      <style jsx>{`
        .documentsExportPlaceholder { min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #172033; padding: 24px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        section { width: min(680px, 100%); background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; padding: 24px; }
        h1 { margin: 0 0 10px; font-size: 30px; letter-spacing: 0; }
        p { margin: 0; color: #596579; line-height: 1.5; }
      `}</style>
    </main>
  );
}
