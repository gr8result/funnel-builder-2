import React from 'react';
import { fieldClass } from './cabinetryUi';

export default function CabinetHardwareStep({ configuration = {}, onUpdate }) {
  const value = configuration.hardware || {};
  return <div>
    <h3 className="text-lg font-semibold">Hardware / Soft Close</h3>
    <p className="mt-1 text-sm text-slate-600">Record hardware requirements for the cabinetmaker.</p>
    <div className="mt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value.softCloseDoors)} onChange={(event) => onUpdate({ ...value, softCloseDoors: event.target.checked })} />Soft-close doors</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value.softCloseDrawers)} onChange={(event) => onUpdate({ ...value, softCloseDrawers: event.target.checked })} />Soft-close drawers</label>
    </div>
    <label className="mt-4 block text-sm">Drawer system<select className={fieldClass} value={value.drawerSystem || ''} onChange={(event) => onUpdate({ ...value, drawerSystem: event.target.value })}>
      <option value="">Select drawer system</option><option value="standardRunners">Standard runners</option><option value="concealedRunners">Concealed runners</option><option value="metalSided">Metal-sided drawer system</option><option value="pushToOpen">Push-to-open system</option><option value="cabinetmakerSpecification">Cabinetmaker specification</option>
    </select></label>
    <label className="mt-4 block text-sm">Hinges / hardware<select className={fieldClass} value={value.hinges || ''} onChange={(event) => onUpdate({ ...value, hinges: event.target.value })}>
      <option value="">Select hinges / hardware</option><option value="standardConcealed">Standard concealed hinges</option><option value="softCloseConcealed">Soft-close concealed hinges</option><option value="pushToOpen">Push-to-open hardware</option><option value="cabinetmakerSpecification">Cabinetmaker specification</option>
    </select></label>
    <label className="mt-4 block text-sm">Hardware notes<textarea className={fieldClass} rows="3" value={value.notes || ''} onChange={(event) => onUpdate({ ...value, notes: event.target.value })} /></label>
  </div>;
}

