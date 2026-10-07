import React from 'react';
import { buttonClass, cabinetConfigurationGroups, fieldClass, humanLabel } from './cabinetryUi';

export default function CabinetConfigurationStep({ roomKey, configuration = {}, onUpdate }) {
  const value = configuration.configuration || {};
  const components = value.components || {};
  const quantities = value.quantities || {};
  const groups = cabinetConfigurationGroups(roomKey);
  const allowed = new Set(groups.flatMap((group) => group.options.map(([key]) => key)));
  const copiedItems = Object.entries(components).filter(([key, selected]) => selected && !allowed.has(key));
  return (
    <div>
      <h3 className="text-lg font-semibold">Cabinet Configuration</h3>
      <p className="mt-1 text-sm text-slate-600">Choose the cabinetry required in this room and record quantities where known.</p>
      {groups.map((group) => (
        <fieldset key={group.title} className="mt-5">
          <legend className="mb-2 font-medium">{group.title}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.options.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(components[key])} onChange={(event) => onUpdate({ ...value, components: { ...components, [key]: event.target.checked } })} />
                  {label}
                </label>
                {components[key] && <input className={`${fieldClass} !mt-0 !w-20`} aria-label={`${label} quantity`} type="number" min="1" step="1" placeholder="Qty" value={quantities[key] ?? ''} onChange={(event) => onUpdate({ ...value, quantities: { ...quantities, [key]: event.target.value === '' ? '' : Math.max(1, Number(event.target.value)) } })} />}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      {copiedItems.length > 0 && <aside className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Copied items needing review</p>
        <p>These selected items belong to a different room type. Remove them before saving this room.</p>
        <ul className="mt-2 space-y-2">{copiedItems.map(([key]) => <li key={key} className="flex items-center justify-between gap-3"><span>{humanLabel(key)}</span><button type="button" className={buttonClass} onClick={() => onUpdate({ ...value, components: { ...components, [key]: false } })}>Remove {humanLabel(key).toLowerCase()}</button></li>)}</ul>
      </aside>}
    </div>
  );
}
