// The storage mode in force, shown wherever a job is open: LOCAL ONLY (this computer) or SHARED
// (multi-user), with the shared state of the open job. Links to Storage Settings.
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStorageSettings } from "../../lib/job-storage/storageSettings.js";
import { sharedJobState, sharedStorageActive } from "../../lib/job-storage/sharedSync.js";

export default function StorageStatusLink({ jobKey = "" }) {
  const [view, setView] = useState(null);
  useEffect(() => {
    const read = () => { const settings = loadStorageSettings(); setView({ shared: sharedStorageActive(settings), state: jobKey ? sharedJobState(jobKey, settings) : null }); };
    read();
    window.addEventListener("gr8:job-storage-settings", read);
    window.addEventListener("gr8:shared-job-state", read);
    return () => { window.removeEventListener("gr8:job-storage-settings", read); window.removeEventListener("gr8:shared-job-state", read); };
  }, [jobKey]);
  if (!view) return null;
  const { shared, state } = view;
  const label = !shared ? "Storage: Local only" : state?.conflict ? "Shared: NOT shared - conflict" : state?.pending ? "Shared: not yet shared" : state?.revision ? `Shared · revision ${state.revision}` : "Storage: Shared";
  const tone = !shared ? ["#e2e8f0", "#0f172a"] : state?.conflict ? ["#fee2e2", "#991b1b"] : state?.pending ? ["#fef3c7", "#78350f"] : ["#dcfce7", "#14532d"];
  return (
    <Link href="/modules/estimate-builder/storage-settings" data-testid="storage-status" data-shared={shared ? "true" : "false"} data-conflict={state?.conflict ? "true" : "false"} data-revision={state?.revision || 0}
      title={shared ? "Jobs are saved to your company's shared storage. Open Storage Settings." : "Jobs are stored on this computer only. Open Storage Settings."}
      style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "6px 16px", borderRadius: 999, background: tone[0], color: tone[1], fontSize: 16, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
      {label}
    </Link>
  );
}
