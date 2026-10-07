import { clamp, deepClone, uid } from "./editorUtils.js";

const BLOCK_RADIUS_DEFAULTS = {
  header: 8,
  text: 0,
  image: 0,
  button: 0,
  divider: 0,
  spacer: 0,
  hero: 12,
  imageText: 12,
  quote: 12,
  promo: 14,
  video: 12,
  contact: 12,
  grid: 0,
  list: 0,
  gridCard: 12,
  listCard: 12,
  social: 10,
  footer: 8,
};

export function defaultBlockRadius(type = "") {
  return BLOCK_RADIUS_DEFAULTS[String(type || "")] ?? 0;
}

export function resolveBlockRadius(props = {}, fallback = 0) {
  return clamp(Number(props?.blockRadius ?? fallback), 0, 120);
}

export function withNormalizedBlockProps(type, props = {}) {
  const merged = { ...deepClone(DEFAULTS[type] || {}), ...(props || {}) };
  if (merged.blockRadius === undefined) {
    merged.blockRadius = defaultBlockRadius(type);
  }
  if (type === "image" && (!Object.prototype.hasOwnProperty.call(props || {}, "bgColor") || String(merged.bgColor || "").toLowerCase() === "#f8fafc")) {
    merged.bgColor = "transparent";
  }
  if (type === "imageText") {
    const isLegacyDefaultLayout = Number(props?.headlineY ?? 28) === 28
      && Number(props?.subtextY ?? 56) === 56
      && Number(props?.buttonY ?? 84) === 84;
    if (!Object.prototype.hasOwnProperty.call(props || {}, "buttonY") || isLegacyDefaultLayout) {
      merged.buttonY = 78;
    }
    if (!Object.prototype.hasOwnProperty.call(props || {}, "buttonBoxHeightPx") || isLegacyDefaultLayout) {
      merged.buttonBoxHeightPx = Math.max(84, Number(merged.buttonBoxHeightPx || 72));
    }
  }
  return merged;
}

const DEFAULT_EMAIL_SETTINGS = {
  preheaderText: "",
  outerBgColor: "#dbe3ea",
  outerBgImageSrc: "",
  outerBgRepeat: "no-repeat",
  canvasBgColor: "#ffffff",
  canvasWidth: 600,
  canvasRadius: 16,
};

export function normalizeEmailSettings(raw = {}) {
  return {
    ...DEFAULT_EMAIL_SETTINGS,
    ...raw,
    canvasWidth: clamp(raw?.canvasWidth ?? DEFAULT_EMAIL_SETTINGS.canvasWidth, 420, 900),
    canvasRadius: clamp(raw?.canvasRadius ?? DEFAULT_EMAIL_SETTINGS.canvasRadius, 0, 32),
  };
}

export function extractEmailSettings(blocks = []) {
  const meta = (Array.isArray(blocks) ? blocks : []).find((b) => b?.type === "__emailSettings");
  return normalizeEmailSettings(meta?.props || {});
}

export function stripEmailMetaBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).filter((b) => b?.type !== "__emailSettings");
}

export function packBlocksForSave(blocks = [], emailSettings = {}) {
  return [
    { id: uid(), type: "__emailSettings", props: normalizeEmailSettings(emailSettings) },
    ...stripEmailMetaBlocks(blocks),
  ];
}

export const DEFAULTS = {
  header: {
    logoSrc: "", title: "Your Email Title", subtitle: "Subtitle or tagline here",
    bgColor: "#1d4ed8", textColor: "#ffffff", bgImageSrc: "", bgRepeat: "no-repeat",
    titleColor: "#ffffff", subtitleColor: "#dbeafe", titleSize: 28, subtitleSize: 16,
    logoWidthPct: 28, logoHeightPx: 84,
  },
  text: {
    html: "<p>Your text goes here.</p>",
    bgColor: "#ffffff", textColor: "#1e293b", fontSize: 20, align: "left", variant: "body", fontFamily: "Arial, Helvetica, sans-serif", bgImageSrc: "", bgRepeat: "no-repeat",
  },
  image: {
    src: "", alt: "Image", linkHref: "", align: "center", widthPct: 100, borderRadius: 0,
    bgColor: "transparent", fitMode: "cover",
    imageX: 50, imageY: 50,
    heightPx: 220, overlayEnabled: true, overlayTitle: "Click to edit headline", overlayText: "Click to edit supporting text", overlayPosition: "center", overlayBgColor: "rgba(15,23,42,0.38)", textColor: "#ffffff", overlayX: 50, overlayY: 50,
    overlayTitleColor: "#ffffff", overlayTextColor: "#f8fafc", overlayTitleSize: 24, overlayTextSize: 14,
    overlayImageSrc: "", overlayImageX: 50, overlayImageY: 22, overlayImageWidthPct: 24, overlayImageHeightPx: 72, overlayImageRadius: 8,
  },
  button: {
    text: "Click Here", href: "#",
    bgColor: "#2563eb", textColor: "#ffffff", borderRadius: 8, align: "center",
    blockBgColor: "transparent",
    widthMode: "auto", widthPx: 200, paddingY: 12,
  },
  divider: { color: "#e2e8f0", thickness: 1, style: "solid", widthPct: 100 },
  spacer: { height: 36, bgColor: "transparent" },
  hero: {
    imageSrc: "", headline: "Your Big Headline",
    subtext: "Supporting text that explains the value proposition.",
    ctaText: "Get Started", ctaHref: "#",
    bgColor: "#0f172a", textColor: "#ffffff", bgImageSrc: "", bgRepeat: "no-repeat",
    ctaBgColor: "#2563eb", ctaTextColor: "#ffffff",
    imageWidthPct: 100, imageHeightPx: 220, imageX: 50, imageY: 50,
    headlineColor: "#ffffff", subtextColor: "#e5e7eb", headlineSize: 30, subtextSize: 15,
    paddingY: 36,
  },
  imageText: {
    imageSrc: "",
    headline: "Text over your image",
    subtext: "Add a headline and supporting copy directly on top of the image.",
    buttonText: "Learn More",
    href: "#",
    textColor: "#ffffff",
    headlineColor: "#ffffff",
    subtextColor: "#e5e7eb",
    headlineSize: 30,
    subtextSize: 15,
    buttonBgColor: "#2563eb",
    buttonTextColor: "#ffffff",
    overlayShade: "rgba(15,23,42,0.45)",
    overlayImageSrc: "",
    overlayImageX: 50,
    overlayImageY: 18,
    overlayImageWidthPct: 24,
    overlayImageHeightPx: 72,
    overlayImageRadius: 8,
    headlineX: 50,
    headlineY: 28,
    headlineBoxWidthPct: 78,
    headlineBoxHeightPx: 84,
    subtextX: 50,
    subtextY: 56,
    subtextBoxWidthPct: 84,
    subtextBoxHeightPx: 92,
    buttonX: 50,
    buttonY: 78,
    buttonBoxWidthPct: 36,
    buttonBoxHeightPx: 84,
    align: "center",
    height: 320,
  },
  quote: {
    avatarSrc: "",
    quote: "This is a powerful testimonial from a happy client.",
    author: "Client Name",
    role: "Company or Role",
    bgColor: "#eff6ff",
    textColor: "#0f172a",
  },
  promo: {
    badge: "Limited Offer",
    headline: "Special promotion for your clients",
    details: "Add urgency, discount details, or a quick benefit statement here.",
    code: "SAVE20",
    buttonText: "Claim Offer",
    href: "#",
    bgColor: "#111827",
    accentColor: "#f59e0b",
    textColor: "#ffffff",
  },
  video: {
    thumbnailSrc: "",
    title: "Watch our latest video",
    caption: "Use this block to send people to a webinar, product demo, or case study video.",
    buttonText: "Watch Now",
    href: "#",
    bgColor: "#0f172a",
    textColor: "#ffffff",
  },
  contact: {
    heading: "Need help?",
    name: "Your Name",
    role: "Customer Success",
    email: "hello@example.com",
    phone: "+1 (555) 123-4567",
    address: "123 Business Street, City",
    buttonText: "Book a Call",
    href: "#",
    bgColor: "#f8fafc",
    textColor: "#0f172a",
  },
  grid: {
    bgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    columnsPerRow: 2,
    columns: [
      { imageSrc: "", title: "Card One", text: "Description text goes here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 160, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
      { imageSrc: "", title: "Card Two", text: "Description text goes here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 160, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
    ],
  },
  list: {
    bgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    itemsPerRow: 1,
    items: [
      { imageSrc: "", title: "Item One", text: "Description here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 110, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
      { imageSrc: "", title: "Item Two", text: "Description here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 110, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
    ],
  },
  gridCard: {
    groupId: "",
    sectionBgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    perRow: 2,
    bgColor: "#ffffff",
    imageSrc: "",
    imageWidthPct: 100,
    imageHeightPx: 160,
    overlayEnabled: false,
    overlayBgColor: "rgba(15,23,42,0.38)",
    overlayX: 50,
    overlayY: 50,
    title: "Card Title",
    text: "Description text goes here.",
    linkHref: "",
  },
  listCard: {
    groupId: "",
    sectionBgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    perRow: 1,
    bgColor: "#ffffff",
    imageSrc: "",
    imageWidthPct: 100,
    imageHeightPx: 110,
    overlayEnabled: false,
    overlayBgColor: "rgba(15,23,42,0.38)",
    overlayX: 50,
    overlayY: 50,
    title: "List Item",
    text: "Description here.",
    linkHref: "",
  },
  social: {
    bgColor: "#eff6ff",
    platforms: [
      { name: "facebook",  href: "https://facebook.com/" },
      { name: "instagram", href: "https://instagram.com/" },
      { name: "linkedin",  href: "https://linkedin.com/" },
      { name: "x",        href: "https://x.com/" },
      { name: "youtube",  href: "https://youtube.com/" },
    ],
  },
  footer: {
    company: "Your Company", address: "123 Street, City, Country",
    unsubscribeHref: "#", unsubscribeText: "Unsubscribe", bgColor: "#f1f5f9", textColor: "#64748b",
  },
};

export function makeBlock(type) {
  return { id: uid(), type, props: withNormalizedBlockProps(type) };
}

export function isCardBlockType(type) {
  return type === "gridCard" || type === "listCard";
}

export function makeGroupedCardBlocks(type) {
  const groupId = uid();
  const count = type === "gridCard" ? 2 : 2;
  return Array.from({ length: count }, (_, idx) => ({
    id: uid(),
    type,
    props: {
      ...withNormalizedBlockProps(type),
      groupId,
      title: type === "gridCard" ? `Card ${idx + 1}` : `Item ${idx + 1}`,
    },
  }));
}

export function normalizeBlocksForEditor(blocks = []) {
  const next = [];

  for (const rawBlock of Array.isArray(blocks) ? blocks : []) {
    if (!rawBlock?.type) continue;

    if (rawBlock.type === "grid") {
      const groupId = uid();
      const sectionBgColor = rawBlock.props?.bgColor || "#ffffff";
      const perRow = clamp(rawBlock.props?.columnsPerRow || (rawBlock.props?.columns?.length || 2), 1, 4);
      const columns = Array.isArray(rawBlock.props?.columns) && rawBlock.props.columns.length
        ? rawBlock.props.columns
        : [deepClone(DEFAULTS.gridCard), deepClone(DEFAULTS.gridCard)];

      columns.forEach((col, idx) => {
        next.push({
          id: uid(),
          type: "gridCard",
          props: {
            ...withNormalizedBlockProps("gridCard"),
            groupId,
            sectionBgColor,
            sectionHeadline: rawBlock.props?.sectionHeadline || "",
            sectionSubtext: rawBlock.props?.sectionSubtext || "",
            perRow,
            blockRadius: resolveBlockRadius(col, defaultBlockRadius("gridCard")),
            imageSrc: col.imageSrc || "",
            title: col.title || `Card ${idx + 1}`,
            text: col.text || "Description text goes here.",
            linkHref: col.linkHref || "",
            bgColor: col.bgColor || "#ffffff",
            imageWidthPct: clamp(col.imageWidthPct || 100, 20, 100),
            imageHeightPx: clamp(col.imageHeightPx || 160, 60, 420),
            overlayEnabled: Boolean(col.overlayEnabled),
            overlayBgColor: col.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: clamp(col.overlayX || 50, 0, 100),
            overlayY: clamp(col.overlayY || 50, 0, 100),
          },
        });
      });
      continue;
    }

    if (rawBlock.type === "list") {
      const groupId = uid();
      const sectionBgColor = rawBlock.props?.bgColor || "#ffffff";
      const perRow = clamp(rawBlock.props?.itemsPerRow || 1, 1, 4);
      const items = Array.isArray(rawBlock.props?.items) && rawBlock.props.items.length
        ? rawBlock.props.items
        : [deepClone(DEFAULTS.listCard), deepClone(DEFAULTS.listCard)];

      items.forEach((item, idx) => {
        next.push({
          id: uid(),
          type: "listCard",
          props: {
            ...withNormalizedBlockProps("listCard"),
            groupId,
            sectionBgColor,
            sectionHeadline: rawBlock.props?.sectionHeadline || "",
            sectionSubtext: rawBlock.props?.sectionSubtext || "",
            perRow,
            blockRadius: resolveBlockRadius(item, defaultBlockRadius("listCard")),
            imageSrc: item.imageSrc || "",
            title: item.title || `Item ${idx + 1}`,
            text: item.text || "Description here.",
            linkHref: item.linkHref || "",
            bgColor: item.bgColor || "#ffffff",
            imageWidthPct: clamp(item.imageWidthPct || 100, 20, 100),
            imageHeightPx: clamp(item.imageHeightPx || 110, 60, 420),
            overlayEnabled: Boolean(item.overlayEnabled),
            overlayBgColor: item.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: clamp(item.overlayX || 50, 0, 100),
            overlayY: clamp(item.overlayY || 50, 0, 100),
          },
        });
      });
      continue;
    }

    if (rawBlock.type === "gridCard" || rawBlock.type === "listCard") {
      next.push({
        ...rawBlock,
        props: {
          ...deepClone(DEFAULTS[rawBlock.type] || {}),
          ...rawBlock.props,
          groupId: rawBlock.props?.groupId || uid(),
          sectionBgColor: rawBlock.props?.sectionBgColor || "#ffffff",
          sectionHeadline: rawBlock.props?.sectionHeadline || "",
          sectionSubtext: rawBlock.props?.sectionSubtext || "",
          perRow: clamp(rawBlock.props?.perRow || (rawBlock.type === "gridCard" ? 2 : 1), 1, 4),
          imageWidthPct: clamp(rawBlock.props?.imageWidthPct || 100, 20, 100),
          imageHeightPx: clamp(rawBlock.props?.imageHeightPx || (rawBlock.type === "gridCard" ? 160 : 110), 60, 420),
          overlayEnabled: Boolean(rawBlock.props?.overlayEnabled),
          overlayBgColor: rawBlock.props?.overlayBgColor || "rgba(15,23,42,0.38)",
          overlayX: clamp(rawBlock.props?.overlayX || 50, 0, 100),
          overlayY: clamp(rawBlock.props?.overlayY || 50, 0, 100),
        },
      });
      continue;
    }

    next.push({
      ...rawBlock,
      props: {
        ...deepClone(DEFAULTS[rawBlock.type] || {}),
        ...rawBlock.props,
      },
    });
  }

  return next;
}

export function collapseBlocksForExport(blocks = []) {
  const normalized = normalizeBlocksForEditor(blocks);
  const next = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const block = normalized[i];

    if (block?.type === "gridCard" && block?.props?.groupId) {
      const group = [block];
      while (
        i + 1 < normalized.length &&
        normalized[i + 1]?.type === "gridCard" &&
        normalized[i + 1]?.props?.groupId === block.props.groupId
      ) {
        group.push(normalized[i + 1]);
        i += 1;
      }

      next.push({
        id: uid(),
        type: "grid",
        props: {
          bgColor: block.props.sectionBgColor || "#ffffff",
          sectionHeadline: block.props.sectionHeadline || "",
          sectionSubtext: block.props.sectionSubtext || "",
          columnsPerRow: block.props.perRow || 2,
          columns: group.map((entry) => ({
            imageSrc: entry.props.imageSrc || "",
            title: entry.props.title || "Card",
            text: entry.props.text || "",
            linkHref: entry.props.linkHref || "",
            bgColor: entry.props.bgColor || "#ffffff",
            imageWidthPct: entry.props.imageWidthPct || 100,
            imageHeightPx: entry.props.imageHeightPx || 160,
            overlayEnabled: Boolean(entry.props.overlayEnabled),
            overlayBgColor: entry.props.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: entry.props.overlayX || 50,
            overlayY: entry.props.overlayY || 50,
          })),
        },
      });
      continue;
    }

    if (block?.type === "listCard" && block?.props?.groupId) {
      const group = [block];
      while (
        i + 1 < normalized.length &&
        normalized[i + 1]?.type === "listCard" &&
        normalized[i + 1]?.props?.groupId === block.props.groupId
      ) {
        group.push(normalized[i + 1]);
        i += 1;
      }

      next.push({
        id: uid(),
        type: "list",
        props: {
          bgColor: block.props.sectionBgColor || "#ffffff",
          sectionHeadline: block.props.sectionHeadline || "",
          sectionSubtext: block.props.sectionSubtext || "",
          itemsPerRow: block.props.perRow || 1,
          items: group.map((entry) => ({
            imageSrc: entry.props.imageSrc || "",
            title: entry.props.title || "Item",
            text: entry.props.text || "",
            linkHref: entry.props.linkHref || "",
            bgColor: entry.props.bgColor || "#ffffff",
            imageWidthPct: entry.props.imageWidthPct || 100,
            imageHeightPx: entry.props.imageHeightPx || 110,
            overlayEnabled: Boolean(entry.props.overlayEnabled),
            overlayBgColor: entry.props.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: entry.props.overlayX || 50,
            overlayY: entry.props.overlayY || 50,
          })),
        },
      });
      continue;
    }

    next.push({
      ...block,
      props: withNormalizedBlockProps(block.type, block.props || {}),
    });
  }

  return next;
}
