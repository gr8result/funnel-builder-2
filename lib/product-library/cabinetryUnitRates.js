// Supply-and-install rate estimates for the builder cabinetry catalogue.
//
// The cabinetry units in cabinetryCatalogueSelectors.js carry no price, so every
// cabinetmaker line lands in an estimate as "quote required". These rates give each
// unit a starting number. They are ESTIMATES, not supplier quotes - see RATE_BASIS -
// so anything derived from them keeps priceStatus "price_pending" and must be checked
// against a real cabinetmaker quote before it reaches a client.
//
// Rates are per unit, supply AND install, GST inclusive, south-east Queensland,
// excluding benchtops, appliances, sinks and tapware.

export const RATE_BASIS = {
  scope: "Supply and install per unit. Excludes benchtops, appliances, sinks and tapware.",
  region: "South-east Queensland",
  currency: "AUD",
  gstIncluded: true,
  estimatedOn: "2026-09-09",
  derivedFrom: [
    "Semi-custom cabinetry supply AUD 200-400 per linear metre; custom AUD 400-800 per linear metre.",
    "Cabinet installation AUD 50-150 per linear metre; cabinetmaker labour AUD 100-200 per hour.",
    "Door finishes: melamine AUD 150-400/m2, 2-pac polyurethane AUD 350-700/m2, Shaker/timber AUD 400-900/m2.",
    "Polyurethane doors typically 30-50 percent above melamine equivalents.",
    "Indicative 900mm vanity installed with laminate top: about AUD 1,500.",
  ],
  sourceUrls: [
    "https://servicetasker.com.au/cost-guides/how-much-does-a-kitchen-cabinet-maker-charge",
    "https://servicetasker.com.au/cost-guides/how-much-does-kitchen-cabinet-installation-cost",
    "https://www.sparky.fyi/costs/kitchen-cabinetry",
    "https://www.sparky.fyi/costs/bathroom-vanity",
  ],
  caveat: "Unverified estimates. Real rates vary by carcass material, hardware brand, unit width and installer.",
};

// Door finish drives most of the price spread. Multipliers are relative to standard
// colourboard and apply only to units with a visible door or drawer front.
export const CABINETRY_FINISH_MULTIPLIERS = {
  "Standard colourboard": 1.0,
  "Flat standard colour board": 1.0,
  "Premium decorative board": 1.18,
  "Vinyl wrap": 1.25,
  "Thermolaminated/vinyl-wrap doors": 1.25,
  "Gloss decorative board": 1.35,
  "Two-pack painted": 1.45,
  "Two-pack painted doors": 1.45,
  "Shaker/profile door": 1.65,
  "Shaker/profiled doors": 1.65,
  // Deliberately absent: "Other/custom" - no sensible default, must be quoted.
};

export const DEFAULT_CABINETRY_FINISH = "Standard colourboard";

// baseRate is the standard-colourboard rate. finishSensitive marks units whose price
// moves with the door finish; hardware, kick panels and shelving do not.
export const CABINETRY_UNIT_RATES = {
  // Kitchen / butlers pantry / laundry
  "CABINETRY-UNIT-STANDARD-BASE": { baseRate: 380, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-CORNER-UNIT": { baseRate: 560, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-SINK-CUPBOARD": { baseRate: 420, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-PULL-OUT-BIN": { baseRate: 450, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-UNDERBENCH-OVEN-CABINET": { baseRate: 520, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-DISHWASHER-CABINET": { baseRate: 300, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-MICROWAVE-CABINET": { baseRate: 480, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-RANGEHOOD-CABINET": { baseRate: 380, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-TALL-PANTRY": { baseRate: 1150, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-FOUR-BANK-DRAWERS": { baseRate: 780, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-FIVE-BANK-DRAWERS": { baseRate: 880, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-TWO-BANK-POT-DRAWERS": { baseRate: 620, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-THREE-BANK-POT-DRAWERS-ONE-SMALL-AND-TWO-LARGE": { baseRate: 740, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-HIDDEN-DRAWERS": { baseRate: 320, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-OVERHEAD": { baseRate: 290, unit: "ITEM", finishSensitive: true },

  // Bathroom / ensuite / powder room
  "CABINETRY-UNIT-BATH-FLOOR-TWO-DOOR": { baseRate: 650, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-FLOOR-ONE-DOOR": { baseRate: 480, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-FLOOR-FOUR-DRAWERS": { baseRate: 880, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-FLOOR-TOWEL-RACK": { baseRate: 210, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-WALL-TWO-DOOR": { baseRate: 700, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-WALL-ONE-DOOR": { baseRate: 520, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-WALL-THREE-DRAWER": { baseRate: 880, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-WALL-TWO-DRAWER": { baseRate: 780, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-WALL-TOWEL-DISPLAY": { baseRate: 220, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-TALL-LINEN": { baseRate: 980, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-SHAVING-TWO-DOOR": { baseRate: 620, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-SHAVING-ONE-DOOR": { baseRate: 420, unit: "ITEM", finishSensitive: true },
  "CABINETRY-UNIT-BATH-LINEN-BULKHEAD": { baseRate: 260, unit: "ITEM", finishSensitive: false },
  "CABINETRY-UNIT-BATH-OTHER-CUSTOM": { baseRate: null, unit: "ITEM", finishSensitive: true, note: "Custom unit - always quote." },

  // Laundry cabinetry and provisions
  "CABINETRY-LAUNDRY-TUB-BASE-UNIT": { baseRate: null, unit: "ITEM", finishSensitive: true, note: "No verified laundry tub base-unit rate held - quote with cabinetmaker." },
  "CABINETRY-LAUNDRY-WASHING-MACHINE-PROVISION": { baseRate: 280, unit: "ITEM", finishSensitive: true },
  "CABINETRY-LAUNDRY-DRYER-PROVISION": { baseRate: 280, unit: "ITEM", finishSensitive: true },

  // Kick panels - priced by run, not by door finish
  "CABINETRY-KICK-PANEL-BRUSHED-ALUMINIUM": { baseRate: 75, unit: "LM", finishSensitive: false },
  "CABINETRY-KICK-PANEL-STAINLESS-STEEL-LOOK": { baseRate: 75, unit: "LM", finishSensitive: false },
  "CABINETRY-KICK-PANEL-BLACK-ALUMINIUM": { baseRate: 75, unit: "LM", finishSensitive: false },

  // Bulkheads, shelving, features
  "CABINETRY-BULKHEAD-RAW-MDF": { baseRate: 185, unit: "LM", finishSensitive: false },
  "CABINETRY-SHELVING-OPEN": { baseRate: 180, unit: "ITEM", finishSensitive: true },
  "CABINETRY-SHELVING-CLEATED": { baseRate: 150, unit: "ITEM", finishSensitive: false },
  "CABINETRY-SHELVING-FLOATING": { baseRate: 240, unit: "ITEM", finishSensitive: true },
  "CABINETRY-FEATURE-WINE-RACK": { baseRate: 260, unit: "ITEM", finishSensitive: true },
  "CABINETRY-ROBE-HANGING-RAIL": { baseRate: 120, unit: "ITEM", finishSensitive: false },

  // Appliance panels
  "CABINETRY-APPLIANCE-PANEL-DISHWASHER": { baseRate: 260, unit: "ITEM", finishSensitive: true },
  "CABINETRY-APPLIANCE-PANEL-FRIDGE": { baseRate: 420, unit: "ITEM", finishSensitive: true },

  // Hardware - per door or drawer front
  "CABINETRY-HARDWARE-BLUM-SOFT-CLOSE": { baseRate: 85, unit: "EACH", finishSensitive: false },
  "CABINETRY-HARDWARE-STANDARD-RUNNERS": { baseRate: 35, unit: "EACH", finishSensitive: false },
};

/**
 * Estimated supply-and-install rate for a cabinetry unit in a given door finish.
 * Returns rate null when no defensible estimate exists, so callers show
 * "quote required" rather than inventing a number.
 */
export function getCabinetryUnitRate(unitId, finish = DEFAULT_CABINETRY_FINISH) {
  const entry = CABINETRY_UNIT_RATES[unitId];
  if (!entry) return { rate: null, unit: "ITEM", priceStatus: "quote_required", reason: "No rate held for this item." };
  if (entry.baseRate === null || entry.baseRate === undefined) {
    return { rate: null, unit: entry.unit, priceStatus: "quote_required", reason: entry.note || "Rate must be quoted." };
  }

  const multiplier = entry.finishSensitive ? CABINETRY_FINISH_MULTIPLIERS[finish] : 1;
  if (entry.finishSensitive && multiplier === undefined) {
    return { rate: null, unit: entry.unit, priceStatus: "quote_required", reason: `No multiplier for finish "${finish}".` };
  }

  return {
    rate: Math.round((entry.baseRate * multiplier) / 5) * 5,
    unit: entry.unit,
    baseRate: entry.baseRate,
    finish: entry.finishSensitive ? finish : "Finish independent",
    multiplier,
    priceStatus: "price_pending",
    reason: "Industry estimate - confirm with cabinetmaker before quoting.",
  };
}

export function listCabinetryUnitRates(finish = DEFAULT_CABINETRY_FINISH) {
  return Object.keys(CABINETRY_UNIT_RATES).map((id) => ({ id, ...getCabinetryUnitRate(id, finish) }));
}
