import React, { useRef, useState } from 'react';
import CabinetConfigurationStep from './CabinetConfigurationStep';
import CabinetFinishStep from './CabinetFinishStep';
import CabinetInternalsStep from './CabinetInternalsStep';
import KickboardStep from './KickboardStep';
import HandlesStep from './HandlesStep';
import BenchtopStep from './BenchtopStep';
import CabinetHardwareStep from './CabinetHardwareStep';
import CabinetSpecialFeaturesStep from './CabinetSpecialFeaturesStep';
import CabinetryRoomReview from './CabinetryRoomReview';
import { buttonClass, cabinetConfigurationGroups, cabinetFeatureOptions, humanLabel, primaryButtonClass, productKey } from './cabinetryUi';

export const CABINETRY_STEPS = [
  ['configuration', 'Configuration'], ['finish', 'Cabinet Finish'], ['internals', 'Internals / Exposed Finishes'],
  ['kickboard', 'Kickboards'], ['handles', 'Handles'], ['benchtop', 'Benchtop'],
  ['hardware', 'Hardware / Soft Close'], ['specialFeatures', 'Special Features'], ['review', 'Review'],
];
const stageComponents = { configuration: CabinetConfigurationStep, finish: CabinetFinishStep, internals: CabinetInternalsStep, kickboard: KickboardStep, handles: HandlesStep, benchtop: BenchtopStep, hardware: CabinetHardwareStep, specialFeatures: CabinetSpecialFeaturesStep };

function validationMessage(room, roomKey) {
  if (!Object.values(room.configuration?.components || {}).some(Boolean)) return 'Select at least one cabinet configuration before saving.';
  const allowedComponents = new Set(cabinetConfigurationGroups(roomKey).flatMap((group) => group.options.map(([key]) => key)));
  const incompatibleComponents = Object.entries(room.configuration?.components || {}).filter(([key, selected]) => selected && !allowedComponents.has(key));
  if (incompatibleComponents.length) return `Review Configuration and remove items that do not apply to this room: ${incompatibleComponents.map(([key]) => humanLabel(key)).join(', ')}.`;
  const invalidQuantity = Object.entries(room.configuration?.quantities || {}).find(([key, quantity]) => room.configuration?.components?.[key] && quantity !== '' && (!Number.isInteger(Number(quantity)) || Number(quantity) < 1));
  if (invalidQuantity) return `Enter a whole-number quantity of at least 1 for ${humanLabel(invalidQuantity[0]).toLowerCase()}.`;
  if (!productKey(room.finish)) return 'Select a cabinet finish product before saving.';
  if (!room.internals?.type) return 'Select the internal cabinet finish before saving.';
  if (room.internals.type === 'catalogue' && !productKey(room.internals.product)) return 'Select an internal finish product before saving.';
  if (room.internals.exposedInteriors && !productKey(room.internals.exposedFinish)) return 'Select an exposed interior finish before saving.';
  if (!room.kickboard?.type) return 'Select a kickboard finish or No kickboards before saving.';
  if (room.kickboard.type === 'catalogue' && !productKey(room.kickboard.product)) return 'Select a kickboard product before saving.';
  if (!room.handles?.system) return 'Select a handle system before saving.';
  if (['knobs', 'barHandles', 'pullHandles', 'other'].includes(room.handles.system) && !productKey(room.handles.product)) return 'Select a physical handle product before saving.';
  if (['knobs', 'barHandles', 'pullHandles', 'other'].includes(room.handles.system)) {
    if (room.handles.product.finishes?.length && !room.handles.finish) return 'Select the physical handle finish before saving.';
    if (room.handles.product.sizes?.length && !room.handles.size) return 'Select the physical handle size before saving.';
  }
  if (!room.benchtop?.material) return 'Select a benchtop material or No Benchtop before saving.';
  if (room.benchtop.material === 'stone' && !productKey(room.benchtop.product)) return 'Select a stone / sintered benchtop product before saving.';
  if (room.benchtop.material === 'laminate' && !room.benchtop.brand) return 'Select Polytec or Laminex as the laminate benchtop brand before saving.';
  if (room.benchtop.material === 'laminate' && !productKey(room.benchtop.product)) return 'Select a laminate benchtop product before saving.';
  if (room.benchtop.product?.requiresVariantSelection && !room.benchtop.product.variantId) return 'Select the benchtop material finish and sheet size before saving.';
  const allowedFeatures = new Set(cabinetFeatureOptions(roomKey).map(([key]) => key));
  const incompatibleFeatures = Object.entries(room.specialFeatures || {}).filter(([key, selected]) => selected === true && !allowedFeatures.has(key));
  if (incompatibleFeatures.length) return `Review Special Features and remove items that do not apply to this room: ${incompatibleFeatures.map(([key]) => humanLabel(key)).join(', ')}.`;
  return '';
}

// The parent owns the room specification. Async hydration is reflected directly;
// stage navigation never re-emits props or clones catalogue records into local state.
export default function CabinetryRoomWorkflow({ roomKey, roomLabel, configuration = {}, onUpdateConfiguration, onSave, onCancel, saving = false }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');
  const [savingLocally, setSavingLocally] = useState(false);
  const saveInFlight = useRef(false);
  const busy = saving || savingLocally;
  const step = CABINETRY_STEPS[stepIndex][0];
  const Stage = stageComponents[step];
  function navigate(index) { setError(''); setStepIndex(index); }
  async function handleSave() {
    if (busy || saveInFlight.current) return;
    const validation = validationMessage(configuration, roomKey);
    if (validation) { setError(validation); return; }
    saveInFlight.current = true;
    setSavingLocally(true);
    setError('');
    try {
      const result = await onSave(configuration);
      if (result === false) setError('The room could not be saved. Check the page error and try again.');
    } catch (saveError) {
      setError(saveError.message || 'The room could not be saved. Please try again.');
    } finally {
      saveInFlight.current = false;
      setSavingLocally(false);
    }
  }
  return <div data-testid="cabinetry-room-workflow" className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{roomLabel || configuration.roomLabel || roomKey} Cabinetry</h2>
      {onCancel && <button type="button" className={buttonClass} disabled={busy} onClick={onCancel}>Room List</button>}
    </div>
    <nav className="my-5 flex flex-wrap gap-2" aria-label="Cabinetry workflow stages">{CABINETRY_STEPS.map(([key, label], index) => <button type="button" key={key} className={index === stepIndex ? primaryButtonClass : buttonClass} aria-current={index === stepIndex ? 'step' : undefined} disabled={busy} onClick={() => navigate(index)}>{index + 1}. {label}</button>)}</nav>
    <div data-testid={`cabinetry-step-${step}`}>
      {step === 'review' ? <CabinetryRoomReview configuration={configuration} onSave={handleSave} saving={busy} error={error} /> : <fieldset disabled={busy} className="min-w-0 border-0 p-0"><Stage roomKey={roomKey} configuration={configuration} onUpdate={(value) => { setError(''); onUpdateConfiguration(step, value); }} /></fieldset>}
    </div>
    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
      <button type="button" data-testid="cabinetry-back" className={buttonClass} disabled={busy || stepIndex === 0} onClick={() => navigate(stepIndex - 1)}>Back</button>
      <span className="text-sm text-slate-500">Step {stepIndex + 1} of {CABINETRY_STEPS.length}</span>
      {step !== 'review' && <button type="button" data-testid="cabinetry-next" className={primaryButtonClass} disabled={busy} onClick={() => navigate(stepIndex + 1)}>Next</button>}
    </div>
  </div>;
}

