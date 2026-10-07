import React, { useState } from 'react';
import { getProductLibraryCabinetryColourRecords } from '../../../lib/product-library/cabinetryCatalogueSelectors';
import CatalogueProductPicker from './CatalogueProductPicker';
import { fieldClass } from './cabinetryUi';

export default function CabinetFinishStep({ configuration = {}, onUpdate }) {
  const [brand, setBrand] = useState('');
  const records = getProductLibraryCabinetryColourRecords({ brand, availableOnly: true });
  return <div>
    <h3 className="text-lg font-semibold">Cabinet Finish</h3>
    <p className="mt-1 text-sm text-slate-600">Select the external door and panel finish. Internals are specified separately.</p>
    <label className="mt-4 block text-sm">Cabinet finish brand<select className={fieldClass} value={brand} onChange={(event) => setBrand(event.target.value)}>
      <option value="">All brands</option><option value="Polytec">Polytec</option><option value="Laminex">Laminex</option>
    </select></label>
    <CatalogueProductPicker label="Cabinet finish product" records={records} value={configuration.finish} onChange={onUpdate} />
  </div>;
}

