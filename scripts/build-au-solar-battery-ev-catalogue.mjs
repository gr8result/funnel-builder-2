// Builds data/product-library/catalogues/services/AU-SOLAR-BATTERY-EV-CATALOGUE.json
//
// Canonical Product Library range for Client Selections -> Solar & Batteries:
//   solar-system  : residential PV SYSTEMS (panel x qty + inverter) built from component records
//   home-battery  : residential batteries
//   ev-charger    : residential AC chargers
// Component records (PV module, inverters) are canonical products the systems reference by
// productCode; they carry no clientSelectionRequirement tag, so clients choose systems, not parts.
//
// Every specification below was read from the manufacturer's datasheet / technical-data page on
// the date recorded. Values a source did not state are left null - never estimated. Prices are
// only the manufacturer/retailer's PUBLISHED supply price where one was found, with its source and
// date; battery and system prices vary with installation, rebates and region, so they are
// quote_required and any published figures are kept as dated references only.
//
// Images are the manufacturer's (or an authorised AU retailer's) product image, stored locally.
import fs from "node:fs";
import path from "node:path";

const VERIFIED_AT = "2026-09-28";
const IMG = "/images/catalogues/services/solar";

function record(fields) {
  const {
    code, requirement = "", order = 0, category, manufacturer, brand = manufacturer, supplier = manufacturer,
    range = "", name, model = "", sku = model, description, image, imageSource, imageSourceType = "official_manufacturer_page",
    officialUrl, specUrl = officialUrl, sourceName, price = null, priceBasis = "", priceSourceUrl = "", priceUnit = "each",
    keySpec, facets = {}, specifications = {}, warranty = null, components = null, priceReferences = [], extra = {},
  } = fields;
  const priced = typeof price === "number";
  return {
    product_code: code,
    family_key: "solar",
    requirement_keys: requirement,
    category_key: category,
    top_level_area: "services",
    manufacturer,
    brand,
    supplier,
    range,
    product_name: name,
    model,
    sku,
    description,
    primary_image_url: `${IMG}/${image}`,
    thumbnail_url: `${IMG}/${image}`,
    image_source_url: imageSource,
    image_source_type: imageSourceType,
    image_status: "verified_exact",
    image_verified_at: VERIFIED_AT,
    official_product_url: officialUrl,
    specification_url: specUrl,
    client_price: priced ? price : null,
    rrp: priced ? price : null,
    price_status: priced ? "current" : "quote_required",
    price_unit: priceUnit,
    price_source_url: priced ? priceSourceUrl : "",
    price_verified_at: priced ? VERIFIED_AT : "",
    currency: "AUD",
    gst_included: true,
    country: "AU",
    regions: "AU",
    active: true,
    source_type: "manufacturer_datasheet",
    source_name: sourceName,
    source_url: specUrl,
    source_retrieved_at: VERIFIED_AT,
    source_verified_at: VERIFIED_AT,
    attributes: {
      ...(requirement ? { clientSelectionRequirement: requirement, clientSelectionOrder: order } : { recordType: "component" }),
      keySpec,
      selectionFacets: facets,
      specifications,
      warranty,
      ...(priced ? { priceBasis } : { priceNote: priceBasis || "Quote required: price depends on installation, switchboard, network approval and any rebates." }),
      ...(priceReferences.length ? { publishedPriceReferences: priceReferences } : {}),
      ...(components ? { components } : {}),
      ...extra,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------------------------
const TRINA = {
  code: "SOLAR-PANEL-TRINA-TSM-440NEG9R28",
  name: "Trina Solar Vertex S+ 440 W (TSM-440NEG9R.28)",
  watts: 440,
};
const INVERTERS = {
  sg5rs: { code: "SOLAR-INV-SUNGROW-SG5.0RS", name: "Sungrow SG5.0RS", kw: 5, phase: "Single phase" },
  sg6rs: { code: "SOLAR-INV-SUNGROW-SG6.0RS", name: "Sungrow SG6.0RS", kw: 6, phase: "Single phase" },
  sg8rt: { code: "SOLAR-INV-SUNGROW-SG8.0RT", name: "Sungrow SG8.0RT", kw: 8, phase: "Three phase" },
  sg10rt: { code: "SOLAR-INV-SUNGROW-SG10RT", name: "Sungrow SG10RT", kw: 10, phase: "Three phase" },
  primo5: { code: "SOLAR-INV-FRONIUS-PRIMO-GEN24-5.0-PLUS", name: "Fronius Primo GEN24 5.0 Plus", kw: 5, phase: "Single phase" },
};
const TRINA_DS = "https://static.trinasolar.com/sites/default/files/Vertex%20S+_NEG9R.28_EN_2024_Aus_B_web.pdf";
const SUNGROW_RS_DS = "https://www.sungrowpower.com/en/products/string-inverter/sg5-0-6-0rs";
const SUNGROW_RT_DS = "https://info-support.sungrowpower.com/application/pdf/2022/08/18/DS_20220818_SG5.0_7.0_8.0_10RT_Datasheet_V11_EN(AU).pdf";
const FRONIUS_PRIMO = "https://www.fronius.com/en-au/australia/solar-energy/installers-partners/technical-data/all-products/inverters/fronius-primo-gen24-plus/fronius-primo-gen24-5-0-plus";

const components = [
  record({
    code: TRINA.code, category: "Solar Components", manufacturer: "Trina Solar", range: "Vertex S+", name: TRINA.name, model: "TSM-440NEG9R.28",
    description: "N-type i-TOPCon monofacial dual-glass residential module (425-455 W range; 440 W bin used in the systems).",
    image: "trina-vertex-s-plus-neg9r28.png", imageSource: "https://pages.trinasolar.com/NEG9R.28.html",
    officialUrl: "https://pages.trinasolar.com/NEG9R.28.html", specUrl: TRINA_DS, sourceName: "Trina Solar Vertex S+ NEG9R.28 datasheet (2024 Aus)",
    keySpec: "440 W · N-type TOPCon dual glass · 1762 × 1134 × 30 mm · 21.0 kg",
    specifications: { powerW: 440, productRangeW: "425-455", cellType: "N-type i-TOPCon, 144 cells", dimensionsMm: "1762 x 1134 x 30", weightKg: 21.0, maxSystemVoltage: "1500 V DC (IEC)", temperatureCoefficientPmax: "-0.29%/°C" },
    warranty: "25 years product, 30 years power (per 2024 Aus datasheet; refer ANZ Limited Warranty Supplement)",
  }),
  record({
    code: INVERTERS.sg5rs.code, category: "Solar Components", manufacturer: "Sungrow", range: "SG RS", name: INVERTERS.sg5rs.name, model: "SG5.0RS",
    description: "Single-phase residential string inverter, 2 MPPT.", image: "sungrow-sg5-6rs.png",
    imageSource: SUNGROW_RS_DS, officialUrl: SUNGROW_RS_DS, specUrl: "https://g7solar.com/wp-content/uploads/2025/05/Datasheet-SG5.0RS.pdf",
    sourceName: "Sungrow SG5.0/6.0RS datasheet V12 (2023)", keySpec: "5 kW · single phase · 2 MPPT · IP65",
    specifications: { ratedAcPowerKw: 5, phase: "Single phase", mppt: 2, ipRating: "IP65" },
  }),
  record({
    code: INVERTERS.sg6rs.code, category: "Solar Components", manufacturer: "Sungrow", range: "SG RS", name: INVERTERS.sg6rs.name, model: "SG6.0RS",
    description: "Single-phase residential string inverter, 2 MPPT.", image: "sungrow-sg5-6rs.png",
    imageSource: SUNGROW_RS_DS, officialUrl: SUNGROW_RS_DS, specUrl: "https://g7solar.com/wp-content/uploads/2025/05/Datasheet-SG5.0RS.pdf",
    sourceName: "Sungrow SG5.0/6.0RS datasheet V12 (2023)", keySpec: "6 kW · single phase · 2 MPPT · IP65",
    specifications: { ratedAcPowerKw: 6, phase: "Single phase", mppt: 2, ipRating: "IP65" },
  }),
  record({
    code: INVERTERS.sg8rt.code, category: "Solar Components", manufacturer: "Sungrow", range: "SG RT", name: INVERTERS.sg8rt.name, model: "SG8.0RT",
    description: "Three-phase residential string inverter for 1000 Vdc systems, 2 MPPT, AFCI.", image: "sungrow-sg-rt.png",
    imageSource: "https://aus.sungrowpower.com/productDetail/2087/string-inverter-sg5-0-7-0-8-0-10rt", officialUrl: "https://aus.sungrowpower.com/productDetail/2087/string-inverter-sg5-0-7-0-8-0-10rt",
    specUrl: SUNGROW_RT_DS, sourceName: "Sungrow SG5.0/7.0/8.0/10RT datasheet V11 EN (AU)", keySpec: "8 kVA · three phase · 2 MPPT · IP65",
    specifications: { ratedAcPowerKva: 8, phase: "Three phase", mppt: 2, ipRating: "IP65", afci: true },
  }),
  record({
    code: INVERTERS.sg10rt.code, category: "Solar Components", manufacturer: "Sungrow", range: "SG RT", name: INVERTERS.sg10rt.name, model: "SG10RT",
    description: "Three-phase residential string inverter for 1000 Vdc systems, 2 MPPT, AFCI.", image: "sungrow-sg-rt.png",
    imageSource: "https://aus.sungrowpower.com/productDetail/2087/string-inverter-sg5-0-7-0-8-0-10rt", officialUrl: "https://aus.sungrowpower.com/productDetail/2087/string-inverter-sg5-0-7-0-8-0-10rt",
    specUrl: SUNGROW_RT_DS, sourceName: "Sungrow SG5.0/7.0/8.0/10RT datasheet V11 EN (AU)", keySpec: "10 kVA · three phase · 2 MPPT · IP65",
    specifications: { ratedAcPowerKva: 10, phase: "Three phase", mppt: 2, ipRating: "IP65", afci: true },
  }),
  record({
    code: INVERTERS.primo5.code, category: "Solar Components", manufacturer: "Fronius", range: "Primo GEN24 Plus", name: INVERTERS.primo5.name, model: "Primo GEN24 5.0 Plus",
    description: "Single-phase hybrid inverter, 2 MPPT, battery-ready (BYD Battery-Box Premium HVS/HVM, LG RESU FLEX), PV Point and Full Backup.",
    image: "fronius-primo-gen24-5-0-plus.webp", imageSource: FRONIUS_PRIMO, officialUrl: FRONIUS_PRIMO,
    sourceName: "Fronius Australia technical data - Primo GEN24 5.0 Plus", keySpec: "5 kW · single phase hybrid · 2 MPPT · IP66",
    specifications: { ratedAcPowerKw: 5, phase: "Single phase", mppt: 2, maxPvGeneratorKwp: 7.5, hybrid: true, compatibleBatteries: ["BYD Battery-Box Premium HVS/HVM", "LG RESU FLEX"], backup: "PV Point; Full Backup with battery and switchover components", ipRating: "IP66", weightKg: 15.38, dimensionsMm: "474 x 530 x 165", monitoring: "Fronius Solar.web (WLAN / Ethernet)" },
  }),
];

// ---------------------------------------------------------------------------------------------
// Solar PV systems: panel x quantity + inverter. Array sizes keep DC:AC within the CEC 133% limit.
// ---------------------------------------------------------------------------------------------
function system({ code, order, panels, inverter, monitoring, extra = {} }) {
  const inv = INVERTERS[inverter];
  const dcKw = Math.round(panels * TRINA.watts) / 1000;
  const ratio = Math.round((dcKw / inv.kw) * 1000) / 10;
  const invComponent = components.find((item) => item.product_code === inv.code);
  return record({
    code, requirement: "solar-system", order, category: "Solar PV Systems", manufacturer: `Trina Solar / ${invComponent.manufacturer}`,
    brand: invComponent.manufacturer, supplier: "Solar installer (quote)", range: `${dcKw.toFixed(2)} kW system`,
    name: `${dcKw.toFixed(2)} kW Solar PV System — ${panels} × Trina Vertex S+ 440 W + ${inv.name}`,
    model: `${panels}x TSM-440NEG9R.28 + ${invComponent.model}`, sku: code,
    description: `Approximately ${dcKw.toFixed(1)} kW residential solar system: ${panels} × ${TRINA.name} with a ${inv.name} ${inv.phase.toLowerCase()} inverter (${inv.kw} kW). Array-to-inverter ratio ${ratio}%.`,
    image: "trina-vertex-s-plus-neg9r28.png", imageSource: "https://pages.trinasolar.com/NEG9R.28.html",
    officialUrl: "https://pages.trinasolar.com/NEG9R.28.html", specUrl: TRINA_DS,
    sourceName: "System composed from the Trina Vertex S+ and inverter manufacturer datasheets",
    priceUnit: "system",
    keySpec: `${dcKw.toFixed(2)} kW DC · ${panels} × 440 W · ${inv.kw} kW ${inv.phase.toLowerCase()} inverter`,
    facets: { Phase: inv.phase, "System size": `${Math.round(dcKw)} kW class`, Inverter: invComponent.manufacturer },
    specifications: {
      systemNominalCapacityKw: dcKw, panelModel: TRINA.name, panelWattage: TRINA.watts, panelQuantity: panels,
      inverterModel: inv.name, inverterCapacityKw: inv.kw, phase: inv.phase, arrayToInverterRatioPct: ratio, monitoring,
    },
    warranty: "Panel: 25 years product / 30 years power (Trina 2024 Aus datasheet). Inverter: per manufacturer warranty.",
    components: [
      { role: "pv-module", productCode: TRINA.code, productName: TRINA.name, quantity: panels, unitW: TRINA.watts },
      { role: "inverter", productCode: inv.code, productName: inv.name, quantity: 1, capacityKw: inv.kw, phase: inv.phase },
    ],
    extra: { systemType: "grid_connected_pv", ...extra },
  });
}

const systems = [
  system({ code: "SOLAR-SYSTEM-6.6KW-SUNGROW-SG5RS", order: 10, panels: 15, inverter: "sg5rs", monitoring: "Sungrow online monitoring" }),
  system({ code: "SOLAR-SYSTEM-6.6KW-FRONIUS-PRIMO-GEN24", order: 20, panels: 15, inverter: "primo5", monitoring: "Fronius Solar.web", extra: { batteryReady: true, compatibleBatteries: ["BYD Battery-Box Premium HVS/HVM", "LG RESU FLEX"] } }),
  system({ code: "SOLAR-SYSTEM-7.9KW-SUNGROW-SG6RS", order: 30, panels: 18, inverter: "sg6rs", monitoring: "Sungrow online monitoring" }),
  system({ code: "SOLAR-SYSTEM-10.1KW-SUNGROW-SG8RT", order: 40, panels: 23, inverter: "sg8rt", monitoring: "Sungrow online monitoring" }),
  system({ code: "SOLAR-SYSTEM-13.2KW-SUNGROW-SG10RT", order: 50, panels: 30, inverter: "sg10rt", monitoring: "Sungrow online monitoring" }),
];

// ---------------------------------------------------------------------------------------------
// Home batteries
// ---------------------------------------------------------------------------------------------
const PW3_DS = "https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/en-au/Powerwall-3-Datasheet-AU-EN.pdf";
const SBR_DS = "https://info-support.sungrowpower.com/application/pdf/2022/04/21/DS_20220421_SBR096_128_160_192_224_256_Datasheet_V13_EN.pdf";
const SIGEN_DS = "https://www.sigenergy.com/uploads/en_download/1693548782125366.pdf";
const BYD_DS = "https://www.bydbatterybox.com/uploads/downloads/230530_BYD_Battery-Box_Premium_HVS&HVM_Datasheet_V1.7_EN-647eedf90f9c3.pdf";
const GOODWE_DS = "https://www.goodwe.com.au/Ftp/Downloads/Datasheet/AU/GW_Lynx-F-G2-Series_Datasheet-AU.pdf";
const ENPHASE_DS = "https://solarproof.com.au/datasheets/battery_datasheet_Enphase%20IQ%20Battery%205P.pdf";
const ALPHA_DS = "https://www.energyaustralia.com.au/sites/default/files/2023-07/Alpha%20G3.pdf";

function battery(fields) {
  const s = fields.specifications;
  return record({
    requirement: "home-battery", category: "Home Batteries", ...fields,
    facets: {
      Chemistry: s.chemistry || "Not stated",
      "Integrated inverter": s.integratedInverter ? "Yes" : "No",
      Phase: s.phase || "Per inverter",
      "Usable capacity": `${Math.floor(s.usableCapacityKwh / 5) * 5}-${Math.floor(s.usableCapacityKwh / 5) * 5 + 5} kWh`,
    },
  });
}

const batteries = [
  battery({
    code: "BATTERY-TESLA-POWERWALL-3", order: 10, manufacturer: "Tesla", range: "Powerwall", name: "Tesla Powerwall 3 (13.5 kWh)", model: "Powerwall 3", sku: "1707000-xx-y",
    description: "Integrated solar inverter and battery. Whole-home backup with Backup Gateway 2. Expandable with Powerwall 3 units and Expansion units.",
    image: "tesla-powerwall-3.webp", imageSource: "https://www.gstore.com.au/tesla-powerwall-3-13-5kwh-energy-storage-system/", imageSourceType: "authorised_retailer_listing",
    officialUrl: "https://www.tesla.com/en_au/powerwall", specUrl: PW3_DS, sourceName: "Tesla Powerwall 3 Datasheet AU EN (2025)",
    keySpec: "13.5 kWh usable · 11.04 kW continuous · integrated 20 kW DC solar inverter · single phase",
    specifications: { usableCapacityKwh: 13.5, nominalCapacityKwh: 14, continuousOutputKw: 11.04, integratedInverter: true, maxSolarInputKwDc: 20, mppt: 3, phase: "Single phase", backup: "Whole-home backup via Backup Gateway 2", expandable: "Up to 4 Powerwall 3 units; up to 3 Expansion units (max 7 units)", chemistry: null, ipRating: "IP55 enclosure / IP67 battery & power electronics", dimensionsMm: "1105 x 609 x 193", weightKg: 130 },
    warranty: "10 years",
    priceReferences: [
      { price: 11159, basis: "Installed, after federal rebate (Grow Energy listing)", url: "https://growenergy.com.au/products/tesla-powerwall-3", capturedAt: VERIFIED_AT },
      { price: 12938, basis: "Installed with rebate, Sydney NSW (Solar Battery Supermarket listing)", url: "https://solarbatterysupermarket.com.au/products/tesla-powerwall-3-13-5kwh-solar-battery", capturedAt: VERIFIED_AT },
    ],
  }),
  ...[["SBR096", 9.6, 5.76, 114, "625 x 545 x 330", 10], ["SBR128", 12.8, 7.68, 147, "625 x 675 x 330", 20], ["SBR192", 19.2, 11.52, 213, "625 x 935 x 330", 30]].map(([model, kwh, kw, kg, dims, orderOffset]) => battery({
    code: `BATTERY-SUNGROW-${model}`, order: 20 + orderOffset / 10, manufacturer: "Sungrow", range: "SBR", name: `Sungrow ${model} High Voltage Battery (${kwh} kWh)`, model,
    description: "Modular high-voltage LFP battery (3.2 kWh modules). Pairs with a compatible Sungrow hybrid inverter.",
    image: "sungrow-sbr-battery.png", imageSource: "https://www.sungrowpower.com/au/en/products/residential-energy-storage-system/b-sbr064-096-128-160-192-224-256",
    officialUrl: "https://www.sungrowpower.com/au/en/products/residential-energy-storage-system/b-sbr064-096-128-160-192-224-256", specUrl: SBR_DS,
    sourceName: "Sungrow SBR096-256 datasheet V13 (2022)",
    keySpec: `${kwh} kWh usable · ${kw} kW rated DC · LFP · IP55`,
    specifications: { usableCapacityKwh: kwh, ratedDcPowerKw: kw, maxContinuousCurrentA: 30, chemistry: "LFP (LiFePO4)", integratedInverter: false, compatibleInverter: "Compatible Sungrow hybrid inverter", depthOfDischarge: "Up to 100% (settable)", expandable: "3-8 modules per unit, up to 4 units in parallel (9-100 kWh)", ipRating: "IP55", weightKg: kg, dimensionsMm: dims, phase: null },
    warranty: "10 years",
  })),
  ...[["1 × BAT 8.0", 7.8, 8.06, 4, 1], ["2 × BAT 8.0", 15.6, 16.12, 8, 2]].map(([label, usable, total, kw, count]) => battery({
    code: `BATTERY-SIGENERGY-SIGENSTOR-BAT8-X${count}`, order: 40 + count, manufacturer: "Sigenergy", range: "SigenStor", name: `Sigenergy SigenStor ${label} (${usable} kWh)`, model: "SigenStor BAT 8.0",
    description: `Stackable LFP battery modules (7.8 kWh usable each) for the SigenStor system; requires the SigenStor Energy Controller (hybrid inverter). ${count} module${count > 1 ? "s" : ""}.`,
    image: "sigenergy-sigenstor.png", imageSource: "https://www.sigenergy.com/en/products/sigenstor",
    officialUrl: "https://www.sigenergy.com/en/products/sigenstor", specUrl: SIGEN_DS, sourceName: "Sigenergy SigenStor BAT 5.0/8.0 datasheet",
    keySpec: `${usable} kWh usable · ${kw} kW charge/discharge · LFP · IP66`,
    specifications: { usableCapacityKwh: usable, nominalCapacityKwh: total, continuousOutputKw: kw, modules: count, chemistry: "LFP (LiFePO4)", integratedInverter: false, compatibleInverter: "SigenStor Energy Controller (single or three phase)", phase: "Single or three phase (per Energy Controller)", expandable: "Up to 6 modules per stack", ipRating: "IP66" },
  })),
  ...[["HVS 10.2", 10.24, 4, 167], ["HVS 12.8", 12.8, 5, 205]].map(([model, kwh, modules, kg], index) => battery({
    code: `BATTERY-BYD-${model.replace(/\s+/g, "-")}`, order: 50 + index, manufacturer: "BYD", range: "Battery-Box Premium HVS", name: `BYD Battery-Box Premium ${model} (${kwh} kWh)`, model,
    description: `High-voltage LFP battery, ${modules} × 2.56 kWh HVS modules. Compatible with listed 1- and 3-phase high-voltage inverters (e.g. Fronius GEN24 Plus).`,
    image: "byd-battery-box-premium-hvs.png", imageSource: "https://www.bydbatterybox.com/",
    officialUrl: "https://www.bydbatterybox.com/", specUrl: BYD_DS, sourceName: "BYD Battery-Box Premium HVS/HVM datasheet V1.7",
    keySpec: `${kwh} kWh usable · 25 A max output · LFP · IP55`,
    specifications: { usableCapacityKwh: kwh, modules, maxOutputCurrentA: 25, chemistry: "LFP (cobalt-free)", integratedInverter: false, compatibleInverter: "BYD Battery-Box Premium HVS/HVM compatible inverter list (incl. Fronius GEN24 Plus)", phase: "1 or 3 phase (per inverter)", expandable: "Up to 3 identical HVS in parallel (max 38.4 kWh)", backup: "On-grid + backup / off-grid capable (per datasheet applications)", ipRating: "IP55", weightKg: kg },
    warranty: "10 years",
  })),
  ...[["LX F9.6-H-20", 9.6, 6.72, 120], ["LX F12.8-H-20", 12.8, 8.96, 154]].map(([model, kwh, kw, kg], index) => battery({
    code: `BATTERY-GOODWE-${model.replace(/[\s.]+/g, "-")}`, order: 60 + index, manufacturer: "GoodWe", range: "Lynx Home F G2", name: `GoodWe Lynx Home F G2 ${model} (${kwh} kWh)`, model,
    description: "Stackable high-voltage LFP battery (3.2 kWh modules) for compatible GoodWe EH and ET series hybrid inverters.",
    image: "goodwe-lynx-home-f-g2.png", imageSource: "https://www.goodwe.com.au/lynxf-g2-series",
    officialUrl: "https://www.goodwe.com.au/lynxf-g2-series", specUrl: GOODWE_DS, sourceName: "GoodWe Lynx F G2 Series datasheet AU (V2.1, 2026-06-30)",
    keySpec: `${kwh} kWh usable · ${kw} kW nominal · LFP · IP55`,
    specifications: { usableCapacityKwh: kwh, nominalPowerKw: kw, maxContinuousCurrentA: 35, chemistry: "LFP (LiFePO4)", integratedInverter: false, compatibleInverter: "GoodWe EH / ET series (see compatibility list)", phase: "Per inverter", expandable: "6.4-28.8 kWh per stack; up to 8 towers in parallel", ipRating: "IP55", weightKg: kg, roundTripEfficiency: "94%" },
  })),
  battery({
    code: "BATTERY-ENPHASE-IQ-BATTERY-5P", order: 70, manufacturer: "Enphase", range: "IQ Battery", name: "Enphase IQ Battery 5P (5.0 kWh)", model: "IQBATTERY-5P-1P-ROW",
    description: "All-in-one AC-coupled battery with six embedded grid-forming IQ8D-BAT microinverters. Backup, self-consumption and time-of-use modes.",
    image: "enphase-iq-battery-5p.png", imageSource: "https://enphase.com/en-au/store/storage/iq-battery-5p-flexphase",
    officialUrl: "https://enphase.com/en-au/store/storage/iq-battery-5p-flexphase", specUrl: ENPHASE_DS, sourceName: "Enphase IQ Battery 5P data sheet AU/NZ (2023)",
    keySpec: "5.0 kWh usable · 3.84 kVA continuous · AC-coupled · LFP",
    specifications: { usableCapacityKwh: 5.0, continuousOutputKva: 3.84, peakOutputKva: 7.68, chemistry: "LFP (lithium iron phosphate)", integratedInverter: true, phase: "Single phase", backup: "Supports backup mode", expandable: "Modular - add IQ Battery 5P units", dimensionsMm: "980 x 550 x 188" },
    warranty: "15-year limited warranty",
  }),
  battery({
    code: "BATTERY-ALPHAESS-SMILE-G3-S5", order: 80, manufacturer: "AlphaESS", range: "SMILE-G3", name: "AlphaESS SMILE-G3-S5 (10.1 kWh module, 5 kW hybrid)", model: "SMILE-G3-S5 + SMILE-G3-BAT-10.1P",
    description: "Hybrid inverter (5 kW) with 10.1 kWh LFP battery module, UPS backup, expandable to 60.5 kWh.",
    image: "alphaess-smile-g3-s5.png", imageSource: "https://voltxenergy.com.au/products/alpha-ess-home-solar-battery-system", imageSourceType: "authorised_retailer_listing",
    officialUrl: "https://alphaess.au/products/smile-g3-s5", specUrl: ALPHA_DS, sourceName: "AlphaESS SMILE-G3 residential datasheet (AU)",
    keySpec: "9.6 kWh usable · 5 kW hybrid inverter · UPS backup · LFP",
    specifications: { usableCapacityKwh: 9.6, nominalCapacityKwh: 10.1, continuousOutputKw: 5, integratedInverter: true, maxPvInputKw: 10, phase: "Single phase", backup: "UPS", expandable: "10.1-60.5 kWh", chemistry: "LFP (LiFePO4)", ipRating: "IP65", depthOfDischarge: "95%" },
    warranty: "5 years product, 10 years battery performance",
  }),
];

// ---------------------------------------------------------------------------------------------
// EV chargers
// ---------------------------------------------------------------------------------------------
const chargers = [
  record({
    code: "EV-TESLA-GEN3-WALL-CONNECTOR-7M", requirement: "ev-charger", order: 10, category: "EV Chargers", manufacturer: "Tesla", supplier: "JET Charge", range: "Wall Connector",
    name: "Tesla Gen 3 Wall Connector (7.3 m tethered)", model: "Gen 3 Wall Connector", sku: "TESAC022700300",
    description: "Wi-Fi connected AC charger for single- or three-phase supply, up to 32 A (installer adjustable).",
    image: "tesla-gen3-wall-connector.png", imageSource: "https://store.jetcharge.com.au/products/tesla-gen-3-wall-connector", imageSourceType: "authorised_retailer_listing",
    officialUrl: "https://store.jetcharge.com.au/products/tesla-gen-3-wall-connector", specUrl: "https://static.getpylon.com/datasheets/evchargers/Tesla-Gen3_WallConnector_AU_NZ-5.pdf",
    sourceName: "Tesla Gen 3 Wall Connector AU/NZ product specifications",
    price: 800, priceBasis: "Published retail price inc GST, supply only (installation extra)", priceSourceUrl: "https://store.jetcharge.com.au/products/tesla-gen-3-wall-connector",
    keySpec: "Up to 32 A · ~7.4 kW single phase / ~22 kW three phase · Type 2 tethered 7.3 m · Wi-Fi",
    facets: { Phase: "Single or three phase", Connector: "Type 2 tethered", "Solar-aware": "Not stated on spec sheet" },
    specifications: { maxCurrentA: 32, phase: "1-phase 230 V or 3-phase 400 V", approxPowerKw: "~7.4 kW single phase / ~22 kW three phase (32 A)", connector: "Type 2, tethered 7.3 m", smart: "Wi-Fi 2.4 GHz", solarIntegration: null, loadManagement: null, rcd: "Integrated (Type A + 6 mA DC)", ipRating: "IP55", weightKg: 6.8 },
  }),
  record({
    code: "EV-MYENERGI-ZAPPI-7KW-TETHERED", requirement: "ev-charger", order: 20, category: "EV Chargers", manufacturer: "myenergi", supplier: "Energy Outlet", range: "zappi",
    name: "myenergi zappi v2.1 7 kW (tethered 6.5 m)", model: "zappi 2H07TW-A", sku: "2H07TW-A",
    description: "Solar-aware EV charger: ECO+ charges only from surplus solar, ECO blends surplus and grid, FAST charges at full rate. Supplied with clip-on grid sensor.",
    image: "myenergi-zappi-7kw.jpg", imageSource: "https://energyoutlet.com.au/products/myenergi-zappi-7kw-w-6-5m-type-2-cable-inbuilt-wifi-white", imageSourceType: "authorised_retailer_listing",
    officialUrl: "https://energyoutlet.com.au/products/myenergi-zappi-7kw-w-6-5m-type-2-cable-inbuilt-wifi-white", specUrl: "https://www.solarchoice.net.au/wp-content/uploads/myenergi-zappi-Datasheet-Rev-English-REV-A.pdf",
    sourceName: "myenergi zappi datasheet DS-00010 Rev A (Oct 2024)",
    price: 1554, priceBasis: "Published retail price inc GST, supply only (installation extra)", priceSourceUrl: "https://energyoutlet.com.au/products/myenergi-zappi-7kw-w-6-5m-type-2-cable-inbuilt-wifi-white",
    keySpec: "7 kW single phase · Type 2 tethered 6.5 m · ECO / ECO+ solar charging · Wi-Fi",
    facets: { Phase: "Single phase", Connector: "Type 2 tethered", "Solar-aware": "Yes" },
    specifications: { powerKw: 7, phase: "Single phase", connector: "Type 2, tethered 6.5 m", smart: "Wi-Fi / Ethernet, myenergi app, scheduling", solarIntegration: "ECO+ (surplus solar only) and ECO (surplus + minimum grid)", loadManagement: "Clip-on grid sensor(s) supplied", batteryCompatible: "Works alongside battery storage" },
  }),
  record({
    code: "EV-WALLBOX-PULSAR-PLUS-7.4KW", requirement: "ev-charger", order: 30, category: "EV Chargers", manufacturer: "Wallbox", supplier: "Energy Outlet", range: "Pulsar Plus",
    name: "Wallbox Pulsar Plus 7.4 kW (5 m tethered)", model: "Pulsar Plus", sku: "PLP1-0-2-2-9-002",
    description: "Compact smart charger with myWallbox app (Wi-Fi / Bluetooth). Eco-Smart solar charging and Power Boost dynamic load management with the relevant accessory.",
    image: "wallbox-pulsar-plus.png", imageSource: "https://energyoutlet.com.au/products/wallbox-pulsar-plus-7-4kw-single-phase-type-2-smart-ev-charger", imageSourceType: "authorised_retailer_listing",
    officialUrl: "https://energyoutlet.com.au/products/wallbox-pulsar-plus-7-4kw-single-phase-type-2-smart-ev-charger", specUrl: "https://energyoutlet.com.au/products/wallbox-pulsar-plus-7-4kw-single-phase-type-2-smart-ev-charger",
    sourceName: "Energy Outlet Wallbox Pulsar Plus listing",
    price: 1549, priceBasis: "Published retail price inc GST, supply only (installation extra)", priceSourceUrl: "https://energyoutlet.com.au/products/wallbox-pulsar-plus-7-4kw-single-phase-type-2-smart-ev-charger",
    keySpec: "7.4 kW single phase · Type 2 tethered 5 m · Eco-Smart solar · Wi-Fi / Bluetooth",
    facets: { Phase: "Single phase", Connector: "Type 2 tethered", "Solar-aware": "Yes" },
    specifications: { powerKw: 7.4, phase: "Single phase", connector: "Type 2, tethered 5 m", smart: "myWallbox app, Wi-Fi / Bluetooth", solarIntegration: "Eco-Smart (100% solar or solar + grid)", loadManagement: "Power Boost / Power Sharing (accessory dependent)" },
  }),
  record({
    code: "EV-FRONIUS-WATTPILOT-HOME-11J", requirement: "ev-charger", order: 40, category: "EV Chargers", manufacturer: "Fronius", range: "Wattpilot",
    name: "Fronius Wattpilot Home 11 J", model: "Wattpilot Home 11 J",
    description: "Wall-mounted charger with dynamic PV-surplus charging and automatic 1-/3-phase switching; works with Fronius inverters and Solar.web.",
    image: "fronius-wattpilot-home-11-j.webp", imageSource: "https://www.fronius.com/en-au/australia/solar-energy/installers-partners/technical-data/all-products/solutions/fronius-wattpilot/fronius-wattpilot/wattpilot-home-11-j",
    officialUrl: "https://www.fronius.com/en-au/australia/solar-energy/installers-partners/technical-data/all-products/solutions/fronius-wattpilot/fronius-wattpilot/wattpilot-home-11-j",
    sourceName: "Fronius Australia technical data - Wattpilot Home 11 J",
    keySpec: "3.68 kW single / 11 kW three phase · Type 2 socket · PV-surplus charging · IP65",
    facets: { Phase: "Single or three phase", Connector: "Type 2 socket", "Solar-aware": "Yes" },
    specifications: { powerKw: "3.68 (1-phase) / 11 (3-phase)", currentA: "6-16 A", phase: "1 or 3 phase, automatic switching", connector: "Type 2 infrastructure socket with mechanical lock", smart: "WLAN, OCPP 1.6 J", solarIntegration: "Dynamic PV surplus charging 1.38-11 kW", loadManagement: null, ipRating: "IP65", dimensionsMm: "155 x 287 x 109", weightKg: 1.85 },
    priceBasis: "Quote required: no clear published AU supply price for this model.",
  }),
];

const products = [...systems, ...batteries, ...chargers, ...components];
const catalogue = {
  catalogue: "AU-SOLAR-BATTERY-EV-CATALOGUE",
  generatedAt: new Date().toISOString(),
  note: "Canonical Product Library range for Client Selections > Solar & Batteries. Specifications from manufacturer datasheets (see each record's source_url / specification_url). Prices only where a published supply price was found (price_source_url, price_verified_at); otherwise quote_required.",
  officialSources: Array.from(new Set(products.flatMap((item) => [item.specification_url, item.official_product_url]).filter(Boolean))),
  products,
};
const out = path.resolve("data/product-library/catalogues/services/AU-SOLAR-BATTERY-EV-CATALOGUE.json");
fs.writeFileSync(out, `${JSON.stringify(catalogue, null, 2)}\n`);
const counts = products.reduce((acc, item) => ({ ...acc, [item.requirement_keys || "component"]: (acc[item.requirement_keys || "component"] || 0) + 1 }), {});
console.log(out, counts);
