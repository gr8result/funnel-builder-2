import React, { useMemo } from 'react';
import { getProductLibraryCabinetryHandleRecords } from '../../../lib/product-library/cabinetryCatalogueSelectors';
import CatalogueProductPicker from './CatalogueProductPicker';
import { fieldClass } from './cabinetryUi';

export const HANDLE_SYSTEMS = [['handleless', 'Handleless'], ['fingerPull', 'Finger pull'], ['integratedPull', 'Integrated pull'], ['knobs', 'Knobs'], ['barHandles', 'Bar handles'], ['pullHandles', 'Pull handles'], ['other', 'Other catalogue handle']];
export default function HandlesStep({ configuration = {}, onUpdate }) {
  const value = configuration.handles || {};
  const catalogue = getProductLibraryCabinetryHandleRecords({ availableOnly: true });
  const records = useMemo(() => catalogue.filter((record) => {
    const style = record.style || '';
    if (value.system === 'knobs') return /knob/i.test(style);
    if (value.system === 'barHandles') return /bar/i.test(style);
    if (value.system === 'pullHandles') return /pull/i.test(style);
    return true;
  }), [catalogue, value.system]);
  const physical = ['knobs', 'barHandles', 'pullHandles', 'other'].includes(value.system);
  const currentProduct = catalogue.find((record) => record.productId === value.product?.productId || record.id === value.product?.id) || value.product;
  const finishes = currentProduct?.finishes || [];
  const sizes = (currentProduct?.sizes || []).filter((size) => value.system === 'knobs' ? /knob/i.test(size) : value.system === 'other' || !/knob/i.test(size));
  return <div>
    <h3 className="text-lg font-semibold">Handles</h3>
    <label className="mt-4 block text-sm">Handle system<select className={fieldClass} value={value.system || ''} onChange={(event) => onUpdate({ system: event.target.value, product: null, finish: '', size: '' })}>
      <option value="">Select handle system</option>{HANDLE_SYSTEMS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
    </select></label>
    {physical && <>
      <CatalogueProductPicker label="Handle product" records={records} value={value.product} onChange={(product) => onUpdate({ ...value, product, finish: '', size: '' })} />
      {value.product && <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Handle finish<select className={fieldClass} value={value.finish || ''} onChange={(event) => onUpdate({ ...value, finish: event.target.value })}><option value="">Select finish</option>{finishes.map((finish) => <option key={finish} value={finish}>{finish}</option>)}</select></label>
        <label className="text-sm">Handle size<select className={fieldClass} value={value.size || ''} onChange={(event) => onUpdate({ ...value, size: event.target.value })}><option value="">Select size</option>{sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>}
    </>}
  </div>;
}

