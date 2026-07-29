import type { ApprovalStage } from "../services/approvalStageService";

export function CreateSnapshotPanel({ stage, onCreate }: { stage: ApprovalStage; onCreate: () => void }) {
  return <section className="approvalCard"><h2>Create Locked Selection Snapshot</h2><p>Creates immutable snapshot version {stage.snapshots.length + 1} from the current matching approvals and fingerprint.</p><button type="button" className="primaryButton" disabled={!stage.readiness.ready} onClick={onCreate}>Create Locked Selection Snapshot</button></section>;
}
