import { useMemo } from "react";
import { useRouter } from "next/router";
import { InclusionsSelectionsProjectBanner } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsProjectBanner";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import { contextFromQuery } from "../../src/modules/inclusions-selections/routing/stageNavigation";

export default function SelectionProcurementPlaceholderPage() {
  const router = useRouter();
  const context = useMemo(() => contextFromQuery(router.query), [router.query]);

  return (
    <main className="procurementPlaceholder">
      <InclusionsSelectionsProjectBanner currentStage="procurement" context={context} />
      <InclusionsSelectionsStageNav currentStage="procurement" context={context} />
      <section>
        <h1>Procurement</h1>
        <p>Supplier ordering, procurement tracking and purchase schedules will be completed in a future stage.</p>
      </section>
      <style jsx>{`
        .procurementPlaceholder { min-height: 100vh; background: #f6f7f9; color: #172033; padding: 24px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        section { width: min(680px, 100%); margin: 18px auto 0; background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; padding: 24px; }
        h1 { margin: 0 0 10px; font-size: 30px; letter-spacing: 0; }
        p { margin: 0; color: #596579; line-height: 1.5; }
      `}</style>
    </main>
  );
}
