export function ClientChangesRequestedPanel({ onReturn }: { onReturn: () => void }) {
  return <section className="approvalCard"><h2>Client Requested Changes</h2><p>Requested changes preserve approval history, invalidate current approvals and return affected items to the editable workspace.</p><button type="button" onClick={onReturn}>Return to Selection Workspace</button></section>;
}
