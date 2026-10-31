import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";
import { createPremierInclusionsWorkingCopy } from "./masterTemplate.js";
import { Font, Encodings } from "@pdf-lib/standard-fonts";
import { hasApprovedProductImage, missingProductInformation, normalizeCatalogueProduct, rankCatalogueCandidatesForCategories } from "./productProposal.mjs";
import { commonConstructionReviewItems, STANDARD_TIER_SETTINGS } from "./tierScheduleReview.mjs";
import { PRODUCT_INCLUSION_ITEMS, RESIDENTIAL_INCLUSION_ITEMS } from "./residentialInclusionStructure.mjs";
import { applyBrochurePhotography } from "./brochurePhotography.mjs";

export const STANDARD_INCLUSION_TIERS = Object.freeze(["Economy", "Classic", "Premier", "Premium"]);
export const PRODUCT_PRICE_LEVELS = Object.freeze([
  { key: "budget", label: "Budget", quantile: 0.2 },
  { key: "mid-range", label: "Mid-range", quantile: 0.5 },
  { key: "high-end", label: "High-end", quantile: 0.8 },
]);

const CORE_MASTER_REQUIREMENTS = [
  { section: "Kitchen", title: "Oven", category: "Ovens", widthMm: 900 },
  { section: "Kitchen", title: "Cooktop", category: "Cooktops", widthMm: 900 },
  { section: "Kitchen", title: "Rangehood", category: "Rangehoods", widthsMm: [700, 900] },
  { section: "Kitchen", title: "Dishwasher", category: "Dishwashers" },
  { section: "Kitchen", title: "Kitchen sink", category: "Kitchen Sinks" },
  { section: "Kitchen", title: "Kitchen mixer", category: "Kitchen Mixers" },
  { section: "Kitchen", title: "Cabinetry", category: "Cabinetry" },
  { section: "Kitchen", title: "Cabinet door finish", category: "Cabinet Finishes" },
  { section: "Kitchen", title: "Benchtops", category: "Benchtops" },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Toilet suite", category: "Toilets", productType: /toilet suite|close.coupled|wall.faced|back.to.wall|\bpan\b/i, excludedProductType: /flush plate|button|seat only|washlet|cistern only/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Basin", category: "Basins", productType: /\bbasin\b/i, excludedProductType: /bottle trap|basin waste|plug.*waste/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Basin mixer", category: "Basin Mixers", namePattern: /\bbasin mixer\b/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Bath", category: "Baths" },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Shower mixer", category: "Shower Mixers", namePattern: /(?:shower|bath\/shower).*mixer|mixer.*(?:shower|bath\/shower)/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Showerhead and outlet", category: "Showerheads", productType: /shower.*head|twin shower|rail shower|shower.*outlet/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Shower screen", category: "Shower Screen", productType: /semi.?frameless/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Mirror", category: "Mirror" },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Bathroom accessories", category: "Bathroom Accessories" },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Wall tiles", category: "Wall Tiles", productType: /\bwall\b/i },
  { section: "Bathroom, Ensuite Laundry & WC", title: "Floor tiles", category: "Floor Tiles", productType: /\bfloor\b/i },
  { section: "Electrical", title: "Downlights and light fittings", category: "Lighting", productType: /downlight/i },
  { section: "Electrical", title: "Ceiling fans", category: "Ceiling Fans" },
  { section: "Windows & Doors", title: "Entry door", category: "Entry Door" },
  { section: "Windows & Doors", title: "Internal doors", category: "Internal Doors" },
  { section: "Windows & Doors", title: "Door furniture", category: "Internal Door Hardware" },
  { section: "Windows & Doors", title: "Windows and glazing", category: "Windows" },
  { section: "Windows & Doors", title: "Garage door", category: "Garage Doors" },
  { section: "Robes & Linen Cupboards", title: "Wardrobe and linen systems", category: "Wardrobe Systems" },
  { section: "Internal Finishes", title: "Paint system", category: "Painting" },
  { section: "Flooring", title: "Carpet flooring", category: "Carpet Flooring", productType: /carpet/i },
  { section: "Flooring", title: "Hard flooring", category: "Hard Flooring", productType: /hybrid|laminate|vinyl|engineered|timber/i },
  { section: "Plumbing & Drainage", title: "Hot water system", category: "Hot Water Systems", excludedProductType: /3.phase|three.phase|pool|tank only|collector only/i },
  { section: "Roofing", title: "Roofing and roofline system", category: "Roofing" },
  { section: "External Finishes", title: "External bricks", category: "Bricks" },
  { section: "External Finishes", title: "External cladding", category: "Cladding" },
  { section: "Driveway", title: "Driveway finish", category: "Driveway Finishes" },
];

const structuredProductRequirements = PRODUCT_INCLUSION_ITEMS.map(({ productCategory, productRequired, ...item }) => ({
  ...item,
  category: productCategory,
}));
const MASTER_REQUIREMENTS = structuredProductRequirements.map((item) => {
  const legacyRequirement = CORE_MASTER_REQUIREMENTS.find((entry) => entry.title === item.title && entry.category === item.category);
  return legacyRequirement ? { ...item, legacySection: legacyRequirement.section } : item;
});

const PRODUCT_QUANTILE_BY_LEVEL = Object.fromEntries(PRODUCT_PRICE_LEVELS.map((level) => [level.key, level.quantile]));
const PRICE_LABEL_BY_LEVEL = Object.fromEntries(PRODUCT_PRICE_LEVELS.map((level) => [level.key, level.label]));
const BODY_FONT = Font.load("Helvetica");
const HEADING_FONT = Font.load("Helvetica-Bold");

function textWidth(text, size, bold = false) {
  return [...String(text)].reduce((width, character) => {
    const point = character.codePointAt(0);
    const glyph = Encodings.WinAnsi.canEncodeUnicodeCodePoint(point) ? Encodings.WinAnsi.encodeUnicodeCodePoint(point).name : "question";
    return width + ((bold ? HEADING_FONT : BODY_FONT).getWidthOfGlyph(glyph) || 550) * size / 1000;
  }, 0);
}

function wrapText(text, width, size, bold = false) {
  return String(text || "").split("\n").flatMap((paragraph) => {
    const lines = [];
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && textWidth(`${line} ${word}`, size, bold) > width - 12) {
        lines.push(line);
        line = "";
      }
      line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
    return lines;
  });
}

function productPrice(product) {
  const value = product.allowance ?? product.price;
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

function hasVerifiedPrice(product) {
  return productPrice(product) !== null && Boolean(product.priceSource || product.priceEffectiveDate);
}

const TILE_APPLICATION_BY_CATEGORY = { "Floor Tiles": "floor", "Wall Tiles": "wall" };
const tileApplicationFor = (requirement) => TILE_APPLICATION_BY_CATEGORY[requirement.category] || "";

// A tile's recorded application outranks marketing copy such as "matching floor and wall combinations".
function tileApplicationMatches(product, requirement) {
  const application = tileApplicationFor(requirement);
  return !application || !product.tileApplications?.length || product.tileApplications.includes(application);
}

// Indoor floor requirements use indoor tiles when the library has them; external tiles stay for external areas.
function preferIndoorTiles(candidates, requirement) {
  if (tileApplicationFor(requirement) !== "floor" || /external|outdoor|alfresco/i.test(requirement.title)) return candidates;
  const indoor = candidates.filter((product) => !/\bexternal\b|\boutdoor\b/i.test(product.name));
  return indoor.length ? indoor : candidates;
}

function filterCandidatesForMasterRequirement(candidates, requirement) {
  const widths = requirement.widthsMm || (requirement.widthMm ? [requirement.widthMm] : []);
  return preferIndoorTiles(candidates, requirement)
    .filter((product) => !widths.length || widths.some((width) => new RegExp(`\\b(?:${width}\\s*mm|${width / 10}\\s*cm)\\b`, "i").test(`${product.name} ${product.specification}`)))
    .filter((product) => !requirement.namePattern || requirement.namePattern.test(`${product.name} ${product.specification}`))
    .filter((product) => tileApplicationMatches(product, requirement))
    .filter((product) => !requirement.productType || (tileApplicationFor(requirement) && product.tileApplications?.length) || requirement.productType.test(`${product.productType} ${product.name} ${product.specification} ${product.description}`))
    .filter((product) => !requirement.excludedProductType || !requirement.excludedProductType.test(`${product.productType} ${product.name} ${product.specification} ${product.description}`))
    .sort((left, right) => Number(hasVerifiedPrice(right)) - Number(hasVerifiedPrice(left))
      || Number(hasApprovedProductImage(right)) - Number(hasApprovedProductImage(left))
      || Number(Boolean(right.image)) - Number(Boolean(left.image))
      || (productPrice(left) ?? Number.MAX_SAFE_INTEGER) - (productPrice(right) ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name));
}

export function catalogueCandidatesForMasterRequirement(productRows, requirement) {
  return filterCandidatesForMasterRequirement(
    rankCatalogueCandidatesForCategories(productRows, [requirement.category], { perCategory: 1000, totalLimit: 1000 }),
    requirement,
  );
}

export function catalogueCandidatesForMasterRequirements(productRows, requirements) {
  const categoryCandidates = new Map();
  return Object.fromEntries(requirements.map((requirement) => {
    if (!categoryCandidates.has(requirement.category)) {
      categoryCandidates.set(requirement.category, rankCatalogueCandidatesForCategories(productRows, [requirement.category], { perCategory: 1000, totalLimit: 1000 }));
    }
    return [requirement.key || `${requirement.section}::${requirement.title}`, filterCandidatesForMasterRequirement(categoryCandidates.get(requirement.category), requirement)];
  }));
}

function chooseFamilyPrice(candidates, quantile) {
  if (!candidates.length) return null;
  const verifiedPriceCandidates = candidates.filter(hasVerifiedPrice);
  const pool = verifiedPriceCandidates.length ? verifiedPriceCandidates : candidates;
  return pool[Math.round((pool.length - 1) * quantile)];
}

function productReviewItem(requirement, priceLevel, product) {
  if (!product) {
    return {
      id: `review:${requirement.section}:${requirement.title}`,
      category: requirement.section,
      group: requirement.group || "",
      requirementCategory: requirement.category,
      requirementTitle: requirement.title,
      requirementKey: requirement.key || "",
      reviewStatus: "needs_review",
      productRequired: true,
      description: requirement.title,
      specification: "",
      product: null,
      reason: `Builder review required: no compatible ${requirement.category} product is available in the effective Product Library. The supplied master specification is retained unchanged.`,
      priceLevel,
      origin: "master-template-review-gap",
    };
  }

  return {
    id: `generated:${requirement.section}:${requirement.title}:${product.productId}`,
    category: requirement.section,
    group: requirement.group || "",
    requirementCategory: requirement.category,
    requirementTitle: requirement.title,
    requirementKey: requirement.key || "",
    reviewStatus: "generated",
    productRequired: true,
    description: product.name,
    specification: product.specification || product.description || "",
    includedUnitPrice: productPrice(product),
    ...(productPrice(product) !== null ? { includedPriceBasis: "catalogue_unit_price" } : {}),
    product: { ...product },
    missingInformation: missingProductInformation(product),
    reason: productPrice(product) !== null
      ? "Selected from the effective Product Library using its exact product family and recorded price."
      : "Selected from the effective Product Library using its exact product family. Price or allowance requires builder review.",
    priceLevel,
    origin: "workspace-product-library",
  };
}

function comprehensiveConstructionReviewItems() {
  const retained = commonConstructionReviewItems();
  const ignoredReferenceWords = new Set(["against", "applicable", "builder", "building", "construction", "material", "requirements", "selected", "specification", "system"]);
  const matchTokens = (value) => String(value || "").toLowerCase().match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 4 && !ignoredReferenceWords.has(token)) || [];
  const referenceScore = (item, entry) => {
    const haystack = `${entry.requirementTitle || ""} ${entry.description || ""} ${entry.referenceSpecification || entry.specification || ""}`.toLowerCase();
    return matchTokens(`${item.title} ${item.group}`).reduce((score, token) => {
      const stem = token.slice(0, Math.min(token.length, 6));
      return score + (haystack.includes(token) || (stem.length >= 5 && haystack.includes(stem)) ? 1 : 0);
    }, 0);
  };
  const sourceCategories = {
    "preliminaries-site-works": ["Design & Services", "Siteworks & Foundations"],
    "concrete-structural": ["Structural & External", "Siteworks & Foundations"],
    "external-walls-cladding": ["Structural & External"],
    roofing: ["Roofing"],
    "windows-external-doors": ["Windows & Doors"],
    "internal-doors": ["Windows & Doors"],
    "internal-door-hardware": ["Windows & Doors"],
    "storage-joinery": ["Robes & Linen Cupboards"],
    "internal-linings-finishes": ["Internal Finishes", "Painting"],
    "kitchen-cabinetry": ["Kitchen"],
    "kitchen-benchtops": ["Kitchen"],
    "kitchen-appliances": ["Kitchen"],
    "kitchen-plumbing": ["Kitchen", "Plumbing & Drainage"],
    "bathrooms-ensuites": ["Bathroom, Ensuite Laundry & WC"],
    "bathroom-tiling": ["Bathroom, Ensuite Laundry & WC"],
    laundry: ["Bathroom, Ensuite Laundry & WC", "Plumbing & Drainage"],
    "floor-coverings": ["Flooring"],
    "stairs-balustrades": ["Structural & External"],
    "electrical-lighting": ["Electrical"],
    "heating-cooling-hot-water": ["Plumbing & Drainage", "Electrical"],
    "external-works": ["Driveway", "Structural & External"],
  };
  return RESIDENTIAL_INCLUSION_ITEMS.filter((item) => !item.productRequired).map((item) => {
    const references = retained.filter((entry) => (sourceCategories[item.sectionKey] || []).includes(entry.category));
    const rankedReferences = references.map((entry) => ({ entry, score: referenceScore(item, entry) }))
      .sort((left, right) => right.score - left.score);
    const matchedReference = rankedReferences[0]?.score > 0 ? rankedReferences[0].entry : null;
    const retainedSummary = String(matchedReference?.referenceSpecification || matchedReference?.specification || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    return {
      id: `construction:${item.key}`,
      category: item.section,
      group: item.group,
      requirementTitle: item.title,
      requirementKey: item.key,
      description: item.title,
      specification: retainedSummary
        ? `${item.title}: ${retainedSummary} Builder to confirm applicability against the plans and engineering before approval.`
        : `${item.title} requires builder confirmation against the plans, engineering and applicable building requirements.`,
      product: null,
      productRequired: false,
      sourceReference: matchedReference?.sourceReference ? [matchedReference.sourceReference] : [],
      origin: "construction-requirement",
      reviewStatus: "needs_review",
      quantity: "",
      unit: "",
      allowanceOverride: "",
      reason: "Construction specification retained for builder review; no catalogue product has been invented.",
    };
  });
}

function templateImagePage(document) {
  const page = document.pages.find((entry) => entry.id === "premier-inclusions-page-07");
  if (!page || page.objects?.length) return;
  page.objects = [createObject("image", {
    name: "Original master-template page 07",
    x: 0,
    y: 0,
    width: page.width || 794,
    height: page.height || 1123,
    style: { objectFit: "contain" },
    data: { imageRef: "/standard-inclusions/assets/slide-07-exact.png", alt: "Original master schedule page 07" },
  })];
}

function applyBrandingAndTier(document, { tier, branding = {} }) {
  const businessName = String(branding.businessName || branding.legalName || "Builder").trim();
  const website = String(branding.website || "").trim();
  const phone = String(branding.phone || "").trim();
  const logo = String(branding.logo || branding.businessLogo || "").trim();
  for (const page of document.pages) {
    page.objects = (page.objects || []).map((object) => {
      let next = object;
      if (object.type === "text" && object.data?.text) {
        let text = String(object.data.text)
          .replace(/Premier Inclusions Range Schedule/g, `${tier} Inclusions Schedule`)
          .replace(/Premier Inclusions Schedule/g, `${tier} Inclusions Schedule`)
          .replace(/Premier Inclusions/g, `${tier} Inclusions`)
          .replace(/Premier Range/g, `${tier} Range`)
          .replace(/Premier range/g, `${tier} range`)
          .replace(/\bPremier\b/g, tier)
          .replace(/goodbuild\.com\.au/gi, website || "")
          .replace(/Goodbuild|Good Build|GoodBuild/g, businessName);
        if (/1300 1231 456/.test(text)) text = text.replace(/1300 1231 456/g, phone);
        next = { ...object, data: { ...object.data, text } };
      }
      if (logo && object.type === "logo" && object.data?.imageRef === "/standard-inclusions/assets/image18.png") {
        next = { ...next, data: { ...(next.data || {}), imageRef: logo, assetPath: undefined, alt: businessName } };
      }
      return next;
    });
  }
  const cover = document.pages[0];
  cover.objects = cover.objects.filter((object) => !["p1-text-19", "p1-text-20", "p1-text-21", "p1-logo-17", "p1-logo-18"].includes(object.id));
  const title = cover.objects.find((object) => object.id === "p1-text-3");
  if (title) title.data.text = `${tier}\nInclusions Schedule`;
  const artwork = document.pages.find((page) => page.id === "premier-inclusions-page-07");
  if (artwork) {
    artwork.objects.push(createObject("shape", { name: "Working-copy footer", x: 0, y: 1000, width: 794, height: 123, style: { fill: "#ffffff", strokeWidth: 0 } }));
    artwork.objects.push(label("Master artwork note", "Original master product imagery. Refer to the product selection pages for current catalogue selections; unresolved specifications require builder review.", 34, 1008, 715, 40, 10));
    artwork.objects.push(label("Builder footer", [businessName, phone, website].filter(Boolean).join(" | "), 34, 1060, 548, 35, 11));
    if (logo) artwork.objects.push(createObject("logo", { name: "Builder logo", x: 625, y: 1050, width: 126, height: 56, style: { objectFit: "contain" }, data: { imageRef: logo, alt: businessName } }));
  }
}

function fitMasterText(document) {
  for (const page of document.pages) {
    const textObjects = page.objects.filter((object) => object.type === "text");
    for (const object of textObjects) {
      const original = String(object.data?.text || "");
      object.width = Math.min(object.width, page.width - object.x - 26);
      let available = Math.min(object.height, page.height - object.y - 22);
      const next = textObjects.filter((other) => other.y > object.y + 5
        && Math.min(object.x + object.width, other.x + other.width) - Math.max(object.x, other.x) > Math.min(object.width, other.width) * 0.35)
        .sort((left, right) => left.y - right.y)[0];
      if (next) available = Math.min(available, next.y - object.y - 5);
      let size = Number(object.style?.fontSize || 12);
      const bold = size >= 14;
      while (size > 8 && wrapText(original, object.width, size, bold).length * size * 1.25 > available) size -= 0.5;
      object.data = { ...object.data, text: wrapText(original, object.width, size, bold).join("\n") };
      object.style = { ...object.style, fontFamily: "Arial", fontSize: size, fontWeight: bold ? "700" : "400", lineHeight: 1.25, letterSpacing: 0 };
      object.height = Math.max(available, wrapText(original, object.width, size, bold).length * size * 1.25);
    }
  }
}

function repairKitchenArtwork(document) {
  const page = document.pages.find((entry) => entry.id === "premier-inclusions-page-08");
  if (!page) return;
  page.objects = page.objects.filter((object) => object.id !== "p8-shape-1");
  const photo = page.objects.find((object) => object.id === "p8-image-0");
  Object.assign(photo, { x: 34, y: 115, width: 726, height: 565, layer: 0, style: { ...photo.style, objectFit: "contain" } });
  page.objects.push(label("Kitchen finishes heading", "Kitchen finishes", 34, 40, 726, 50, 32, "#102d25", "700"));
  const notes = page.objects.filter((object) => object.type === "text" && object.id.startsWith("p8-text"));
  notes.forEach((object, index) => {
    Object.assign(object, { x: index % 2 ? 410 : 34, y: 735 + Math.floor(index / 2) * 95, width: 346, height: 80 });
    object.style = { ...object.style, fontSize: 16, color: "#183147", textAlign: "left" };
  });
}

function separateTermiteSpecification(document) {
  const page = document.pages.find((entry) => entry.id === "premier-inclusions-page-05");
  const foundations = page?.objects.find((object) => object.id === "p5-text-16");
  const heading = page?.objects.find((object) => object.id === "p5-text-32");
  if (!foundations || !heading) return;
  const lines = foundations.data.text.split("\n");
  const termite = lines.find((line) => line.startsWith("Termite treatment"));
  if (!termite) return;
  foundations.data.text = lines.filter((line) => line !== termite).join("\n");
  page.objects.push(label("Termite treatment specification", termite, heading.x, heading.y + 30, 350, 48, 11));
}

function label(name, text, x, y, width, height, fontSize, color = "#183147", fontWeight = "500") {
  const printable = String(text || "").replaceAll("&bull;", "\u2022").replaceAll("&amp;", "&").replaceAll("\u00c2\u00ae", "\u00ae");
  const wrapped = wrapText(printable, width, fontSize, Number(fontWeight) >= 600);
  return createObject("text", {
    name,
    x,
    y,
    width,
    height: Math.max(height, wrapped.length * fontSize * 1.7 + 6),
    style: { fontFamily: "Arial", fontSize, fontWeight, color, lineHeight: 1.35, textAlign: "left", letterSpacing: 0 },
    data: { text: wrapped.join("\n") },
  });
}

function productDetailPages(items, tier, priceLevel) {
  const groups = new Map();
  for (const item of items.filter((item) => item.product)) groups.set(item.category, [...(groups.get(item.category) || []), item]);
  const gaps = items.filter((item) => !item.product).map((item) => ({ ...item, requirementTitle: `${item.category}: ${item.requirementTitle}`, reason: "Product selection requires builder review. The original master construction specification remains included; no price or substitute product has been invented." }));
  if (gaps.length) groups.set("Product selections requiring review", gaps);
  const pages = [];
  let pendingPage = null;
  for (const [section, sectionItems] of groups) {
    let part = 1;
    let objects;
    let position;
    const startPage = () => {
      objects = [
        label("Section heading", section, 48, 44, 698, 38, 27, "#102d25", "700"),
        label("Selection level", `${tier} schedule · ${priceLevel} product price level`, 48, 88, 698, 22, 12, "#8a6115", "700"),
      ];
      position = 148;
    };
    const finishPage = () => {
      const current = createA4Page({ name: `${section} selections${part > 1 ? ` ${part}` : ""}`, background: { color: "#ffffff" }, objects });
      if (pendingPage) pages.push(pendingPage);
      pendingPage = current;
      part += 1;
    };
    startPage();
    if (pendingPage && section !== "Product selections requiring review") {
      const bottom = Math.max(...pendingPage.objects.map((object) => object.y + object.height));
      if (bottom < 650) {
        objects = [...pendingPage.objects, label("Selection section", section, 48, bottom + 30, 698, 38, 24, "#102d25", "700")];
        position = bottom + 95;
        pendingPage = null;
      }
    }
    for (const item of sectionItems) {
      const row = [];
      const previousObjects = objects;
      objects = row;
        const x = 48;
        const y = 0;
        const imageRef = hasApprovedProductImage(item.product) ? item.product.image : "";
        if (imageRef) objects.push(createObject("image", { name: `${item.requirementTitle} product image`, x, y: y + 52, width: 150, height: 160, style: { objectFit: "contain" }, data: { imageRef, alt: item.product.name } }));
        objects.push(label(`${item.requirementTitle} title`, item.requirementTitle, x, y, 698, 30, 18, "#102d25", "700"));
        if (!item.product) {
          objects.push(label(`${item.requirementTitle} review`, item.reason, x, objects[0].height + 14, 680, 0, 13, "#8d3c27", "500"));
        } else {
        const product = item.product;
        const textX = imageRef ? x + 176 : x;
        const textWidth = imageRef ? 512 : 688;
        let cursor = y + 52;
        const addText = (name, text, size, color = "#42534a", weight = "500") => {
          const object = label(name, text, textX, cursor, textWidth, 0, size, color, weight);
          objects.push(object);
          cursor += object.height + 14;
        };
        const details = [product.brand, product.range, product.model || product.sku].filter(Boolean).join(" · ");
        addText(`${item.requirementTitle} product name`, product.name, 16, "#102d25", "700");
        if (details) addText(`${item.requirementTitle} product identity`, details, 12);
        const recordedPrice = productPrice(product);
        if (recordedPrice !== null) addText(`${item.requirementTitle} price`, `${product.currency || "AUD"} ${recordedPrice.toFixed(2)} · catalogue unit price${product.unit ? ` / ${product.unit}` : ""}`, 12, "#8a6115", "700");
        const description = product.description || product.specification || "Product specifications are not recorded in the Product Library.";
        addText(`${item.requirementTitle} specification`, description, 12);
        if (item.missingInformation?.length) addText(`${item.requirementTitle} review note`, `Builder review: ${item.missingInformation.join(", ")}.`, 11, "#8d3c27");
        }
      objects = previousObjects;
      const height = Math.max(...row.map((object) => object.y + object.height)) + 30;
      if (position + height > 1035 && objects.length > 2) {
        finishPage();
        startPage();
      }
      for (const object of row) objects.push({ ...object, y: object.y + position });
      position += height;
    }
    finishPage();
  }
  if (pendingPage) pages.push(pendingPage);
  return pages;
}

function contentsPage(pages, branding) {
  const sourceSections = [
    ["Overview and construction specification", 6],
    ["Site Preparation & Foundations & Slab", 6], ["Structural & External", 6], ["Driveway", 6], ["General Inclusions", 6],
    ["Kitchen", 7], ["Appliances - master artwork", 8], ["Kitchen finishes", 9],
    ["Bathroom, Ensuite Laundry & WC", 10], ["Electrical", 10], ["Windows & Doors", 10], ["Robes & Linen Cupboards", 10],
    ["Internal Finishes", 11], ["Plumbing & Drainage", 11], ["Roofing", 11], ["Painting", 11], ["Flooring", 11],
  ];
  const seenSections = new Set();
  const selections = pages.flatMap((page, index) => index < 10 ? [] : page.objects.filter((object) => ["Section heading", "Selection section"].includes(object.name)).flatMap((object) => {
    const section = object.data.text.replace(/\n/g, " ");
    if (seenSections.has(section)) return [];
    seenSections.add(section);
    return [[`${section} selections`, index + 2]];
  }));
  const rows = [...sourceSections, ...selections];
  return createA4Page({ name: "Contents", objects: [
    label("Contents heading", "Contents", 48, 55, 698, 46, 32, "#102d25", "700"),
    label("Builder identity", branding.businessName || branding.legalName || "", 48, 112, 698, 30, 14),
    ...rows.flatMap(([title, number], index) => [
      label(`Contents ${index + 1}`, title, 48, 176 + index * 27, 630, 23, 12),
      label(`Contents page ${index + 1}`, String(number), 714, 176 + index * 27, 32, 23, 12, "#8a6115", "700"),
    ]),
  ] });
}

export function generateMasterInclusionsSchedule({ scheduleId, tier = "Premier", priceLevel = "mid-range", products = [], branding = {} } = {}) {
  const selectedTier = STANDARD_INCLUSION_TIERS.includes(tier) ? tier : "Premier";
  const selectedPriceLevel = STANDARD_TIER_SETTINGS[selectedTier]?.priceLevel || priceLevel;
  const priceQuantile = PRODUCT_QUANTILE_BY_LEVEL[selectedPriceLevel] ?? PRODUCT_QUANTILE_BY_LEVEL["mid-range"];
  const levelLabel = PRICE_LABEL_BY_LEVEL[selectedPriceLevel] || "Mid-range";
  const normalizedProducts = (products || []).map(normalizeCatalogueProduct).filter(product => product.productId && product.name && product.active);
  const requirements = MASTER_REQUIREMENTS.map((reference) => (
    selectedTier === "Classic" && ["Oven", "Cooktop"].includes(reference.title) ? { ...reference, widthMm: 600 }
      : selectedTier === "Classic" && reference.title === "Rangehood" ? { ...reference, widthsMm: [600] } : reference
  ));
  const candidatesByRequirement = catalogueCandidatesForMasterRequirements(normalizedProducts, requirements);
  const productItems = requirements.map(requirement => {
    return productReviewItem(
    requirement,
    levelLabel,
    chooseFamilyPrice(candidatesByRequirement[requirement.key || `${requirement.section}::${requirement.title}`] || [], priceQuantile),
  );
  });
  const items = STANDARD_TIER_SETTINGS[selectedTier] ? [...comprehensiveConstructionReviewItems(), ...productItems] : productItems;
  const sectionOrder = [...new Set(items.map(item => item.category))];
  items.sort((left, right) => sectionOrder.indexOf(left.category) - sectionOrder.indexOf(right.category));
  const document = createPremierInclusionsWorkingCopy({ builderId: "builder", workbookId: scheduleId || "" });
  document.id = `standard-inclusions-${scheduleId || Date.now()}`;
  document.name = `${selectedTier} Inclusions Schedule`;
  document.pages = [...document.pages, ...productDetailPages(items, selectedTier, levelLabel)];
  document.metadata = {
    ...(document.metadata || {}),
    documentSource: "native-master-template",
    masterTemplateId: "premier-inclusions-master-template",
    immutableMaster: false,
    generatedTier: selectedTier,
    productPriceLevel: selectedPriceLevel,
    productPriceLevelLabel: levelLabel,
  };
  templateImagePage(document);
  repairKitchenArtwork(document);
  separateTermiteSpecification(document);
  applyBrandingAndTier(document, { tier: selectedTier, branding });
  fitMasterText({ pages: document.pages.slice(0, 10) });
  document.pages.splice(1, 0, contentsPage(document.pages, branding));
  if (STANDARD_TIER_SETTINGS[selectedTier]) document.pages = buildTierBrochurePages({ items, tier: selectedTier, branding, name: document.name });
  document.activePageId = document.pages[0]?.id || null;
  const gaps = items.filter(item => !item.product && item.productRequired !== false).map(item => ({ category: item.category, requirementTitle: item.requirementTitle, reason: item.reason }));
  return { document, items, gaps, priceLevel: levelLabel, tier: selectedTier };
}

export function buildTierBrochurePages({ items = [], tier = "Premier", branding = {}, name = "" }) {
  const settings = STANDARD_TIER_SETTINGS[tier] || STANDARD_TIER_SETTINGS.Premier;
  const business = branding.businessName || branding.legalName || "Builder branding requires review";
  const contact = [branding.phone, branding.email, branding.website].filter(Boolean).join(" | ");
  const image = (name, imageRef, x, y, width, height, productId = "") => createObject("image", {
    name,
    x,
    y,
    width,
    height,
    style: { objectFit: "cover" },
    data: { imageRef, alt: name, ...(productId ? { productId } : {}) },
  });
  const band = (name, fill, x, y, width, height, opacity = 1) => createObject("shape", { name, x, y, width, height, opacity, style: { fill, strokeWidth: 0 } });
  const logo = branding.logo ? [createObject("logo", { name: "Builder logo", x: 48, y: 46, width: 190, height: 90, style: { objectFit: "contain" }, data: { imageRef: branding.logo, alt: business } })] : [];
  const cover = tier === "Classic" ? [image("Classic residential cover", settings.cover, 0, 0, 794, 650), band("Cover title band", "#ffffff", 0, 650, 794, 473), ...logo,
    label("Tier heading", "Classic", 48, 700, 698, 85, 54, settings.accent, "700"), label("Cover title", "Inclusions Schedule", 48, 798, 698, 60, 32), label("Builder identity", business, 48, 900, 698, 60, 22), label("Builder contact", contact, 48, 1000, 698, 55, 12)]
    : tier === "Premier" ? [image("Premier kitchen cover", settings.cover, 304, 0, 490, 1123), band("Premier editorial panel", "#142c35", 0, 0, 304, 1123), ...logo,
      label("Tier heading", "Premier", 32, 420, 250, 90, 42, "#ffffff", "700"), label("Cover title", "Inclusions\nSchedule", 32, 530, 250, 120, 30, "#ffffff"), label("Builder identity", business, 32, 825, 240, 100, 19, "#ffffff"), label("Builder contact", contact, 32, 990, 240, 85, 11, "#ffffff")]
      : [image("Premium living cover", settings.cover, 0, 0, 794, 1123), band("Premium title overlay", "#17151d", 0, 660, 794, 463, 0.85), ...logo,
        label("Tier heading", "Premium", 48, 710, 698, 100, 60, "#ffffff", "700"), label("Cover title", "Inclusions Schedule", 48, 835, 698, 60, 32, "#ffffff"), label("Builder identity", business, 48, 945, 698, 50, 22, "#ffffff"), label("Builder contact", contact, 48, 1035, 698, 55, 12, "#ffffff")];
  if (items.some(item => item.reviewStatus !== "approved" && item.reviewStatus !== "rejected")) cover.push(label("Draft review status", "DRAFT - BUILDER REVIEW REQUIRED", tier === "Premier" ? 32 : 48, tier === "Classic" ? 1060 : tier === "Premier" ? 170 : 675, tier === "Premier" ? 240 : 698, 24, 11, tier === "Classic" ? settings.accent : "#ffffff", "700"));
  const pages = [createA4Page({ name: `${tier} cover`, objects: cover.map((object, layer) => ({ ...object, layer })) }), createA4Page({ name: "Contents" })];
  const sections = new Map();
  for (const item of items.filter(item => item.reviewStatus !== "rejected")) sections.set(item.category, [...(sections.get(item.category) || []), item]);
  let pendingPage = null;
  for (const [section, sectionItems] of sections) {
    let objects;
    let cursor;
    let part = 1;
    const start = () => {
      objects = [label("Section heading", section, 48, 44, 698, 50, 26, settings.accent, "700")];
      cursor = 125;
    };
    const finish = () => {
      if (pendingPage) pages.push(pendingPage);
      objects.push(label("Builder footer", `${business} | ${tier} | ${pages.length + 1}`, 48, 1080, 698, 24, 10));
      pendingPage = createA4Page({ name: `${section}${part > 1 ? ` ${part}` : ""}`, objects });
      part += 1;
    };
    start();
    if (pendingPage) {
      const prior = pendingPage.objects.filter(object => object.name !== "Builder footer");
      const bottom = Math.max(...prior.map(object => object.y + object.height));
      if (bottom < 500) {
        const heading = label("Section heading", section, 48, bottom + 34, 698, 50, 26, settings.accent, "700");
        objects = [...prior, heading];
        cursor = heading.y + heading.height + 30;
        pendingPage = null;
      }
    }
    for (const item of sectionItems) {
      const unresolved = !item.product && item.productRequired !== false && item.reviewResolution !== "builder_specification";
      const text = unresolved ? `${item.reason || "Product or allowance requires builder review."}\nNo product or price has been invented.` : item.specification || item.product?.specification || item.description || "Specification requires builder review.";
      const title = item.requirementTitle || item.description || item.product?.name || section;
      const visualProduct = item.productRequired !== false;
      const width = visualProduct ? 520 : 698;
      const detail = [item.product?.brand, item.product?.name, item.product?.range, item.product?.model || item.product?.sku].filter(Boolean).join(" | ");
      const productFinish = [item.product?.colour, item.product?.finish].filter(Boolean).join(" | ");
      const texts = [label("Inclusion heading",       title, 48, 0, 698, 0, 16, settings.accent, "700")];
      let offset = texts[0].height + 12;
            const textX = visualProduct ? 226 : 48;
      if (detail) { const entry = label("Product identity", detail, textX, offset, width, 0, 12, "#183147", "700"); texts.push(entry); offset += entry.height + 12; }
      if (productFinish) { const entry = label("Product colour and finish", productFinish, textX, offset, width, 0, 11, settings.accent, "700"); texts.push(entry); offset += entry.height + 10; }
      const specification = label("Approved specification", text, textX, offset, width, 0, 12, unresolved ? "#95442b" : "#334741"); texts.push(specification); offset += specification.height + 12;
      const allowance = item.allowanceOverride !== "" && item.allowanceOverride != null ? Number(item.allowanceOverride) : item.product?.allowance ?? item.product?.price;
      if (Number.isFinite(allowance)) { const entry = label("Verified unit price", `${item.product?.currency || "AUD"} ${Number(allowance).toFixed(2)}${item.unit || item.product?.unit ? ` / ${item.unit || item.product.unit}` : ""} | catalogue / builder-approved unit basis`, textX, offset, width, 0, 11, settings.accent); texts.push(entry); offset += entry.height + 12; }
      if (hasApprovedProductImage(item.product)) texts.push(image(title, item.product.image, 48, texts[0].height + 12, 150, 150, item.product.productId));
      else if (visualProduct) {
              texts.push(band("Product image placeholder", "#eef2ef", 48, texts[0].height + 12, 150, 150));
              texts.push(label("Product image review", "IMAGE REVIEW\nREQUIRED", 56, texts[0].height + 58, 134, 48, 11, "#66766e", "700"));
      }
      const height = Math.max(offset, ...texts.map(object => object.y + object.height)) + 26;
      if (cursor + height > 1050 && objects.length > 1) { finish(); start(); }
      for (const object of texts) objects.push({ ...object, y: object.y + cursor });
      cursor += height;
    }
    finish();
  }
  if (pendingPage) pages.push(pendingPage);
  const indexed = new Set();
  const index = pages.flatMap((page, number) => number < 2 ? [] : page.objects.filter(object => object.name === "Section heading").sort((left, right) => left.y - right.y).flatMap(object => {
    const section = object.data.text.replace(/\n/g, " ");
    if (indexed.has(section)) return [];
    indexed.add(section);
    return [[section, number + 1]];
  }));
  let contentsY = 205;
  pages[1].objects = [label("Contents heading", "Contents", 48, 55, 400, 60, 34, settings.accent, "700"), label("Builder identity", business, 48, 130, 400, 35, 16),
    ...index.flatMap(([section, number], position) => {
      const heading = label(`Contents ${position}`, section, 48, contentsY, 340, 24, 13);
      const pageNumber = label(`Contents page ${position}`, String(number), 412, contentsY, 36, 24, 13, settings.accent, "700");
      contentsY += heading.height + 10;
      return [heading, pageNumber];
    })];
  return applyBrochurePhotography(pages);
}

export function masterInclusionRequirementSections() {
  return [...new Set(MASTER_REQUIREMENTS.map(item => item.section))];
}

export function masterInclusionRequirements() {
  return MASTER_REQUIREMENTS.map((requirement) => ({ ...requirement }));
}
