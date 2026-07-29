import type { ApprovalStage } from "../services/approvalStageService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function ClientApprovalPackage({ stage }: { stage: ApprovalStage }) {
  return <section className="approvalCard"><header><h2>Client Approval Package</h2><span>{stage.clientProjection.draftWarning}</span></header><p>{stage.clientProjection.declaration}</p>{stage.clientProjection.groupedByRoom.map((group) => <article key={group.areaName}><h3>{group.areaName}</h3><div className="approvalRows">{group.lines.map((line) => <div key={`${group.areaName}:${line.requirementName}`} className="approvalRow"><strong>{line.requirementName}</strong><span>{line.selectedItem}</span><span>{line.quantity} {line.unit}</span><span>Allowance {currency.format(line.allowance.amount)}</span><span>Selected {currency.format(line.selectedValue.amount)}</span><span>Variation {currency.format(line.netVariation.amount)}</span></div>)}</div></article>)}<strong>Net variation inc GST {currency.format(stage.clientProjection.totalDraftVariation.amount)}</strong></section>;
}
