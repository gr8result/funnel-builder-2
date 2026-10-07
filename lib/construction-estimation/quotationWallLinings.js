import { createWallLiningMeasurements } from '../../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { TAKEOFF_LEVELS, EXTERIOR_WALL_SYSTEM_FIELD_KEYS, takeoffLevelWallHeightM } from './takeoffMaterialQuantities.js';

const num = (value) => Number(String(value ?? '').replace(/[$,]/g, '')) || 0;
const round = (value) => Math.round(value * 10000) / 10000;
const present = (value) => value !== '' && value !== undefined && value !== null;

export function wallLiningRowPolicy(row = {}) {
  const label = String(row.item || row.values?.[0] || '').trim();
  if (row.id === 'quote-30013' || /^R\s*1\.5\s+BATTS TO WALLS$/i.test(label)) return { key: 'totalNetExteriorWallAreaM2', type: 'batts' };
  if (row.id === 'quote-1269' || /^GYPROCK SUPPLY & FIX - EXTERIOR WALLS$/i.test(label)) return { key: 'totalExternalPlasterboardWallM2', type: 'external', rate: 22 };
  if (row.id === 'quote-1270' || /^GYPROCK SUPPLY & FIX - INTERNAL WALLS$/i.test(label)) return { key: 'totalInternalPlasterboardWallM2', type: 'internal', rate: 22 };
  if (row.id === 'quote-1271' || /^GYPROCK SUPPLY & FIX - CEILINGS$/i.test(label)) return { type: 'ceiling', rate: 22 };
  return null;
}

// Migrate in place by stable ID. Never rebuild sections, reorder lines or replace their IDs.
export function withWallLiningMappings(quotation = {}) {
  return Object.fromEntries(Object.entries(quotation).map(([name, section]) => [name, {
    ...section,
    // Display Section 67 is the DOORS group. Its legacy spreadsheet key is DOORS (71);
    // PIVOT DOOR (67) is a child, so never use the old suffix as a display section number.
    ...(/^DOORS(?:\s*\(\d+\))?$/i.test(name) ? { displayName: 'ENTRY DOORS' } : {}),
    ...(/^PIVOT DOOR(?:\s*\(67\))?$/i.test(name) && section.displayName === 'ENTRY DOORS' ? { displayName: 'PIVOT DOOR' } : {}),
    rows: (section.rows || []).map((row) => {
      const policy = wallLiningRowPolicy(row);
      if (!policy) return row;
      return {
        ...row,
        ...(policy.key ? { quantityKey: policy.key, quantity: '', importedQuantity: '', autoQuantity: true, quantityManualOverride: false, quantityFormulaOverride: false, formulas: { ...row.formulas, B: policy.key } } : {}),
        ...(policy.rate && row.wallLiningRateVersion !== 1 ? { excelRate: '$22.00', manualRate: '', supplierQuote: '', quotedSupplierRate: '', supplierCatalogueRate: '', sourceOfRate: 'workbook', wallLiningRateVersion: 1, values: Array.isArray(row.values) ? row.values.map((value, index) => index === 5 ? '$22.00' : value) : row.values } : {}),
      };
    }),
  }]));
}

export function calculateWallLinings(workbook = {}, quantities = {}) {
  const rows = workbook.data?.inputDataSheet?.rows || {};
  const raw = (key) => rows[key]?.value;
  const countText = String(raw('floorCount') || '').toLowerCase();
  const count = /three/.test(countText) ? 3 : /two|double/.test(countText) ? 2 : /single|one/.test(countText) ? 1 : num(countText.match(/\d+/)?.[0]) || Infinity;
  const registry = Object.entries(TAKEOFF_LEVELS);
  const included = registry.filter((_, index) => index < count);
  const job = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob;
  const live = Array.isArray(job?.completedWallRuns);
  const measurements = live ? createWallLiningMeasurements(job) : [];
  const systems = Object.keys(EXTERIOR_WALL_SYSTEM_FIELD_KEYS);
  const levels = included.map(([level, prefix]) => {
    let gross = 0, openings = 0, external = 0, internal = 0;
    const fields = [];
    if (live) {
      const walls = measurements.filter((item) => item.kind === 'wall' && item.level === level && item.quantity !== null);
      const exterior = walls.filter((item) => item.category === 'exterior');
      gross = exterior.reduce((sum, wall) => sum + num(wall.quantity) * (num(wall.wallHeightM) || takeoffLevelWallHeightM(prefix, rows)), 0);
      openings = measurements.filter((item) => item.kind === 'opening' && item.level === level && item.linkedWallId && item.wallCategory === 'exterior' && item.openingClass !== 'Internal Door').reduce((sum, item) => sum + num(item.openingAreaM2), 0);
      external = Math.max(0, gross - openings);
      const heightValue = num(raw(`${prefix}CeilingHeight`));
      const ceilingHeight = heightValue > 20 ? heightValue / 1000 : heightValue;
      internal = walls.filter((item) => item.category === 'interior').reduce((sum, wall) => {
        const faces = num(wall.linedFaces) || 2;
        return sum + Math.max(0, num(wall.quantity) * (num(wall.wallHeightM) || ceilingHeight) * faces - (wall.openingDeductionsEnabled ? num(wall.linkedOpeningAreaM2) * faces : 0));
      }, 0);
      fields.push('Takeoff associated wall/opening measurements', `${prefix}CeilingHeight`, `${prefix}FloorDepthMm`);
    } else {
      const measuredSystems = systems.filter((system) => present(raw(`${prefix}${system}GrossWallM2`)) || present(raw(`${prefix}${system}NetWallM2`)));
      gross = measuredSystems.length ? measuredSystems.reduce((sum, system) => sum + num(raw(`${prefix}${system}GrossWallM2`)), 0) : num(quantities[`${prefix}ExternalWallAreaM2`]);
      openings = present(raw(`${prefix}ExternalOpeningAreaM2`)) ? num(raw(`${prefix}ExternalOpeningAreaM2`)) : measuredSystems.length ? measuredSystems.reduce((sum, system) => sum + num(raw(`${prefix}${system}OpeningM2`)), 0) : num(quantities[`${prefix}WindowDoorDeductionsM2`]);
      external = Math.max(0, gross - openings);
      if (measuredSystems.length && measuredSystems.every((system) => present(raw(`${prefix}${system}NetWallM2`)))) external = measuredSystems.reduce((sum, system) => sum + num(raw(`${prefix}${system}NetWallM2`)), 0);
      internal = present(raw(`${prefix}InternalWallNetPlasterboardM2`)) ? num(raw(`${prefix}InternalWallNetPlasterboardM2`)) : num(quantities[`${prefix}InternalPlasterboardWallM2`]);
      fields.push(...(measuredSystems.length ? measuredSystems.map((system) => `${prefix}${system}GrossWallM2 / NetWallM2`) : [`${prefix}ExternalWallAreaM2`]), `${prefix}ExternalOpeningAreaM2`, `${prefix}InternalWallNetPlasterboardM2`);
    }
    return { level, prefix, gross: round(gross), openings: round(openings), net: round(Math.max(0, gross - openings)), external: round(external), internal: round(internal), fields };
  });
  const sum = (key) => round(levels.reduce((total, level) => total + level[key], 0));
  return { levels, live, gross: sum('gross'), openings: sum('openings'), quantities: { totalNetExteriorWallAreaM2: sum('net'), totalExternalPlasterboardWallM2: sum('external'), totalInternalPlasterboardWallM2: sum('internal') } };
}

export function wallLiningWorking(policy, source) {
  return source.levels.map((level) => `${level.level}: ${policy.type === 'internal' ? `${level.internal.toFixed(2)} m² net internal lining` : `${level.gross.toFixed(2)} m² gross - ${level.openings.toFixed(2)} m² exterior openings = ${level[policy.type === 'external' ? 'external' : 'net'].toFixed(2)} m² net`} [${level.fields.join(', ')}]`).join('\n') + `\n${policy.key} = ${source.quantities[policy.key].toFixed(2)} m² (openings deducted once)`;
}
