// Balustrade systems for Client Selections (Exterior + Interior "Stairs & Balustrades").
//
// Writes data/product-library/catalogues/exterior/AU-BALUSTRADE-SYSTEMS-CATALOGUE.json and
// upgrades the two existing ProtectorAl records in AU-EXTERIOR-FINISHES-CATALOGUE.json in place
// (same product codes - reused, never duplicated).
//
// Balustrades are CONFIGURABLE SYSTEMS priced per lineal metre (LM), not fixed SKUs. Each record:
//   - names the system type (material, glass system, mounting) and a genuine reference system
//     where one was verified (supplier + URL);
//   - lists only the mounting / finish / glass / timber options that system type supports;
//   - carries an INDICATIVE ESTIMATING RATE ($/LM, supply + install, inc GST) derived from
//     published 2025-2026 Australian cost guides. It is stored as price_status "allowance_only"
//     with attributes.estimatingRate.basis = "indicative_estimating_rate" - never as a supplier
//     quoted price. Procurement replaces it with the supplier / subcontractor quotation.
import fs from "node:fs";
import path from "node:path";

const VERIFIED_AT = "2026-09-28";
const IMG = "/images/catalogues/exterior/balustrades";

// ---------------------------------------------------------------------------------------------
// Rate evidence (captured 2026-09-28). Ranges are installed $/LM inc GST as published.
// ---------------------------------------------------------------------------------------------
const SRC = {
  quoteYard: { source: "The Quote Yard - Balustrade Installation Cost NSW 2026 (published 24 Aug 2026)", url: "https://www.thequoteyard.com.au/services/balustrade-installation-cost-2026-nsw" },
  serviceTasker: { source: "ServiceTasker - How Much Do Balustrades Cost in Australia (2026 cost guide)", url: "https://servicetasker.com.au/cost-guides/how-much-do-balustrades-cost" },
  homeUpkeep: { source: "Home Upkeep - Glass Balustrade Cost in Melbourne 2026 Guide (updated 7 Jun 2026)", url: "https://homeupkeep.com.au/glass-balustrade-cost-melbourne/" },
  aquaVista: { source: "Aqua Vista Glass (Brisbane) - The Cost for Glass Balustrades (updated 4 Sep 2025)", url: "https://www.aquavistaglass.com.au/blog/glass-balustrade-cost/" },
  qhi: { source: "QHI (Queensland) - Balustrades & Handrails supplied and installed, from $220 per lineal metre", url: "https://qhi.net.au/products/balustrades-handrails-from-220-per-lineal-metre" },
};
const evidence = (key, range, appliesTo) => ({ ...SRC[key], range, appliesTo, capturedAt: VERIFIED_AT });

// One default rate per system family: a mid-point of the published ranges (QLD / Brisbane
// evidence weighted where available). These are estimating allowances only.
const RATE_FAMILIES = {
  timber: { ratePerLm: 325, evidence: [evidence("quoteYard", "$200-$450", "Timber balustrade"), evidence("serviceTasker", "$200-$450", "Timber"), evidence("qhi", "from $220", "Timber vertical balustrade, deck / landing / stairs (QLD)")] },
  aluminium: { ratePerLm: 325, evidence: [evidence("quoteYard", "$250-$450", "Aluminium balustrade"), evidence("serviceTasker", "$200-$350", "Aluminium")] },
  aluminiumBlade: { ratePerLm: 400, evidence: [evidence("quoteYard", "$250-$450", "Aluminium balustrade (blade / batten sits at the upper end)"), evidence("serviceTasker", "$200-$350", "Aluminium")] },
  steel: { ratePerLm: 300, evidence: [evidence("serviceTasker", "$230-$370", "Horizontal steel balustrades"), evidence("qhi", "from $220", "Vertical metal (BlueScope steel) panels with hardwood rail (QLD)")] },
  steelFlatBar: { ratePerLm: 350, evidence: [evidence("serviceTasker", "$230-$370", "Steel balustrades"), evidence("serviceTasker", "$350-$500", "Horizontal stainless steel balustrades")] },
  wire: { ratePerLm: 400, evidence: [evidence("quoteYard", "$300-$500", "Wire balustrade"), evidence("serviceTasker", "$300-$450", "Stainless steel cable balustrades")] },
  framedGlass: { ratePerLm: 400, evidence: [evidence("homeUpkeep", "$250-$450", "Framed glass (full aluminium frame)"), evidence("serviceTasker", "$400-$550", "Framed glass with stainless steel")] },
  semiFrameless: { ratePerLm: 525, evidence: [evidence("homeUpkeep", "$400-$650", "Semi-frameless (posts between glass)"), evidence("quoteYard", "$400-$700", "Semi frameless glass")] },
  framelessSpigot: { ratePerLm: 650, evidence: [evidence("aquaVista", "$375-$425 (standard frameless); $675-$755 (custom frameless)", "Frameless glass, Brisbane"), evidence("homeUpkeep", "$600-$900", "Fully frameless / spigot-mounted"), evidence("quoteYard", "$600-$1,000", "Frameless glass"), evidence("serviceTasker", "$700-$1,000", "Spigot bottom-mounted frameless glass")] },
  framelessChannelTop: { ratePerLm: 725, evidence: [evidence("homeUpkeep", "$550-$800", "Channel-mounted frameless"), evidence("serviceTasker", "$900-$1,200", "Channel-mounted frameless")] },
  framelessSideMount: { ratePerLm: 750, evidence: [evidence("aquaVista", "$375-$425 (standard frameless); $675-$755 (custom frameless)", "Frameless / pin-fixed glass, Brisbane"), evidence("serviceTasker", "$600-$900", "Glass side-mounted double-pressure bracket (frameless)"), evidence("serviceTasker", "$800-$1,100", "Side-mounted frameless glass")] },
  framelessChannelFascia: { ratePerLm: 850, evidence: [evidence("serviceTasker", "$800-$1,100", "Side-mounted frameless glass"), evidence("serviceTasker", "$900-$1,200", "Channel-mounted frameless")] },
};

const APPLICATIONS = {
  internalStairs: "Internal stairs", externalStairs: "External stairs", balcony: "Balcony", void: "Void",
  upperPatio: "Upper patio", deck: "Deck", verandah: "Verandah",
};
const A = APPLICATIONS;

function system(fields) {
  const {
    code, order, name, systemType, material, glassSystem = null, mountingOptions, defaultMounting = mountingOptions[0],
    applications, finishOptions, glassOptions = [], timberOptions = null, rateFamily, description, image, imageSource,
    reference = null, supplier = reference?.brand || "Balustrade installer (quote)", brand = reference?.brand || "Builder-configured system",
    notes = [], existingRecord = null,
  } = fields;
  const rate = RATE_FAMILIES[rateFamily];
  const mountingLabel = defaultMounting;
  return {
    ...(existingRecord || {}),
    product_code: code,
    family_key: "balustrades",
    requirement_keys: "balustrades",
    category_key: "Balustrades",
    top_level_area: "exterior",
    manufacturer: reference?.brand || "",
    brand,
    supplier,
    range: systemType,
    product_name: name,
    model: reference?.name || systemType,
    description,
    colour: "",
    finish: finishOptions[0] || "",
    configuration: glassSystem ? `${glassSystem.toLowerCase()}_${material.toLowerCase()}` : material.toLowerCase(),
    material,
    primary_image_url: `${IMG}/${image}`,
    thumbnail_url: `${IMG}/${image}`,
    image_source_url: imageSource,
    image_source_type: existingRecord?.image_source_type || "supplier_or_installer_project_photo",
    image_verified_at: VERIFIED_AT,
    image_status: "verified_range",
    official_product_url: reference?.url || existingRecord?.official_product_url || "",
    specification_url: reference?.url || existingRecord?.specification_url || "",
    supplier_url: existingRecord?.supplier_url || reference?.url || "",
    client_price: rate.ratePerLm,
    price_status: "allowance_only",
    price_unit: "LM",
    currency: "AUD",
    gst_included: "true",
    price_verified_at: VERIFIED_AT,
    country: "AU",
    regions: "AU;QLD",
    active: "true",
    discontinued: "false",
    archived: "false",
    source_type: existingRecord?.source_type || "configurable_system_catalogue",
    source_name: existingRecord?.source_name || (reference ? `${reference.brand} ${reference.name}` : "Builder-configured balustrade system"),
    source_url: existingRecord?.source_url || reference?.url || "",
    source_retrieved_at: VERIFIED_AT,
    source_verified_at: VERIFIED_AT,
    attributes: {
      ...(existingRecord?.attributes || {}),
      recordType: "balustrade_system",
      selectionModel: "configurable_system",
      clientSelectionOrder: order,
      systemType,
      material,
      glassSystem,
      mountingOptions,
      defaultMounting: mountingLabel,
      applications,
      finishOptions,
      glassOptions,
      ...(timberOptions ? { timberOptions } : {}),
      referenceSystem: reference,
      priceUnit: "LM",
      estimatingRate: {
        ratePerLm: rate.ratePerLm,
        basis: "indicative_estimating_rate",
        label: "Indicative estimating rate - supply and install, inc GST",
        family: rateFamily,
        setAt: VERIFIED_AT,
        evidence: rate.evidence,
        note: "Market allowance for preliminary estimating and client selections. Not a supplier quoted price; replace with the supplier / subcontractor quotation at procurement.",
      },
      priceBasis: "Indicative estimating rate inc GST (supply and install)",
      keySpec: `${systemType} · ${mountingLabel} · ${applications.slice(0, 3).join(" / ")}`,
      compliance: "Height, openings and loads must meet NCC / AS 1170.1; confirm with the installer for each location.",
      notes,
      optionalRequirement: true,
    },
  };
}

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, json, crlf = false) => {
  const text = `${JSON.stringify(json, null, 2)}\n`;
  fs.writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text);
};

const finishesFile = path.resolve("data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json");
const finishes = read(finishesFile);
const existing = (code) => finishes.products.find((product) => product.product_code === code) || null;

const POWDER_COAT = ["Black powder coat", "White powder coat", "Monument powder coat", "Other Dulux powder-coat colour (to order)"];
const GLASS_CLEAR = ["Clear toughened safety glass"];

const upgradedExisting = [
  system({
    existingRecord: existing("BALUSTRADE-PROTECTORAL-GLASS"), code: "BALUSTRADE-PROTECTORAL-GLASS", order: 30,
    name: "Frameless glass balustrade — spigot, top mounted (ProtectorAl)", systemType: "Frameless Glass — Spigot Top Mounted",
    material: "Glass", glassSystem: "Frameless", mountingOptions: ["Top mounted (spigot)", "Face mounted (side spigot)"],
    applications: [A.balcony, A.deck, A.upperPatio, A.verandah],
    finishOptions: ["Stainless steel (mirror polish)", "Black aluminium", "White aluminium"], glassOptions: ["12 mm Grade A toughened, heat soaked (AS 2208)"],
    rateFamily: "framelessSpigot",
    description: "Frameless 12 mm toughened glass panels on spigots, 950 or 1050 mm high; panels 600-1200 mm wide. Hardware in mirror-polish stainless or black / white aluminium.",
    image: "frameless-glass-spigot-top-mount.jpg", imageSource: "https://protectoraluminium.com.au/products/glass-balustrade/",
    reference: { brand: "ProtectorAl", name: "Glass Balustrade", url: "https://protectoraluminium.com.au/products/glass-balustrade/" },
  }),
  system({
    existingRecord: existing("BALUSTRADE-PROTECTORAL-ALUMINIUM"), code: "BALUSTRADE-PROTECTORAL-ALUMINIUM", order: 100,
    name: "Aluminium vertical picket balustrade (ProtectorAl)", systemType: "Aluminium — Vertical Picket",
    material: "Aluminium", mountingOptions: ["Top mounted (base-plated posts)", "Face mounted (side-fixed posts)"],
    applications: [A.balcony, A.deck, A.verandah, A.externalStairs, A.upperPatio],
    finishOptions: ["Black powder coat", "White powder coat", "Other colours (to order)"], rateFamily: "aluminium",
    description: "Powder-coated aluminium balustrade panels and posts that sleeve together (950 or 1050 mm high).",
    image: "aluminium-vertical-picket.jpg", imageSource: "https://protectoraluminium.com.au/products/aluminium-balustrade/",
    reference: { brand: "ProtectorAl", name: "Aluminium Balustrade", url: "https://protectoraluminium.com.au/products/aluminium-balustrade/" },
  }),
];

const systems = [
  // ---------------- GLASS ----------------
  system({
    code: "BALUSTRADE-GLASS-FRAMED-ALUMINIUM", order: 10, name: "Framed glass balustrade — aluminium frame", systemType: "Framed Glass — Aluminium Framed",
    material: "Glass", glassSystem: "Framed", mountingOptions: ["Top mounted (base-plated posts)", "Face mounted (side-fixed posts)"],
    applications: [A.balcony, A.deck, A.upperPatio, A.verandah, A.void], finishOptions: POWDER_COAT, glassOptions: [...GLASS_CLEAR, "Translucent / frosted (to order)"],
    rateFamily: "framedGlass",
    description: "Glass infill held in a continuous aluminium frame: posts, bottom rail and handrail, glazed with rubber wedges. Powder-coated frame.",
    image: "framed-glass-aluminium.jpg", imageSource: "https://railsafe.com.au/product-category/framed-glass/",
    reference: { brand: "Railsafe", name: "Framed Glass balustrade", url: "https://railsafe.com.au/product-category/framed-glass/" },
  }),
  system({
    code: "BALUSTRADE-GLASS-SEMI-FRAMELESS-POSTS", order: 20, name: "Semi-frameless glass balustrade — post mounted", systemType: "Semi-Frameless Glass — Post Mounted",
    material: "Glass", glassSystem: "Semi-Frameless", mountingOptions: ["Top mounted (base-plated posts)", "Face mounted (side-fixed posts)", "Core drilled posts"],
    applications: [A.balcony, A.deck, A.upperPatio, A.verandah, A.externalStairs],
    finishOptions: ["Black powder-coated aluminium posts", "White powder-coated aluminium posts", "Stainless steel posts (satin / mirror)"], glassOptions: GLASS_CLEAR,
    rateFamily: "semiFrameless",
    description: "Toughened glass panels clamped between posts with a continuous top handrail. Aluminium or stainless posts.",
    image: "semi-frameless-glass-posts.webp", imageSource: "https://www.glassoutlet.com.au/glass-balustrade",
    reference: { brand: "Glass Outlet", name: "Australis semi-frameless glass balustrade", url: "https://www.glassoutlet.com.au/glass-balustrade" },
  }),
  system({
    code: "BALUSTRADE-GLASS-FRAMELESS-CHANNEL-TOP", order: 40, name: "Frameless glass balustrade — channel, top mounted", systemType: "Frameless Glass — Channel Top Mounted",
    material: "Glass", glassSystem: "Frameless", mountingOptions: ["Top mounted (base channel)"],
    applications: [A.balcony, A.deck, A.upperPatio, A.void], finishOptions: ["Clear anodised aluminium channel", "Black channel cladding (to order)"], glassOptions: ["12 mm toughened", "Laminated toughened (per engineering)"],
    rateFamily: "framelessChannelTop",
    description: "Glass set in a continuous deck-mounted aluminium base channel with adjustable glazing - no spigots or posts.",
    image: "frameless-glass-channel-top-mount.png", imageSource: "https://glasshouseau.com/products/deck-mount-channel-kit",
    reference: { brand: "Glass House AU", name: "VersaTilt deck mount channel kit", url: "https://glasshouseau.com/products/deck-mount-channel-kit" },
  }),
  system({
    code: "BALUSTRADE-GLASS-FRAMELESS-CHANNEL-FASCIA", order: 50, name: "Frameless glass balustrade — channel, fascia / face mounted", systemType: "Frameless Glass — Channel Face Mounted",
    material: "Glass", glassSystem: "Frameless", mountingOptions: ["Face mounted (fascia channel)"],
    applications: [A.balcony, A.upperPatio, A.void], finishOptions: ["Clear anodised aluminium channel", "Black channel cladding (to order)"], glassOptions: ["12 mm toughened", "Laminated toughened (per engineering)"],
    rateFamily: "framelessChannelFascia",
    description: "Aluminium channel fixed to the face of the slab or balcony edge, keeping the full floor area clear; glass sits outside the edge.",
    image: "frameless-glass-channel-fascia-mount.jpg", imageSource: "https://glasshouseau.com/products/face-mount-channel-kit",
    reference: { brand: "Glass House AU", name: "VersaTilt face mount channel kit", url: "https://glasshouseau.com/products/face-mount-channel-kit" },
  }),
  system({
    code: "BALUSTRADE-GLASS-FRAMELESS-SIDE-PINS", order: 60, name: "Frameless glass balustrade — side mounted pins / standoffs", systemType: "Frameless Glass — Side Mounted (Pins)",
    material: "Glass", glassSystem: "Frameless", mountingOptions: ["Side mounted (standoff pins)", "Face mounted (standoff pins)"],
    applications: [A.balcony, A.externalStairs, A.deck, A.upperPatio, A.void],
    finishOptions: ["Stainless steel pins (316 / 2205)", "Black pins (to order)"], glassOptions: ["15 mm toughened, drilled for standoffs", "Laminated toughened (per engineering)"],
    rateFamily: "framelessSideMount",
    description: "Drilled toughened glass fixed to the balcony edge or stair stringer with stainless standoff pins - the glass floats beside the edge.",
    image: "frameless-glass-side-mount-pins-external.jpg", imageSource: "https://www.aussiestairs.com.au/balustrades/glass-balustrades",
    reference: { brand: "Aussie Stairs", name: "Glass balustrades (side-mounted)", url: "https://www.aussiestairs.com.au/balustrades/glass-balustrades" },
  }),
  system({
    code: "BALUSTRADE-GLASS-FRAMELESS-STAIR-SIDE-PINS", order: 70, name: "Frameless glass stair balustrade — side mounted to stringer", systemType: "Frameless Glass — Stair Side Mounted",
    material: "Glass", glassSystem: "Frameless", mountingOptions: ["Stair mounted (stringer pins)"],
    applications: [A.internalStairs, A.externalStairs, A.void],
    finishOptions: ["Stainless steel pins", "Black pins (to order)"], glassOptions: ["Toughened, drilled and raked to the stair"],
    rateFamily: "framelessSideMount",
    description: "Raked glass panels pinned to the stair stringer, continuing to the void or landing.",
    image: "frameless-glass-side-mount-pins-stair.jpg", imageSource: "https://www.aussiestairs.com.au/balustrades/glass-balustrades",
    reference: { brand: "Aussie Stairs", name: "Glass balustrades (stair)", url: "https://www.aussiestairs.com.au/balustrades/glass-balustrades" },
    notes: ["Rate applies per raked LM of stair plus landing / void run."],
  }),
  // ---------------- ALUMINIUM / STEEL ----------------
  system({
    code: "BALUSTRADE-ALUMINIUM-BATTEN-BLADE", order: 110, name: "Aluminium batten / blade balustrade", systemType: "Aluminium — Vertical Batten",
    material: "Aluminium", mountingOptions: ["Top mounted (base-plated posts)", "Face mounted (side-fixed posts)"],
    applications: [A.balcony, A.deck, A.verandah, A.upperPatio], finishOptions: ["Black powder coat", "White powder coat", "Other colours (to order)"],
    rateFamily: "aluminiumBlade",
    description: "Vertical aluminium batten infill panels (1050 mm high batten panel in the reference range) for a contemporary finish.",
    image: "aluminium-batten-blade.jpg", imageSource: "https://protectoraluminium.com.au/products/aluminium-balustrade/",
    reference: { brand: "ProtectorAl", name: "Batten balustrade panel", url: "https://protectoraluminium.com.au/products/aluminium-balustrade/" },
  }),
  system({
    code: "BALUSTRADE-ALUMINIUM-TRADITIONAL-VERTICAL", order: 120, name: "Aluminium balustrade — traditional vertical (Queenslander style)", systemType: "Aluminium — Traditional Vertical",
    material: "Aluminium", mountingOptions: ["Top mounted (base-plated posts)", "Face mounted (side-fixed posts)"],
    applications: [A.verandah, A.balcony, A.deck], finishOptions: ["White powder coat", "Other colours (to order)"],
    rateFamily: "aluminium",
    description: "Low-maintenance aluminium balustrade with a traditional vertical look for verandahs and character homes.",
    image: "aluminium-horizontal-rail.jpg", imageSource: "https://www.slatwerx.com.au/products/aire%e2%84%a2-aluminium-balustrade-system",
    reference: { brand: "Slatwerx", name: "AIRE aluminium balustrade system", url: "https://www.slatwerx.com.au/products/aire%e2%84%a2-aluminium-balustrade-system" },
  }),
  system({
    code: "BALUSTRADE-STEEL-VERTICAL-PANELS-HARDWOOD-RAIL", order: 130, name: "Steel vertical panel balustrade with hardwood top rail", systemType: "Steel — Vertical Panels, Hardwood Rail",
    material: "Steel", mountingOptions: ["Top mounted (timber posts)", "Face mounted (to deck frame)"],
    applications: [A.deck, A.externalStairs, A.verandah, A.balcony], finishOptions: ["White", "Cream", "Black"],
    rateFamily: "steel",
    description: "Fabricated BlueScope steel vertical panels between timber posts with a hardwood top rail - a common Queensland deck balustrade.",
    image: "steel-vertical-panels-hardwood-rail.jpg", imageSource: "https://qhi.net.au/products/balustrades-handrails-from-220-per-lineal-metre",
    reference: { brand: "QHI", name: "Vertical metal panels (BlueScope steel)", url: "https://qhi.net.au/products/balustrades-handrails-from-220-per-lineal-metre" },
  }),
  system({
    code: "BALUSTRADE-STEEL-FLAT-BAR-VERTICAL", order: 140, name: "Powder-coated steel flat bar balustrade", systemType: "Steel — Vertical Flat Bar",
    material: "Steel", mountingOptions: ["Top mounted (base plates)", "Face mounted (side-fixed)", "Stair mounted"],
    applications: [A.balcony, A.externalStairs, A.internalStairs, A.void, A.upperPatio], finishOptions: ["Black powder coat", "Other Dulux powder-coat colour (to order)"],
    rateFamily: "steelFlatBar",
    description: "Custom-fabricated vertical flat bar steel balustrade with a steel top rail, powder coated.",
    image: "steel-flat-bar-vertical.webp", imageSource: "https://weldingmen.com.au/black-flat-bar-balustrades-sydney/",
    reference: { brand: "Weldingmen", name: "Black flat bar balustrades", url: "https://weldingmen.com.au/black-flat-bar-balustrades-sydney/" },
  }),
  system({
    code: "BALUSTRADE-STAINLESS-WIRE-TIMBER-POSTS", order: 150, name: "Stainless wire balustrade with timber posts", systemType: "Stainless Wire — Timber Posts",
    material: "Steel", mountingOptions: ["Top mounted (timber posts)"],
    applications: [A.deck, A.verandah, A.upperPatio], finishOptions: ["Stainless steel wire (316)"],
    rateFamily: "wire",
    description: "Tensioned 316 stainless wire between timber posts under a timber top rail.",
    image: "stainless-wire-timber-posts.jpg", imageSource: "https://www.miamistainless.com.au/glass-balustrade",
    reference: { brand: "Miami Stainless", name: "Wire balustrade", url: "https://www.miamistainless.com.au/" },
    notes: ["Horizontal wire can be climbable: not permitted where the floor is more than 4 m above the surface below (NCC)."],
  }),
  // ---------------- TIMBER (configurable, trade built) ----------------
  system({
    code: "BALUSTRADE-TIMBER-VERTICAL-PAINTED", order: 200, name: "Timber vertical balustrade — painted (deck / stairs)", systemType: "Timber — Square Vertical Balusters, Painted",
    material: "Timber", mountingOptions: ["Top mounted (timber posts)", "Stair mounted"],
    applications: [A.deck, A.externalStairs, A.verandah, A.balcony], finishOptions: ["Paint - colour to schedule"],
    timberOptions: {
      species: ["Pre-primed treated pine (external)"], postSize: ["90 × 90 mm", "100 × 100 mm"], handrailProfile: ["Flat top rail", "Rounded / bullnose rail"],
      balusterProfile: ["Square vertical baluster"], balusterSpacing: ["Maximum 125 mm gap (NCC)"], finish: ["Painted"], use: ["External"],
    },
    rateFamily: "timber",
    description: "Pre-primed pine posts, rails and square vertical balusters, painted - the traditional Queensland deck and stair balustrade. Built by the carpenter.",
    image: "timber-vertical-painted-deck.jpg", imageSource: "https://qhi.net.au/products/balustrades-handrails-from-220-per-lineal-metre",
    supplier: "Carpentry (builder)", brand: "Trade built",
  }),
  system({
    code: "BALUSTRADE-TIMBER-TRADITIONAL-VERANDAH", order: 210, name: "Traditional timber verandah balustrade — painted", systemType: "Timber — Traditional Turned / Dowel",
    material: "Timber", mountingOptions: ["Top mounted (timber posts)"],
    applications: [A.verandah, A.balcony], finishOptions: ["Paint - colour to schedule"],
    timberOptions: {
      species: ["Treated pine (external)", "Hardwood"], postSize: ["90 × 90 mm", "100 × 100 mm"], handrailProfile: ["Traditional moulded rail"],
      balusterProfile: ["Turned baluster", "Dowel / square"], balusterSpacing: ["Maximum 125 mm gap (NCC)"], finish: ["Painted"], use: ["External"],
    },
    rateFamily: "timber",
    description: "Traditional painted timber balustrade with moulded rail - suits Queenslanders, Federation and heritage homes.",
    image: "timber-traditional-verandah-painted.png", imageSource: "https://woodturn.com.au/collections/balustrading-1",
    reference: { brand: "Classic Woodcraft", name: "Timber balustrading (rails, posts, balusters)", url: "https://woodturn.com.au/collections/balustrading-1" },
    supplier: "Carpentry (builder)",
  }),
  system({
    code: "BALUSTRADE-TIMBER-STAIR-STAINED", order: 220, name: "Timber stair balustrade — stained / natural", systemType: "Timber — Stair Balustrade, Stained",
    material: "Timber", mountingOptions: ["Stair mounted", "Top mounted (newel posts)"],
    applications: [A.internalStairs, A.void], finishOptions: ["Stain - colour to schedule", "Clear / natural finish"],
    timberOptions: {
      species: ["Tasmanian Oak", "Spotted Gum", "Blackbutt", "Other hardwood (to order)"], postSize: ["Newel post to design"], handrailProfile: ["Profile to supplier range (e.g. 100+ profiles)"],
      balusterProfile: ["Turned baluster", "Square baluster"], balusterSpacing: ["Maximum 125 mm gap (NCC)"], finish: ["Stained", "Clear"], use: ["Internal"],
    },
    rateFamily: "timber",
    description: "Hardwood handrail, newels and balusters for internal stairs and voids, stained or clear finished.",
    image: "timber-stair-stained.jpg", imageSource: "https://sunstatetimbers.com.au/timber-handrails-and-balustrades/",
    reference: { brand: "Sunstate Timbers", name: "Timber handrails and balustrades (Brisbane)", url: "https://sunstatetimbers.com.au/timber-handrails-and-balustrades/" },
    supplier: "Stair / joinery supplier",
  }),
];

// Existing ProtectorAl records upgraded in place (CRLF, 2-space, like the rest of that file).
finishes.products = finishes.products.map((product) => upgradedExisting.find((item) => item.product_code === product.product_code) || product);
write(finishesFile, finishes, true);

const out = path.resolve("data/product-library/catalogues/exterior/AU-BALUSTRADE-SYSTEMS-CATALOGUE.json");
write(out, {
  catalogue: "AU-BALUSTRADE-SYSTEMS-CATALOGUE",
  generatedAt: new Date().toISOString(),
  note: "Configurable balustrade systems priced per LM at indicative estimating rates (price_status allowance_only; attributes.estimatingRate). The ProtectorAl glass and aluminium systems remain in AU-EXTERIOR-FINISHES-CATALOGUE.json and are upgraded in place by this script.",
  rateFamilies: RATE_FAMILIES,
  products: systems,
});
console.log(out, systems.length, "new systems;", upgradedExisting.length, "existing systems upgraded");
