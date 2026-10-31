const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const slug = (value) => String(value || "").trim().replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();

export function managedSubcontractDraftPayload({ workspaceId, jobId, commercialProjectId, snapshotId, snapshotProjectId, contract, internalOrder, supplier, actorId, createdAt = new Date().toISOString() } = {}) {
  if (!UUID.test(String(actorId || ""))) return { ok: false, code: "SIGN_IN_REQUIRED" };
  if (!UUID.test(String(workspaceId || ""))) return { ok: false, code: "WORKSPACE_REQUIRED" };
  if (!UUID.test(String(commercialProjectId || "")) || !UUID.test(String(snapshotId || ""))) return { ok: false, code: "COMMERCIAL_SNAPSHOT_REQUIRED" };
  if (String(snapshotProjectId || "") !== String(commercialProjectId)) return { ok: false, code: "SNAPSHOT_PROJECT_MISMATCH" };
  if (!jobId || contract?.jobId !== jobId || contract?.builderId !== workspaceId) return { ok: false, code: "JOB_OR_WORKSPACE_MISMATCH" };
  if (!contract?.contractId || internalOrder?.tradeContractId !== contract.contractId) return { ok: false, code: "CONTRACT_LINK_MISMATCH" };
  if (!supplier?.name) return { ok: false, code: "SUBCONTRACTOR_REQUIRED" };
  if (internalOrder.status && String(internalOrder.status).toLowerCase() !== "draft") return { ok: false, code: "INTERNAL_ORDER_NOT_DRAFT" };
  const commitment = money(internalOrder.commitment ?? contract.contractAmount);
  if (!(commitment > 0)) return { ok: false, code: "COMMITMENT_REQUIRED" };

  const stableId = slug(contract.contractId);
  const poNumber = `SUB-${stableId}`;
  const sourceProcurementItemId = `trade-contract:${contract.contractId}`;
  const gstRate = 10;
  return {
    ok: true,
    poNumber,
    sourceProcurementItemId,
    purchaseOrder: {
      workspace_id: workspaceId,
      project_id: commercialProjectId,
      snapshot_id: snapshotId,
      supplier_id: supplier.id || null,
      po_number: poNumber,
      status: "draft",
      supplier_name: supplier.name,
      supplier_email: supplier.email || null,
      issued_at: null,
      subtotal: commitment,
      gst_total: money(commitment * gstRate / 100),
      total: money(commitment * (1 + gstRate / 100)),
      delivery_address: "",
      notes: `Internal draft linked to estimate job ${jobId}. Not issued or sent.`,
      metadata: {
        source: "estimate_builder_subcontract",
        tradeContractId: contract.contractId,
        internalPurchaseOrderId: internalOrder.id,
        linkedEstimateJobId: jobId,
        sourceSection: contract.sourceSection || contract.trade,
        issueState: "DRAFT_NOT_ISSUED",
      },
      created_by: actorId || null,
      updated_by: actorId || null,
    },
    item: {
      workspace_id: workspaceId,
      project_id: commercialProjectId,
      snapshot_id: snapshotId,
      source_procurement_item_id: sourceProcurementItemId,
      description: `${String(contract.trade || "Subcontract").replace(/_/g, " ")} subcontract commitment`,
      quantity_ordered: 1,
      quantity_received: 0,
      unit: "LS",
      unit_cost: commitment,
      gst_rate: gstRate,
      line_total: commitment,
      status: "draft",
      metadata: {
        source: "estimate_builder_subcontract",
        tradeContractId: contract.contractId,
        internalPurchaseOrderId: internalOrder.id,
        sourceSection: contract.sourceSection || contract.trade,
        milestoneCount: internalOrder.milestones?.length || 0,
        createdAt,
      },
      created_by: actorId || null,
    },
  };
}
