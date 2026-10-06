import React from 'react';
import { getProductLibraryCabinetryKickboardRecords } from '../../../lib/product-library/cabinetryCatalogueSelectors';
import CatalogueProductPicker, { ProductSummary } from './CatalogueProductPicker';
import { fieldClass, productSnapshot } from './cabinetryUi';

export default function KickboardStep({ configuration = {}, onUpdate }) {
  const value = configuration.kickboard || {};
  const records = getProductLibraryCabinetryKickboardRecords({ availableOnly: true });
  const aluminium = records.find((product) => /BRUSHED-ALUMINIUM/i.test(product.id || product.productCode || ''));
  function choose(type) {
    onUpdate({ type, product: type === 'brushedAluminium' ? productSnapshot(aluminium) : null });
  }
  return <div>
    <h3 className="text-lg font-semibold">Kickboards</h3>
    <label className="mt-4 block text-sm">Kickboard finish<select className={fieldClass} value={value.type || ''} onChange={(event) => choose(event.target.value)}>
      <option value="">Select kickboard finish</option><option value="matching">Matching cabinetry finish</option>
      <option value="brushedAluminium">Brushed aluminium</option><option value="catalogue">Other catalogue finish</option><option value="none">No kickboards</option>
    </select></label>
    {value.type === 'matching' && <ProductSummary product={configuration.finish} />}
    {value.type === 'brushedAluminium' && <ProductSummary product={value.product} />}
    {value.type === 'catalogue' && <CatalogueProductPicker label="Kickboard product" records={records} value={value.product} onChange={(product) => onUpdate({ ...value, product })} />}
  </div>;
}

