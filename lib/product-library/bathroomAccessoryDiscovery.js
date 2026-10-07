import { discoverProductTypes, normalizeProductType, productClassification } from "./selectionProductDiscovery.js";

export const BATHROOM_ACCESSORY_AREA = "bathroom-accessories";
const PREFIX = "bathroom-accessory-";

// Synonyms describe types, never individual products. Unlisted types in an accessory
// category are discovered below, so this table is not an allowlist for the range.
export const BATHROOM_ACCESSORY_TYPES = [
  ["towel-rail", "Towel Rails", /\btowel (rail|bar)\b/],
  ["heated-towel-rail", "Heated Towel Rails", /\bheated (single |double )?towel (rail|bar|rack)\b/],
  ["towel-ladder", "Towel Ladders", /\btowel ladder\b/],
  ["hand-towel", "Hand Towel Rings / Rails", /\btowel ring\b|\bhand towel (rail|holder|bar)\b/],
  ["towel-hook", "Towel Hooks", /\btowel hook\b/],
  ["robe-hook", "Robe Hooks", /\b(robe|bathroom|multi purpose|multipurpose|double) hook\b/],
  ["towel-rack", "Robe / Towel Racks", /\b(towel|robe) rack\b/],
  ["toilet-roll-holder", "Toilet Roll Holders", /\b(toilet|toilet paper|tissue|toilet tissue|paper) (roll )?holder\b/],
  ["spare-toilet-roll-holder", "Spare Toilet Roll Holders", /\b(spare|reserve|extra) (toilet |toilet paper |paper )?(roll|tissue) (holder|storage)\b/],
  ["toilet-brush", "Toilet Brushes", /\b(toilet|wc) brush\b/],
  ["soap-dish", "Soap Dishes / Holders", /\bsoap (dish|holder|tray)\b/],
  ["soap-dispenser", "Soap Dispensers", /\bsoap dispenser\b/],
  ["shower-shelf", "Shower Shelves", /\bshower shelf\b/],
  ["shower-caddy", "Shower Caddies", /\b(shower|bathroom) (caddy|basket)\b/],
  ["bathroom-shelf", "Bathroom Shelves", /\bbathroom shelf\b/],
  ["glass-shelf", "Glass Shelves", /\bglass shelf\b/],
  ["toothbrush-holder", "Toothbrush Holders", /\b(toothbrush|tooth brush) holder\b/],
  ["tumbler", "Tumblers / Holders", /\btumbler\b/],
  ["accessory-set", "Accessory Sets", /\b(accessory|bathroom) (set|pack|kit)\b/],
  ["grab-rail", "Grab Rails", /\b(grab|safety|support) (rail|bar)\b/],
  ["hand-rail", "Hand Rails", /\b(hand ?rail)\b/],
  ["shower-rail-accessory", "Shower Rails (Accessories)", /\bshower (rail|slider|slide rail)\b/],
  ["bathroom-floor-waste", "Floor Wastes / Waste Grates", /\bfloor (waste|drain)\b|\bwaste grate\b|\b(channel|linear|strip) (waste|drain)\b|\bgrate(s)? (and )?drain\b/],
  ["accessory-mirror", "Mirrors / Shaving Mirrors", /\bmirror\b/],
  ["paper-towel-holder", "Paper Towel Holders", /\bpaper towel (holder|dispenser)\b/],
  ["toilet-seat-accessory", "Toilet / Bidet Seats", /\b(washlet|bidet|toilet) seat\b/],
].map(([key, label, pattern], order) => ({ key, label, pattern, order }));

export const LEGACY_BATHROOM_ACCESSORY_KEYS = ["towel-rail", "hand-towel", "toilet-roll-holder", "robe-hook", "shower-shelf", "toilet-brush"];
const byKey = new Map(BATHROOM_ACCESSORY_TYPES.map((type) => [type.key, type]));
const generic = /^(bathroom |bath |wet area )?accessory$|^(plumbing|bathroom|bathroom ensuite|interior|product|other|shelf|shelves and soap holder)$/;
const accessoryCategory = /\b(bathroom|bath|wet area) accessory\b/;
const wetRoom = /\b(bathroom|bath|ensuite|powder room|wet area|wc)\b/;
const fixture = /\b(toilet suite|cistern|bath tub|bathtub|freestanding bath|basin|tapware|mixer|shower system|shower set|twin shower|shower rose|shower head)\b/;
const contextTypes = new Set(["hand-rail", "shower-rail-accessory", "accessory-mirror", "paper-towel-holder", "glass-shelf", "accessory-set", "toilet-seat-accessory"]);
const title = (value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function bathroomAccessoryTypeByKey(key = "") {
  if (typeof key !== "string") return null;
  if (byKey.has(key)) return byKey.get(key);
  if (key.startsWith(PREFIX) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key.slice(PREFIX.length))) {
    return { key, label: title(key.slice(PREFIX.length).replace(/-/g, " ")), order: 1000 };
  }
  return null;
}

function matchType(value) {
  // Specific variants precede their broader synonyms, independent of display order.
  const priority = ["paper-towel-holder", "spare-toilet-roll-holder", "hand-towel", "towel-ladder", "heated-towel-rail", "shower-caddy", "shower-shelf", "glass-shelf", "accessory-set"];
  return priority.map((key) => byKey.get(key)).find((type) => type.pattern.test(value))
    || BATHROOM_ACCESSORY_TYPES.find((type) => type.pattern.test(value));
}

export function classifyBathroomAccessory(product = {}) {
  const classification = productClassification(product);
  const types = classification.types.map(normalizeProductType);
  const categories = classification.categories.map(normalizeProductType);
  const tags = classification.tags.map(normalizeProductType);
  const name = normalizeProductType(classification.name);
  // Supplier accessory headings occasionally contain full fixtures or kitchen wastes.
  // Inspect the product itself before trusting a broad merchandising category.
  if (/\b(sink waste|basket waste|mixing valve|tmv|wash dry|cleaner sink)\b/.test(name)
    || /\b(pan|suite)\b.*\b(bidet|washlet|toilet)\b/.test(name)) return null;
  const structured = [...types, ...categories, ...tags];
  const bathroomContext = [...classification.rooms.map(normalizeProductType), ...categories, ...tags].some((value) => wetRoom.test(value));
  const explicitAccessory = structured.some((value) => accessoryCategory.test(value))
    || (structured.includes("accessory") && bathroomContext);
  const legacy = classification.tags.map((tag) => String(tag)).find((tag) => LEGACY_BATHROOM_ACCESSORY_KEYS.includes(tag));
  // Names refine broad supplier headings ("Shelves", "Towel Rails") into actual types.
  // Descriptions are never searched: related-product marketing must not affect membership.
  const candidates = [name, ...types, ...categories, ...tags];
  const matched = candidates.map(matchType).find(Boolean);
  // A specific accessory subtype can sit inside a broad plumbing/fixture family.
  // Marketing mentions on a complete fixture still cannot turn it into an accessory.
  const specificAccessory = [...types, name].map(matchType).some((type) => type && !contextTypes.has(type.key));
  const completeFixtureName = /\b(toilet suite|cistern|bath tub|bathtub|freestanding bath|tapware|mixer|shower system|shower set|twin shower|shower rose|shower head)\b/.test(name);
  if (completeFixtureName || (!explicitAccessory && !specificAccessory && [...types, ...categories, name].some((value) => fixture.test(value) || /^(toilet|bath|basin|shower)$/.test(value)))) return null;
  if (matched) {
    const requiresContext = contextTypes.has(matched.key);
    const context = explicitAccessory || (matched.key !== "shower-rail-accessory" && matched.key !== "accessory-mirror"
      && bathroomContext);
    if (!requiresContext || context || legacy) return matched;
  }
  if (legacy) return byKey.get(legacy);
  if (!explicitAccessory) return null;
  // A genuinely new supplier subtype gets a stable, namespaced requirement of its own.
  const subtype = [...types, ...categories].find((value) => value && !generic.test(value) && !accessoryCategory.test(value));
  const key = PREFIX + (subtype || "other-accessories").replace(/\s+/g, "-");
  return { key, label: subtype ? title(subtype) : "Other Bathroom Accessories", order: 1000 };
}

export function discoverBathroomAccessoryTypes(products = []) {
  return discoverProductTypes(products, classifyBathroomAccessory);
}
