import React from 'react';
import { getProductLibraryCabinetryColourRecords } from '../../../lib/product-library/cabinetryCatalogueSelectors';
import CatalogueProductPicker, { ProductSummary } from './CatalogueProductPicker';
import { fieldClass } from './cabinetryUi';

export default function CabinetInternalsStep({ configuration = {}, onUpdate }) {
  const value = configuration.internals || {};
  const records = getProductLibraryCabinetryColourRecords({ availableOnly: true });
  return <div>
    <h3 className="text-lg font-semibold">Internals / Exposed Finishes</h3>
    <label className="mt-4 block text-sm">Internal cabinet finish<select className={fieldClass} value={value.type || ''} onChange={(event) => onUpdate({ ...value, type: event.target.value, product: null })}>
      <option value="">Select internal finish</option><option value="standardWhite">Standard white internals</option>
      <option value="matching">Matching coloured internals</option><option value="catalogue">Different catalogue finish</option>
    </select></label>
    {value.type === 'matching' && <><p className="mt-2 text-sm text-slate-600">Use the selected external cabinetry colour for internals, subject to board availability.</p><ProductSummary product={configuration.finish} /></>}
    {value.type === 'catalogue' && <CatalogueProductPicker label="Internal finish product" records={records} value={value.product} onChange={(product) => onUpdate({ ...value, product })} />}
    <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value.exposedInteriors)} onChange={(event) => onUpdate({ ...value, exposedInteriors: event.target.checked })} />Exposed cabinet interiors</label>
    {value.exposedInteriors && <CatalogueProductPicker label="Exposed interior finish" records={records} value={value.exposedFinish} onChange={(product) => onUpdate({ ...value, exposedFinish: product })} />}
    <CatalogueProductPicker label="Open shelf finish" records={records} value={value.openShelfFinish} onChange={(product) => onUpdate({ ...value, openShelfFinish: product })} />
    <CatalogueProductPicker label="Feature shelf finish" records={records} value={value.featureShelfFinish} onChange={(product) => onUpdate({ ...value, featureShelfFinish: product })} />
  </div>;
}

