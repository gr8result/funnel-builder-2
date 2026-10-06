import React from 'react';
import { humanLabel, primaryButtonClass, productName } from './cabinetryUi';
import { HANDLE_SYSTEMS } from './HandlesStep';

function selectedEntries(values = {}, quantities = {}) {
  return Object.entries(values).filter(([, value]) => value !== false && value !== null && value !== undefined && value !== '' && typeof value !== 'object')
    .map(([key, value]) => value === true ? `${humanLabel(key)}${quantities[key] ? ` × ${quantities[key]}` : ''}` : `${humanLabel(key)}: ${humanLabel(value)}`);
}
function productLine(label, product) {
  const name = productName(product);
  if (!name) return '';
  const code = product?.productCode || product?.colourCode || product?.sku || product?.model;
  return `${label ? `${label}: ` : ''}${name}${code ? ` (code: ${code})` : ''}`;
}
function ReviewGroup({ title, lines }) {
  const selected = lines.filter(Boolean);
  if (!selected.length) return null;
  return <section className="rounded-lg border border-slate-200 p-4"><h4 className="font-semibold">{title}</h4><ul className="mt-2 space-y-1 text-sm text-slate-700">{selected.map((line, index) => <li key={index}>{line}</li>)}</ul></section>;
}

export default function CabinetryRoomReview({ configuration = {}, onSave, saving, error }) {
  const internals = configuration.internals || {};
  const kickboard = configuration.kickboard || {};
  const handles = configuration.handles || {};
  const benchtop = configuration.benchtop || {};
  const fabrication = benchtop.fabrication || {};
  const materialPending = benchtop.material && benchtop.material !== 'none' && (!benchtop.product || (benchtop.product.requiresVariantSelection && !benchtop.product.variantId));
  const fabricationLines = [
    fabrication.thickness && `Fabricated benchtop thickness: ${fabrication.thickness} mm`,
    fabrication.edgeProfile && `Edge profile: ${humanLabel(fabrication.edgeProfile)}`,
    fabrication.mitredDrop && `Mitred / drop edge${fabrication.dropEdgeHeight ? `: ${fabrication.dropEdgeHeight} mm` : ''}`,
    fabrication.waterfallEnds !== undefined && fabrication.waterfallEnds !== '' && `Waterfall ends: ${String(fabrication.waterfallEnds) === '0' ? 'None' : fabrication.waterfallEnds}`,
    fabrication.splashbackUpstand && `Splashback / upstand: ${humanLabel(fabrication.splashbackUpstand)}${fabrication.splashbackUpstand !== 'none' && fabrication.splashbackHeight ? ` (${fabrication.splashbackHeight} mm)` : ''}`,
    fabrication.notes && `Fabrication notes: ${fabrication.notes}`,
  ];
  return <div>
    <h3 className="text-lg font-semibold">Room Cabinetry Review</h3>
    <p className="mt-1 text-sm text-slate-600">Review the selected specification for {configuration.roomLabel || configuration.roomKey || 'this room'}.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <ReviewGroup title="Configuration" lines={selectedEntries(configuration.configuration?.components, configuration.configuration?.quantities)} />
      <ReviewGroup title="Cabinet Finish" lines={[productLine('', configuration.finish)]} />
      <ReviewGroup title="Internals" lines={[
        internals.type === 'standardWhite' ? 'Standard white internals' : internals.type === 'matching' ? 'Matching coloured internals' : internals.type === 'catalogue' ? 'Catalogue internal finish' : '',
        internals.type === 'matching' && productLine('Matching internal finish', configuration.finish),
        internals.type === 'catalogue' && productLine('Internal finish', internals.product),
        internals.exposedInteriors && 'Exposed cabinet interiors',
        internals.exposedInteriors && productLine('Exposed interior finish', internals.exposedFinish),
        productLine('Open shelf finish', internals.openShelfFinish), productLine('Feature shelf finish', internals.featureShelfFinish),
      ]} />
      <ReviewGroup title="Kickboards" lines={[kickboard.type === 'matching' ? 'Matching cabinetry finish' : kickboard.type === 'none' ? 'No kickboards' : kickboard.type && humanLabel(kickboard.type), productLine('', kickboard.type === 'matching' ? configuration.finish : kickboard.product)]} />
      <ReviewGroup title="Handles" lines={[HANDLE_SYSTEMS.find(([key]) => key === handles.system)?.[1], productLine('', handles.product), handles.finish && `Finish: ${handles.finish}`, handles.size && `Size: ${handles.size}`]} />
      <ReviewGroup title="Benchtop" lines={[
        benchtop.material === 'none' ? 'No benchtop' : benchtop.material === 'stone' ? 'Stone / Sintered' : benchtop.material === 'laminate' ? 'Laminate' : '',
        benchtop.material !== 'none' && benchtop.brand, benchtop.material !== 'none' && productLine('', benchtop.product),
        benchtop.product?.size && `Material sheet size: ${benchtop.product.size}`,
        benchtop.product?.thicknessKind === 'laminate_sheet' && benchtop.product.thickness && `Laminate sheet thickness: ${benchtop.product.thickness}`,
        ...(benchtop.material && benchtop.material !== 'none' ? fabricationLines : []),
      ]} />
      <ReviewGroup title="Hardware" lines={selectedEntries(configuration.hardware)} />
      <ReviewGroup title="Special Features" lines={selectedEntries(configuration.specialFeatures)} />
    </div>
    {materialPending && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Material selection pending. Choose a verified benchtop product and its material variant before saving.</p>}
    {configuration.legacyReviewRequired && <aside className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Earlier cabinetry selection retained for review</p>
      <p>Earlier schedules, area finishes and other unsupported details are preserved with this room. Check the new specification against the original before confirming it.</p>
      {(configuration.legacySelections || []).map((selection, index) => <p key={selection.id || index} className="mt-1">{[selection.room, selection.selected_product_name || selection.product_name || selection.title, selection.selected_supplier_name || selection.brand, selection.selected_colour, selection.selected_finish, selection.description].filter(Boolean).join(' · ') || 'Original cabinetry selection retained.'}</p>)}
    </aside>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="button" data-testid="cabinetry-save" className={`${primaryButtonClass} mt-5`} disabled={saving} onClick={onSave}>{saving ? 'Saving room…' : 'Save Room'}</button>
  </div>;
}

