import React, { useState } from 'react';
import { buttonClass, fieldClass, primaryButtonClass } from './cabinetryUi';

export default function CabinetryRoomList({ rooms = [], configurations = {}, savedConfigurations = {}, selectRoom, onCopy, onFinish }) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const canCopy = source && destination && source !== destination && configurations[source];
  const hasDrafts = rooms.some((room) => configurations[room.key] && configurations[room.key] !== savedConfigurations[room.key]);
  function status(room) {
    const value = configurations[room.key];
    if (!value) return 'Not started';
    if (value !== savedConfigurations[room.key]) return 'Unsaved draft';
    if (value.benchtop?.material && value.benchtop.material !== 'none' && !value.benchtop.product) return 'Material selection pending';
    if (value.legacyReviewRequired) return 'Earlier selection — review required';
    return 'Saved';
  }
  return <div data-testid="cabinetry-room-list" className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-xl font-semibold">Cabinetry Rooms</h2>
    <p className="mt-1 text-sm text-slate-600">Specify and save each room independently.</p>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rooms.map((room) => <li key={room.key}>
      <button type="button" data-testid={`cabinetry-room-${room.key}`} className="flex w-full flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50" onClick={() => selectRoom(room.key)}>
        <span className="font-semibold">{room.label}</span><span className="text-sm text-slate-600">{status(room)}</span>
      </button>
    </li>)}</ul>
    {onCopy && <fieldset className="mt-6 rounded-lg border border-slate-200 p-4"><legend className="px-1 font-medium">Copy a room specification</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Copy from room<select className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)}><option value="">Select source room</option>{rooms.filter((room) => configurations[room.key]).map((room) => <option value={room.key} key={room.key}>{room.label}</option>)}</select></label>
        <label className="text-sm">Copy to room<select className={fieldClass} value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">Select destination room</option>{rooms.filter((room) => room.key !== source).map((room) => <option value={room.key} key={room.key}>{room.label}</option>)}</select></label>
      </div>
      <p className="mt-3 text-sm text-slate-600">Copy Colours Only transfers finish selections. Copy Complete Specification also copies configuration, quantities, handles, benchtop, hardware and special features. Review and save the destination room after copying.</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={!canCopy} onClick={() => onCopy(source, destination, 'colours')}>Copy Colours Only</button><button type="button" className={buttonClass} disabled={!canCopy} onClick={() => onCopy(source, destination, 'complete')}>Copy Complete Specification</button></div>
    </fieldset>}
    {hasDrafts && <p className="mt-4 text-sm text-amber-900">Some rooms have unsaved drafts. Save each room to retain changes when you leave Client Selections.</p>}
    {onFinish && <button type="button" data-testid="cabinetry-finish" className={`${primaryButtonClass} mt-5`} onClick={onFinish}>Finish Cabinetry</button>}
  </div>;
}

