import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";
import { hasApprovedProductImage } from "./productProposal.mjs";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

const THEMES = {
  Budget: { ink: "#163f36", accent: "#ca8c52", paper: "#f4f1e9", label: "ESSENTIAL COLLECTION" },
  "Mid-range": { ink: "#123b46", accent: "#bf8a45", paper: "#f2f0e9", label: "SIGNATURE COLLECTION" },
  "High-end": { ink: "#17191d", accent: "#c4a06a", paper: "#f4f0e9", label: "RESERVE COLLECTION" },
  Custom: { ink: "#123b46", accent: "#bf8a45", paper: "#f2f0e9", label: "BESPOKE COLLECTION" },
};

const DESIGN_VARIANTS = {
  Luxury: { ink: "#1a1b1f", accent: "#b9945f", paper: "#f3efe8" },
  Modern: { ink: "#123b46", accent: "#bf8a45", paper: "#f2f0e9" },
  Coastal: { ink: "#164754", accent: "#c89b69", paper: "#eef4f2" },
};

const LIFESTYLE_IMAGES = {
  cover: "/assets/builders/standard-inclusions-premier-kitchen.webp",
  overview: "/assets/builders/standard-inclusions-premier-living.jpg",
  kitchen: "/images/catalogues/product-library/rooms/kitchen-cabinetry-appliances.jpg",
  bathroom: "/images/catalogues/product-library/rooms/ensuite-shower-vanity.jpg",
  flooring: "/images/client-selections/client-selections-flooring.webp",
};

const BROCHURE_CHAPTERS = [
  {
    key: "site-structure",
    title: "Site works & structure",
    eyebrow: "A CONFIDENT FOUNDATION",
    summary: "Professional services, site preparation and the structural systems that establish the quality of the home.",
    sections: ["Preliminaries & Site Works", "Concrete & Structural"],
    image: "/assets/builders/standard-inclusions-construction-strip.png",
  },
  {
    key: "external-envelope",
    title: "Roofing & external finishes",
    eyebrow: "BUILT FOR THE AUSTRALIAN LANDSCAPE",
    summary: "A coordinated exterior palette of masonry, cladding, roofing and durable weather protection.",
    sections: ["External Walls & Cladding", "Roofing"],
    image: "/images/catalogues/product-library/rooms/exterior-house-facade.jpg",
  },
  {
    key: "doors-windows",
    title: "Windows, doors & hardware",
    eyebrow: "WELCOME HOME",
    summary: "Windows, glazing, entry doors, internal doors and hardware selected for security, light and everyday ease.",
    sections: ["Windows & External Doors", "Internal Doors", "Internal Door Hardware"],
    image: "/images/client-selections/internal-doors.webp",
  },
  {
    key: "interior-finishes",
    title: "Joinery & interior finishes",
    eyebrow: "DETAILS THAT COMPLETE THE HOME",
    summary: "Storage, internal linings, trim and paint finishes brought together as a calm, coherent interior.",
    sections: ["Storage & Joinery", "Internal Linings & Finishes"],
    image: "/images/catalogues/product-library/rooms/internal-hallway-interior.jpg",
  },
  {
    key: "kitchen",
    title: "Kitchen collection",
    eyebrow: "THE HEART OF THE HOME",
    summary: "Cabinetry, benchtops, appliances, sinks and tapware presented with their exact selected product identities.",
    sections: ["Kitchen Cabinetry", "Kitchen Benchtops", "Kitchen Appliances", "Kitchen Plumbing"],
    image: LIFESTYLE_IMAGES.kitchen,
  },
  {
    key: "bathrooms",
    title: "Bathrooms & ensuites",
    eyebrow: "CALM, REFINED, ENDURING",
    summary: "Sanitaryware, tapware, shower fittings and tiles composed as a complete bathroom collection.",
    sections: ["Bathrooms & Ensuites", "Bathroom Tiling"],
    image: LIFESTYLE_IMAGES.bathroom,
  },
  {
    key: "laundry-flooring",
    title: "Laundry & flooring",
    eyebrow: "PRACTICAL BEAUTY",
    summary: "A functional laundry and coordinated floor finishes selected for comfort, durability and visual continuity.",
    sections: ["Laundry", "Floor Coverings"],
    image: "/images/catalogues/product-library/rooms/laundry-cabinetry-appliances.jpg",
  },
  {
    key: "stairs-electrical",
    title: "Stairs, lighting & electrical",
    eyebrow: "CONNECTED, LIT AND CONSIDERED",
    summary: "Stair and balustrade details supported by a practical electrical and lighting specification.",
    sections: ["Stairs & Balustrades", "Electrical & Lighting"],
    image: "/images/catalogues/product-library/rooms/living-lounge-room.jpg",
  },
  {
    key: "services-external",
    title: "Comfort systems & external works",
    eyebrow: "COMFORT INSIDE. LIVEABILITY OUTSIDE.",
    summary: "Heating, cooling, hot water and external works that support comfortable living throughout the year.",
    sections: ["Heating, Cooling & Hot Water", "External Works"],
    image: "/images/catalogues/product-library/rooms/alfresco-outdoor-entertaining.jpg",
  },
];

function createPrototypePage(props) {
  return createA4Page({
    ...props,
    objects: (props.objects || []).map((object, layer) => ({ ...object, layer })),
  });
}

function resolveTheme(packageChoice, designStyle = "Modern") {
  const packageTheme = THEMES[packageChoice] || THEMES["Mid-range"];
  return { ...packageTheme, ...(DESIGN_VARIANTS[designStyle] || DESIGN_VARIANTS.Modern) };
}

function text(name, value, x, y, width, height, size, color, weight = "400", options = {}) {
  return createObject("text", {
    name,
    x,
    y,
    width,
    height,
    locked: true,
    style: {
      fontFamily: options.fontFamily || "Arial",
      fontSize: size,
      fontWeight: weight,
      color,
      lineHeight: options.lineHeight || 1.25,
      letterSpacing: options.letterSpacing || 0,
      textTransform: options.textTransform,
    },
    data: { text: String(value || "") },
  });
}

function shape(name, fill, x, y, width, height, options = {}) {
  return createObject("shape", {
    name,
    x,
    y,
    width,
    height,
    locked: true,
    opacity: options.opacity ?? 1,
    style: {
      fill,
      stroke: options.stroke || "transparent",
      strokeWidth: options.strokeWidth || 0,
      borderRadius: options.borderRadius || 0,
    },
  });
}

function image(name, imageRef, x, y, width, height, options = {}) {
  return createObject("image", {
    name,
    x,
    y,
    width,
    height,
    locked: true,
    style: { objectFit: options.objectFit || "cover", borderRadius: options.borderRadius || 0 },
    data: {
      imageRef,
      alt: options.alt || name,
      ...(options.productId ? { productId: options.productId } : {}),
      ...(options.illustrativeOnly ? { illustrativeOnly: true } : {}),
    },
  });
}

function tidy(value, maxLength = 150) {
  const clean = String(value || "")
    .replace(/Â/g, "")
    .replace(/[•|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
}

function productDetail(item) {
  const product = item?.product || {};
  return {
    requirement: item?.requirementTitle || "",
    id: product.productId || "",
    name: product.name || item?.description || "",
    brand: product.brand || "",
    model: product.model || product.sku || "",
    finish: [product.colour, product.finish].filter(Boolean).join(" · "),
    image: hasApprovedProductImage(product) ? product.image : "",
    specification: tidy(item?.specification || product.specification || product.description, 120),
  };
}

function selected(items, titles, limit) {
  const order = new Map(titles.map((title, index) => [title, index]));
  return items
    .filter((item) => order.has(item.requirementTitle) && item.product?.productId && hasApprovedProductImage(item.product))
    .sort((left, right) => order.get(left.requirementTitle) - order.get(right.requirementTitle))
    .slice(0, limit)
    .map(productDetail);
}

function footer(theme, pageNumber) {
  return [
    shape("Footer rule", theme.accent, 54, 1064, 686, 2),
    text("Footer label", "GR8 RESULT  ·  STANDARD INCLUSIONS", 54, 1078, 560, 20, 9, theme.ink, "700", { letterSpacing: 1.4 }),
    text("Footer page", String(pageNumber).padStart(2, "0"), 696, 1078, 44, 20, 9, theme.ink, "700"),
  ];
}

function productCard(product, x, y, width, height, theme, variant = "standard") {
  const imageWidth = variant === "wide" ? 174 : 128;
  const imageHeight = height - 28;
  const copyX = x + imageWidth + 34;
  const copyWidth = width - imageWidth - 54;
  const tallCard = height >= 220;
  const nameHeight = tallCard ? 82 : 52;
  const identityY = tallCard ? y + 138 : y + 108;
  const detailY = tallCard ? y + 168 : y + 140;
  return [
    shape(`${product.requirement} card`, "#ffffff", x, y, width, height, { borderRadius: 14, stroke: "#dfe5e2", strokeWidth: 1 }),
    image(`${product.requirement} product image`, product.image, x + 14, y + 14, imageWidth, imageHeight, {
      objectFit: "contain",
      borderRadius: 9,
      productId: product.id,
      alt: `${product.brand} ${product.name}`.trim(),
    }),
    text(`${product.requirement} category`, product.requirement.toUpperCase(), copyX, y + 22, copyWidth, 18, 9, theme.accent, "700", { letterSpacing: 1.2 }),
    text(`${product.requirement} name`, product.name, copyX, y + 48, copyWidth, nameHeight, tallCard ? 14 : 15, theme.ink, "700", { fontFamily: "Georgia", lineHeight: 1.12 }),
    text(`${product.requirement} identity`, [product.brand, product.model].filter(Boolean).join("  ·  "), copyX, identityY, copyWidth, 24, 10, "#53645f", "700"),
    text(`${product.requirement} finish`, product.finish || product.specification, copyX, detailY, copyWidth, height - (detailY - y) - 16, 10, "#64736f", "400", { lineHeight: 1.3 }),
  ];
}

// A product requirement the builder resolved with its own verified specification (no catalogue product).
function isBuilderSpecification(item) {
  return item?.reviewResolution === "builder_specification" && Boolean(String(item?.specification || "").trim());
}

function visualIssueType(item) {
  const title = String(item?.requirementTitle || item?.description || "");
  const product = item?.product || {};
  if (!item?.productRequired) return "";
  if (!product.productId) return isBuilderSpecification(item) ? "" : "missing_product";
  if (/floor tiles?/i.test(title) && /wall tile/i.test(String(product.name || ""))) {
    return "incompatible_product";
  }
  if (/cabinet handles?/i.test(title) && /external door|entry door|lockset/i.test(`${product.category || ""} ${product.name || ""}`)) {
    return "incompatible_product";
  }
  if (!hasApprovedProductImage(product)) return "missing_image";
  return "";
}

function visualIssue(item) {
  const issueType = visualIssueType(item);
  if (issueType === "missing_product") return "No verified catalogue product is selected.";
  if (issueType === "missing_image") {
    return item?.product?.image
      ? "The catalogue image is awaiting Product Library verification, so this product is shown without a photo."
      : "The verified catalogue product has no approved image, so it is shown without a photo.";
  }
  if (issueType === "incompatible_product" && /floor tiles?/i.test(String(item?.requirementTitle || item?.description || ""))) {
    return "The selected product is identified as a wall tile for a floor-tile requirement.";
  }
  if (issueType === "incompatible_product") return "The selected product is external-door hardware rather than cabinet hardware.";
  return "";
}

function inclusionDetail(item) {
  const product = item?.product || {};
  if (item?.productRequired && !product.productId && isBuilderSpecification(item)) {
    const specification = tidy(item.specification, 190);
    return {
      title: tidy(specification, 80),
      identity: "Builder-verified specification",
      detail: specification.length > 80 ? specification : "No catalogue product or price is attached.",
    };
  }
  if (item?.productRequired) {
    const identity = [product.brand, product.model || product.sku, product.colour, product.finish].filter(Boolean).join(" · ");
    return {
      title: product.name || item.requirementTitle || item.description || "Product selection",
      identity,
      detail: tidy(product.specification || product.description || item.specification || item.description, 112),
    };
  }
  const specification = tidy(item?.specification, 112);
  const repetitiveReviewCopy = /requires builder confirmation against the plans, engineering and retained master specification/i.test(specification);
  return {
    title: item?.requirementTitle || item?.description || "Included construction requirement",
    identity: item?.group || item?.category || "",
    detail: repetitiveReviewCopy
      ? "Builder review against approved plans, engineering and the retained construction specification."
      : tidy(specification || item?.description || "Included in the structured schedule.", 112),
  };
}

function inclusionCard(item, x, y, width, height, theme, compact = false) {
  const product = item?.product || {};
  const hasImage = Boolean(item?.productRequired && product.productId && hasApprovedProductImage(product));
  const imageSize = compact ? 70 : 94;
  const inset = compact ? 12 : 14;
  const copyX = hasImage ? x + imageSize + inset * 2 + 8 : x + 18;
  const copyWidth = width - (copyX - x) - 16;
  const detail = inclusionDetail(item);
  const objects = [
    shape(`${item.requirementTitle || item.description} inclusion card`, "#ffffff", x, y, width, height, {
      borderRadius: 12,
      stroke: "#dfe5e2",
      strokeWidth: 1,
    }),
  ];
  if (hasImage) {
    objects.push(image(
      `${item.requirementTitle || item.description} exact product image`,
      product.image,
      x + inset,
      y + inset,
      imageSize,
      height - inset * 2,
      {
        objectFit: "contain",
        borderRadius: 8,
        productId: product.productId,
        alt: `${product.brand || ""} ${product.name || item.requirementTitle || ""}`.trim(),
      },
    ));
  } else {
    objects.push(shape(`${item.requirementTitle || item.description} accent`, theme.accent, x, y, 5, height, {
      borderRadius: 4,
    }));
  }
  objects.push(
    text(`${item.requirementTitle || item.description} requirement`, String(item.requirementTitle || item.description || "").toUpperCase(), copyX, y + (compact ? 12 : 16), copyWidth, 16, compact ? 7.5 : 8, theme.accent, "700", { letterSpacing: 0.9 }),
    text(
      `${item.requirementTitle || item.description} title`,
      tidy(detail.title, hasImage ? (compact ? 45 : 58) : (compact ? 65 : 80)),
      copyX,
      y + (compact ? 30 : 38),
      copyWidth,
      compact ? 36 : 44,
      compact ? 11 : 13,
      theme.ink,
      "700",
      { fontFamily: "Georgia", lineHeight: 1.12 },
    ),
  );
  if (detail.identity) {
    objects.push(text(
      `${item.requirementTitle || item.description} identity`,
      tidy(detail.identity, hasImage ? 34 : 58),
      copyX,
      y + (compact ? 68 : 86),
      copyWidth,
      18,
      compact ? 8 : 9,
      "#53645f",
      "700",
    ));
  }
  objects.push(text(
    `${item.requirementTitle || item.description} detail`,
    tidy(detail.detail, compact ? (hasImage ? 72 : 100) : 112),
    copyX,
    y + (compact ? 88 : 111),
    copyWidth,
    Math.max(18, height - (compact ? 98 : 123)),
    compact ? 8 : 9,
    "#64736f",
    "400",
    { lineHeight: 1.28 },
  ));
  return objects;
}

function chapterPage({ chapter, items, theme, pageNumber, continuation = false, chapterPageNumber = 1 }) {
  const contentTop = continuation ? 188 : 346;
  const rowsPerColumn = Math.max(1, Math.ceil(items.length / 2));
  const gap = continuation ? 8 : 10;
  const availableHeight = continuation ? 826 : 654;
  const rowHeight = Math.floor((availableHeight - (rowsPerColumn - 1) * gap) / rowsPerColumn);
  const cardWidth = 330;
  const objects = continuation
    ? [
        shape(`${chapter.title} continuation header`, theme.ink, 0, 0, A4_WIDTH, 150),
        shape(`${chapter.title} continuation accent`, theme.accent, 54, 52, 58, 3),
        text(`${chapter.title} continuation eyebrow`, chapter.eyebrow, 132, 43, 500, 20, 9, "#f1d7ad", "700", { letterSpacing: 1.6 }),
        text(`${chapter.title} continuation title`, `${chapter.title} · continued`, 54, 72, 650, 62, 24, "#ffffff", "700", { fontFamily: "Georgia", lineHeight: 1.08 }),
      ]
    : [
        image(`${chapter.title} lifestyle`, chapter.image, 0, 0, A4_WIDTH, 304, { illustrativeOnly: true, alt: chapter.title }),
        shape(`${chapter.title} hero overlay`, "linear-gradient(90deg, rgba(8,29,34,0.94) 0%, rgba(8,29,34,0.56) 56%, rgba(8,29,34,0.08) 100%)", 0, 0, A4_WIDTH, 304),
        shape(`${chapter.title} hero accent`, theme.accent, 54, 66, 58, 3),
        text(`${chapter.title} eyebrow`, chapter.eyebrow, 132, 56, 530, 20, 9, "#f1d7ad", "700", { letterSpacing: 1.7 }),
        text(`${chapter.title} heading`, chapter.title, 54, 100, 600, 76, 34, "#ffffff", "700", { fontFamily: "Georgia", lineHeight: 1.08 }),
        text(`${chapter.title} summary`, chapter.summary, 54, 202, 570, 64, 12, "#eef3f1", "400", { lineHeight: 1.45 }),
      ];
  items.forEach((item, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const x = 54 + column * 356;
    const y = contentTop + row * (rowHeight + gap);
    objects.push(...inclusionCard(item, x, y, cardWidth, rowHeight, theme, rowHeight < 140));
  });
  objects.push(...footer(theme, pageNumber));
  return createPrototypePage({
    name: `${chapter.title}${chapterPageNumber > 1 ? ` ${chapterPageNumber}` : ""}`,
    data: {
      brochureChapter: chapter.key,
      chapterPageNumber,
      inclusionItemIds: items.map((item) => item.id),
      productIds: items.map((item) => item.product?.productId).filter(Boolean),
    },
    background: { color: theme.paper },
    objects,
  });
}

function chapterPages({ items, theme, startingPageNumber }) {
  const pages = [];
  let pageNumber = startingPageNumber;
  for (const chapter of BROCHURE_CHAPTERS) {
    const chapterItems = items.filter((item) => chapter.sections.includes(item.category));
    let offset = 0;
    const pageCount = Math.max(1, Math.ceil(chapterItems.length / 10));
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const chapterPageNumber = pageIndex + 1;
      const continuation = chapterPageNumber > 1;
      const pagesRemaining = pageCount - pageIndex;
      const pageSize = Math.ceil((chapterItems.length - offset) / pagesRemaining);
      const pageItems = chapterItems.slice(offset, offset + pageSize);
      pages.push(chapterPage({
        chapter,
        items: pageItems,
        theme,
        pageNumber,
        continuation,
        chapterPageNumber,
      }));
      offset += pageItems.length;
      pageNumber += 1;
    }
  }
  return pages;
}

function coverPage({ name, packageChoice, branding, theme }) {
  const business = branding.businessName || branding.legalName || "GR8 Result";
  const contact = [branding.phone, branding.website].filter(Boolean).join("  ·  ");
  return createPrototypePage({
    name: "Design prototype - Cover",
    metadata: { brochurePrototypePage: "cover" },
    objects: [
      image("Architectural kitchen", LIFESTYLE_IMAGES.cover, 0, 0, A4_WIDTH, A4_HEIGHT, { illustrativeOnly: true }),
      shape("Cover tonal overlay", "linear-gradient(90deg, rgba(9,27,31,0.96) 0%, rgba(9,27,31,0.78) 47%, rgba(9,27,31,0.08) 78%)", 0, 0, A4_WIDTH, A4_HEIGHT),
      shape("Cover accent", theme.accent, 54, 214, 76, 4),
      ...(branding.logo ? [image("Builder logo", branding.logo, 54, 54, 180, 94, { objectFit: "contain", alt: business })] : []),
      text("Collection label", theme.label, 54, 164, 400, 24, 11, "#ffffff", "700", { letterSpacing: 2.1 }),
      text("Cover heading", "Inclusions,\nbeautifully considered.", 54, 248, 430, 190, 46, "#ffffff", "700", { fontFamily: "Georgia", lineHeight: 1.04 }),
      text("Cover summary", `${packageChoice} building inclusions selected for enduring style, everyday performance and confident living.`, 58, 470, 360, 96, 16, "#edf3f1", "400", { lineHeight: 1.45 }),
      text("Schedule name", name, 58, 745, 360, 80, 22, "#ffffff", "700", { fontFamily: "Georgia" }),
      text("Builder identity", business, 58, 858, 360, 30, 13, "#ffffff", "700"),
      text("Builder contact", contact, 58, 900, 360, 46, 11, "#d7e0dd"),
      text("Cover note", "Product photography throughout this brochure represents the exact catalogue selections included in this schedule.", 58, 1008, 386, 54, 9, "#d7e0dd", "400", { lineHeight: 1.4 }),
    ],
  });
}

function overviewPage({ items, packageChoice, theme }) {
  const matched = items.filter((item) => item.productRequired && item.product?.productId).length;
  return createPrototypePage({
    name: "Design prototype - Inclusions overview",
    metadata: { brochurePrototypePage: "overview" },
    background: { color: theme.paper },
    objects: [
      image("Contemporary living inspiration", LIFESTYLE_IMAGES.overview, 420, 0, 374, A4_HEIGHT, { illustrativeOnly: true }),
      shape("Overview image fade", "linear-gradient(90deg, #f2f0e9 0%, rgba(242,240,233,0.88) 16%, rgba(242,240,233,0) 58%)", 394, 0, 400, A4_HEIGHT),
      text("Overview eyebrow", `${packageChoice.toUpperCase()} PACKAGE`, 54, 62, 310, 22, 10, theme.accent, "700", { letterSpacing: 1.8 }),
      text("Overview title", "A complete home,\nclearly specified.", 54, 105, 350, 120, 36, theme.ink, "700", { fontFamily: "Georgia", lineHeight: 1.08 }),
      text("Overview introduction", "A confident inclusions schedule should be simple to understand. Product choices are shown visually, while construction requirements remain structured behind the brochure for pricing and quotation use.", 54, 252, 324, 130, 13, "#40534e", "400", { lineHeight: 1.55 }),
      shape("Overview statistic one", "#ffffff", 54, 416, 148, 110, { borderRadius: 12 }),
      text("Overview item count", String(items.length), 72, 438, 110, 40, 29, theme.ink, "700", { fontFamily: "Georgia" }),
      text("Overview item label", "structured inclusions", 72, 485, 110, 22, 9, "#64736f", "700"),
      shape("Overview statistic two", "#ffffff", 218, 416, 160, 110, { borderRadius: 12 }),
      text("Overview product count", String(matched), 236, 438, 120, 40, 29, theme.ink, "700", { fontFamily: "Georgia" }),
      text("Overview product label", "catalogue selections", 236, 485, 126, 22, 9, "#64736f", "700"),
      text("Overview section title", "Inside the collection", 54, 584, 300, 34, 18, theme.ink, "700", { fontFamily: "Georgia" }),
      ...[
        ["KITCHEN", "Appliances, cabinetry, benchtops and tapware"],
        ["BATHROOMS", "Sanitaryware, tapware, tiles and accessories"],
        ["INTERIORS", "Flooring, doors, hardware, paint and lighting"],
        ["EXTERIORS", "Windows, roofing, cladding and external finishes"],
      ].flatMap(([label, copy], index) => {
        const y = 646 + index * 92;
        return [
          shape(`Overview ${label} rule`, theme.accent, 54, y, 34, 2),
          text(`Overview ${label}`, label, 106, y - 6, 110, 20, 10, theme.ink, "700", { letterSpacing: 1.2 }),
          text(`Overview ${label} copy`, copy, 106, y + 24, 268, 46, 11, "#53645f", "400", { lineHeight: 1.35 }),
        ];
      }),
      ...footer(theme, 2),
    ],
  });
}

function kitchenPage({ items, theme }) {
  const products = selected(items, ["Oven", "Cooktop", "Kitchen mixer tap", "Kitchen sink", "Dishwasher"], 4);
  return createPrototypePage({
    name: "Design prototype - Kitchen",
    metadata: { brochurePrototypePage: "kitchen", productIds: products.map((product) => product.id) },
    background: { color: theme.paper },
    objects: [
      image("Kitchen lifestyle", LIFESTYLE_IMAGES.kitchen, 0, 0, A4_WIDTH, 390, { illustrativeOnly: true }),
      shape("Kitchen hero overlay", "linear-gradient(180deg, rgba(10,34,38,0.06) 20%, rgba(10,34,38,0.88) 100%)", 0, 0, A4_WIDTH, 390),
      text("Kitchen eyebrow", "THE HEART OF THE HOME", 54, 246, 400, 22, 10, "#f1d7ad", "700", { letterSpacing: 2 }),
      text("Kitchen title", "Kitchen", 54, 282, 400, 70, 42, "#ffffff", "700", { fontFamily: "Georgia" }),
      text("Kitchen intro", "Real catalogue products, shown exactly as selected.", 310, 310, 430, 34, 13, "#ffffff", "400"),
      ...products.flatMap((product, index) => productCard(product, 54 + (index % 2) * 350, 430 + Math.floor(index / 2) * 292, 336, 260, theme)),
      ...footer(theme, 3),
    ],
  });
}

function bathroomPage({ items, theme }) {
  const products = selected(items, ["Vanity basin", "Basin mixer", "Toilet suite", "Showerhead", "Bath"], 4);
  return createPrototypePage({
    name: "Design prototype - Bathroom",
    metadata: { brochurePrototypePage: "bathroom", productIds: products.map((product) => product.id) },
    background: { color: "#f7f5ef" },
    objects: [
      image("Bathroom lifestyle", LIFESTYLE_IMAGES.bathroom, 444, 0, 350, A4_HEIGHT, { illustrativeOnly: true }),
      shape("Bathroom photo fade", "linear-gradient(90deg, #f7f5ef 0%, rgba(247,245,239,0.94) 15%, rgba(247,245,239,0) 58%)", 418, 0, 376, A4_HEIGHT),
      text("Bathroom eyebrow", "BATHROOM COLLECTION", 54, 56, 326, 22, 10, theme.accent, "700", { letterSpacing: 1.9 }),
      text("Bathroom title", "Calm, refined,\nand made to last.", 54, 96, 342, 118, 34, theme.ink, "700", { fontFamily: "Georgia", lineHeight: 1.08 }),
      text("Bathroom intro", "Selected sanitaryware and tapware are presented with their real brand, model and finish.", 54, 232, 320, 66, 12, "#53645f", "400", { lineHeight: 1.45 }),
      ...products.flatMap((product, index) => productCard(product, 54, 324 + index * 178, 356, 160, theme)),
      ...footer(theme, 4),
    ],
  });
}

function flooringPage({ items, theme }) {
  const products = selected(items, ["Carpet", "Hybrid flooring", "Engineered timber flooring", "Vinyl flooring"], 3);
  return createPrototypePage({
    name: "Design prototype - Flooring",
    metadata: { brochurePrototypePage: "flooring", productIds: products.map((product) => product.id) },
    background: { color: theme.paper },
    objects: [
      image("Flooring lifestyle", LIFESTYLE_IMAGES.flooring, 0, 0, A4_WIDTH, 362, { illustrativeOnly: true }),
      shape("Flooring hero overlay", "linear-gradient(90deg, rgba(10,31,34,0.9) 0%, rgba(10,31,34,0.36) 58%, rgba(10,31,34,0.04) 100%)", 0, 0, A4_WIDTH, 362),
      text("Flooring eyebrow", "FLOORING COLLECTION", 54, 76, 400, 22, 10, "#f1d7ad", "700", { letterSpacing: 2 }),
      text("Flooring title", "Comfort underfoot.\nCharacter throughout.", 54, 118, 470, 112, 36, "#ffffff", "700", { fontFamily: "Georgia", lineHeight: 1.08 }),
      text("Flooring intro", "Every finish is tied to the selected Product Library record.", 54, 258, 430, 40, 12, "#ffffff"),
      ...products.flatMap((product, index) => productCard(product, 54, 406 + index * 204, 686, 178, theme, "wide")),
      ...footer(theme, 5),
    ],
  });
}

export function buildInclusionsBrochurePrototype({ items = [], branding = {}, name = "", packageChoice = "Mid-range" } = {}) {
  const theme = resolveTheme(packageChoice);
  const context = { items, branding, name, packageChoice, theme };
  const pages = [
    coverPage(context),
    overviewPage(context),
    kitchenPage(context),
    bathroomPage(context),
    flooringPage(context),
  ];
  return {
    id: `standard-inclusions-design-prototype-${Date.now()}`,
    name: `${name || "Standard Inclusions"} - five-page design prototype`,
    pages,
    activePageId: pages[0].id,
    selection: { selectedObjectIds: [], lastSelectedObjectId: null },
    metadata: {
      brochureDesignPrototype: true,
      packageChoice,
      generatedAt: new Date().toISOString(),
      productIds: [...new Set(pages.flatMap((page) => page.metadata?.productIds || []))],
    },
  };
}

export function buildInclusionsBrochureDocument({ items = [], branding = {}, name = "", packageChoice = "Mid-range", designStyle = "Modern" } = {}) {
  const theme = resolveTheme(packageChoice, designStyle);
  const context = { items, branding, name, packageChoice, theme };
  const cover = { ...coverPage(context), name: "Cover", data: { brochurePage: "cover" } };
  const overview = { ...overviewPage(context), name: "Inclusions overview", data: { brochurePage: "overview" } };
  const contentPages = chapterPages({ items, theme, startingPageNumber: 3 });
  const pages = [cover, overview, ...contentPages];
  const renderedItemIds = contentPages.flatMap((page) => page.data?.inclusionItemIds || []);
  const productItems = items.filter((item) => item.productRequired);
  const visualIssues = productItems
    .map((item) => ({
      itemId: item.id,
      requirementTitle: item.requirementTitle,
      productId: item.product?.productId || "",
      issueType: visualIssueType(item),
      issue: visualIssue(item),
    }))
    .filter((entry) => entry.issue);
  return {
    id: `standard-inclusions-brochure-${Date.now()}`,
    name: `${name || "Standard Inclusions"} brochure`,
    pages,
    activePageId: pages[0].id,
    selection: { selectedObjectIds: [], lastSelectedObjectId: null },
    metadata: {
      brochureDesignSystem: "gr8-editorial-v1",
      completeResidentialSchedule: true,
      packageChoice,
      designStyle,
      generatedAt: new Date().toISOString(),
      requiredItemCount: items.length,
      renderedItemCount: renderedItemIds.length,
      renderedItemIds,
      productRequirementCount: productItems.length,
      matchedProductCount: productItems.filter((item) => item.product?.productId).length,
      exactProductImageCount: productItems.filter((item) => item.product?.productId && hasApprovedProductImage(item.product) && !visualIssue(item)).length,
      productIds: [...new Set(productItems.map((item) => item.product?.productId).filter(Boolean))],
      visualIssues,
      approvalBlocked: visualIssues.length > 0,
    },
  };
}
