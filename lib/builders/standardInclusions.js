export const STANDARD_INCLUSION_SECTION_TITLES = [
  "Highlight Inclusions",
  "General Inclusions",
  "Site Preparation & Foundations",
  "Structural & External",
  "Energy & Comfort",
  "Kitchen",
  "Electrical",
  "Robes & Linen Cupboards",
  "Plumbing & Drainage",
  "Bathroom, Ensuite & WC",
  "Windows, Doors & Locks",
  "Internal",
  "Painting",
  "Roofing",
  "Laundry",
  "Driveway",
  "External Finishes",
  "Your Selections Process",
];

const PACKAGE_ID = "std-premier-range-inclusions";
const PLACEHOLDER = "/images/placeholders";
const DEFAULT_COVER_TITLE = "Premier Range Inclusions";
const DEFAULT_COVER_SUBTITLE = "Premier Range Inclusions Schedule";
const LEGACY_LONG_COVER_INTRO = "Our Standard Inclusions Schedule outlines the quality fixtures, fittings, finishes and construction standards included within this Project Estimate. Every estimate is prepared using this Mid Range Standard Inclusions package to provide a clear and consistent pricing basis. Your final product selections and any approved upgrades or downgrades will be confirmed during the Selections Process and fully documented within your Formal Quotation before your Building Contract is prepared.";
const DEFAULT_COVER_INTRO = "Our Premier Range Inclusions Schedule outlines the fixtures, finishes and construction standards included as the baseline for your Project Estimate. It gives you a clear view of the quality included before your final selections are confirmed in the Formal Quotation.";
const DEFAULT_COVER_TAGLINE = "Premier range.\nPersonalised by choice.";
const DEFAULT_COVER_IMAGE = "/assets/builders/standard-inclusions-hero.jpg";
const DEFAULT_BUILDER_PHONE = "1300 1231 456";
const PREMIER_INTRO_IMAGE = "/assets/builders/standard-inclusions-premier-living.jpg";
const PREMIER_INTRO_HEADING = "Premier Inclusions";
const LEGACY_LONG_PREMIER_INTRO_COPY = "Every great home begins with exceptional foundations - not just in the way it's built, but in the quality of the fixtures, fittings and finishes included throughout. Our Premier Inclusions have been carefully selected to deliver the perfect balance of style, performance and long-term value, ensuring your home is ready to enjoy from the day you move in.\n\nEvery Project Estimate is prepared using our Premier Inclusions as the standard specification, giving you a clear understanding of exactly what is included. During your personalised Selections Process, you'll have the opportunity to tailor your home by choosing colours, finishes and approved upgrades, with all final selections documented in your Formal Quotation before your Building Contract is prepared.";
const LEGACY_SHORT_PREMIER_INTRO_COPY = "Every great home begins with exceptional foundations, quality fixtures and carefully selected finishes. Our Premier Inclusions have been chosen to deliver style, performance and long-term value from the day you move in.\n\nYour Project Estimate is prepared using this Premier range as the standard specification. During your Selections Process, colours, finishes and approved upgrades are confirmed and documented in your Formal Quotation.";
const PREMIER_INTRO_COPY = "Our Premier Inclusions provide the perfect balance of quality, style and value, forming the standard specification for every Project Estimate. During your Selections Process, you'll personalise your home by selecting colours, finishes and approved upgrades, with all final inclusions confirmed in your Formal Quotation before your Building Contract is prepared.";
const LEGACY_COVER_TITLES = new Set(["STANDARD INCLUSIONS", "Standard Inclusions", "Premier Inclusions"]);
const LEGACY_COVER_SUBTITLES = new Set(["A clear baseline inclusions schedule for pricing your project estimate.", "Mid Range Inclusions Schedule"]);
const LEGACY_COVER_INTROS = new Set([
  "This schedule outlines the standard inclusions used as the baseline for preparing the project estimate. Final client selections may upgrade, downgrade or vary from this package after acceptance.",
  "Our Standard Inclusions Schedule sets out the quality fittings, fixtures and finishes included in every home as part of our mid range offering. Designed for comfort, style and lasting value.",
  "A clear guide to the fixtures, finishes and construction standards included as the baseline for your Project Estimate.",
  LEGACY_LONG_COVER_INTRO,
]);
const LEGACY_COVER_TAGLINES = new Set([
  "Built for life. Backed by quality.",
  "Built with quality.\nDesigned for life.",
  "Quality by standard.\nPersonalised by choice.",
]);
const LEGACY_COVER_IMAGES = new Set([`${PLACEHOLDER}/standard-inclusions-cover.svg`]);
const LEGACY_BUILDER_PHONES = new Set(["", "1800 472 683", "07 5555 1234"]);
const DEFAULT_COVER_FEATURES = [
  {
    icon: "quality",
    title: "Quality Inclusions",
    text: "Carefully selected for performance, durability and style.",
  },
  {
    icon: "home",
    title: "Premier Range",
    text: "A complete Premier range of inclusions to make building easy.",
  },
  {
    icon: "value",
    title: "Great Value",
    text: "Inclusions that deliver exceptional value for your investment.",
  },
];

const DEFAULT_DOCUMENT_PAGES = {
  intro: {
    image_url: PREMIER_INTRO_IMAGE,
    heading: PREMIER_INTRO_HEADING,
    intro: PREMIER_INTRO_COPY,
  },
  living: {
    image_url: "/assets/builders/standard-inclusions-kitchen-black-white.webp",
    heading: "Creating homes you'll love coming home to.",
    intro: "The best homes are built around the people who live in them. Our Premier Inclusions provide a carefully selected range of quality fixtures, fittings and finishes, creating the perfect foundation before you personalise your home during the Selections Process.",
    callouts: ["20mm stone benchtops", "Polytec or Laminex cabinetry", "Standard appliance package", "Quality floor finishes"],
  },
  selections: {
    image_url: "/assets/builders/standard-inclusions-family-kitchen.jpg",
    heading: "Designed for the way you live.",
    intro: "Our Premier Inclusions provide the perfect balance of quality, style and value, forming the standard specification for every Project Estimate.\n\nDuring your Selections Process, you'll personalise your home by selecting colours, finishes and approved upgrades, with all final inclusions confirmed in your Formal Quotation before your Building Contract is prepared.",
    closing: "Premier range.\nPersonalised by choice.",
  },
  specification: {
    image_url: "",
    heading: "Premier Inclusions",
    intro: "",
    images: [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
    ],
  },
};

const SECTION_COPY = {
  "Highlight Inclusions": ["Quality fixtures and finishes allowance", "Site-specific construction allowances", "Practical storage and robe inclusions", "Modern electrical and lighting allowances", "Durable external finishes"],
  "General Inclusions": ["Building approval coordination allowance", "Standard builder supervision", "Construction insurance allowance", "Site safety and compliance allowance", "Final builder clean allowance"],
  "Site Preparation & Foundations": ["Site cut up to 1m cross fall", "Termite treatment to perimeter and slab penetrations to Australian Standards"],
  "Structural & External": ["70mm T2 treated timber framing", "T2 treated timber roof trusses to engineer's design", "Colorbond roof with 65mm Anticon insulation blanket"],
  "Energy & Comfort": ["Ceiling and wall insulation to required standards", "Roof sarking or blanket as specified", "Energy-efficient glazing where required", "Water-efficient plumbing fixtures", "Natural ventilation considered through the plan"],
  Kitchen: ["Cabinetry allowance", "Benchtop allowance", "Sink and mixer allowance", "Appliance allowance", "Splashback allowance"],
  Electrical: ["LED downlight allowance", "Power point allowance", "Switching allowance", "Smoke alarm allowance", "External light allowance"],
  "Robes & Linen Cupboards": ["Built-in robe shelf and rail allowance", "Linen shelving allowance", "Sliding robe door allowance", "Practical storage fit-out", "Painted internal finishes"],
  "Plumbing & Drainage": ["Hot and cold water rough-in", "Sanitary drainage allowance", "External hose tap allowance", "Stormwater allowance", "Plumbing compliance allowance"],
  "Bathroom, Ensuite & WC": ["Vanity allowance", "Tapware allowance", "Toilet suite allowance", "Shower screen allowance", "Tile allowance"],
  "Windows, Doors & Locks": ["Aluminium window allowance", "External door allowance", "Internal door allowance", "Lever hardware allowance", "Locks and privacy sets where required"],
  Internal: ["Plasterboard lining allowance", "Cornice allowance", "Skirting and architrave allowance", "Internal door trims", "Final internal finishing allowance"],
  Painting: ["Internal wall paint system", "Ceiling paint system", "Door and trim paint system", "External paint allowance where specified", "Standard colour allowance"],
  Roofing: ["Roof sheeting allowance", "Gutter and fascia allowance", "Downpipe allowance", "Roof insulation allowance", "Roof flashings allowance"],
  Laundry: ["Choice of 20mm stone benchtops from builder's range"],
  Driveway: ["Exposed aggregate driveways and paths 60m2 allowance"],
  "External Finishes": ["Colorbond roof, fascia and gutters in a standard colour", "90mm PVC downpipes", "Aluminium windows and sliding doors", "Standard garage door and external door hardware", "Plain concrete driveway and paths where included"],
  "Your Selections Process": ["Confirm standard colours, finishes and fixtures", "Choose from the builder's approved supplier ranges", "Review upgrade or downgrade costs against the included allowance", "Approve final selections before the Formal Quotation is completed", "All confirmed selections and variations are documented before contract"],
};

export function createDefaultStandardInclusions(builderId = "local-builder") {
  return {
    selectedPackageId: PACKAGE_ID,
    packages: [{
      id: PACKAGE_ID,
      builder_id: builderId,
      name: "Premier Range Inclusions",
      cover_title: DEFAULT_COVER_TITLE,
      cover_subtitle: DEFAULT_COVER_SUBTITLE,
      intro: DEFAULT_COVER_INTRO,
      cover_tagline: DEFAULT_COVER_TAGLINE,
      cover_features: DEFAULT_COVER_FEATURES,
      cover_image_url: DEFAULT_COVER_IMAGE,
      builder_logo_url: "",
      footer_logo_url: "",
      builder_phone: DEFAULT_BUILDER_PHONE,
      builder_website: "goodbuild.com.au",
      footer_contact: "Your Building Team | Contact details",
      document_pages: DEFAULT_DOCUMENT_PAGES,
      is_default: true,
      active: true,
    }],
    sections: STANDARD_INCLUSION_SECTION_TITLES.map((title, index) => ({
      id: `std-sec-${index + 1}`,
      package_id: PACKAGE_ID,
      title,
      bullets: SECTION_COPY[title] || [],
      image_url: `${PLACEHOLDER}/standard-${(index % 6) + 1}.svg`,
      sort_order: index + 1,
      active: true,
    })),
  };
}

export function normaliseStandardInclusions(value = {}, builderId = "local-builder") {
  const defaults = createDefaultStandardInclusions(builderId);
  const packages = Array.isArray(value.packages) && value.packages.length ? value.packages : defaults.packages;
  const selectedPackageId = value.selectedPackageId || packages.find((item) => item.is_default && item.active !== false)?.id || packages[0]?.id || defaults.selectedPackageId;
  const defaultSections = defaults.sections;
  const sourceSections = Array.isArray(value.sections) && value.sections.length ? value.sections : defaultSections;
  const sectionsWithDefaults = mergeMissingStandardSections(sourceSections, defaultSections, selectedPackageId);
  return {
    selectedPackageId,
    pdfPages: Array.isArray(value.pdfPages) ? value.pdfPages : [],
    selectedPdfPageId: value.selectedPdfPageId || "",
    pdfSourceName: value.pdfSourceName || "",
    pptxSourceName: value.pptxSourceName || "",
    pdfEditorMode: value.pdfEditorMode || "",
    documentBuilder: value.documentBuilder || null,
    masterTemplate: value.masterTemplate || null,
    builderCopies: Array.isArray(value.builderCopies) ? value.builderCopies : [],
    activeBuilderCopyId: value.activeBuilderCopyId || "",
    packages: packages.map((item, index) => ({
      id: item.id || `std-pkg-${index + 1}`,
      builder_id: item.builder_id || builderId,
      name: normalisePremierPackageName(item.name),
      cover_title: LEGACY_COVER_TITLES.has(item.cover_title) ? DEFAULT_COVER_TITLE : normalisePremierText(item.cover_title || DEFAULT_COVER_TITLE),
      cover_subtitle: LEGACY_COVER_SUBTITLES.has(item.cover_subtitle) ? DEFAULT_COVER_SUBTITLE : normalisePremierText(item.cover_subtitle || DEFAULT_COVER_SUBTITLE),
      intro: LEGACY_COVER_INTROS.has(item.intro) ? DEFAULT_COVER_INTRO : normalisePremierText(item.intro || DEFAULT_COVER_INTRO),
      cover_tagline: LEGACY_COVER_TAGLINES.has(item.cover_tagline) ? DEFAULT_COVER_TAGLINE : normalisePremierText(item.cover_tagline || DEFAULT_COVER_TAGLINE),
      cover_features: normaliseCoverFeatures(item.cover_features),
      cover_image_url: LEGACY_COVER_IMAGES.has(item.cover_image_url) ? DEFAULT_COVER_IMAGE : (item.cover_image_url || DEFAULT_COVER_IMAGE),
      builder_logo_url: item.builder_logo_url || "",
      footer_logo_url: item.footer_logo_url || item.builder_logo_url || "",
      builder_phone: LEGACY_BUILDER_PHONES.has(item.builder_phone || "") ? DEFAULT_BUILDER_PHONE : item.builder_phone,
      builder_website: item.builder_website || "",
      footer_contact: item.footer_contact || "",
      document_pages: normaliseDocumentPages(item.document_pages),
      is_default: Boolean(item.is_default),
      active: item.active !== false,
    })),
    sections: sectionsWithDefaults.map((item, index) => ({
      id: item.id || `std-sec-${index + 1}`,
      package_id: item.package_id || selectedPackageId,
      title: item.title || STANDARD_INCLUSION_SECTION_TITLES[index] || `Section ${index + 1}`,
      bullets: Array.isArray(item.bullets) ? item.bullets : String(item.bullets || "").split("\n").map((line) => line.trim()).filter(Boolean),
      image_url: item.image_url || "",
      sort_order: Number(item.sort_order || index + 1),
      active: item.active !== false,
    })),
  };
}

export function selectedStandardInclusionsPackage(value = {}) {
  const normalised = normaliseStandardInclusions(value);
  const selectedPackage = normalised.packages.find((item) => item.id === normalised.selectedPackageId) || normalised.packages[0] || null;
  const packageId = selectedPackage?.id || normalised.selectedPackageId;
  return {
    ...normalised,
    package: selectedPackage,
    sections: normalised.sections
      .filter((section) => section.package_id === packageId && section.active !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
  };
}

function normaliseCoverFeatures(features = []) {
  const source = Array.isArray(features) && features.length ? features : DEFAULT_COVER_FEATURES;
  return DEFAULT_COVER_FEATURES.map((fallback, index) => {
    const item = source[index] || {};
    return {
      icon: item.icon || fallback.icon,
      title: normalisePremierText(item.title || fallback.title),
      text: normalisePremierText(item.text || fallback.text),
    };
  });
}

function normalisePremierPackageName(name = "") {
  const value = String(name || "").trim();
  if (!value || value === "Mid Range Standard Inclusions" || value === "Mid Range Inclusions" || value === "Standard Inclusions") {
    return "Premier Range Inclusions";
  }
  return normalisePremierText(value);
}

function normalisePremierText(value = "") {
  return String(value || "")
    .replace(/Mid Range Standard Inclusions/g, "Premier Range Inclusions")
    .replace(/Mid Range Inclusions/g, "Premier Range Inclusions")
    .replace(/Mid Range/g, "Premier Range")
    .replace(/mid range/g, "Premier range")
    .replace(/Quality by standard\./g, "Premier range.");
}

function normaliseDocumentPages(pages = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_DOCUMENT_PAGES).map(([key, fallback]) => {
    const item = pages?.[key] || {};
    const legacyBuildQuality = key === "buildQuality" && (
      item.heading === "BUILT ON QUALITY" ||
      item.image_url === "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1500&q=80" ||
      item.intro === "Every quality home begins with a solid foundation and careful attention to detail. Our Standard Inclusions provide a dependable mid-range specification covering site preparation, structural construction, insulation and essential building systems." ||
      item.intro === LEGACY_LONG_PREMIER_INTRO_COPY ||
      item.intro === LEGACY_SHORT_PREMIER_INTRO_COPY
    );
    const legacyLiving = key === "living" && (
      item.heading === "DESIGNED FOR EVERYDAY LIVING" ||
      item.image_url === "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1500&q=80" ||
      item.image_url === "/assets/builders/standard-inclusions-premier-kitchen.jpg" ||
      item.intro === "Our Premier range combines practical design, durable finishes and modern styling to create a home that feels comfortable from the day you move in."
    );
    const legacySelections = key === "selections" && (
      item.heading === "A HOME MADE YOURS" ||
      item.image_url === "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1500&q=80" ||
      item.intro === "Your Project Estimate is prepared using this Premier Range Inclusions Schedule as the baseline specification. During the Selections Process, you will confirm colours, finishes and products and may choose approved upgrades or downgrades to personalise your home."
    );
    return {
      ...fallback,
      ...(legacyBuildQuality || legacyLiving || legacySelections ? {} : item),
      callouts: Array.isArray(item.callouts) ? item.callouts : fallback.callouts,
    };
  }));
}

function mergeMissingStandardSections(sourceSections = [], defaultSections = [], selectedPackageId = PACKAGE_ID) {
  const existing = Array.isArray(sourceSections) ? [...sourceSections] : [];
  const existingTitles = new Set(existing.map((section) => String(section.title || "").trim().toLowerCase()));
  const packageId = selectedPackageId || existing[0]?.package_id || PACKAGE_ID;
  const missing = defaultSections
    .filter((section) => !existingTitles.has(String(section.title || "").trim().toLowerCase()))
    .map((section, index) => ({
      ...section,
      id: `${section.id || "std-sec"}-added-${index + 1}`,
      package_id: packageId,
      sort_order: existing.length + index + 1,
    }));
  return [...existing, ...missing];
}
