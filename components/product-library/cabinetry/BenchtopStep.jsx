import React from 'react';
import { getProductLibraryCabinetryBenchtopRecords } from '../../../lib/product-library/cabinetryCatalogueSelectors';
import CatalogueProductPicker from './CatalogueProductPicker';
import { fieldClass, productKey, productSnapshot, productVariantSnapshot } from './cabinetryUi';

export default function BenchtopStep({ configuration = {}, onUpdate }) {
  const value = configuration.benchtop || {};
  const fabrication = value.fabrication || {};
  const brands = value.material === 'laminate' ? ['Polytec', 'Laminex'] : ['Caesarstone', 'Neolith'];
  const records = value.material && value.material !== 'none' ? getProductLibraryCabinetryBenchtopRecords({ material: value.material, brand: value.brand || '', availableOnly: true }) : [];
  const selectedRecord = records.find((record) => productKey(record) === productKey(value.product));
  const variants = selectedRecord?.variants || [];
  const updateFabrication = (key, next) => onUpdate({ ...value, fabrication: { ...fabrication, [key]: next } });
  return <div>
    <h3 className="text-lg font-semibold">Benchtop</h3>
    <label className="mt-4 block text-sm">Benchtop material<select className={fieldClass} value={value.material || ''} onChange={(event) => onUpdate({ material: event.target.value, brand: '', product: null, fabrication: {} })}>
      <option value="">Select material</option><option value="laminate">Laminate</option><option value="stone">Stone / Sintered</option><option value="none">No Benchtop</option>
    </select></label>
    {value.material && value.material !== 'none' && <>
      <label className="mt-4 block text-sm">Benchtop brand<select className={fieldClass} value={value.brand || ''} onChange={(event) => onUpdate({ ...value, brand: event.target.value, product: null })}>
        <option value="">All brands</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
      </select></label>
      <CatalogueProductPicker label="Benchtop material product" records={records} value={value.product} onChange={(product) => onUpdate({ ...value, product, brand: product?.brand || value.brand || '' })} emptyMessage={`No verified ${value.brand ? `${value.brand} ` : ''}${value.material === 'laminate' ? 'laminate benchtop' : 'stone / sintered'} catalogue products available. Material product selection remains pending.`} />
      {variants.length > 0 && <label className="mt-4 block text-sm">Material variant<select className={fieldClass} value={value.product?.variantId || ''} onChange={(event) => {
        const variant = variants.find((item) => item.id === event.target.value);
        onUpdate({ ...value, product: variant ? productVariantSnapshot(selectedRecord, variant) : productSnapshot(selectedRecord) });
      }}>
        <option value="">Select finish and sheet size</option>
        {variants.map((variant) => <option key={variant.id} value={variant.id}>{[variant.finish, variant.size, variant.thickness && `${variant.thickness} sheet`, variant.sku && `SKU ${variant.sku}`].filter(Boolean).join(' · ')}</option>)}
      </select><span className="mt-1 block text-slate-600">This is the laminate surface sheet. Specify the finished benchtop thickness below. Pricing and stock require a supplier quote.</span></label>}
      <fieldset className="mt-6"><legend className="font-medium">Fabrication specification</legend>
        <p className="mt-1 text-sm text-slate-600">Fabrication is recorded separately from the selected material product.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Thickness (mm)<input className={fieldClass} type="number" min="1" value={fabrication.thickness ?? ''} onChange={(event) => updateFabrication('thickness', event.target.value)} /></label>
          <label className="text-sm">Edge profile<select className={fieldClass} value={fabrication.edgeProfile || ''} onChange={(event) => updateFabrication('edgeProfile', event.target.value)}><option value="">Select edge profile</option><option value="square">Square</option><option value="pencilRound">Pencil round</option><option value="bevelled">Bevelled</option><option value="bullnose">Bullnose</option><option value="postformed">Postformed laminate</option><option value="other">Other / custom</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(fabrication.mitredDrop)} onChange={(event) => updateFabrication('mitredDrop', event.target.checked)} />Mitred / drop edge</label>
          {fabrication.mitredDrop && <label className="text-sm">Drop edge height (mm)<input className={fieldClass} type="number" min="1" value={fabrication.dropEdgeHeight ?? ''} onChange={(event) => updateFabrication('dropEdgeHeight', event.target.value)} /></label>}
          <label className="text-sm">Waterfall ends<select className={fieldClass} value={fabrication.waterfallEnds ?? ''} onChange={(event) => updateFabrication('waterfallEnds', event.target.value)}><option value="">Select waterfall ends</option><option value="0">None</option><option value="1">One end</option><option value="2">Both ends</option></select></label>
          <label className="text-sm">Splashback / upstand<select className={fieldClass} value={fabrication.splashbackUpstand || ''} onChange={(event) => updateFabrication('splashbackUpstand', event.target.value)}><option value="">Select splashback / upstand</option><option value="none">None</option><option value="upstand">Upstand</option><option value="splashback">Splashback</option><option value="both">Splashback and upstand</option></select></label>
          {fabrication.splashbackUpstand && fabrication.splashbackUpstand !== 'none' && <label className="text-sm">Splashback / upstand height (mm)<input className={fieldClass} type="number" min="1" value={fabrication.splashbackHeight ?? ''} onChange={(event) => updateFabrication('splashbackHeight', event.target.value)} /></label>}
        </div>
        <label className="mt-4 block text-sm">Fabrication notes<textarea className={fieldClass} rows="2" value={fabrication.notes || ''} onChange={(event) => updateFabrication('notes', event.target.value)} /></label>
      </fieldset>
    </>}
  </div>;
}

