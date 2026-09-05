export default function EntryDoorFurnitureSchedule({ workbook, title = "Entry-door furniture - supplier / purchase order schedule", review = false }) {
  const lines = workbook?.entryDoorFurnitureSchedule || [];
  if (!lines.length) return null;
  return <section data-testid={review ? "entry-door-review-schedule" : "entry-door-supplier-schedule"} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 20, overflowX: 'auto' }}>
    <h2>{title}</h2>
    <p>{review ? "Chosen inclusions saved to this job, grouped by exterior entry door." : "Saved Client Selections, grouped by scheduled door. Obtain supplier rates before ordering."}</p>
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr>{['Door', 'Level / location', 'Product', 'Model / SKU', 'Finish / lock', 'Quantity', 'Rate', 'Selection status'].map(h => <th key={h} style={{ padding: 8 }}>{h}</th>)}</tr></thead>
      <tbody>{lines.map(line => <tr key={line.id}>
        <td style={{ padding: 8 }}>{line.doorReference}</td><td>{[line.level, line.location].filter(Boolean).join(' / ')}</td>
        <td><img src={line.imageUrl} alt="" width="64" height="64" style={{ objectFit: 'contain' }} /><div>{line.brand} {line.productName}</div></td>
        <td>{line.sku || line.model}</td><td>{[line.finish, line.lockType].filter(Boolean).join(' / ')}</td><td>{line.quantity}</td>
        <td>{line.rate == null ? 'Rate required' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(line.rate)}</td><td>{line.selectionStatus}</td>
      </tr>)}</tbody></table>
  </section>;
}
