export const ENTRY_DOOR_STEPS = ['supplier', 'range', 'design', 'size', 'configuration', 'finish', 'glass-type', 'hardware', 'review'];

// Requirements come from the resolved model, never from the route or family alone.
export function nextIncompleteEntryDoorStep(selection, required) {
  for (const [step, field] of [['supplier','Supplier'], ['range','Range'], ['design','ProductCode']]) {
    if (!selection[field]) return step;
  }
  for (const [step, field] of [['size','Size'], ['configuration','Configuration'], ['finish','Finish']]) {
    if (required[step] && !selection[field]) return step;
  }
  // Choosing the glass is the confirmation. A separate "choose glass option" gate in front of
  // it asked the same question twice and stalled the flow after the finish was picked.
  if (required.glazing && !selection.Glazing) return 'glass-type';
  if (!selection.Hardware || !selection.HardwareConfirmed ||
      (required.hardwareFinish && !selection.FurnitureFinish) ||
      !(Number(selection.HardwareOptions?.quantity) > 0)) return 'hardware';
  return 'review';
}

export function entryDoorDraftAfterChoice(current, patch) {
  const next = {...current, ...patch};
  const fields = ['Supplier','Range','ProductCode','Size','Configuration','Finish','Glazing'];
  const changed = fields.findIndex(key => Object.hasOwn(patch, key) && patch[key] !== current[key]);
  if (changed >= 0) {
    for (const key of fields.slice(changed + 1)) if (!Object.hasOwn(patch, key)) next[key] = '';
    if (changed < fields.indexOf('Glazing')) next.GlazingConfirmed = false;
    next.HardwareConfirmed = false;
    next.Complete = false;
  }
  if (patch.Hardware !== undefined && patch.Hardware !== current.Hardware) next.HardwareConfirmed = false;
  return next;
}
