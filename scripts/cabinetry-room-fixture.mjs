import { isWetAreaCabinetryLocationName, normaliseCabinetrySelection } from '../lib/builders/cabinetryWorkflow.js';

// A cabinetry selection whose rooms have every required choice made but are not yet confirmed -
// the state of a job where the client has worked through each room and is about to press Next.
// Shared by the cabinetry room navigation tests.
export const SIX_CABINETRY_ROOMS = ['Kitchen', "Butler's Pantry", 'Bathroom', 'Ensuite', 'Powder Room', 'Laundry'];

export function readyCabinetryLocation(name) {
  // Wet areas (vanities) and joinery rooms have different cabinet areas.
  const areaKey = isWetAreaCabinetryLocationName(name) ? 'floorVanityDoors' : 'lowerDoorsDrawers';
  const colour = { id: 'test-colour', colourId: 'test-colour', colourName: 'Test White', supplier: 'Polytec', productRange: 'Test range', finish: 'Matt' };
  return {
    id: `cabinetry-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, location: name, locationType: name, included: true, status: 'in_progress', confirmedAt: '',
    supplier: 'Polytec', enabledAreaKeys: [areaKey], scope: [areaKey], areaSelections: { [areaKey]: colour }, defaultColour: colour,
    ...(isWetAreaCabinetryLocationName(name) ? { bathroomScopeKeys: [] } : {
      benchtop: { range: 'Test laminate', thickness: '20 mm', colour: 'Test White', materialChoice: 'laminate' },
      handles: { base: { id: 'test-handle', productName: 'Test handle', finish: 'Black' } },
    }),
  };
}

export function readyCabinetrySelection(roomNames = SIX_CABINETRY_ROOMS) {
  return normaliseCabinetrySelection({ locations: roomNames.map(readyCabinetryLocation), scheduleApproved: true, confirmed: false });
}
