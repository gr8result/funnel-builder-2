export const standardInclusionsData = {
  builder: {
    builderName: "Goodbuild Quality Builders",
    logoUrl: "/assets/builders/goodbuild-logo.png",
    phone: "1300 1231 456",
    website: "goodbuild.com.au",
    packageName: "Premier Range Inclusions",
  },
  pages: [
    { id: "page01-cover", title: "Cover", component: "Page01Cover", sortOrder: 1, enabled: true, locked: true },
    { id: "page02-premier-introduction", title: "Premier Inclusions Introduction", component: "Page02PremierIntroduction", sortOrder: 2, enabled: true, locked: true },
    { id: "page03-creating-homes", title: "Creating Homes You'll Love Coming Home To", component: "Page03CreatingHomes", sortOrder: 3, enabled: true, locked: true },
    { id: "page04-designed-for-living", title: "Designed For The Way You Live", component: "Page04DesignedForLiving", sortOrder: 4, enabled: true, locked: true },
    { id: "page05-construction-inclusions", title: "Construction / Premier Inclusions Schedule", component: "Page05ConstructionInclusions", sortOrder: 5, enabled: true, locked: true },
    { id: "page06-selections-process", title: "Selections Process", component: "Page06SelectionsProcess", sortOrder: 6, enabled: true, locked: true },
  ],
  page01Cover: {
    title: "Premier Range Inclusions",
    subtitle: "Premier Range Inclusions Schedule",
    imageUrl: "/assets/builders/standard-inclusions-hero.jpg",
    intro: "Our Premier Inclusions Schedule sets out the quality fittings, fixtures and finishes included in every home as part of our Premier range offering. Designed for comfort, style and lasting value.",
    tagline: "Built for life. Backed by quality.",
    features: [
      { icon: "quality", title: "Quality Inclusions", text: "Carefully selected for performance, durability and style." },
      { icon: "home", title: "Everything You Need", text: "A complete range of inclusions to make building easy." },
      { icon: "value", title: "Great Value", text: "Inclusions that deliver exceptional value for your investment." },
    ],
  },
  page02PremierIntroduction: {
    imageUrl: "/assets/builders/standard-inclusions-premier-living.jpg",
    heading: "Premier Inclusions",
    intro: "Our Premier Inclusions provide the perfect balance of quality, style and value, forming the standard specification for every Project Estimate. During your Selections Process, you'll personalise your home by selecting colours, finishes and approved upgrades, with all final inclusions confirmed in your Formal Quotation before your Building Contract is prepared.",
  },
  page03CreatingHomes: {
    imageUrl: "/assets/builders/standard-inclusions-kitchen-black-white.webp",
    heading: "Creating homes you'll love coming home to.",
    intro: "The best homes are built around the people who live in them. Our Premier Inclusions provide a carefully selected range of quality fixtures, fittings and finishes, creating the perfect foundation before you personalise your home during the Selections Process.",
  },
  page04DesignedForLiving: {
    imageUrl: "/assets/builders/standard-inclusions-family-kitchen.jpg",
    heading: "Designed for the way you live.",
    intro: "Our Premier Inclusions provide the perfect balance of quality, style and value, forming the standard specification for every Project Estimate.\n\nDuring your Selections Process, you'll personalise your home by selecting colours, finishes and approved upgrades, with all final inclusions confirmed in your Formal Quotation before your Building Contract is prepared.",
  },
  page05ConstructionInclusions: {
    imageUrl: "/assets/builders/standard-inclusions-construction-strip.png",
    heading: "Premier Inclusions Schedule",
    site: [
      "Site cut allowance for up to 1 metre cross fall",
      "Engineer-designed concrete slab system to suit site conditions",
      "Termite treatment to perimeter and slab penetrations in accordance with Australian Standards",
    ],
    structural: [
      "70mm T2 treated timber wall framing",
      "T2 treated timber roof trusses designed to engineer's requirements",
      "Colorbond steel roofing",
      "65mm Anticon insulation blanket beneath roof sheeting",
    ],
    laundry: [
      "Choice of 20mm stone benchtops from the builder's standard range",
      "Stainless steel laundry tub",
      "Laminated cabinetry with soft-close hardware",
    ],
    driveway: [
      "Exposed aggregate driveway and paths",
      "Allowance up to 60m2",
      "Colour selected from the builder's standard range",
    ],
    highlights: [
      { title: "20mm Smartstone benchtops", detail: "Choice from the builder's standard colour range" },
      { title: "Polytec or Laminex cabinetry", detail: "Choice from the builder's approved colourboard range" },
      { title: "900mm stainless steel appliance package", detail: "Oven, cooktop, canopy rangehood and dishwasher" },
      { title: "Quality floor coverings", detail: "Tiles to wet areas and carpet to nominated rooms" },
      { title: "Dulux paint system", detail: "Walls, ceilings, doors and trims" },
      { title: "Colorbond roof, fascia and gutters", detail: "Choice from the standard colour range" },
    ],
    general: [
      "Building approvals and standard certification",
      "Energy efficiency assessment",
      "Builder's internal and external clean",
      "Independent quality inspections during construction",
      "12-month maintenance period following handover",
    ],
  },
  page06SelectionsProcess: {
    heading: "Your Home, Your Way",
    intro: "Selections are where your home becomes personal. Our process gives you a clear baseline, practical guidance and documented choices before your Formal Quotation is prepared.",
    steps: ["Confirm standard colours and finishes", "Review approved upgrade options", "Document accepted selections", "Confirm final inclusions before contract"],
  },
};

export const STANDARD_PAGE_KEYS = ["intro", "living", "selections", "specification"];

export function normalisePageSettings(settings = standardInclusionsData.pages) {
  return [...settings].map((page, index) => ({
    id: page.id,
    title: page.title,
    component: page.component,
    sortOrder: Number(page.sortOrder || index + 1),
    enabled: page.enabled !== false,
    locked: page.locked === true,
  }));
}

export function orderedEnabledPages(settings = standardInclusionsData.pages) {
  return normalisePageSettings(settings)
    .filter((page) => page.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function duplicatePage(settings, pageId) {
  const pages = normalisePageSettings(settings);
  const source = pages.find((page) => page.id === pageId);
  if (!source || source.locked) return pages;
  const copy = { ...source, id: `${source.id}-copy-${Date.now()}`, title: `${source.title} Copy`, sortOrder: source.sortOrder + 0.5, locked: false };
  return normalisePageSettings([...pages, copy]).sort((a, b) => a.sortOrder - b.sortOrder).map((page, index) => ({ ...page, sortOrder: index + 1 }));
}

export function movePage(settings, pageId, direction) {
  const pages = normalisePageSettings(settings).sort((a, b) => a.sortOrder - b.sortOrder);
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0 || pages[index].locked) return pages;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= pages.length) return pages;
  const [page] = pages.splice(index, 1);
  pages.splice(nextIndex, 0, page);
  return pages.map((item, orderIndex) => ({ ...item, sortOrder: orderIndex + 1 }));
}
