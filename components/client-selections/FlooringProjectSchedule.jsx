// Live project projection alongside the existing immutable commercial snapshots.
export default function FlooringProjectSchedule({ workbook, variation = false, procurement = false }) {
  const rows = Object.values(workbook?.quotation || {}).flatMap((s) => s.rows || []).filter((r) => r.source === "client-selections-flooring" && r.flooringType === "carpet");
  if (!rows.length) return null;
  const money = (n) => n == null ? "Pending" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
  return <section data-testid={variation ? "carpet-project-variations" : procurement ? "carpet-project-procurement" : "carpet-project-boq"} style={{ background: "white", border: "1px solid #cbd5e1", borderRadius: 12, padding: 20, fontSize: 16, overflowX: "auto" }}>
    <style>{`.carpet-project-table { min-width: 1040px; border-collapse: collapse; } .carpet-project-table th, .carpet-project-table td { padding: 12px 14px; vertical-align: top; border-bottom: 1px solid #e2e8f0; } .carpet-project-table th { background: #f1f5f9; white-space: nowrap; } .carpet-project-table td:first-child { min-width: 280px; } .carpet-project-table td:not(:first-child) { min-width: 110px; } .carpet-project-table p { margin: 5px 0; }`}</style>
    <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>{variation ? "Current carpet selection variations" : procurement ? "Carpet procurement — confirm cutting plan before ordering" : "Current project carpet schedule"}</h2>
    <p>{variation ? "Selection comparisons are shown ex GST. They remain pending until a retailer quote, order quantity and internal allowance are recorded." : "Saved Client Selections, with the room breakdown used by Quotation Builder and Procurement. Rates and totals are ex GST."}</p>
    <table className="carpet-project-table" style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Carpet / rooms</th><th>Net area</th><th>Order estimate</th><th>Internal allowance</th><th>Selected cost</th><th>Variation</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td><strong>{r.brand} {r.productLibrarySnapshot?.range} {r.colour}</strong><p>{r.fibre}</p>{(r.locationSchedule || []).map((room) => <div key={room.location}>{room.location}: {Number(room.quantity).toFixed(2)}m²</div>)}</td><td>{r.flooringOrder?.netAreaM2?.toFixed(2)}m²</td><td>{r.flooringOrder?.estimatedOrderAreaM2 == null ? "Cutting plan required" : `${r.flooringOrder.estimatedOrderAreaM2.toFixed(2)}m²`}</td><td>{money(r.carpetCosts?.internalEstimateExGst)}</td><td>{money(r.carpetCosts?.selectedCostExGst)}<p>{r.supplier || "Supplier quote required"}</p></td><td>{money(r.carpetCosts?.variationExGst)}</td></tr>)}
    </tbody></table>
  </section>;
}
