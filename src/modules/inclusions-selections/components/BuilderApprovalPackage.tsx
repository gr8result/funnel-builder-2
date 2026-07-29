import type { ApprovalStage } from "../services/approvalStageService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function BuilderApprovalPackage({ stage }: { stage: ApprovalStage }) {
  return <section className="approvalCard internalApproval"><header><h2>{stage.builderProjection.heading}</h2><span>Internal Builder Approval</span></header><div className="approvalRows">{stage.builderProjection.lines.map((line) => <div key={`${line.areaName}:${line.requirementName}`} className="approvalRow"><strong>{line.areaName} - {line.requirementName}</strong><span>{line.selectedItem}</span><span>{line.supplierName ?? "Supplier missing"}</span><span>{line.supplierSku ?? "SKU missing"}</span><span>Builder {currency.format(line.builderCost.amount)}</span><span>Client {currency.format(line.clientPrice.amount)}</span><span>Margin {currency.format(line.marginImpact.amount)}</span></div>)}</div></section>;
}
