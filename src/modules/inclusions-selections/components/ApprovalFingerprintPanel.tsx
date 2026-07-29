import type { ApprovalStage } from "../services/approvalStageService";

export function ApprovalFingerprintPanel({ stage }: { stage: ApprovalStage }) {
  return <section className="approvalCard"><h2>Approval Version and Fingerprint</h2><p>{stage.currentFingerprint}</p><p>Material approval inputs include areas, requirements, selections, locations, quantities, prices, GST, variations, Not Applicable decisions, client-visible notes and review readiness.</p></section>;
}
