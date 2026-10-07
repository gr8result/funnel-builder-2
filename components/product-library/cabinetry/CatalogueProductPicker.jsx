import React, { useMemo, useState } from 'react';
import { fieldClass, productKey, productName, productSnapshot, humanLabel } from './cabinetryUi';

export function ProductSummary({ product }) {
  if (!product) return null;
  const image = product.imageUrl || product.primaryImageUrl || product.swatchImage;
  const price = product.clientPrice ?? product.price ?? product.rrp;
  const details = [
    ['Supplier', product.supplier || product.brand],
    ['Range', product.range || product.productRange || product.productFamily || product.style],
    ['Model / code', product.model || product.productCode || product.colourCode || product.sku],
    ['Finish', product.finish],
    ['Size', product.size],
    ['Price', price !== undefined && price !== null && price !== '' ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: product.currency || 'AUD' }).format(Number(price)) : product.priceStatus ? humanLabel(product.priceStatus) : 'Price pending'],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  return <div className="mt-3 flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
    {image && <img src={image} alt={productName(product)} width="96" height="96" loading="lazy" className="h-24 w-24 rounded object-contain" />}
    <div className="min-w-0"><p className="font-medium">{productName(product)}</p>
      <dl className="mt-1 grid gap-1 text-sm text-slate-600">{details.map(([label, value]) => <div key={label}><dt className="inline font-medium">{label}: </dt><dd className="inline">{value}</dd></div>)}</dl>
    </div>
  </div>;
}

export default function CatalogueProductPicker({ label = 'Product', records = [], value, onChange, emptyMessage = 'No verified catalogue products available.' }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? records.filter((product) => [productName(product), product.productCode, product.sku, product.range].join(' ').toLowerCase().includes(query)) : records;
  }, [records, search]);
  const visible = filtered.slice(0, 100);
  const selectedKey = productKey(value);
  return <div className="mt-3">
    {records.length > 30 && <label className="block text-sm">Search {label.toLowerCase()}<input className={fieldClass} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Colour, product name or code" /></label>}
    <label className="mt-3 block text-sm">{label}<select className={fieldClass} value={selectedKey} onChange={(event) => onChange(productSnapshot(records.find((product) => productKey(product) === event.target.value)))}>
      <option value="">Select a product</option>
      {selectedKey && !visible.some((product) => productKey(product) === selectedKey) && <option value={selectedKey}>{productName(value)} (selected)</option>}
      {visible.map((product) => <option key={productKey(product)} value={productKey(product)}>{productName(product)}</option>)}
    </select></label>
    {records.length === 0 && <p role="status" className="mt-2 text-sm text-amber-800">{emptyMessage}</p>}
    {records.length > 0 && filtered.length === 0 && <p className="mt-2 text-sm text-slate-600">No products match this search.</p>}
    {filtered.length > 100 && <p className="mt-2 text-xs text-slate-500">Showing the first 100 of {filtered.length} products. Search to narrow the list.</p>}
    <ProductSummary product={value} />
  </div>;
}

