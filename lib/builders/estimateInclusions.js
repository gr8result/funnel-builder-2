export const BUILDER_INCLUSION_SECTION_TITLES = [
  "Site Works",
  "Structural",
  "Kitchen",
  "Bathroom & Ensuite",
  "Laundry",
  "Doors",
  "Electrical",
  "Roof, Windows & Garage",
  "Walls & Paint",
  "Suppliers",
];

export const BUILDER_INCLUSION_LOCAL_MODELS = {
  packages: "builder_inclusion_packages",
  sections: "builder_inclusion_sections",
  media: "builder_inclusion_media",
  suppliers: "builder_inclusion_suppliers",
};

const PLACEHOLDER_IMAGE_BASE = "/images/placeholders";

const LUXURY_SECTIONS = [
  {
    title: "Site Works",
    subtitle: "Prepared, protected and ready for construction.",
    body: "A considered site setup gives the project a clean start and helps maintain safety, access and presentation throughout the build.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/site-works.jpg`,
    layout_type: "image_left",
    bullets: ["Site establishment and temporary protection", "Construction access allowance", "Set-out coordination", "Initial site preparation", "Waste and site management allowance"],
  },
  {
    title: "Structural",
    subtitle: "The foundation of a confident build.",
    body: "Structural inclusions are selected to support a durable, well-detailed home built in accordance with engineering and approved documentation.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/structural.jpg`,
    layout_type: "image_right",
    bullets: ["Engineered slab and framing allowances", "Structural steel where documented", "Tie-down and bracing requirements", "Termite management allowance", "Compliance with relevant building standards"],
  },
  {
    title: "Kitchen",
    subtitle: "A refined centrepiece for everyday living.",
    body: "The kitchen package balances beautiful presentation with practical storage, durable surfaces and quality fittings.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/kitchen.jpg`,
    layout_type: "feature",
    bullets: ["Stone or premium benchtop allowance", "Soft-close cabinetry allowance", "Quality appliance allowance", "Feature tapware and sink allowance", "Splashback and lighting allowance"],
    media: [
      { image_url: `${PLACEHOLDER_IMAGE_BASE}/kitchen-detail.jpg`, caption: "Cabinetry and benchtop detail", media_type: "image" },
      { image_url: `${PLACEHOLDER_IMAGE_BASE}/appliances.jpg`, caption: "Appliance allowance", media_type: "image" },
    ],
  },
  {
    title: "Bathroom & Ensuite",
    subtitle: "Calm, practical and beautifully finished wet areas.",
    body: "Bathrooms and ensuites include coordinated fixtures, finishes and waterproofing allowances to support a polished result.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/bathroom.jpg`,
    layout_type: "image_left",
    bullets: ["Vanity, basin and mirror allowance", "Tapware and shower fitting allowance", "Toilet suite allowance", "Floor and wall tile allowance", "Waterproofing to wet area requirements"],
  },
  {
    title: "Laundry",
    subtitle: "Durable finishes with smart everyday utility.",
    body: "Laundry inclusions focus on storage, robust surfaces and practical fittings that support the way the home will be used.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/laundry.jpg`,
    layout_type: "image_right",
    bullets: ["Laundry tub and mixer allowance", "Cabinetry and benchtop allowance", "Tiled splashback allowance", "Washing machine tap set", "Ventilation and lighting allowance"],
  },
  {
    title: "Doors",
    subtitle: "Hardware and profiles that complete the home.",
    body: "Door inclusions provide a clean, cohesive finish across entry, internal and utility spaces.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/doors.jpg`,
    layout_type: "image_left",
    bullets: ["Entry door allowance", "Internal door allowance", "Lever hardware allowance", "Privacy sets where required", "Paint finish to internal doors and trims"],
  },
  {
    title: "Electrical",
    subtitle: "Lighting, power and comfort planned into the build.",
    body: "Electrical allowances support a practical home with considered lighting, switching and essential safety requirements.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/electrical.jpg`,
    layout_type: "image_right",
    bullets: ["Power point and switch allowance", "LED downlight allowance", "Smoke alarm allowance", "Exhaust fans where required", "External lighting allowance"],
  },
  {
    title: "Roof, Windows & Garage",
    subtitle: "Weather protection, natural light and secure access.",
    body: "External envelope inclusions bring together roofing, openings and garage access for a complete weather-ready shell.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/exterior.jpg`,
    layout_type: "feature",
    bullets: ["Roofing and gutter allowance", "Aluminium window and sliding door allowance", "Garage door and motor allowance", "Flyscreen allowance where applicable", "External sealants and finishing items"],
  },
  {
    title: "Walls & Paint",
    subtitle: "Interior surfaces finished with a cohesive palette.",
    body: "Wall and paint inclusions cover internal linings, trims and paint systems for a clean handover-ready finish.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/paint.jpg`,
    layout_type: "image_left",
    bullets: ["Plasterboard lining allowance", "Cornice and trim allowance", "Internal wall paint system", "Ceiling paint system", "External paint allowance where specified"],
  },
  {
    title: "Suppliers",
    subtitle: "Trusted supply partners coordinated into the estimate.",
    body: "Supplier references can be tailored by each builder to show the brands and trade partners used in their own inclusion package.",
    hero_image_url: `${PLACEHOLDER_IMAGE_BASE}/suppliers.jpg`,
    layout_type: "supplier_grid",
    bullets: ["Supplier logos can be added or hidden", "Categories can be grouped by trade", "Each builder controls their own package", "No product selection controls are shown in the estimate pack"],
  },
];

const LUXURY_SUPPLIERS = [
  ["Appliances", "Appliance Partner"],
  ["Plumbing", "Plumbing Supplier"],
  ["Tiles", "Tile Supplier"],
  ["Electrical", "Electrical Supplier"],
  ["Roofing", "Roofing Supplier"],
  ["Cabinetry", "Cabinetry Partner"],
];

export function createDefaultEstimateInclusions(builderId = "local-builder") {
  const packageId = "pkg-luxury-inclusions";
  return {
    selectedPackageId: packageId,
    packages: [
      {
        id: packageId,
        builder_id: builderId,
        name: "Luxury Inclusions",
        description: "Premium brochure-style inclusions package for residential estimates.",
        is_default: true,
        active: true,
      },
    ],
    sections: LUXURY_SECTIONS.map((section, index) => ({
      id: `sec-luxury-${index + 1}`,
      package_id: packageId,
      title: section.title,
      subtitle: section.subtitle,
      body: section.body,
      bullets: section.bullets,
      hero_image_url: section.hero_image_url,
      layout_type: section.layout_type,
      sort_order: index + 1,
      active: true,
    })),
    media: LUXURY_SECTIONS.flatMap((section, sectionIndex) => (section.media || []).map((item, mediaIndex) => ({
      id: `media-luxury-${sectionIndex + 1}-${mediaIndex + 1}`,
      section_id: `sec-luxury-${sectionIndex + 1}`,
      image_url: item.image_url,
      caption: item.caption,
      media_type: item.media_type || "image",
      sort_order: mediaIndex + 1,
    }))),
    suppliers: LUXURY_SUPPLIERS.map(([category, supplierName], index) => ({
      id: `supplier-luxury-${index + 1}`,
      package_id: packageId,
      supplier_name: supplierName,
      logo_url: "",
      category,
      sort_order: index + 1,
    })),
  };
}

export function normaliseEstimateInclusions(value = {}, builderId = "local-builder") {
  const defaults = createDefaultEstimateInclusions(builderId);
  const packages = Array.isArray(value.packages) && value.packages.length ? value.packages : defaults.packages;
  const selectedPackageId = value.selectedPackageId || packages.find((item) => item.is_default && item.active !== false)?.id || packages[0]?.id || defaults.selectedPackageId;
  return {
    selectedPackageId,
    packages: packages.map((item, index) => ({
      id: item.id || `pkg-${index + 1}`,
      builder_id: item.builder_id || builderId,
      name: item.name || `Inclusions Package ${index + 1}`,
      description: item.description || "",
      is_default: Boolean(item.is_default),
      active: item.active !== false,
    })),
    sections: (Array.isArray(value.sections) && value.sections.length ? value.sections : defaults.sections).map((item, index) => ({
      id: item.id || `sec-${index + 1}`,
      package_id: item.package_id || selectedPackageId,
      title: item.title || BUILDER_INCLUSION_SECTION_TITLES[index] || `Section ${index + 1}`,
      subtitle: item.subtitle || "",
      body: item.body || "",
      bullets: Array.isArray(item.bullets) ? item.bullets : String(item.bullets || "").split("\n").map((line) => line.trim()).filter(Boolean),
      hero_image_url: item.hero_image_url || "",
      layout_type: item.layout_type || "image_left",
      sort_order: Number(item.sort_order || index + 1),
      active: item.active !== false,
    })),
    media: (Array.isArray(value.media) ? value.media : defaults.media).map((item, index) => ({
      id: item.id || `media-${index + 1}`,
      section_id: item.section_id || "",
      image_url: item.image_url || "",
      caption: item.caption || "",
      media_type: item.media_type || "image",
      sort_order: Number(item.sort_order || index + 1),
    })),
    suppliers: (Array.isArray(value.suppliers) && value.suppliers.length ? value.suppliers : defaults.suppliers).map((item, index) => ({
      id: item.id || `supplier-${index + 1}`,
      package_id: item.package_id || selectedPackageId,
      supplier_name: item.supplier_name || "",
      logo_url: item.logo_url || "",
      category: item.category || "",
      sort_order: Number(item.sort_order || index + 1),
    })),
  };
}

export function selectedEstimateInclusionsPackage(estimateInclusions = {}) {
  const normalised = normaliseEstimateInclusions(estimateInclusions);
  const selectedPackage = normalised.packages.find((item) => item.id === normalised.selectedPackageId) || normalised.packages[0] || null;
  const packageId = selectedPackage?.id || normalised.selectedPackageId;
  return {
    ...normalised,
    package: selectedPackage,
    sections: normalised.sections
      .filter((section) => section.package_id === packageId && section.active !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    suppliers: normalised.suppliers
      .filter((supplier) => supplier.package_id === packageId)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
  };
}
