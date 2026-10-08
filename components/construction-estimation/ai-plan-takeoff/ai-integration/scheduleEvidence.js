// AI evidence augments the existing Rooms and Custom Takeoffs sections. Geometry
// remains the sole source of measured area/length/count inputs; printed totals
// remain visible benchmarks and are never silently substituted for geometry.
export function createAiScheduleRows(analysis, pages) {
  const eligible = (item) => pages.includes(item.page) && item.basis !== 'ASSUMED' && item.confidence >= 0.5;
  const row = (item, index, section, quantity, unit, category) => ({
    ...item, section, itemId: `ai-evidence-${section}-${item.page}-${index}`,
    planSheet: item.page, category, quantity, unit, source: 'ai',
    notes: `${item.basis}; ${Math.round(item.confidence * 100)}% confidence. ${item.evidence}`,
  });
  return {
    rooms: (analysis?.rooms || []).filter(eligible).map((item, i) => row(item, i, 'Rooms', 1, 'No', item.name)),
    customTakeoffs: [
      ...(analysis?.geometryValidation?.passed ? analysis.scopeResult?.quantities || [] : []).filter((q) => pages.includes(q.page) && !['Tiles', 'Hybrid', 'Carpets', 'Polished Concrete', 'exposed Agg'].includes(q.category)).map((item, index) => ({ ...item, section: 'Custom Takeoffs', itemId: `ai-scope-${item.page}-${index}`, planSheet: item.page, source: 'ai', category: `${item.category}${item.room ? ` — ${item.room}` : ''}`, notes: item.evidence })),
      ...(analysis?.fixtures || []).filter(eligible).map((item, i) => row(item, i, 'Custom Takeoffs', item.quantity, 'No', `${item.type}${item.room ? ` — ${item.room}` : ''}`)),
      ...(analysis?.documentedQuantities || []).filter(eligible).map((item, i) => row(item, i, 'Drawing evidence', item.value, item.unit, item.label)),
    ],
  };
}

// Only these existing, non-geometric Data Input fields can be populated from a
// printed specification. Room-specific ceiling heights must not become a global
// storey height; conflicting values are kept in review.
export const DOCUMENTED_INPUT_UNITS = {
  lowerCeilingHeight: 'mm', upperCeilingHeight: 'mm', thirdCeilingHeight: 'mm',
  roofPitchDegrees: 'degrees', eavesWidthM: 'm',
};

export function documentedInputCandidates(analysis) {
  const groups = new Map();
  for (const item of analysis?.documentedQuantities || []) {
    const key = String(item.label || '').trim();
    if (!Object.hasOwn(DOCUMENTED_INPUT_UNITS, key)) continue;
    const unit = String(item.unit || '').trim().toLowerCase();
    const expected = DOCUMENTED_INPUT_UNITS[key];
    let value = Number(item.value);
    if (!(value > 0) || item.basis !== 'OBSERVED' || item.confidence < 0.8) continue;
    if (expected === 'mm' && unit === 'm') value *= 1000;
    else if (expected === 'm' && unit === 'mm') value /= 1000;
    else if (unit !== expected && !(expected === 'degrees' && ['deg', '°'].includes(unit))) continue;
    const candidates = groups.get(key) || [];
    candidates.push({ ...item, key, value, unit: expected });
    groups.set(key, candidates);
  }
  return [...groups].map(([key, candidates]) => ({ key, candidates, conflict: new Set(candidates.map((item) => item.value)).size > 1 }));
}
