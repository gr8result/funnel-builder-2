import type { ApprovalStage } from "../services/approvalStageService";

export function ApprovalHistoryTimeline({ stage }: { stage: ApprovalStage }) {
  return <section className="approvalCard"><h2>Approval History</h2><div className="historyTimeline">{stage.history.map((event) => <article key={event.id}><strong>{event.eventType.replace(/_/g, " ")}</strong><span>{event.timestamp}</span><span>{event.actor} - {event.actorRole}</span><span>{event.fingerprint}</span>{event.comments ? <p>{event.comments}</p> : null}</article>)}</div></section>;
}
