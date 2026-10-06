import { discoverProductTypes, normalizeProductType, productClassification } from "./selectionProductDiscovery.js";

export const BATHROOM_ACCESSORY_PREFIX = "bathroom-accessory--";
const type = (key, label, pattern, options = {}) => ({ key, label, pattern, ...options });

// Synonyms/order only, not an inclusion whitelist. Unrecognised accessory subcategories
// become their own cards; accessory records without a subtype remain browsable in Other.
export const BATHROOM_ACCESSORY_TYPES = [
  type("towel-ladder", "Towel Ladders", /\b(?:towel ladder|heated towel (?:ladder|rack))\b/),
  type("hand-towel", "Hand Towel Rings / Rails", /\b(?:towel ring|hand towel (?:rail|holder|bar))\b/, { legacy: true }),
  type("towel-rail", "Towel Rails", /\btowel (?:rail|bar)\b/, { legacy: true }),
  type("towel-rack", "Robe / Towel Racks", /\b(?:robe|towel) rack\b/),
  type("robe-hook", "Robe / Towel Hooks", /\b(?:robe|towel|bathroom) hook\b/, { legacy: true }),
  type("spare-toilet-roll-holder", "Spare Toilet Roll Holders", /\b(?:spare|reserve|extra) (?:toilet|toilet paper|paper|toilet tissue)(?: roll)? holder\b/),
  type("toilet-roll-holder", "Toilet Roll Holders", /\b(?:toilet (?:roll|paper|tissue)|toilet paper roll|tissue roll|wc roll) holder\b/, { legacy: true }),
  type("toilet-brush", "Toilet Brushes", /\b(?:toilet|wc) brush\b/, { legacy: true }),
  type("soap-dispenser", "Soap Dispensers", /\b(?:soap|lotion) dispenser\b/),
  type("soap-dish", "Soap Dishes / Holders", /\bsoap (?:dish|holder|tray)\b/),
  type("shower-caddy", "Shower Caddies", /\bshower (?:caddy|basket|organiser|organizer)\b/),
  type("glass-shelf", "Glass Shelves", /\bglass shelf\b/, { context: true }),
  type("bathroom-shelf", "Bathroom Shelves", /\bbathroom shelf\b/),
  type("shower-shelf", "Shower Shelves", /\bshower shelf\b/, { legacy: true }),
  type("toothbrush-holder", "Toothbrush Holders", /\b(?:toothbrush|tooth brush|dental) holder\b/),
  type("tumbler", "Tumblers / Holders", /\btumbler\b/, { context: true }),
  type("accessory-set", "Accessory Sets", /\b(?:accessory|bathroom|bath) (?:set|pack|kit)\b/, { context: true }),
  type("grab-rail", "Grab Rails", /\b(?:grab|assist|safety|support) (?:rail|bar)\b/, { context: true }),
  type("hand-rail", "Hand Rails", /\b(?:hand rail|handrail)\b/, { context: true }),
  type("shower-rail", "Shower Rails", /\b(?:shower (?:rail|slider)|slide rail|slider rail)\b/, { accessoryOnly: true }),
  type("floor-waste", "Floor Wastes / Waste Grates", /\b(?:floor waste|waste grate|floor drain|shower drain|strip drain|linear drain|grate.*drain)\b/, { context: true }),
  type("shaving-mirror", "Shaving / Makeup Mirrors", /\b(?:shaving|makeup|make up|magnifying) mirror\b/, { accessoryOnly: true }),
  type("mirror", "Mirrors", /\bmirror\b/, { accessoryOnly: true }),
  type("paper-towel-holder", "Paper Towel Holders", /\bpaper towel (?:holder|dispenser)\b/, { context: true }),
  type("toilet-seat", "Toilet / Washlet Seats", /\b(?:toilet|washlet|bidet) seat\b/, { accessoryOnly: true }),
].map((entry, order) => ({ ...entry, key: entry.legacy ? entry.key : `${BATHROOM_ACCESSORY_PREFIX}${entry.key}`, order }));

export function bathroomAccessoryTypeForKey(key) {
  const known = BATHROOM_ACCESSORY_TYPES.find((entry) => entry.key === key);
  if (known) return known;
  if (!key?.startsWith(BATHROOM_ACCESSORY_PREFIX)) return null;
  const suffix = key.slice(BATHROOM_ACCESSORY_PREFIX.length);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix)) return null;
  return { key, label: suffix === "other" ? "Other Bathroom Accessories" : suffix.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), order: 1000 };
}

export function classifyBathroomAccessory(product = {}) {
  const data = productClassification(product);
  const structured = [...data.types, ...data.categories, ...data.tags].map(normalizeProductType);
  const legacy = BATHROOM_ACCESSORY_TYPES.find((entry) => entry.legacy && data.tags.some((tag) => normalizeProductType(tag) === normalizeProductType(entry.key)));
  const accessory = structured.some((value) => /\b(?:bathroom|bath|toilet|shower) accessory\b/.test(value)
    || value === "accessory" || value.startsWith("bathroom accessory ")) || Boolean(legacy);
  const bathroom = accessory || [...structured, ...data.rooms.map(normalizeProductType)].some((value) => /\b(?:bathroom|ensuite|en suite|powder room|wet area|washroom)\b/.test(value));
  const name = normalizeProductType(data.name);
  // Explicit accessory categorisation is required to override fixture classification.
  if (!accessory && [...structured, name].some((value) => /\b(?:mixer|tapware|basin|bathtub|bath tub|bath spout|toilet suite|shower system|shower set|twin shower|vanity|cistern)\b/.test(value)
    || /^(?:toilet|bath|basin|shower|tap)$/.test(value))) return null;
  // Specific product/type metadata takes precedence over broad supplier categories and legacy
  // selection tags (the old shower-shelf tag also covered liquid soap dispensers).
  for (const value of [...data.types.map(normalizeProductType), name, ...structured]) {
    const match = BATHROOM_ACCESSORY_TYPES.find((entry) => entry.pattern.test(value)
      && (!entry.accessoryOnly || accessory) && (!entry.context || bathroom));
    if (match) return match;
  }
  if (legacy) return legacy;
  if (!accessory) return null;
  const specific = [...data.types, ...data.categories].map(normalizeProductType).find((value) => value
    && !/^(?:bathroom|bath|toilet|shower)?\s*accessory$/.test(value)
    && !/^(?:bathroom|bath|interior|plumbing|fixture|product|other|general)$/.test(value));
  return bathroomAccessoryTypeForKey(`${BATHROOM_ACCESSORY_PREFIX}${specific ? specific.replace(/ /g, "-") : "other"}`);
}

export function discoverBathroomAccessoryTypes(products = []) {
  return discoverProductTypes(products, classifyBathroomAccessory);
}
