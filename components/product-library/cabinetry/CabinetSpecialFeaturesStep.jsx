import React from 'react';
import { buttonClass, cabinetFeatureOptions, fieldClass, humanLabel } from './cabinetryUi';

export default function CabinetSpecialFeaturesStep({ roomKey, configuration = {}, onUpdate }) {
  const value = configuration.specialFeatures || {};
  const options = cabinetFeatureOptions(roomKey);
  const allowed = new Set(options.map(([key]) => key));
  const copiedItems = Object.entries(value).filter(([key, selected]) => selected === true && !allowed.has(key));
  return <div>
    <h3 className="text-lg font-semibold">Special Features</h3>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{options.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm"><input type="checkbox" checked={Boolean(value[key])} onChange={(event) => onUpdate({ ...value, [key]: event.target.checked })} />{label}</label>)}</div>
    {copiedItems.length > 0 && <aside className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><p className="font-medium">Copied features needing review</p><p>Remove features that belong to a different room type before saving.</p><ul className="mt-2 space-y-2">{copiedItems.map(([key]) => <li key={key} className="flex items-center justify-between gap-3"><span>{humanLabel(key)}</span><button type="button" className={buttonClass} onClick={() => onUpdate({ ...value, [key]: false })}>Remove {humanLabel(key).toLowerCase()}</button></li>)}</ul></aside>}
    <label className="mt-4 block text-sm">Special feature notes<textarea className={fieldClass} rows="3" value={value.notes || ''} onChange={(event) => onUpdate({ ...value, notes: event.target.value })} /></label>
  </div>;
}

