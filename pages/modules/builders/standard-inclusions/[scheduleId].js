import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { supabase } from "../../../../utils/supabase-client";
import { createPremierInclusionsDocument } from "../../../../components/document-engine/templates/standardInclusionsTemplate.js";
import { createA4Page } from "../../../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../../../components/document-engine/core/objectEngine.js";
import { isInclusionsDraftApprovable, missingProductInformation, rankCatalogueCandidatesForCategories } from "../../../../lib/standard-inclusions/productProposal.mjs";
import { suggestSelectionSlot, SELECTION_SLOTS } from "../../../../lib/standard-inclusions/jobBaseline.mjs";
import { generateMasterInclusionsSchedule, buildTierBrochurePages, catalogueCandidatesForMasterRequirement, catalogueCandidatesForMasterRequirements, masterInclusionRequirements } from "../../../../lib/standard-inclusions/simpleScheduleGenerator.mjs";
import { applyBrochurePhotography, isBrochurePhotograph } from "../../../../lib/standard-inclusions/brochurePhotography.mjs";
import { buildInclusionsBrochureDocument, buildInclusionsBrochurePrototype } from "../../../../lib/standard-inclusions/brochureDesignPrototype.mjs";
import { RESIDENTIAL_INCLUSION_STRUCTURE } from "../../../../lib/standard-inclusions/residentialInclusionStructure.mjs";
import { approveConstructionSection, inclusionCanBeApproved, refreshInclusionReview, requiredChecklistApproved, STANDARD_TIER_SETTINGS, scheduleGenerationBlockReason, scheduleApprovalIssues, mergeScheduleBranding } from "../../../../lib/standard-inclusions/tierScheduleReview.mjs";

const DocumentPageBuilder = dynamic(() => import("../../../../components/document-engine/editor/DocumentPageBuilder.jsx"), {
  ssr: false,
  loading: () => <div className="state">Loading brochure editor...</div>,
});

const STARTER_CATEGORIES = RESIDENTIAL_INCLUSION_STRUCTURE.map((section) => section.title);
const VISUAL_PRODUCT_REQUIREMENTS = masterInclusionRequirements();
const TOTAL_INCLUSION_ITEMS = RESIDENTIAL_INCLUSION_STRUCTURE.reduce((total, section) => total + section.groups.reduce((groupTotal, group) => groupTotal + group.items.length, 0), 0);
const TOTAL_PRODUCT_INCLUSIONS = VISUAL_PRODUCT_REQUIREMENTS.length;

export async function getServerSideProps(context) {
  const initialScheduleId = String(context.params?.scheduleId || "").trim();
  if (!initialScheduleId) return { notFound: true };
  return { props: { initialScheduleId } };
}

function valueText(value) {
  return String(value ?? "").trim();
}

function brochureContentSignature(document) {
  return JSON.stringify(document ? { name: document.name, pages: document.pages } : null);
}

function specificationText(value) {
  if (!value || typeof value !== "object") return valueText(value);
  const entries = Array.isArray(value) ? value.map((entry, index) => [String(index + 1), entry]) : Object.entries(value);
  return entries.map(([key, entry]) => {
    const display = Array.isArray(entry) ? entry.join(", ") : String(entry ?? "").trim();
    return display ? `${key}: ${display}` : "";
  }).filter(Boolean).join("; ");
}

function canonicalBrandName(value) {
  const brand = valueText(value);
  if (/^(?:classic\s+)?colorbond(?:\s+steel)?$/i.test(brand)) return "COLORBOND steel";
  if (/^hume(?:\s+doors)?$/i.test(brand) || /^hume timber and doors$/i.test(brand)) return "Hume Doors & Timber";
  return brand;
}

function normalizeProduct(row) {
  const entity = row?.metadata?.productEntity || {};
  const attributes = entity.attributes || row?.attributes || {};
  return {
    productId: String(row?.id || row?.productId || row?.stableProductId || row?.productCode || ""),
    name: valueText(row?.product_name || row?.productName || entity.productName || row?.name),
    familyKey: valueText(entity.familyKey || row?.familyKey),
    categoryKey: valueText(entity.categoryKey || row?.categoryKey),
    requirementKeys: row?.requirementKeys || entity.requirementKeys || [],
    productType: valueText(entity.productType || entity.familyKey || row?.familyKey || row?.selection_type),
    selectionSlotIds: Array.isArray(row?.selection_slot_ids || row?.selectionSlotIds || entity.selectionSlotIds) ? (row.selection_slot_ids || row.selectionSlotIds || entity.selectionSlotIds).map(String) : [],
    brand: canonicalBrandName(entity.brand || row?.manufacturer_name || row?.brand || row?.manufacturer),
    range: valueText(entity.range || row?.metadata?.range || row?.range),
    model: valueText(row?.model || row?.productModel || entity.model || row?.sku),
    sku: valueText(row?.sku || entity.supplierSku),
    colour: valueText(entity.colour || entity.color || attributes.colour || attributes.color || row?.colour || row?.color),
    finish: valueText(entity.finish || attributes.finish || row?.finish),
    category: valueText(entity.category || row?.quote_structure_section || entity.topLevelArea || row?.topLevelArea || row?.categoryKey || row?.selection_type || row?.category),
    description: valueText(row?.description || entity.description),
    specification: specificationText(entity.specification || entity.specifications || attributes.specification || attributes.specifications),
    supplier: valueText(entity.supplier || row?.supplier),
    image: valueText(row?.primary_image_url || row?.primaryImageUrl || row?.thumbnailUrl || row?.imageReference || entity.primaryImage || entity.primaryImageUrl),
    imageStatus: valueText(entity.imageStatus || row?.image_status || row?.imageStatus),
    imageSource: valueText(entity.imageSource || row?.image_source || row?.imageSource || row?.sourceName),
    availableOptions: entity.attributes?.selectionFacets || entity.selectionFacets || row?.metadata?.selectionFacets || attributes.selectionFacets || {},
    unit: valueText(row?.unit || row?.priceUnit || entity.priceUnit || entity.unit),
    allowance: (row?.base_allowance ?? row?.allowance ?? row?.builderCost) == null ? null : Number(row.base_allowance ?? row.allowance ?? row.builderCost),
    price: (row?.upgrade_cost ?? row?.clientPrice ?? row?.builderPrice ?? row?.rrp ?? row?.price) == null ? null : Number(row.upgrade_cost ?? row.clientPrice ?? row.builderPrice ?? row.rrp ?? row.price),
    priceSource: valueText(entity.priceSource || row?.priceSource || row?.sourceName || row?.metadata?.priceSource || (row?.price != null || row?.clientPrice != null ? "Product Library price; source not recorded" : "")),
    priceEffectiveDate: valueText(entity.priceEffectiveDate || entity.priceVerifiedAt || row?.priceEffectiveDate || row?.priceUpdatedAt || row?.sourceVerifiedAt),
    gstIncluded: typeof (entity.gstIncluded ?? entity.priceIncludesGst ?? row?.gstIncluded ?? row?.priceIncludesGst) === "boolean" ? (entity.gstIncluded ?? entity.priceIncludesGst ?? row?.gstIncluded ?? row?.priceIncludesGst) : null,
    currency: valueText(entity.currency || "AUD"),
    active: row?.active !== false && row?.enabled !== false && row?.selectable !== false && entity.active !== false && entity.archived !== true,
  };
}

function initialDraft(schedule) {
  const saved = schedule?.metadata?.inclusionsDraft || {};
  return {
    status: saved.status || "Draft",
    categories: Array.isArray(saved.categories) && saved.categories.length ? saved.categories : STARTER_CATEGORIES,
    items: Array.isArray(saved.items) ? saved.items : [],
    gaps: Array.isArray(saved.gaps) ? saved.gaps : [],
    gapDetails: Array.isArray(saved.gapDetails) ? saved.gapDetails : [],
    excludedCategories: Array.isArray(saved.excludedCategories) ? saved.excludedCategories : [],
    preferences: { market: "", brands: "", suppliers: "", budget: "", budgetType: "inclusions", qualityLevel: "Standard", maxUnitAllowance: "", specifications: "", notes: "", ...(saved.preferences || {}) },
  };
}

function textObject(name, text, x, y, width, height, fontSize, color, fontWeight = "500", fontFamily = "Arial") {
  return createObject("text", {
    name, x, y, width, height,
    style: { fontFamily, fontSize, fontWeight, color, lineHeight: 1.18, textAlign: "left" },
    data: { text: String(text || "") },
  });
}

const PACKAGE_OPTIONS = {
  Budget: { tierKey: "Classic", priceLevel: "budget" },
  "Mid-range": { tierKey: "Premier", priceLevel: "mid-range" },
  "High-end": { tierKey: "Premium", priceLevel: "high-end" },
  Custom: { tierKey: "Premier", priceLevel: "mid-range" },
};

const DESIGN_STYLES = {
  Luxury: { primary: "#17151d", accent: "#b8945a", surface: "#f7f3ec", headingFont: "Georgia" },
  Modern: { primary: "#142c35", accent: "#b57b35", surface: "#f3f6f5", headingFont: "Arial" },
  Coastal: { primary: "#245b68", accent: "#c58b62", surface: "#f2f8f8", headingFont: "Georgia" },
};

function applySectionPreferences(items, sectionPreferences, products) {
  const preferenceAliases = {
    Kitchen: ["Kitchen appliances and tapware", "Kitchen cabinetry and benchtops"],
    "Bathroom, Ensuite Laundry & WC": ["Bathrooms and ensuites", "Laundry"],
    Electrical: ["Electrical and lighting", "Technology and communications"],
    "Windows & Doors": ["Windows and external doors", "Internal doors and door furniture"],
    "Internal Finishes": ["Painting and finishes", "Internal walls and ceilings"],
    Flooring: ["Flooring"],
    "Plumbing & Drainage": ["Plumbing and hot water"],
    Roofing: ["Roofing"],
    Driveway: ["Site works and preliminary items", "Outdoor areas and landscaping"],
    "Robes & Linen Cupboards": ["Other builder-specific inclusions"],
  };
  return refreshInclusionReview({
    items: items.map((item) => {
      const preference = sectionPreferences[item.requirementKey]
        || sectionPreferences[item.category]
        || (preferenceAliases[item.category] || []).map((category) => sectionPreferences[category]).find((entry) => entry?.mode === "builder")
        || {};
      if (item.productRequired === false) {
        return preference.mode === "builder" && valueText(preference.specification)
          ? { ...item, specification: valueText(preference.specification), reviewStatus: "needs_review", reason: "Builder-supplied construction specification; verify before approval." }
          : item;
      }
      if (preference.mode !== "builder") return item;
      const preferredBrand = valueText(preference.brand).toLowerCase();
      if (!preferredBrand || !item.requirementCategory) return item;
      const candidates = rankCatalogueCandidatesForCategories(
        products.filter((product) => valueText(product.brand).toLowerCase() === preferredBrand),
        [item.requirementCategory],
        { perCategory: 20, totalLimit: 20 },
      );
      const product = candidates[0];
      return product ? {
        ...item,
        product,
        description: product.description || product.name,
        specification: product.specification || product.description || item.specification,
        unit: product.unit || item.unit || "",
        price: product.price,
        allowanceOverride: "",
        missingInformation: [],
        origin: "workspace-product-library",
        reason: `Builder-preferred ${product.brand || "catalogue"} product selected from the effective Product Library.`,
      } : item;
    }),
  });
}

const requirementSelectionKey = (requirement) => requirement.key || `${requirement.section}::${requirement.title}`;

function inspirationImageMatches(asset, category) {
  if (category === "all") return true;
  const text = `${asset.name || ""} ${(asset.tags || []).join(" ")}`.toLowerCase();
  const terms = {
    cover: ["cover", "home", "house", "elevation", "facade", "completed"],
    kitchen: ["kitchen", "cabinet", "benchtop"],
    bathroom: ["bathroom", "ensuite", "bath", "shower"],
    interior: ["interior", "living", "bedroom", "dining"],
    external: ["external", "exterior", "elevation", "facade", "outdoor"],
  }[category] || [];
  return terms.some((term) => text.includes(term));
}

function applyExactProductSelections(items, productSelections, products) {
  return refreshInclusionReview({
    items: items.map((item) => {
      if (item.productRequired === false) return item;
      const productId = productSelections[item.requirementKey] || productSelections[`${item.category}::${item.requirementTitle}`];
      if (!productId) return item;
      const product = products.find((candidate) => candidate.productId === productId);
      if (!product || !catalogueCandidatesForMasterRequirement([product], {
        section: item.category,
        title: item.requirementTitle,
        category: item.requirementCategory,
      }).length) return item;
      return {
        ...item,
        id: `selected:${item.category}:${item.requirementTitle}:${product.productId}`,
        product: { ...product },
        description: product.name,
        specification: product.specification || product.description || "",
        unit: product.unit || "",
        price: product.price,
        includedUnitPrice: product.allowance ?? product.price,
        allowanceOverride: "",
        missingInformation: missingProductInformation(product),
        reviewStatus: "generated",
        origin: "workspace-product-library",
        reason: "Builder-selected exact product from the effective Product Library.",
      };
    }),
  });
}

function applyBrochurePresentation(document, { designStyle = "Modern", selectedImages = [], sectionAssignments = {} } = {}) {
  if (!document) return null;
  const theme = DESIGN_STYLES[designStyle] || DESIGN_STYLES.Modern;
  const next = JSON.parse(JSON.stringify(document));
  next.pages = (next.pages || []).filter((page) => !page.metadata?.brochureMediaPage).map((page) => ({
    ...page,
    background: { ...(page.background || {}), color: page.background?.color || "#ffffff" },
    objects: (page.objects || []).map((object) => {
      if (object.type === "text") {
        const prominent = /heading|title|tier|business/i.test(object.name || "") && !/^#fff(?:fff)?$/i.test(object.style?.color || "");
        return {
          ...object,
          style: {
            ...(object.style || {}),
            ...(prominent ? { color: theme.primary, fontFamily: theme.headingFont } : {}),
          },
        };
      }
      if (object.type === "shape" && !object.data?.brochurePhotography && object.style?.fill && object.style.fill !== "#ffffff") {
        return { ...object, style: { ...object.style, fill: /divider|accent|gold/i.test(object.name || "") ? theme.accent : theme.primary } };
      }
      return object;
    }),
  }));
  next.pages = applyBrochurePhotography(next.pages, { selectedImages, sectionAssignments });
  next.activePageId = next.pages[0]?.id || null;
  next.metadata = { ...(next.metadata || {}), designStyle, selectedImageIds: selectedImages.map((asset) => asset.id) };
  return next;
}

function buildBrochureDocument({ schedule, branding, includedFields, items, categories, tierKey }) {
  const businessName = includedFields.businessName !== false ? valueText(branding.businessName) : "";
  const phone = includedFields.phone !== false ? valueText(branding.phone) : "";
  const website = includedFields.website !== false ? valueText(branding.website) : "";
  const logo = includedFields.logo !== false ? valueText(branding.logo) : "";
  const brandColours = valueText(branding.colours).match(/#[0-9a-f]{3,8}\b/gi) || [];
  const primary = brandColours[0] || "#102d25";
  const accent = brandColours[1] || "#bd8b45";
  const fontNames = valueText(branding.fonts).split(/[,;\n]/).map((font) => font.trim()).filter(Boolean);
  const headingFont = fontNames[0] || "Georgia";
  const bodyFont = fontNames[1] || "Arial";
  const document = createPremierInclusionsDocument({ id: schedule.id, name: schedule.name, metadata: { scheduleId: schedule.id, sourceTemplate: "Premier Inclusions Master" } });
  const coverAndWelcome = document.pages.slice(0, 2).map((page) => ({
    ...page,
    objects: page.objects.map((object) => {
      if (object.type === "logo") return logo ? { ...object, data: { ...(object.data || {}), imageRef: logo, alt: businessName || "Builder logo" } } : null;
      if (object.type !== "text") {
        if (object.type !== "shape") return object;
        return {
          ...object,
          style: {
            ...(object.style || {}),
            fill: object.style?.fill === "#0b2545" ? primary : object.style?.fill === "#d29a37" ? accent : object.style?.fill,
            stroke: object.style?.stroke === "#0b2545" ? primary : object.style?.stroke === "#d29a37" ? accent : object.style?.stroke,
          },
        };
      }

      let text = String(object.data?.text || "")
        .replace(/Goodbuild Quality Builders|Goodbuild/gi, businessName || "Builder")
        .replace(/Premier/gi, tierKey || "Inclusions")
        .replace(/1300 1231 456/g, phone)
        .replace(/goodbuild\.com\.au/gi, website);
      if (!text.trim()) return null;
      return {
        ...object,
        style: {
          ...(object.style || {}),
          fontFamily: object.style?.fontFamily === "Georgia" ? headingFont : bodyFont,
          color: object.style?.color === "#0b2545" ? primary : object.style?.color === "#d29a37" ? accent : object.style?.color,
        },
        data: { ...(object.data || {}), text },
      };
    }).filter(Boolean),
  }));

  const approvedItems = items.filter((item) => item.reviewStatus === "approved");
  const grouped = new Map();
  for (const category of categories || []) grouped.set(category, []);
  for (const item of approvedItems) grouped.set(item.category, [...(grouped.get(item.category) || []), item]);
  const contentPages = [];
  const contentsRows = [];
  for (const [category, categoryItems] of grouped) {
    if (!categoryItems.length) continue;
    for (let offset = 0; offset < categoryItems.length; offset += 8) {
      const pageItems = categoryItems.slice(offset, offset + 8);
      const pageNumber = 4 + contentPages.length;
      contentsRows.push({ category, pageNumber });
      const objects = [
        textObject("Section label", "APPROVED INCLUSIONS", 54, 44, 580, 18, 11, accent, "800", bodyFont),
        textObject("Category heading", category, 54, 82, 680, 48, 29, primary, "600", headingFont),
        createObject("shape", { name: "Brand divider", x: 54, y: 143, width: 680, height: 2, style: { fill: accent, stroke: accent, strokeWidth: 0 } }),
      ];
      pageItems.forEach((item, index) => {
        const y = 178 + index * 112;
        const textX = item.product?.image ? 158 : 62;
        const textWidth = item.product?.image ? 554 : 650;
        const title = item.product?.name || "Custom inclusion";
        const detail = [item.product?.brand, item.product?.range, item.product?.model, item.product?.supplier].filter(Boolean).join(" · ");
        const allowanceValue = item.allowanceOverride !== "" && item.allowanceOverride != null ? item.allowanceOverride : item.product?.allowance;
        const price = allowanceValue != null ? `Allowance: ${item.product?.currency || "AUD"} ${allowanceValue}` : "Allowance not recorded";
        const quantity = item.quantity ? `Quantity: ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "Quantity not specified";
        objects.push(textObject(`Inclusion ${index + 1}`, title, textX, y, textWidth, 25, 16, primary, "700", bodyFont));
        if (detail) objects.push(textObject(`Product details ${index + 1}`, detail, textX, y + 29, textWidth, 18, 11, "#68766e", "600", bodyFont));
        objects.push(textObject(`Description ${index + 1}`, [item.description || item.product?.description, item.product?.specification].filter(Boolean).join(" - "), textX, y + 50, textWidth, 34, 11, "#435249", "500", bodyFont));
        objects.push(textObject(`Price basis ${index + 1}`, price, textX, y + 83, textWidth, 16, 10, accent, "700", bodyFont));
        objects.push(textObject(`Quantity ${index + 1}`, quantity, textX, y + 99, textWidth, 14, 9, "#68766e", "500", bodyFont));
        if (item.product?.image) objects.push(createObject("image", { name: `${title} product image`, x: 62, y, width: 82, height: 82, style: { objectFit: "contain" }, data: { imageRef: item.product.image, alt: title } }));
      });
      objects.push(textObject("Footer business", [businessName, phone, website].filter(Boolean).join("   ·   "), 54, 1082, 680, 18, 9, "#65736a", "500", bodyFont));
      contentPages.push(createA4Page({ name: categoryItems.length > 8 ? `${category} ${Math.floor(offset / 8) + 1}` : category, background: { color: "#ffffff" }, objects }));
    }
  }

  const contentsPage = createA4Page({
    name: "Contents",
    background: { color: "#ffffff" },
    objects: [
      textObject("Contents heading", "Contents", 54, 70, 680, 50, 36, primary, "500", headingFont),
      createObject("shape", { name: "Contents divider", x: 54, y: 134, width: 680, height: 2, style: { fill: accent, stroke: accent, strokeWidth: 0 } }),
      ...contentsRows.slice(0, 24).flatMap((row, index) => [
        textObject(`Contents ${index + 1}`, row.category, 62, 170 + index * 36, 520, 25, 13, primary, "600", bodyFont),
        textObject(`Page ${index + 1}`, String(row.pageNumber), 640, 170 + index * 36, 70, 25, 13, accent, "700", bodyFont),
      ]),
    ],
  });
  const checklistPage = createA4Page({
    name: "Inclusions Checklist",
    background: { color: "#ffffff" },
    objects: [
      textObject("Checklist heading", "Inclusions checklist", 54, 70, 680, 50, 32, primary, "500", headingFont),
      ...categories.slice(0, 24).flatMap((category, index) => {
        const included = approvedItems.some((item) => item.category === category);
        return [
          textObject(`Checklist state ${index + 1}`, included ? "INCLUDED" : "REVIEW", 62, 145 + index * 36, 100, 24, 10, included ? accent : "#77847b", "800", bodyFont),
          textObject(`Checklist category ${index + 1}`, category, 170, 145 + index * 36, 540, 24, 12, primary, "600", bodyFont),
        ];
      }),
    ],
  });
  const supplierNames = [...new Set(approvedItems.map((item) => item.product?.supplier).filter(Boolean))];
  const supplierPage = supplierNames.length ? createA4Page({
    name: "Suppliers and Partners",
    background: { color: "#ffffff" },
    objects: [
      textObject("Supplier heading", "Suppliers and partners", 54, 70, 680, 50, 32, primary, "500", headingFont),
      ...supplierNames.slice(0, 24).map((supplier, index) => textObject(`Supplier ${index + 1}`, supplier, 64, 150 + index * 34, 650, 23, 13, primary, "600", bodyFont)),
    ],
  }) : null;
  const contactPage = createA4Page({
    name: "Contact",
    background: { color: "#f4f6f3" },
    objects: [
      ...(logo ? [createObject("logo", { name: "Builder logo", x: 280, y: 120, width: 230, height: 120, style: { objectFit: "contain" }, data: { imageRef: logo, alt: businessName || "Builder logo" } })] : []),
      textObject("Contact business", businessName || "Builder contact details", 80, 330, 634, 55, 30, primary, "600", headingFont),
      textObject("Contact person", includedFields.contactName !== false ? valueText(branding.contactName) : "", 80, 410, 634, 28, 15, primary, "600", bodyFont),
      textObject("Contact details", [phone, includedFields.email !== false ? valueText(branding.email) : "", website].filter(Boolean).join("\n"), 80, 470, 634, 120, 17, primary, "500", bodyFont),
      textObject("Business address", includedFields.businessAddress !== false ? valueText(branding.businessAddress) : "", 80, 620, 634, 80, 13, "#65736a", "500", bodyFont),
      textObject("Schedule title", schedule.name, 80, 930, 634, 30, 16, accent, "700", bodyFont),
    ].filter((object) => object.data?.text !== ""),
  });

  return {
    ...document,
    name: schedule.name,
    pages: [coverAndWelcome[0], contentsPage, coverAndWelcome[1], ...contentPages, checklistPage, ...(supplierPage ? [supplierPage] : []), contactPage],
    activePageId: coverAndWelcome[0]?.id || document.activePageId,
    metadata: { ...document.metadata, scheduleId: schedule.id, scheduleTier: tierKey, approvedItemsSnapshot: approvedItems },
  };
}

export default function StandardInclusionsSetup({ initialScheduleId = "" }) {
  const router = useRouter();
  const { workspaceId: contextWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const scheduleId = typeof router.query.scheduleId === "string" ? router.query.scheduleId : initialScheduleId;
  const [storedWorkspaceId, setStoredWorkspaceId] = useState("");
  const workspaceId = contextWorkspaceId || storedWorkspaceId;
  const [token, setToken] = useState("");
  const hasSession = Boolean(token);
  const [schedule, setSchedule] = useState(null);
  const [brandingProfile, setBrandingProfile] = useState(null);
  const [branding, setBranding] = useState({});
  const [includedFields, setIncludedFields] = useState({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tierKey, setTierKey] = useState("");
  const [draft, setDraft] = useState({ status: "Draft", categories: STARTER_CATEGORIES, items: [], gaps: [], excludedCategories: [], preferences: { market: "", brands: "", budget: "", notes: "" } });
  const [products, setProducts] = useState([]);
  const [searchByItem, setSearchByItem] = useState({});
  const [categoryInput, setCategoryInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadRetry, setLoadRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState("");
  const [profileWarning, setProfileWarning] = useState("");
  const [productWarning, setProductWarning] = useState("");
  const [notice, setNotice] = useState("");
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [brochureDocument, setBrochureDocument] = useState(null);
  const [prototypeDocument, setPrototypeDocument] = useState(null);
  const [prototypeOpen, setPrototypeOpen] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState(false);
  const [brandingEdited, setBrandingEdited] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [packageChoice, setPackageChoice] = useState("Mid-range");
  const [sectionPreferences, setSectionPreferences] = useState({});
  const [productSelections, setProductSelections] = useState({});
  const [expandedInclusionSections, setExpandedInclusionSections] = useState([RESIDENTIAL_INCLUSION_STRUCTURE[0]?.key]);
  const [productSearches, setProductSearches] = useState({});
  const [activeProductSection, setActiveProductSection] = useState(VISUAL_PRODUCT_REQUIREMENTS[0]?.section || "");
  const [changingRequirement, setChangingRequirement] = useState("");
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [sectionAssignments, setSectionAssignments] = useState({});
  const [showInspirationLibrary, setShowInspirationLibrary] = useState(false);
  const [inspirationCategory, setInspirationCategory] = useState("all");
  const [designStyle, setDesignStyle] = useState("Modern");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const requirementCandidates = useMemo(
    () => catalogueCandidatesForMasterRequirements(products, VISUAL_PRODUCT_REQUIREMENTS),
    [products],
  );

  useEffect(() => {
    setStoredWorkspaceId(window.localStorage.getItem("active_workspace_id") || "");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data?.session?.access_token || "")).catch(() => setToken(""));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setToken(session?.access_token || ""));
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!token || !showInspirationLibrary) return;
    let active = true;
    setMediaLoading(true);
    fetch("/api/assets/list-library?includeEmailTemplateRefs=0", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Media Library could not be loaded.");
      if (!active) return;
      setMediaLibrary((payload.images || []).map((asset, index) => ({
        id: asset.id || asset.storage_path || `media-${index}`,
        name: asset.name || asset.description || `Image ${index + 1}`,
        src: asset.url || asset.src || "",
        tags: Array.isArray(asset.tags) ? asset.tags.map(String) : [],
      })).filter((asset) => asset.src));
    }).catch((mediaError) => {
      if (active) setError(mediaError.message || "Media Library could not be loaded.");
    }).finally(() => {
      if (active) setMediaLoading(false);
    });
    return () => { active = false; };
  }, [token, showInspirationLibrary]);

  async function request(path, options = {}, timeoutMs = 45000) {
    if (!token) throw new Error("Sign in to edit this schedule.");
    if (!workspaceId) throw new Error("Select a builder workspace first.");
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetch(path, {
        ...options,
        ...(controller ? { signal: options.signal || controller.signal } : {}),
        headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId, ...(options.headers || {}) },
      });
      const payload = await response.json().catch((parseError) => {
        if (controller?.signal.aborted) throw parseError;
        throw new Error("The server returned an unreadable response. Retry loading this draft before continuing.");
      });
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Standard Inclusions request failed.");
      return payload;
    } catch (fetchError) {
      if (controller?.signal.aborted) throw new Error("This request timed out. Reopen this draft to check its saved status, then retry. No approved schedule is regenerated.");
      throw fetchError;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  async function uploadBrandAsset(kind, file) {
    if (!file) return;
    setUploadingBrand(true);
    setError("");
    try {
      const body = new FormData();
      body.append("scheduleId", scheduleId);
      body.append("kind", kind);
      body.append("file", file);
      const result = await request("/api/standard-inclusions/branding-asset", { method: "POST", body });
      invalidateApproval();
      setBrandingEdited(true);
      setBranding((current) => ({ ...current, [kind]: result.url }));
      setIncludedFields((current) => ({ ...current, [kind]: true }));
      setNotice("Logo uploaded to this schedule’s workspace-scoped brochure assets.");
    } catch (uploadError) {
      setError(uploadError.message || "Logo upload failed.");
    } finally {
      setUploadingBrand(false);
    }
  }

  useEffect(() => {
    if (workspaceLoading && !workspaceId) return undefined;
    if (!token || !workspaceId || !scheduleId) {
      setError(!token ? "Sign in to load this schedule." : !workspaceId ? "Select an authorised builder workspace to load this schedule." : "The schedule ID is missing.");
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    request(`/api/standard-inclusions/pdf-library?id=${encodeURIComponent(scheduleId)}`, {}, 20000).then((scheduleResult) => {
      if (!active) return;
      const loadedSchedule = scheduleResult.schedules?.[0];
      if (!loadedSchedule) throw new Error("Schedule not found in this workspace.");
      const loadedDraft = initialDraft(loadedSchedule);
      const persistedProducts = [...new Map(loadedDraft.items
        .map((item) => normalizeProduct(item.product))
        .filter((product) => product.productId && product.name && product.active)
        .map((product) => [product.productId, product])).values()];
      const builder = loadedSchedule.metadata?.brochureBuilder || {};
      const loadedPackageChoice = builder.packageChoice || ({ Classic: "Budget", Premier: "Mid-range", Premium: "High-end" }[loadedSchedule.tierKey]) || "Mid-range";
      const loadedDesignStyle = builder.designStyle || "Modern";
      const savedDocument = loadedSchedule.metadata?.brochureDocument || null;
      const savedBranding = loadedSchedule.metadata?.brochureBranding || {};
      setSchedule(loadedSchedule);
      setName(loadedSchedule.name || "");
      setDescription(loadedSchedule.description || "");
      setTierKey(loadedSchedule.tierKey || "");
      setDraft(loadedDraft);
      setProducts(persistedProducts);
      setBrochureDocument(savedDocument);
      setPrototypeDocument(loadedSchedule.metadata?.brochureDesignPrototype || null);
      setBrochureOpen(loadedSchedule.metadata?.generatedSchedule === true && savedDocument?.metadata?.brochureDesignSystem === "gr8-editorial-v1");
      setCurrentStep(Math.min(5, Math.max(1, Number(builder.currentStep) || 1)));
      setPackageChoice(loadedPackageChoice);
      setSectionPreferences(builder.sectionPreferences || {});
      setProductSelections(builder.productSelections || {});
      setSelectedImages(Array.isArray(builder.selectedImages) ? builder.selectedImages : []);
      setSectionAssignments(builder.sectionAssignments || {});
      setDesignStyle(loadedDesignStyle);
      setBranding(savedBranding.snapshot || {});
      setBrandingEdited(false);
      setIncludedFields(savedBranding.includedFields || Object.fromEntries(Object.keys(savedBranding.snapshot || {}).map((key) => [key, Boolean(savedBranding.snapshot?.[key])] )));
      setLoading(false);

      request("/api/standard-inclusions/branding", {}, 20000).then((profileResult) => {
        if (!active) return;
        const profile = profileResult.branding || {};
        const snapshot = mergeScheduleBranding(savedBranding.snapshot || {}, profile);
        setBrandingProfile(profileResult);
        setBranding(snapshot);
        setIncludedFields(savedBranding.includedFields || Object.fromEntries(Object.keys(snapshot).map((key) => [key, Boolean(snapshot[key])] )));
        setProfileWarning("");
      }).catch(() => {
        if (active) setProfileWarning("Business Profile is unavailable. Enter only details you can verify.");
      });

      const mergeProducts = (rows) => {
        const normalized = (rows || [])
          .map(normalizeProduct)
          .filter((product) => product.productId && product.name && product.active);
        setProducts((current) => [...new Map([...current, ...normalized]
          .map((product) => [product.productId, product])).values()]);
        return normalized.length;
      };

      request(`/api/builders/product-catalogue?workspace_id=${encodeURIComponent(workspaceId)}&source=stored`, {}, 60000).then((storedResult) => {
        if (!active) return;
        mergeProducts(storedResult.products);
      }).catch(() => {
        if (active) setProductWarning("Builder-specific Product Library overrides could not be refreshed.");
      });

      request("/api/standard-inclusions/product-catalogue", {}, 30000).then((catalogueResult) => {
        if (!active) return;
        const loadedCount = mergeProducts(catalogueResult.products);
        setProductWarning(loadedCount || persistedProducts.length ? "" : "No active products were returned by this workspace Product Library.");
      }).catch(() => {
        if (active) setProductWarning(persistedProducts.length
          ? "Saved exact selections are available. The full canonical Product Library could not be refreshed."
          : "The workspace Product Library could not be loaded.");
      });
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Could not load the schedule.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [hasSession, workspaceId, scheduleId, workspaceLoading, loadRetry]);

  useEffect(() => {
    if (!products.length) return;
    setProductSelections((current) => {
      let changed = false;
      const next = { ...current };
      for (const requirement of VISUAL_PRODUCT_REQUIREMENTS) {
        const key = requirementSelectionKey(requirement);
        if (next[key] && products.some((product) => product.productId === next[key])) continue;
        const candidates = requirementCandidates[key] || [];
        if (!candidates.length) continue;
        const position = packageChoice === "Budget" ? 0.2 : packageChoice === "High-end" ? 0.8 : 0.5;
        const product = candidates[Math.round((candidates.length - 1) * position)] || candidates[0];
        if (!product) continue;
        next[key] = product.productId;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [products, packageChoice, requirementCandidates]);

  function updatePreference(key, value) {
    invalidateApproval();
    setDraft((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  }

  function brochureBuilderMetadata(step = currentStep, overrides = {}) {
    return {
      currentStep: step,
      packageChoice,
      priceLevel: PACKAGE_OPTIONS[packageChoice]?.priceLevel || "mid-range",
      sectionPreferences,
      productSelections,
      selectedImages,
      sectionAssignments,
      designStyle,
      ...overrides,
    };
  }

  async function uploadBrochureImages(files) {
    const images = Array.from(files || []).filter((file) => file.type?.startsWith("image/"));
    if (!images.length) return;
    setMediaUploading(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of images) {
        const response = await fetch("/api/assets/upload-library", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name || "brochure-image"),
            "X-File-Type": file.type || "application/octet-stream",
            "X-Upload-Tag": "inclusions-brochure",
          },
          body: file,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || !payload.asset?.src) throw new Error(payload?.error || `Could not upload ${file.name}.`);
        uploaded.push({
          id: payload.asset.id || payload.asset.storage_path || `${Date.now()}-${file.name}`,
          name: payload.asset.name || file.name,
          src: payload.asset.src,
        });
      }
      setMediaLibrary((current) => [...uploaded, ...current.filter((asset) => !uploaded.some((entry) => entry.id === asset.id))]);
      setSelectedImages((current) => [...current, ...uploaded.filter((asset) => !current.some((entry) => entry.id === asset.id))]);
      setNotice(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded and selected.`);
    } catch (uploadError) {
      setError(uploadError.message || "Image upload failed.");
    } finally {
      setMediaUploading(false);
    }
  }

  function updateItem(itemId, patch) {
    invalidateApproval();
    setDraft((current) => refreshInclusionReview({ ...current, items: current.items.map((item) => item.id === itemId ? { ...item, ...patch, reviewStatus: patch.reviewStatus || "needs_review" } : item) }));
  }

  async function saveDraft(nextStatus = draft.status, documentSnapshot = brochureDocument, draftSnapshot = draft) {
    if (!schedule) return false;
    setSaving(true);
    setError("");
    setNotice("");
    const inclusionsDraft = { ...draftSnapshot, status: nextStatus };
    const metadata = {
      ...(schedule.metadata || {}),
      schemaVersion: 1,
      workflowStatus: nextStatus,
      inclusionsDraft,
      brochureDocument: documentSnapshot || null,
      brochureBranding: {
        source: "business-profile-vault",
        profileUpdatedAt: brandingProfile?.updated_at || null,
        snapshot: branding,
        includedFields,
        capturedAt: schedule.metadata?.brochureBranding?.capturedAt || new Date().toISOString(),
      },
      brochureBuilder: brochureBuilderMetadata(currentStep, {
        designStyle: documentSnapshot?.metadata?.designStyle || designStyle,
      }),
    };
    try {
      const result = await request("/api/standard-inclusions/pdf-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", scheduleId, name, description, tierKey, metadata }),
      }, 120000);
      setSchedule(result.schedule);
      setDraft(inclusionsDraft);
      setNotice(nextStatus === "Approved" ? "Approved snapshot saved. Product references and branding are pinned to this schedule." : "Draft saved.");
    } catch (saveError) {
      setError(saveError.message || "Could not save this draft.");
      return false;
    } finally {
      setSaving(false);
    }
    return true;
  }

  async function saveBrochure(documentSnapshot) {
    setBrochureDocument(documentSnapshot);
    if (!await saveDraft(draft.status, documentSnapshot)) throw new Error("The brochure could not be saved. Your edits remain open; retry Save.");
  }

  function openDesignPrototype() {
    setPrototypeDocument(buildInclusionsBrochurePrototype({
      items: draft.items,
      branding,
      name,
      packageChoice,
    }));
    setPrototypeOpen(true);
    setBrochureOpen(false);
    setGeneratedPdf(null);
    setNotice("Five-page design prototype opened. The structured schedule and full brochure remain unchanged.");
  }

  async function saveDesignPrototype(documentSnapshot) {
    setPrototypeDocument(documentSnapshot);
    setSaving(true);
    setError("");
    try {
      const metadata = { ...(schedule.metadata || {}), brochureDesignPrototype: documentSnapshot };
      const result = await request("/api/standard-inclusions/pdf-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", scheduleId, name, description, tierKey, metadata }),
      }, 120000);
      setSchedule(result.schedule);
      setNotice("Five-page design prototype saved separately from the structured schedule and full brochure.");
    } catch (saveError) {
      setError(saveError.message || "The design prototype could not be saved.");
      throw saveError;
    } finally {
      setSaving(false);
    }
  }

  function downloadGeneratedPdf() {
    if (!generatedPdf || generatedPdf.documentSignature !== brochureContentSignature(brochureDocument)) return;
    const url = URL.createObjectURL(new Blob([generatedPdf.bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = generatedPdf.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function resolveProductImageForExport(productId) {
    const headers = { "x-workspace-id": workspaceId };
    headers["Author" + "ization"] = ["Bearer", token].join(" ");
    const response = await fetch(`/api/standard-inclusions/product-image?productId=${encodeURIComponent(productId)}`, {
      headers,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Product image ${productId} could not be prepared for PDF export.`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error(`Product image ${productId} could not be read for PDF export.`));
      reader.readAsDataURL(blob);
    });
  }

  async function generateProposals() {
    if (generationBlockReason) {
      setError(generationBlockReason);
      return;
    }
    setProposing(true);
    setError("");
    setNotice("");
    setGenerationProgress("Loading canonical builder branding, matching catalogue families and preserving construction requirements. Missing products will become review exceptions. Large complete schedules can take up to two minutes.");
    try {
      const result = await request("/api/standard-inclusions/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          expectedUpdatedAt: schedule.updatedAt,
          tier: generationTier,
          priceLevel: STANDARD_TIER_SETTINGS[generationTier].priceLevel,
          preferences: draft.preferences,
          ...(brandingEdited ? { brandingOverrides: branding } : {}),
        }),
      }, 120000);
      if (!result.schedule?.metadata?.inclusionsDraft?.items?.length) throw new Error("Generation returned no construction checklist. Reopen this draft and retry; approval remains blocked.");
      const generated = result.schedule;
      const generatedDraft = initialDraft(generated);
      const preferred = applySectionPreferences(generatedDraft.items, sectionPreferences, products);
      const exactSelections = applyExactProductSelections(preferred.items, productSelections, products);
      const nextDraft = { ...generatedDraft, ...preferred, ...exactSelections, items: exactSelections.items };
      const tier = generated.tierKey || generationTier;
      const styledDocument = buildInclusionsBrochureDocument({
        items: nextDraft.items,
        branding,
        name,
        packageChoice,
        designStyle,
      });
      const metadata = {
        ...(generated.metadata || {}),
        inclusionsDraft: nextDraft,
        brochureDocument: styledDocument,
        brochureBuilder: brochureBuilderMetadata(5),
      };
      const saved = await request("/api/standard-inclusions/pdf-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", scheduleId, name, description, tierKey: tier, metadata }),
      }, 120000);
      setSchedule(saved.schedule);
      setTierKey(generated.tierKey);
      setDraft(nextDraft);
      setBrochureDocument(styledDocument);
      setGeneratedPdf(null);
      setBranding(generated.metadata.brochureBranding?.snapshot || branding);
      setBrandingEdited(false);
      setBrandingProfile(current => ({ ...current, branding: generated.metadata.brochureBranding?.snapshot || {}, source: generated.metadata.brochureBranding?.source }));
      setProfileWarning(result.brandingWarning || "");
      setCurrentStep(5);
      setBrochureOpen(true);
      setNotice(`Brochure created and saved with ${result.matchedCount} verified catalogue selections. ${nextDraft.gaps?.length || 0} genuine exceptions are listed in Review Required.`);
      setGenerationProgress("Generation complete. The visual page editor is open.");
    } catch (proposalError) {
      setError(proposalError.message || "Could not prepare product proposals.");
      setGenerationProgress("Generation did not complete in this view. The action is available again; check the error above. Reopen the draft before retrying a timed-out request.");
    } finally {
      setProposing(false);
    }
  }

  function addCategory() {
    const category = valueText(categoryInput);
    if (!category) return;
    invalidateApproval();
    setDraft((current) => current.categories.includes(category) ? current : { ...current, categories: [...current.categories, category] });
    setCategoryInput("");
  }

  function addCustomInclusion(category = draft.categories[0] || "Other builder-specific inclusions") {
    invalidateApproval();
    const item = { id: window.crypto.randomUUID(), category, product: null, description: "", quantity: "", unit: "", allowanceOverride: "", price: null, reason: "Builder-added inclusion.", reviewStatus: "needs_review", origin: "custom" };
    setDraft((current) => ({ ...current, status: "Needs Review", items: [...current.items, item], gaps: current.gaps.filter((gap) => gap !== category), gapDetails: current.gapDetails.filter((gap) => gap.category !== category), excludedCategories: current.excludedCategories.filter((entry) => entry !== category) }));
  }

  function replaceProduct(itemId, productId) {
    const product = products.find((candidate) => candidate.productId === productId);
    const item = draft.items.find(candidate => candidate.id === itemId);
    if (!product || !item || item.productRequired === false) return;
    if (item.requirementCategory && !rankCatalogueCandidatesForCategories([product], [item.requirementCategory]).length) {
      setError("This product family is incompatible with the inclusion requirement. Nothing was changed.");
      return;
    }
    invalidateApproval();
    updateItem(itemId, { product: { ...product }, selectionSlotId: suggestSelectionSlot(product), description: product.name, specification: product.specification || product.description || "", unit: product.unit || "", allowanceOverride: "", price: product.price, missingInformation: missingProductInformation(product), reviewStatus: "needs_review", origin: "workspace-product-library", reason: "Builder-selected exact product from this workspace Product Library." });
  }

  function markApproved() {
    if (!isInclusionsDraftApprovable(draft) || !requiredChecklistApproved(draft, schedule.metadata?.reviewRequirementIds || [])) {
      setError("Resolve gaps, exclude non-applicable categories, and review every item. Each included category needs an approved item.");
      return;
    }
    saveDraft("Approved");
  }

  function openBrochureDesigner() {
    if (!schedule || (!["Approved", "Published", "Generated"].includes(draft.status) && !brochureDocument && !draft.items.length)) {
      setError("Generate the complete draft first, or finish checklist approval before building a new brochure.");
      return;
    }
    const savedDocument = brochureDocument?.metadata?.brochureDesignSystem === "gr8-editorial-v1" ? brochureDocument : null;
    const snapshot = savedDocument || buildInclusionsBrochureDocument({
      items: draft.items,
      branding,
      name,
      packageChoice,
      designStyle,
    });
    setBrochureDocument(snapshot);
    setGeneratedPdf(null);
    setBrochureOpen(true);
    setError("");
  }

  function receiveGeneratedPdf(bytes, fileName) {
    setGeneratedPdf({ bytes, fileName: fileName || `${name || "Inclusions Schedule"}.pdf`, documentSignature: brochureContentSignature(brochureDocument) });
    setNotice("PDF generated from the current brochure layout. Publish it to save a new immutable version.");
  }

  async function publishBrochure() {
    if (blockingBrochureVisualIssues.length) {
      setError("Resolve incompatible or missing product associations and explicitly review any text-only product images before publishing.");
      return;
    }
    if (!["Approved", "Published"].includes(draft.status) || !isInclusionsDraftApprovable(draft) || !requiredChecklistApproved(draft, schedule?.metadata?.reviewRequirementIds || []) || !generatedPdf || !schedule) {
      setError("Complete builder review, approve the schedule, and generate its PDF before publishing.");
      return;
    }
    if (generatedPdf.documentSignature !== brochureContentSignature(brochureDocument)) {
      setError("The brochure changed after PDF generation. Generate its PDF again before publishing.");
      return;
    }
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const upload = new FormData();
      upload.append("action", "replace");
      upload.append("scheduleId", scheduleId);
      upload.append("file", new Blob([generatedPdf.bytes], { type: "application/pdf" }), generatedPdf.fileName);
      const uploaded = await request("/api/standard-inclusions/pdf-library", { method: "POST", body: upload });
      const publishedAt = new Date().toISOString();
      const publishedItems = draft.items.filter((item) => item.reviewStatus === "approved");
      const publishedSnapshots = [
        ...(schedule.metadata?.publishedSnapshots || []),
        {
          publishedAt,
          versionId: uploaded.schedule?.currentVersion?.id || "",
          versionNumber: uploaded.schedule?.currentVersion?.versionNumber || 0,
          branding: { ...branding },
          includedFields: { ...includedFields },
          items: publishedItems,
          reviewRequirementIds: schedule.metadata?.reviewRequirementIds || [],
          brochureDocument,
        },
      ];
      const metadata = { ...(schedule.metadata || {}), workflowStatus: "Published", quotationDefault: packageChoice === "Mid-range" && tierKey === "Premier", inclusionsDraft: { ...draft, status: "Published" }, brochureDocument, publishedSnapshots, brochureBuilder: brochureBuilderMetadata(5) };
      const saved = await request("/api/standard-inclusions/pdf-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", scheduleId, name, description, tierKey, metadata }),
      }, 120000);
      setSchedule(saved.schedule);
      setDraft((current) => ({ ...current, status: "Published" }));
      setNotice(`Published version ${uploaded.schedule?.currentVersion?.versionNumber || ""}. Prior schedule versions remain unchanged.`);
    } catch (publishError) {
      setError(publishError.message || "Could not publish the brochure.");
    } finally {
      setPublishing(false);
    }
  }

  async function approveTextOnlyProductImages() {
    const missingImageIssues = (brochureDocument?.metadata?.visualIssues || []).filter((issue) => issue.issueType === "missing_image");
    if (!missingImageIssues.length || !schedule) return;
    setSaving(true);
    setError("");
    try {
      const approvedBrochureVisualIssueIds = [...new Set([
        ...(schedule.metadata?.approvedBrochureVisualIssueIds || []),
        ...missingImageIssues.map((issue) => issue.itemId),
      ])];
      const metadata = { ...(schedule.metadata || {}), approvedBrochureVisualIssueIds };
      const result = await request("/api/standard-inclusions/pdf-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", scheduleId, name, description, tierKey, metadata }),
      }, 120000);
      setSchedule(result.schedule);
      setNotice(`${missingImageIssues.length} verified product${missingImageIssues.length === 1 ? "" : "s"} explicitly approved for text-only brochure treatment. Missing or incompatible product selections still block publishing.`);
    } catch (approvalError) {
      setError(approvalError.message || "The text-only product-image approval could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function invalidateApproval() {
    setGeneratedPdf(null);
    if (schedule?.metadata?.generatedSchedule) {
      setBrochureDocument(null);
      setDraft((current) => ({ ...current, status: "Needs Review" }));
      return;
    }
    setBrochureDocument(null);
    setDraft((current) => current.status === "Approved" || current.status === "Published" ? { ...current, status: "Needs Review" } : current);
  }

  function updateDesignStyle(nextStyle) {
    setDesignStyle(nextStyle);
    setGeneratedPdf(null);
    setBrochureDocument(buildInclusionsBrochureDocument({
      items: draft.items,
      branding,
      name,
      packageChoice,
      designStyle: nextStyle,
    }));
    setNotice(`${nextStyle} design applied. Inclusion data, product selections and prices were not changed.`);
  }

  function regenerateBrochureLayout() {
    setGeneratedPdf(null);
    const nextDocument = buildInclusionsBrochureDocument({
      items: draft.items,
      branding,
      name,
      packageChoice,
      designStyle,
    });
    nextDocument.metadata.layoutRevision = Number(brochureDocument?.metadata?.layoutRevision || 0) + 1;
    setBrochureDocument(nextDocument);
    const omittedImages = selectedImages.filter(asset => !isBrochurePhotograph(asset)).length;
    setNotice(`Layout regenerated with the approved editorial design. Structured inclusions, products and prices were preserved.${omittedImages ? ` ${omittedImages} selected image(s) lacked identifiable residential subject information and were not used.` : ""}`);
  }

  async function approveVerifiedContent() {
    const nextDraft = refreshInclusionReview({
      ...draft,
      items: draft.items.map((item) => inclusionCanBeApproved(item) ? { ...item, reviewStatus: "approved" } : item),
    });
    setDraft(nextDraft);
    if (nextDraft.gaps.length) {
      setError(`${nextDraft.gaps.length} item${nextDraft.gaps.length === 1 ? "" : "s"} still require verified product or specification information.`);
      return;
    }
    await saveDraft("Approved", brochureDocument, nextDraft);
  }

  const reviewCounts = useMemo(() => ({
    approved: draft.items.filter((item) => item.reviewStatus === "approved").length,
    pending: draft.items.filter((item) => !["approved", "rejected"].includes(item.reviewStatus)).length,
    rejected: draft.items.filter((item) => item.reviewStatus === "rejected").length,
  }), [draft.items]);

  const generationTier = STANDARD_TIER_SETTINGS[tierKey] ? tierKey : Object.keys(STANDARD_TIER_SETTINGS).find(tier => new RegExp(`\\b${tier}\\b`, "i").test(name)) || "";
  const generationBlockReason = scheduleGenerationBlockReason({ authenticated: hasSession, workspaceId, schedule, tier: generationTier, pending: proposing });
  const approvalIssues = scheduleApprovalIssues(draft, schedule?.metadata?.reviewRequirementIds || []);
  const brochureVisualIssues = brochureDocument?.metadata?.visualIssues || [];
  const approvedBrochureVisualIssueIds = new Set(schedule?.metadata?.approvedBrochureVisualIssueIds || []);
  const blockingBrochureVisualIssues = brochureVisualIssues.filter((issue) =>
    issue.issueType !== "missing_image" || !approvedBrochureVisualIssueIds.has(issue.itemId),
  );
  const finalApprovalBlocked = approvalIssues.length > 0 || blockingBrochureVisualIssues.length > 0 || !isInclusionsDraftApprovable(draft) || !requiredChecklistApproved(draft, schedule?.metadata?.reviewRequirementIds || []);
  const brochureAllowed = Boolean(schedule && (["Approved", "Published", "Generated"].includes(draft.status) || brochureDocument || draft.items.length));
  const pdfCurrent = Boolean(generatedPdf && generatedPdf.documentSignature === brochureContentSignature(brochureDocument));
  const publishReason = !["Approved", "Published"].includes(draft.status) || finalApprovalBlocked ? "Complete item and section review, resolve the listed exceptions, then Approve schedule before publishing." : !pdfCurrent ? "Export the current brochure to PDF before publishing. Edits after export require another export." : publishing ? "Publishing is in progress; wait for the result." : "";

  if ((workspaceLoading && !workspaceId) || loading) return <main className="setupPage"><div className="state">Loading schedule…</div></main>;

  if (schedule) return (
    <>
      <Head><title>{name || "AI brochure builder"} | Standard Inclusions</title></Head>
      <main className="brochureBuilder">
        <header className="builderHeader">
          <Link href="/modules/builders/standard-inclusions" className="backLink"><ArrowLeft size={16} /> Schedules</Link>
          <div>
            <span className="eyebrow">Standard Inclusions</span>
            <h1>{brochureOpen ? name : "Create your inclusions brochure"}</h1>
          </div>
          <div className="headerStatus">{draft.status}</div>
        </header>

        {error ? <div className="alert error" role="alert">{error}</div> : null}
        {notice ? <div className="alert notice" role="status">{notice}</div> : null}

        {prototypeOpen && prototypeDocument ? (
          <section className="editorExperience">
            <div className="editorTopbar">
              <div>
                <span className="eyebrow">Original GR8 Result design · five-page approval prototype</span>
                <h2>Advertising-quality brochure prototype</h2>
                <p>Cover, inclusions overview, kitchen, bathroom and flooring only. Product cards use exact saved catalogue identities and images.</p>
              </div>
              <div className="editorActions">
                <button type="button" className="secondaryButton" onClick={() => { setPrototypeOpen(false); setBrochureOpen(Boolean(brochureDocument)); }}>Back to schedule</button>
                <button type="button" className="primaryButton" onClick={openDesignPrototype}>Refresh from selections</button>
              </div>
            </div>
            <DocumentPageBuilder document={prototypeDocument} onChange={setPrototypeDocument} onSave={saveDesignPrototype} onStatus={setNotice} resolveProductImageForExport={resolveProductImageForExport} />
          </section>
        ) : brochureOpen && brochureDocument ? (
          <section className="editorExperience">
            <div className="editorTopbar">
              <div>
                <span className="eyebrow">{packageChoice} package · {designStyle} design</span>
                <h2>Visual brochure editor</h2>
                <p>Edit text directly on a page, select an image to replace it, or change products without rebuilding the schedule.</p>
              </div>
              <div className="editorActions">
                <button type="button" className="primaryButton" onClick={openDesignPrototype}>View five-page prototype</button>
                <button type="button" className="secondaryButton" onClick={() => { setBrochureOpen(false); setCurrentStep(2); }}>Change product</button>
                <label className="styleSelect">Design style<select value={designStyle} onChange={(event) => updateDesignStyle(event.target.value)}>{Object.keys(DESIGN_STYLES).map((style) => <option key={style}>{style}</option>)}</select></label>
                <button type="button" className="secondaryButton" onClick={regenerateBrochureLayout}>Regenerate layout</button>
                <button type="button" className="secondaryButton" disabled={!pdfCurrent} title={pdfCurrent ? "Download the current PDF" : "Use Export PDF in the page editor first"} onClick={downloadGeneratedPdf}>Download PDF</button>
                <button type="button" className="primaryButton" disabled={Boolean(publishReason)} title={publishReason || "Approve and publish this verified brochure"} onClick={publishBrochure}>{publishing ? "Publishing…" : "Approve / publish"}</button>
              </div>
            </div>

            {draft.gapDetails?.length || blockingBrochureVisualIssues.length ? (
              <details className="reviewPanel" open>
                <summary>Review Required <strong>{draft.gapDetails.length + blockingBrochureVisualIssues.length}</strong></summary>
                <div className="reviewItems">
                  {draft.gapDetails.slice(0, 12).map((gap, index) => <div key={`${gap.category}-${gap.requirementTitle}-${index}`}><strong>{gap.category}</strong><span>{gap.requirementTitle}</span><small>{gap.reason}</small></div>)}
                  {brochureVisualIssues.slice(0, 20).map((issue) => <div key={issue.itemId}><strong>{issue.issueType === "missing_image" ? "Product image" : "Catalogue association"}</strong><span>{issue.requirementTitle}</span><small>{issue.issue}{issue.issueType === "missing_image" && approvedBrochureVisualIssueIds.has(issue.itemId) ? " Explicit text-only treatment approved." : ""}</small></div>)}
                </div>
                <button type="button" className="secondaryButton" onClick={() => { setBrochureOpen(false); setCurrentStep(2); }}>Resolve products and specifications</button>
                {brochureVisualIssues.some((issue) => issue.issueType === "missing_image" && !approvedBrochureVisualIssueIds.has(issue.itemId)) ? <button type="button" className="secondaryButton" disabled={saving} onClick={approveTextOnlyProductImages}>Explicitly approve text-only products</button> : null}
              </details>
            ) : (
              <div className="verifiedBar"><span>All product and specification information is present.</span><button type="button" className="secondaryButton" onClick={approveVerifiedContent}>Approve verified content</button></div>
            )}

            {generatedPdf ? <div className="pdfReady" role="status">{generatedPdf.fileName} is ready to download or publish.</div> : null}
            <DocumentPageBuilder document={brochureDocument} onChange={setBrochureDocument} onSave={saveBrochure} onStatus={setNotice} onPdfGenerated={receiveGeneratedPdf} resolveProductImageForExport={resolveProductImageForExport} />
          </section>
        ) : (
          <div className="wizardShell">
            <nav className="stepNav" aria-label="Brochure builder steps">
              {[
                [1, "Package"],
                [2, "Inclusions & brands"],
                [3, "Images"],
                [4, "Design style"],
                [5, "Generate"],
              ].map(([step, label]) => <button key={step} type="button" className={currentStep === step ? "active" : currentStep > step ? "complete" : ""} onClick={() => setCurrentStep(step)}><span>{currentStep > step ? "✓" : step}</span>{label}</button>)}
            </nav>

            <section className="wizardCard">
              {currentStep === 1 ? (
                <>
                  <div className="stepHeading"><span>Step 1</span><h2>Choose a package</h2><p>Give the schedule a name and choose the catalogue level AI should use.</p></div>
                  <label className="nameField">Schedule name<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="For example: Signature Home Inclusions" /></label>
                  <div className="choiceGrid">
                    {Object.keys(PACKAGE_OPTIONS).map((choice) => <button key={choice} type="button" className={packageChoice === choice ? "choice selected" : "choice"} onClick={() => {
                      setPackageChoice(choice);
                      setTierKey(PACKAGE_OPTIONS[choice].tierKey);
                      updatePreference("priceLevel", PACKAGE_OPTIONS[choice].priceLevel);
                    }}><strong>{choice}</strong><span>{choice === "Budget" ? "Practical, value-led catalogue selections" : choice === "Mid-range" ? "Balanced quality and value — the Premier quotation baseline" : choice === "High-end" ? "Premium products and elevated finishes" : "Start from Premier and set your own brand preferences"}</span></button>)}
                  </div>
                </>
              ) : null}

              {currentStep === 2 ? (
                <>
                  <div className="stepHeading"><span>Step 2</span><h2>Inclusions and brands</h2><p>Review the complete residential structure by construction section. Every independently selectable product has its own Product Library control; non-product work retains a builder-review specification.</p></div>
                  <div className="inclusionProgress">
                    <span><strong>{RESIDENTIAL_INCLUSION_STRUCTURE.length}</strong> construction sections</span>
                    <span><strong>{TOTAL_INCLUSION_ITEMS}</strong> inclusion items</span>
                    <span><strong>{TOTAL_PRODUCT_INCLUSIONS}</strong> catalogue selections</span>
                    <span><strong>{Object.keys(productSelections).filter((key) => productSelections[key]).length}</strong> products proposed</span>
                  </div>
                  <div className="inclusionAccordion">
                    {RESIDENTIAL_INCLUSION_STRUCTURE.map((inclusionSection) => {
                      const open = expandedInclusionSections.includes(inclusionSection.key);
                      const sectionItems = inclusionSection.groups.flatMap((group) => group.items);
                      const productItems = sectionItems.filter((item) => item.productRequired);
                      const selectedCount = productItems.filter((item) => productSelections[item.key]).length;
                      return <section key={inclusionSection.key} className={open ? "inclusionSection open" : "inclusionSection"}>
                        <button type="button" className="inclusionSectionToggle" aria-expanded={open} onClick={() => setExpandedInclusionSections((current) => current.includes(inclusionSection.key) ? current.filter((key) => key !== inclusionSection.key) : [...current, inclusionSection.key])}>
                          <span><strong>{inclusionSection.title}</strong><small>{sectionItems.length} items · {selectedCount}/{productItems.length} catalogue selections</small></span>
                          <span aria-hidden="true">{open ? "−" : "+"}</span>
                        </button>
                        {open ? <div className="inclusionSectionBody">
                          {inclusionSection.groups.map((group) => <div key={group.key} className="inclusionGroup">
                            <h3>{group.title}</h3>
                            {group.items.map((item) => {
                              const preference = sectionPreferences[item.key] || { mode: "ai", specification: "" };
                              const candidates = requirementCandidates[item.key] || [];
                              const selectedProduct = products.find((productItem) => productItem.productId === productSelections[item.key]) || null;
                              const search = valueText(productSearches[item.key]).toLowerCase();
                              const filteredCandidates = candidates.filter((candidate) => !search || `${candidate.brand} ${candidate.name} ${candidate.range} ${candidate.model} ${candidate.sku} ${candidate.colour} ${candidate.finish}`.toLowerCase().includes(search)).slice(0, 40);
                              return <article key={item.key} className="inclusionItemRow">
                                <div className="inclusionItemHeading">
                                  <span>{item.productRequired ? item.productCategory : "Construction specification"}</span>
                                  <strong>{item.title}</strong>
                                </div>
                                <div className="modeToggle compact">
                                  <button type="button" className={preference.mode !== "builder" ? "selected" : ""} onClick={() => setSectionPreferences((current) => ({ ...current, [item.key]: { ...(current[item.key] || {}), mode: "ai" } }))}>AI chooses</button>
                                  <button type="button" className={preference.mode === "builder" ? "selected" : ""} onClick={() => setSectionPreferences((current) => ({ ...current, [item.key]: { ...(current[item.key] || {}), mode: "builder" } }))}>Builder chooses</button>
                                </div>
                                {item.productRequired ? <div className="inclusionProductControl">
                                  {selectedProduct ? <div className="compactProduct">
                                    {selectedProduct.image ? <img src={selectedProduct.image} alt={`${selectedProduct.brand} ${selectedProduct.name}`} /> : <span className="compactImagePlaceholder">Image review</span>}
                                    <span><small>{selectedProduct.brand || "Brand review required"}</small><strong>{selectedProduct.name}</strong><small>{[selectedProduct.range, selectedProduct.model || selectedProduct.sku, selectedProduct.colour, selectedProduct.finish].filter(Boolean).join(" · ") || "Specification review required"}</small></span>
                                  </div> : <div className="catalogueGap">No compatible Product Library association. This item remains visible for review.</div>}
                                  {preference.mode === "builder" ? <div className="catalogueSearch">
                                    <input type="search" value={productSearches[item.key] || ""} onChange={(event) => setProductSearches((current) => ({ ...current, [item.key]: event.target.value }))} placeholder={`Search ${item.productCategory}`} />
                                    <select value={productSelections[item.key] || ""} onChange={(event) => setProductSelections((current) => ({ ...current, [item.key]: event.target.value }))}>
                                      <option value="">Choose an exact catalogue product</option>
                                      {filteredCandidates.map((candidate) => <option key={candidate.productId} value={candidate.productId}>{[candidate.brand, candidate.name, candidate.model || candidate.sku, candidate.colour || candidate.finish].filter(Boolean).join(" · ")}</option>)}
                                    </select>
                                    <small>{filteredCandidates.length} matching products shown from the effective Product Library.</small>
                                  </div> : <span className="aiNote">AI recommendation uses the {packageChoice.toLowerCase()} package level and the exact catalogue identity above.</span>}
                                </div> : preference.mode === "builder" ? <textarea value={preference.specification || ""} onChange={(event) => setSectionPreferences((current) => ({ ...current, [item.key]: { ...(current[item.key] || {}), mode: "builder", specification: event.target.value } }))} placeholder="Enter the builder's verified specification. No product or price will be invented." rows={3} /> : <span className="aiNote">Retained as a builder-review construction specification; AI will not invent a product.</span>}
                              </article>;
                            })}
                          </div>)}
                        </div> : null}
                      </section>;
                    })}
                  </div>
                </>
              ) : null}

              {currentStep === 3 ? (
                <>
                  <div className="stepHeading"><span>Step 3</span><h2>Confirm product images</h2><p>These are the actual Product Library items proposed for your inclusions. Select a section to review exact products, images, finishes and specifications. Missing images stay visibly flagged and are never replaced with unrelated photography.</p></div>
                  <div className="productImageSummary">
                    <span><strong>{Object.keys(productSelections).length}</strong> variable products selected</span>
                    <span><strong>{Object.values(productSelections).filter((productId) => products.find((product) => product.productId === productId)?.image).length}</strong> exact product images</span>
                    <span><strong>{Object.values(productSelections).filter((productId) => !products.find((product) => product.productId === productId)?.image).length}</strong> image reviews</span>
                  </div>
                  <div className="productVisualWorkspace">
                    <nav className="productSectionNav" aria-label="Product image sections">
                      {[...new Set(VISUAL_PRODUCT_REQUIREMENTS.map((requirement) => requirement.section))].map((section) => (
                        <button key={section} type="button" className={activeProductSection === section ? "active" : ""} onClick={() => { setActiveProductSection(section); setChangingRequirement(""); }}>
                          <span>{section}</span>
                          <small>{VISUAL_PRODUCT_REQUIREMENTS.filter((requirement) => requirement.section === section).length}</small>
                        </button>
                      ))}
                    </nav>
                    <div className="productRequirementList">
                      <div className="productSectionHeading"><span>Product Library</span><h3>{activeProductSection}</h3></div>
                      {VISUAL_PRODUCT_REQUIREMENTS.filter((requirement) => requirement.section === activeProductSection).map((requirement) => {
                        const key = requirementSelectionKey(requirement);
                        const candidates = requirementCandidates[key] || [];
                        const selectedProduct = products.find((product) => product.productId === productSelections[key]) || null;
                        const alternatives = [...candidates].sort((left, right) => Number(Boolean(right.image)) - Number(Boolean(left.image))).filter((product) => product.productId !== selectedProduct?.productId).slice(0, 6);
                        return <article className="visualProductRow" key={key}>
                          <div className="visualProductTitle"><div><small>{requirement.category}</small><h4>{requirement.title}</h4></div><button type="button" onClick={() => setChangingRequirement((current) => current === key ? "" : key)}>{changingRequirement === key ? "Close options" : "Change product"}</button></div>
                          {selectedProduct ? (
                            <div className="selectedProductCard">
                              {selectedProduct.image ? <img src={selectedProduct.image} alt={`${selectedProduct.brand} ${selectedProduct.name}`} loading="lazy" /> : <div className="productImagePlaceholder"><strong>Image review required</strong><span>{selectedProduct.brand} {selectedProduct.name}</span></div>}
                              <div className="selectedProductCopy">
                                <span className="productBrand">{selectedProduct.brand || "Brand requires review"}</span>
                                <h5>{selectedProduct.name}</h5>
                                <p>{[selectedProduct.range, selectedProduct.model || selectedProduct.sku].filter(Boolean).join(" · ") || "Model or range requires review"}</p>
                                {[selectedProduct.colour, selectedProduct.finish].filter(Boolean).length ? <p><b>Colour / finish:</b> {[selectedProduct.colour, selectedProduct.finish].filter(Boolean).join(" · ")}</p> : null}
                                <p className="productSpec">{selectedProduct.specification || selectedProduct.description || "Specification requires builder review."}</p>
                                <small className={selectedProduct.image ? "imageVerified" : "imageMissing"}>{selectedProduct.image ? "Exact catalogue image" : "No approved image associated with this product"}</small>
                              </div>
                            </div>
                          ) : <div className="productAssociationMissing"><strong>Catalogue association required</strong><span>No compatible product is available in the effective Product Library for this requirement.</span></div>}
                          {changingRequirement === key ? (
                            <div className="productAlternatives">
                              {alternatives.length ? alternatives.map((product) => <button key={product.productId} type="button" onClick={() => { setProductSelections((current) => ({ ...current, [key]: product.productId })); setChangingRequirement(""); }}>
                                {product.image ? <img src={product.image} alt="" loading="lazy" /> : <span className="alternativePlaceholder">No image</span>}
                                <b>{product.brand || "Brand review"}</b>
                                <strong>{product.name}</strong>
                                <small>{[product.range, product.model || product.sku, product.colour || product.finish].filter(Boolean).join(" · ")}</small>
                              </button>) : <p>No alternative exact catalogue matches are available.</p>}
                            </div>
                          ) : null}
                        </article>;
                      })}
                    </div>
                  </div>

                  <section className="inspirationSection">
                    <div><span className="inspirationEyebrow">Optional supplementary photography</span><h3>Builder and inspiration images</h3><p>Use completed homes or lifestyle photography for covers and inspiration pages only. Product sections continue to use exact Product Library images.</p></div>
                    <button type="button" className="secondaryButton" onClick={() => setShowInspirationLibrary((visible) => !visible)}>{showInspirationLibrary ? "Hide inspiration images" : "Add inspiration image"}</button>
                    {showInspirationLibrary ? <div className="inspirationLibrary">
                      <div className="inspirationToolbar">
                        <label className="uploadButton">{mediaUploading ? "Uploading…" : "Upload builder image"}<input type="file" accept="image/*" multiple disabled={mediaUploading} onChange={(event) => uploadBrochureImages(event.target.files)} /></label>
                        <select value={inspirationCategory} onChange={(event) => setInspirationCategory(event.target.value)}><option value="all">All suitable images</option><option value="cover">Covers and completed homes</option><option value="kitchen">Kitchen inspiration</option><option value="bathroom">Bathroom inspiration</option><option value="interior">Interior inspiration</option><option value="external">External elevations</option></select>
                      </div>
                      {mediaLoading ? <div className="emptyState">Loading filtered Media Library…</div> : null}
                      <div className="mediaGrid">
                        {mediaLibrary.filter((asset) => inspirationImageMatches(asset, inspirationCategory)).slice(0, 24).map((asset) => {
                          const selected = selectedImages.some((entry) => entry.id === asset.id);
                          return <article key={asset.id} className={selected ? "mediaCard selected" : "mediaCard"}>
                            <button type="button" onClick={() => setSelectedImages((current) => selected ? current.filter((entry) => entry.id !== asset.id) : [...current, asset])}><img src={asset.src} alt={asset.name} loading="lazy" /><span>{selected ? "Selected" : "Select"}</span></button>
                            {selected ? <select value={sectionAssignments[asset.id] || ""} onChange={(event) => setSectionAssignments((current) => ({ ...current, [asset.id]: event.target.value }))}><option value="">AI arranges this image</option>{["Cover", "Completed homes", "Kitchen inspiration", "Bathroom inspiration", "Interior inspiration", "External elevations"].map((category) => <option key={category}>{category}</option>)}</select> : null}
                          </article>;
                        })}
                      </div>
                    </div> : null}
                  </section>
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
                  <div className="stepHeading"><span>Step 4</span><h2>Choose a design style</h2><p>Design controls presentation only. It never changes inclusions, selected products or pricing.</p></div>
                  <div className="designGrid">
                    {Object.entries(DESIGN_STYLES).map(([style, theme]) => <button key={style} type="button" className={designStyle === style ? "designCard selected" : "designCard"} onClick={() => setDesignStyle(style)} style={{ "--design-primary": theme.primary, "--design-accent": theme.accent, "--design-surface": theme.surface }}><span className="designPreview"><i /><b>{style}</b><small>INCLUSIONS COLLECTION</small></span><strong>{style}</strong></button>)}
                  </div>
                </>
              ) : null}

              {currentStep === 5 ? (
                <>
                  <div className="stepHeading"><span>Step 5</span><h2>Ready to create</h2><p>AI will combine the approved construction structure, effective Product Library, Business Profile branding and your design choices.</p></div>
                  <div className="summaryGrid">
                    <div><span>Schedule</span><strong>{name || "Name required"}</strong></div>
                    <div><span>Package</span><strong>{packageChoice}</strong></div>
                    <div><span>Builder preferences</span><strong>{Object.values(sectionPreferences).filter((entry) => entry.mode === "builder").length} sections</strong></div>
                    <div><span>Product visuals</span><strong>{Object.values(productSelections).filter((productId) => products.find((product) => product.productId === productId)?.image).length} exact images</strong></div>
                    <div><span>Inspiration</span><strong>{selectedImages.length} supplementary</strong></div>
                    <div><span>Design</span><strong>{designStyle}</strong></div>
                    <div><span>Branding</span><strong>{branding.businessName || branding.legalName || "Business Profile review required"}</strong></div>
                  </div>
                  <button type="button" className="createButton" disabled={proposing || !name.trim() || Boolean(generationBlockReason)} title={!name.trim() ? "Enter a schedule name first." : generationBlockReason || "Create the brochure"} onClick={generateProposals}><Sparkles size={20} /> {proposing ? "Creating brochure…" : "Create with AI"}</button>
                  {draft.items.length ? <button type="button" className="secondaryButton" onClick={openBrochureDesigner}>Open complete brochure from saved inclusions</button> : null}
                  {generationProgress ? <p className="generationStatus" role="status">{generationProgress}</p> : null}
                </>
              ) : null}

              <footer className="wizardFooter">
                <button type="button" className="secondaryButton" disabled={currentStep === 1} onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}>Back</button>
                {currentStep < 5 ? <button type="button" className="primaryButton" disabled={currentStep === 1 && !name.trim()} onClick={() => setCurrentStep((step) => Math.min(5, step + 1))}>Continue</button> : null}
              </footer>
            </section>
          </div>
        )}
      </main>
      <style jsx>{`
        .brochureBuilder{min-height:100vh;background:#f4f6f4;color:#17231f;padding:28px clamp(16px,4vw,56px) 64px;font-family:Arial,sans-serif}.builderHeader{max-width:1480px;margin:0 auto 24px;display:grid;grid-template-columns:180px 1fr auto;gap:20px;align-items:center}.builderHeader h1,.stepHeading h2,.editorTopbar h2{margin:5px 0;color:#183026;font:500 clamp(28px,3vw,42px) Georgia,serif}.backLink{display:inline-flex;align-items:center;gap:7px;color:#315244;text-decoration:none;font-weight:700}.eyebrow,.stepHeading>span{color:#9a6b2f;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}.headerStatus{padding:8px 12px;border:1px solid #c9d7ce;border-radius:999px;background:#fff;font-size:12px;font-weight:800}.alert{max-width:1480px;margin:0 auto 14px;padding:12px 15px;border-radius:8px}.alert.error{background:#fff1ed;color:#8a2f20;border:1px solid #efc0b5}.alert.notice{background:#edf8f1;color:#24583d;border:1px solid #b9dec6}.wizardShell,.editorExperience{max-width:1480px;margin:0 auto}.stepNav{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}.stepNav button{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid #d4ded7;border-radius:8px;background:#fff;color:#64736b;font-weight:800;text-align:left}.stepNav button span{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#eef2ef}.stepNav button.active{border-color:#2c654d;color:#214a39;box-shadow:0 0 0 2px rgba(44,101,77,.12)}.stepNav button.complete span{background:#2c654d;color:#fff}.wizardCard{min-height:620px;padding:clamp(22px,4vw,48px);border:1px solid #d8e0da;border-radius:14px;background:#fff;box-shadow:0 16px 44px rgba(24,50,38,.08)}.stepHeading{max-width:850px;margin-bottom:28px}.stepHeading p,.editorTopbar p{margin:8px 0;color:#64736b;line-height:1.55}.nameField{display:grid;gap:8px;max-width:680px;font-weight:800}.nameField input,.sectionRow input,.mediaCard select,.styleSelect select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #c8d5cc;border-radius:7px;background:#fff;color:#1c3027}.choiceGrid,.designGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:25px}.choice,.designCard{padding:22px;border:1px solid #d4ded7;border-radius:10px;background:#fbfcfb;color:#263a31;text-align:left}.choice strong{display:block;margin-bottom:9px;font:500 23px Georgia,serif}.choice span{color:#68766f;font-size:13px;line-height:1.5}.choice.selected,.designCard.selected{border-color:#2c654d;box-shadow:0 0 0 3px rgba(44,101,77,.12)}.sectionList{max-height:650px;overflow:auto;border:1px solid #dce4de;border-radius:10px}.sectionRow{display:grid;grid-template-columns:minmax(230px,1fr) 220px minmax(220px,1fr);gap:14px;align-items:center;padding:13px 15px;border-bottom:1px solid #e9eeea}.sectionRow:last-child{border-bottom:0}.modeToggle{display:flex}.modeToggle button{flex:1;padding:8px;border:1px solid #ccd7d0;background:#fff;color:#526259;font-size:11px;font-weight:800}.modeToggle button:first-child{border-radius:6px 0 0 6px}.modeToggle button:last-child{border-radius:0 6px 6px 0}.modeToggle button.selected{background:#274f3e;color:#fff;border-color:#274f3e}.aiNote{color:#738078;font-size:12px}.inclusionProgress{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}.inclusionProgress span{padding:9px 12px;border:1px solid #d9e2dc;border-radius:999px;background:#f7faf8;color:#5c6c63;font-size:12px}.inclusionProgress strong{color:#1e4b39}.inclusionAccordion{display:grid;gap:10px}.inclusionSection{overflow:hidden;border:1px solid #d8e2db;border-radius:10px;background:#fff}.inclusionSectionToggle{display:flex;width:100%;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:0;background:#f7faf8;color:#244638;text-align:left;cursor:pointer}.inclusionSectionToggle>span:first-child{display:grid;gap:4px}.inclusionSectionToggle strong{font:500 20px Georgia,serif}.inclusionSectionToggle small{color:#718078}.inclusionSectionBody{padding:0 18px 18px}.inclusionGroup h3{margin:20px 0 8px;color:#92652d;font-size:11px;letter-spacing:1px;text-transform:uppercase}.inclusionItemRow{display:grid;grid-template-columns:minmax(180px,.8fr) 190px minmax(260px,1.6fr);gap:14px;align-items:start;padding:14px 0;border-top:1px solid #e4eae6}.inclusionItemHeading{display:grid;gap:4px}.inclusionItemHeading span{color:#839088;font-size:9px;font-weight:800;text-transform:uppercase}.inclusionItemHeading strong{font-size:13px}.modeToggle.compact button{padding:7px 6px}.inclusionProductControl{display:grid;gap:9px}.compactProduct{display:grid;grid-template-columns:58px minmax(0,1fr);gap:10px;align-items:center}.compactProduct img,.compactImagePlaceholder{width:58px;height:58px;border-radius:6px;object-fit:contain;background:#f1f4f2}.compactImagePlaceholder{display:grid;place-items:center;color:#7c6650;font-size:9px;text-align:center}.compactProduct>span{display:grid;gap:3px;min-width:0}.compactProduct small{overflow:hidden;color:#708078;font-size:9px;text-overflow:ellipsis}.compactProduct strong{overflow:hidden;font-size:11px;text-overflow:ellipsis}.catalogueGap{padding:9px;border:1px dashed #deb784;border-radius:6px;background:#fffaf2;color:#76542b;font-size:11px}.catalogueSearch{display:grid;gap:7px}.catalogueSearch input,.catalogueSearch select,.inclusionItemRow textarea{box-sizing:border-box;width:100%;padding:9px;border:1px solid #c8d5cc;border-radius:6px;background:#fff;color:#1c3027}.catalogueSearch small{color:#738078;font-size:9px}.productImageSummary{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}.productImageSummary span{padding:9px 12px;border:1px solid #d9e2dc;border-radius:999px;background:#f7faf8;color:#5c6c63;font-size:12px}.productImageSummary strong{color:#1e4b39}.productVisualWorkspace{display:grid;grid-template-columns:235px minmax(0,1fr);min-height:640px;overflow:hidden;border:1px solid #d8e2db;border-radius:12px;background:#fbfcfb}.productSectionNav{display:flex;flex-direction:column;padding:10px;border-right:1px solid #dce5df;background:#f2f6f3}.productSectionNav button{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px;border:0;border-radius:7px;background:transparent;color:#53645a;font-weight:800;text-align:left;cursor:pointer}.productSectionNav button.active{background:#214f3c;color:#fff}.productSectionNav small{display:grid;place-items:center;min-width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.25)}.productRequirementList{padding:22px;overflow:auto}.productSectionHeading span,.inspirationEyebrow{color:#9a6b2f;font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.productSectionHeading h3{margin:5px 0 18px;font:500 30px Georgia,serif}.visualProductRow{padding:18px 0;border-top:1px solid #e2e8e4}.visualProductTitle{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.visualProductTitle small{color:#7a877f;font-size:10px;text-transform:uppercase}.visualProductTitle h4{margin:4px 0 0;font:500 21px Georgia,serif}.visualProductTitle button{border:1px solid #c8d5cc;border-radius:6px;padding:8px 10px;background:#fff;color:#28503e;font-weight:800;cursor:pointer}.selectedProductCard{display:grid;grid-template-columns:190px minmax(0,1fr);gap:20px;padding:14px;border:1px solid #dce5df;border-radius:9px;background:#fff}.selectedProductCard>img,.productImagePlaceholder{width:190px;height:190px;border-radius:7px;object-fit:contain;background:#f2f4f2}.productImagePlaceholder{display:flex;box-sizing:border-box;flex-direction:column;align-items:center;justify-content:center;padding:18px;border:1px dashed #b9c5bd;color:#65736b;text-align:center}.productImagePlaceholder strong{color:#875b28;text-transform:uppercase}.selectedProductCopy h5{margin:5px 0 7px;color:#193d2f;font:500 23px Georgia,serif}.selectedProductCopy p{margin:5px 0;color:#596960;font-size:12px;line-height:1.45}.productBrand{color:#9a6b2f;font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase}.productSpec{max-width:760px}.imageVerified,.imageMissing{display:inline-block;margin-top:8px;padding:5px 8px;border-radius:999px;background:#e6f4eb;color:#276043;font-weight:800}.imageMissing{background:#fff1df;color:#8a5a20}.productAssociationMissing{display:grid;gap:5px;padding:18px;border:1px dashed #ddb98b;border-radius:8px;background:#fffaf2;color:#74532d}.productAlternatives{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;margin-top:12px}.productAlternatives button{display:flex;min-width:0;flex-direction:column;gap:5px;padding:9px;border:1px solid #d7e1da;border-radius:8px;background:#fff;color:#273c32;text-align:left;cursor:pointer}.productAlternatives img,.alternativePlaceholder{width:100%;height:110px;object-fit:contain;border-radius:5px;background:#f2f4f2}.alternativePlaceholder{display:grid;place-items:center;color:#7a867f;font-size:11px}.productAlternatives b{color:#9a6b2f;font-size:9px;text-transform:uppercase}.productAlternatives strong{font-size:11px}.productAlternatives small{color:#6d7972;font-size:9px}.inspirationSection{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;margin-top:24px;padding:20px;border:1px solid #dce4de;border-radius:10px;background:#f7faf8}.inspirationSection h3{margin:5px 0;font:500 23px Georgia,serif}.inspirationSection p{margin:0;color:#66756d;font-size:12px}.inspirationLibrary{grid-column:1/-1;padding-top:18px;border-top:1px solid #dce5df}.inspirationToolbar{display:flex;flex-wrap:wrap;gap:10px}.inspirationToolbar select{padding:10px;border:1px solid #c8d5cc;border-radius:7px;background:#fff}.uploadButton{display:inline-flex;padding:11px 15px;border-radius:7px;background:#244f3e;color:#fff;font-weight:800;cursor:pointer}.uploadButton input{display:none}.mediaGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-top:20px}.mediaCard{padding:8px;border:1px solid #d9e1db;border-radius:9px;background:#fff}.mediaCard.selected{border-color:#2c654d;box-shadow:0 0 0 2px rgba(44,101,77,.12)}.mediaCard button{position:relative;width:100%;padding:0;border:0;background:transparent;cursor:pointer}.mediaCard img{display:block;width:100%;height:135px;object-fit:cover;border-radius:6px}.mediaCard button span{position:absolute;right:7px;bottom:7px;padding:5px 7px;border-radius:5px;background:rgba(20,40,31,.85);color:#fff;font-size:11px;font-weight:800}.mediaCard select{margin-top:8px;font-size:11px}.emptyState{margin-top:20px;padding:30px;border:1px dashed #cdd8d0;border-radius:8px;color:#708078;text-align:center}.designPreview{display:block;height:230px;padding:18px;background:var(--design-surface);border-radius:7px;color:var(--design-primary)}.designPreview i{display:block;height:115px;margin:-18px -18px 24px;background:linear-gradient(135deg,var(--design-primary),var(--design-accent))}.designPreview b{display:block;font:500 28px Georgia,serif}.designPreview small{color:var(--design-accent);font-weight:800;letter-spacing:1px}.designCard>strong{display:block;margin-top:12px;text-align:center}.summaryGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.summaryGrid div{padding:18px;border:1px solid #dde5df;border-radius:8px;background:#f9fbf9}.summaryGrid span,.summaryGrid strong{display:block}.summaryGrid span{margin-bottom:7px;color:#718078;font-size:11px;font-weight:800;text-transform:uppercase}.createButton{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;margin-top:28px;padding:15px;border:0;border-radius:8px;background:#1d4f3b;color:#fff;font-size:16px;font-weight:900}.createButton:disabled{opacity:.55}.generationStatus{text-align:center;color:#607068}.wizardFooter{display:flex;justify-content:space-between;margin-top:32px;padding-top:20px;border-top:1px solid #e3e9e5}.primaryButton,.secondaryButton{padding:10px 13px;border-radius:7px;font-weight:800;cursor:pointer}.primaryButton{border:1px solid #1d4f3b;background:#1d4f3b;color:#fff}.secondaryButton{border:1px solid #cad5cd;background:#fff;color:#29483a}.primaryButton:disabled,.secondaryButton:disabled{opacity:.5;cursor:not-allowed}.editorExperience{padding:20px;border:1px solid #d8e0da;border-radius:14px;background:#fff}.editorTopbar{display:flex;justify-content:space-between;gap:20px;margin-bottom:16px}.editorActions{display:flex;flex-wrap:wrap;align-items:end;justify-content:flex-end;gap:8px}.styleSelect{display:grid;gap:4px;color:#66756d;font-size:10px;font-weight:800;text-transform:uppercase}.reviewPanel{margin:12px 0;padding:13px;border:1px solid #e5c7a1;border-radius:8px;background:#fffaf2}.reviewPanel summary{cursor:pointer;font-weight:900;color:#704c20}.reviewPanel summary strong{display:inline-grid;place-items:center;min-width:22px;height:22px;margin-left:5px;border-radius:50%;background:#a96d25;color:#fff;font-size:11px}.reviewItems{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin:12px 0}.reviewItems div{display:grid;gap:3px;padding:9px;background:#fff;border:1px solid #eadbc9;border-radius:6px}.reviewItems span,.reviewItems small{color:#6b6259;font-size:11px}.verifiedBar,.pdfReady{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:12px;border-radius:8px;background:#edf8f1;color:#24583d}.pdfReady{display:block;background:#eef5fb;color:#26536f}.styleSelect select{min-width:120px;padding:9px}@media(max-width:900px){.builderHeader{grid-template-columns:1fr}.stepNav{grid-template-columns:1fr 1fr}.choiceGrid,.designGrid,.summaryGrid{grid-template-columns:1fr 1fr}.sectionRow{grid-template-columns:1fr}.productVisualWorkspace{grid-template-columns:1fr}.productSectionNav{display:grid;grid-template-columns:repeat(2,1fr);border-right:0;border-bottom:1px solid #dce5df}.editorTopbar{display:block}.editorActions{justify-content:flex-start}}@media(max-width:560px){.choiceGrid,.designGrid,.summaryGrid{grid-template-columns:1fr}.stepNav{grid-template-columns:1fr}.selectedProductCard{grid-template-columns:1fr}.selectedProductCard>img,.productImagePlaceholder{width:100%}.inspirationSection{grid-template-columns:1fr}}
      `}</style>
    </>
  );

  return (
    <>
      <Head><title>{name || "Schedule setup"} | Standard Inclusions</title></Head>
      <main className="setupPage">
        <header className="topBar">
          <Link href="/modules/builders/standard-inclusions" className="backLink"><ArrowLeft size={16} /> Library</Link>
          <div className="saveState">{draft.status} · {schedule?.currentVersion ? `PDF v${schedule.currentVersion.versionNumber}` : "No PDF attached"}</div>
          <button type="button" className="saveButton" disabled={saving || !schedule} title={saving ? "Draft save is in progress." : !schedule ? "Load the saved schedule successfully before saving changes." : "Save this draft"} onClick={() => saveDraft()}><Save size={16} /> {saving ? "Saving…" : "Save draft"}</button>
        </header>
        {error && <div role="alert" className="errorBanner">{error}{!loading && !schedule && <button type="button" className="secondaryButton" onClick={() => { setError(""); setLoadRetry((value) => value + 1); }}>Retry loading</button>}</div>}
        {notice && <div role="status" className="noticeBanner">{notice}</div>}
        {profileWarning && <div role="status" className="warningBanner">{profileWarning}</div>}
        {productWarning && <div role="status" className="warningBanner">{productWarning}</div>}
        {!schedule && <div role="status" className="warningBanner">Save, generation and approval require a successfully loaded workspace draft. Use Retry loading above; optional branding and catalogue gaps are not prerequisites.</div>}

        <section className="intro">
          <div><span className="eyebrow">Schedule setup · {products.length} workspace products</span><h1>{name || "New inclusions schedule"}</h1><p>Set up the schedule, review real catalogue matches, and preserve a builder-specific snapshot before designing the brochure.</p></div>
          <div className={`statusPill ${draft.status.toLowerCase().replace(/\s+/g, "-")}`}>{draft.status}</div>
        </section>

        <section className="setupGrid">
          <div className="mainColumn">
            {brochureOpen ? (
              <section className="panel designerPanel">
                <div className="designerToolbar">
                  <div><span className="eyebrow">{draft.status} schedule · {tierKey || "Custom tier"}</span><h2>Brochure page editor</h2><p>Brochure-specific changes do not update the Account profile or Product Library.</p></div>
                  <div className="designerActions"><button type="button" className="secondaryButton" onClick={() => setBrochureOpen(false)}>Edit selections</button><button type="button" className="secondaryButton" disabled={!pdfCurrent} title={!pdfCurrent ? "Use Export PDF below first. Content edits require exporting again." : "Download the current exported PDF"} onClick={downloadGeneratedPdf}>Download PDF</button><button type="button" className="approveButton" disabled={Boolean(publishReason)} title={publishReason || "Publish the approved PDF"} onClick={publishBrochure}>{publishing ? "Publishing…" : "Publish PDF version"}</button></div>
                </div>
                {!pdfCurrent && <p role="status">Download PDF: use Export PDF in the page editor first. Edits after export require a new export.</p>}
                {publishReason && <p role="status">Publish PDF: {publishReason}</p>}
                {generatedPdf ? <div className="generatedState" role="status">Generated PDF ready: {generatedPdf.fileName}</div> : null}
                {brochureDocument ? <DocumentPageBuilder document={brochureDocument} onChange={setBrochureDocument} onSave={saveBrochure} onStatus={setNotice} onPdfGenerated={receiveGeneratedPdf} resolveProductImageForExport={resolveProductImageForExport} /> : <div className="state">Preparing brochure template…</div>}
              </section>
            ) : null}
            <div className={`workflowForms${brochureOpen ? " isHidden" : ""}`}>
            <section className="panel">
              <div className="panelHeading"><span className="stepNo">01</span><div><h2>Schedule details</h2><p>Names and quality levels belong to this workspace.</p></div></div>
              <div className="fields twoCols">
                <label>Schedule name<input value={name} maxLength={200} onChange={(event) => { invalidateApproval(); setName(event.target.value); }} /></label>
                <label>Schedule tier<select value={generationTier} disabled={proposing} title={proposing ? "Wait for generation to finish before changing tier." : "Choose the draft specification tier"} onChange={(event) => { invalidateApproval(); setTierKey(event.target.value); }}><option value="">Choose Classic, Premier or Premium</option>{Object.keys(STANDARD_TIER_SETTINGS).map(tier => <option key={tier} value={tier}>{tier}</option>)}</select></label>
                <label className="spanTwo">Description<textarea rows={2} value={description} onChange={(event) => { invalidateApproval(); setDescription(event.target.value); }} /></label>
                <label>Target market<input value={draft.preferences.market} onChange={(event) => updatePreference("market", event.target.value)} placeholder="e.g. first-home buyers" /></label>
                <label>Preferred brands<input value={draft.preferences.brands} onChange={(event) => updatePreference("brands", event.target.value)} placeholder="Comma-separated preferences" /></label>
                <label>Quality level<select value={draft.preferences.qualityLevel || "Standard"} onChange={event => updatePreference("qualityLevel", event.target.value)}>{["Economy", "Standard", "Mid-range", "Premium"].map(level => <option key={level}>{level}</option>)}</select></label>
                <label>Preferred suppliers<input value={draft.preferences.suppliers || ""} onChange={event => updatePreference("suppliers", event.target.value)} /></label>
                <label>Budget basis<select value={draft.preferences.budgetType || "inclusions"} onChange={event => updatePreference("budgetType", event.target.value)}><option value="inclusions">Catalogue allowances (one of each product)</option><option value="construction">Construction budget</option></select></label>
                <label>Target budget (AUD)<input type="number" min="0" step="0.01" value={draft.preferences.budget} onChange={(event) => updatePreference("budget", event.target.value)} /></label>
                <label>Maximum unit allowance (catalogue basis)<input type="number" min="0" step="0.01" value={draft.preferences.maxUnitAllowance || ""} onChange={event => updatePreference("maxUnitAllowance", event.target.value)} /></label>
                <label>Required specification terms<input value={draft.preferences.specifications || ""} onChange={event => updatePreference("specifications", event.target.value)} /></label>
                <label>Additional requirements<input value={draft.preferences.notes} onChange={(event) => updatePreference("notes", event.target.value)} placeholder="Optional product or specification preferences" /></label>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeading"><span className="stepNo">02</span><div><h2>Business branding</h2><p>Imported from the active workspace owner’s existing Business Profile. Changes here are brochure-only.</p></div></div>
              <p>Branding is loaded from the workspace Business Profile. Optional fields do not block draft generation.</p>
              <div className="brandGrid">
                {[
                  ["businessName", "Trading name"], ["legalName", "Registered business name"], ["abn", "ABN"], ["licenceNumber", "Builder licence"],
                  ["businessAddress", "Business address"], ["postalAddress", "Postal address"], ["phone", "Phone"], ["email", "Email"],
                  ["website", "Website"], ["contactName", "Contact person"], ["tagline", "Tagline"], ["description", "Business description"],
                  ["logo", "Primary logo or asset URL"], ["alternateLogo", "Dark-background logo URL"], ["colours", "Brand colours"], ["fonts", "Brand fonts"],
                ].map(([key, label]) => (
                  <label key={key} className="brandField"><span>{label}{brandingProfile?.branding?.[key] ? <small>Business Profile</small> : branding[key] ? <small>Saved brochure value</small> : <small>Optional</small>}</span><input value={branding[key] || ""} onChange={(event) => { invalidateApproval(); setBrandingEdited(true); setBranding((current) => ({ ...current, [key]: event.target.value })); }} /></label>
                ))}
                <label className="brandField"><span>Upload primary logo<small>{uploadingBrand ? "Uploading…" : "PNG, JPEG, WebP"}</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingBrand} onChange={(event) => uploadBrandAsset("logo", event.target.files?.[0])} /></label>
                <label className="brandField"><span>Upload alternate logo<small>{uploadingBrand ? "Uploading…" : "PNG, JPEG, WebP"}</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingBrand} onChange={(event) => uploadBrandAsset("alternateLogo", event.target.files?.[0])} /></label>
              </div>
              {branding.logo ? <div className="logoPreview"><img src={branding.logo} alt="Selected builder logo" /><span>Selected brochure logo</span></div> : null}
              <details className="includeDetails"><summary>Choose details shown in the brochure</summary><div className="includeGrid">{Object.entries(branding).map(([key, value]) => value ? <label key={key}><input type="checkbox" checked={includedFields[key] !== false} onChange={(event) => { invalidateApproval(); setIncludedFields((current) => ({ ...current, [key]: event.target.checked })); }} /> {key}</label> : null)}</div></details>
              <div className="snapshotNote">Profile source: {brandingProfile?.source || "Business Profile Vault"} · {brandingProfile?.updated_at ? `Updated ${new Date(brandingProfile.updated_at).toLocaleDateString()}` : "No saved profile timestamp"}. Snapshot is saved per schedule.</div>
            </section>

            <section className="panel">
              <div className="panelHeading"><span className="stepNo">03</span><div><h2>Inclusions categories</h2><p>Extend this list for the builder’s own schedule structure.</p></div></div>
              <div className="categoryChips">{draft.categories.map((category) => <button key={category} type="button" onClick={() => { invalidateApproval(); setDraft((current) => ({ ...current, categories: current.categories.filter((item) => item !== category), gaps: current.gaps.filter((item) => item !== category), gapDetails: current.gapDetails.filter((gap) => gap.category !== category), excludedCategories: [...new Set([...current.excludedCategories, category])] })); }} title={`Exclude ${category}`}>{category}<span aria-hidden="true">×</span></button>)}</div>
              <div className="inlineAdd"><input value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCategory(); } }} placeholder="Add a builder-specific category" /><button type="button" onClick={addCategory}><Plus size={16} /> Add category</button></div>
              <div className="aiBar"><div><strong>Complete schedule generation</strong><span>Construction requirements are preserved. Missing catalogue products become review exceptions, not a generation blocker.</span></div><button type="button" onClick={generateProposals} disabled={Boolean(generationBlockReason)} title={generationBlockReason || "Generate and save the complete draft in this schedule"} aria-describedby="schedule-generation-status"><Sparkles size={16} /> {proposing ? "Generating…" : "Generate complete draft"}</button></div>
              <div id="schedule-generation-status" role="status" aria-live="polite">{generationBlockReason || generationProgress || `Ready to generate ${generationTier}. Branding details and product gaps will not block generation.`}</div>
              {generationBlockReason && !proposing && <div className="gapNotice">{generationBlockReason}</div>}
            </section>

            <section className="panel reviewPanel">
              <div className="panelHeading"><span className="stepNo">04</span><div><h2>Review and approve</h2><p>Product identities, prices and specifications are snapshots; no catalogue data is silently changed.</p></div></div>
              <div className="reviewSummary"><span>{reviewCounts.approved} approved</span><span>{reviewCounts.pending} needs review</span><span>{reviewCounts.rejected} rejected</span><span>{draft.gaps.length} category gaps</span></div>
              {approvalIssues.length > 0 && <div className="gapNotice" id="schedule-approval-status"><strong>Before final approval</strong><ul>{approvalIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
              <div className="sectionApprovalControls">{[...new Set(draft.items.map(item => item.category))].map(category => <div key={category}><strong>{category}</strong><button type="button" onClick={() => { invalidateApproval(); setDraft(current => approveConstructionSection(current, category)); }}><Check size={15} /> Approve section</button><span>{draft.items.filter(item => item.category === category && item.reviewStatus === "approved").length}/{draft.items.filter(item => item.category === category).length} approved</span></div>)}</div>
              {draft.gaps.length ? <div className="gapNotice"><strong>Builder review required</strong>{draft.gapDetails.length ? draft.gapDetails.map((gap) => <div key={`${gap.category}:${gap.requirementTitle || gap.reason}`}><b>{gap.category}:</b> {gap.reason}</div>) : <div>No suitable workspace product was proposed for these categories. Add a custom inclusion or exclude a category before approval: {draft.gaps.join(", ")}</div>}</div> : null}
              {draft.items.length ? draft.items.map((item) => {
                const query = (searchByItem[item.id] || "").toLowerCase();
                const compatible = item.productRequired === false ? [] : item.requirementCategory ? rankCatalogueCandidatesForCategories(products, [item.requirementCategory], { perCategory: 1000, totalLimit: 1000 }) : products;
                const alternatives = compatible.filter((product) => !query || `${product.name} ${product.brand} ${product.model} ${product.category}`.toLowerCase().includes(query)).slice(0, 60);
                return (
                  <article className="inclusionItem" key={item.id}>
                    <div className="itemTitle"><div><span className="categoryLabel">{item.category}</span><h3>{item.requirementTitle || item.product?.name || "Custom inclusion"}</h3></div><span className={`itemStatus ${item.reviewStatus}`}>{item.reviewStatus.replace("_", " ")}</span></div>
                    {item.product?.image ? <img className="productImage" src={item.product.image} alt={item.product.name} /> : null}
                    {item.product ? <div className="productFacts"><span>{[item.product.brand, item.product.range, item.product.model].filter(Boolean).join(" · ") || "Product details incomplete"}</span><span>{item.product.supplier || "Supplier not recorded"} · SKU {item.product.sku || "not recorded"}</span><span>Base allowance: {item.product.allowance == null ? "not recorded" : `${item.product.currency} ${item.product.allowance}`}</span><span>Upgrade price: {item.product.price == null ? "not recorded" : `${item.product.currency} ${item.product.price}`}</span><span>Price source: {item.product.priceSource || "not recorded"} · Effective: {item.product.priceEffectiveDate || "not recorded"} · GST {item.product.gstIncluded == null ? "basis unrecorded" : item.product.gstIncluded ? "included" : "excluded"}</span><span>Specification: {item.product.specification || item.product.description || "not recorded"}</span></div> : null}
                    {item.missingInformation?.length ? <div className="gapNotice">Needs review: {item.missingInformation.join(", ")}.</div> : null}
                    <label className="itemDescription">Inclusion description<textarea rows={2} value={item.description || ""} onChange={(event) => updateItem(item.id, { description: event.target.value })} /></label>
                    <label className="itemDescription">Specification<textarea rows={3} value={item.specification || item.product?.specification || ""} onChange={event => updateItem(item.id, { specification: event.target.value, reviewStatus: "needs_review" })} /></label>
                    {!item.product && item.productRequired !== false && <label><input type="checkbox" checked={item.reviewResolution === "builder_specification"} onChange={event => updateItem(item.id, { reviewResolution: event.target.checked ? "builder_specification" : "", reviewStatus: "needs_review" })} /> Use builder-verified specification without a catalogue product (no price invented)</label>}
                    <div className="itemValues"><label>Quantity<input type="number" min="0" step="any" value={item.quantity ?? ""} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} placeholder="Not specified" /></label><label>Unit<input value={item.unit || ""} onChange={(event) => updateItem(item.id, { unit: event.target.value })} placeholder="From product or enter" /></label><label>Schedule allowance override<input type="number" min="0" step="0.01" value={item.allowanceOverride ?? ""} onChange={(event) => updateItem(item.id, { allowanceOverride: event.target.value })} placeholder={item.product?.allowance == null ? "Not recorded" : String(item.product.allowance)} /></label></div>
                    {item.product ? <label className="slotControl">Quotation / Client Selections mapping<select value={item.selectionSlotId || ""} onChange={(event) => updateItem(item.id, { selectionSlotId: event.target.value })}><option value="">Descriptive only / leave unmapped</option>{SELECTION_SLOTS.map((slot) => <option key={slot.selectionSlotId} value={slot.selectionSlotId}>{slot.displayName}</option>)}</select></label> : null}
                    {item.productRequired !== false && <div className="alternativeRow"><input value={searchByItem[item.id] || ""} onChange={(event) => setSearchByItem((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Search compatible catalogue alternatives" /><select value="" onChange={(event) => replaceProduct(item.id, event.target.value)}><option value="">Replace with product…</option>{alternatives.map((product) => <option key={product.productId} value={product.productId}>{product.name}{product.brand ? ` · ${product.brand}` : ""}</option>)}</select></div>}
                    {!inclusionCanBeApproved(item) && <p role="status">Approval unavailable: enter the description and verified specification, then choose a compatible product or explicitly confirm the specification without a catalogue product.</p>}
                    <div className="itemActions"><button type="button" disabled={!inclusionCanBeApproved(item)} title={!inclusionCanBeApproved(item) ? "Resolve the item-specific approval message above." : "Approve this item"} className={item.reviewStatus === "approved" ? "selected" : ""} onClick={() => updateItem(item.id, { reviewStatus: "approved" })}><Check size={15} /> Approve</button><button type="button" className={item.reviewStatus === "rejected" ? "selected reject" : ""} onClick={() => updateItem(item.id, { reviewStatus: "rejected" })}>Reject / change</button><button type="button" onClick={() => setDraft((current) => refreshInclusionReview({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}><Trash2 size={15} /> Remove</button></div>
                  </article>
                );
              }) : <div className="emptyReview">No proposed inclusions yet. Generate product proposals or add a custom inclusion.</div>}
              <div className="reviewFooter"><button type="button" className="secondaryButton" onClick={() => addCustomInclusion()}><Plus size={15} /> Add custom inclusion</button><button type="button" className="approveButton" disabled={finalApprovalBlocked} title={finalApprovalBlocked ? approvalIssues[0] || "Every required item must be approved and all gaps resolved." : "Save the approved schedule"} aria-describedby="schedule-approval-status" onClick={markApproved}><Check size={15} /> Approve schedule</button></div>
            </section>
            </div>
          </div>

          <aside className={`sideColumn${brochureOpen ? " isHidden" : ""}`}>
            <section className="sidePanel"><div className="eyebrow">Source library</div><h2>{products.length} active products</h2><p>Loaded from this workspace’s Product Library. Inactive or archived products are not proposed.</p><div className="sourceState">{productWarning || (products.length ? "Workspace catalogue ready" : "No active catalogue products available")}</div></section>
            <section className="sidePanel"><div className="eyebrow">Approval snapshot</div><h2>{draft.status}</h2><p>Current draft has {draft.items.length} items and {draft.gaps.length} unresolved categories.</p><button type="button" className="sideSave" disabled={saving} onClick={() => saveDraft()}><Save size={15} /> {saving ? "Saving…" : "Save draft"}</button><p data-testid="schedule-save-feedback" role={error ? "alert" : "status"} aria-live="polite">{saving ? "Saving draft…" : error || notice || (schedule?.updatedAt ? `Last saved: ${new Date(schedule.updatedAt).toLocaleString()}` : "")}</p></section>
            <section className="sidePanel"><div className="eyebrow">Next</div><h2>Brochure design</h2><p>Review the generated master template, edit selections, then preview or publish the PDF.</p>{!brochureAllowed && <p role="status">Generate the complete draft first, or complete approval to build from the reviewed checklist.</p>}<button type="button" className="sideSave" disabled={!brochureAllowed} title={!brochureAllowed ? "Generate a complete draft or approve the current checklist first." : "Open the brochure page editor"} onClick={openBrochureDesigner}><RefreshCw size={15} /> Continue to design</button></section>
          </aside>
        </section>
      </main>
      <style jsx>{`
        .setupPage{min-height:100vh;background:#f3f6f3;color:#1b2c23;padding:26px clamp(15px,3vw,44px) 60px;font-family:Arial,sans-serif}.topBar{max-width:1420px;margin:0 auto 28px;display:flex;align-items:center;gap:18px}.backLink{display:inline-flex;align-items:center;gap:7px;color:#285342;text-decoration:none;font-weight:700}.saveState{margin-left:auto;color:#64746a;font-size:13px}.saveButton,.approveButton,.sideSave{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:5px;padding:10px 14px;background:#174a3a;color:white;font-weight:700;cursor:pointer}.saveButton:disabled,.approveButton:disabled{opacity:.48;cursor:not-allowed}.intro,.setupGrid{max-width:1420px;margin:0 auto}.intro{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.eyebrow{display:block;color:#9a6b2f;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.intro h1{margin:8px 0;color:#1a2c22;font:500 40px/1.05 Georgia,serif}.intro p{margin:0;color:#64746a;max-width:760px;font-size:14px;line-height:1.55}.statusPill{border-radius:999px;padding:8px 12px;background:#e7eee8;color:#426253;font-size:12px;font-weight:800;white-space:nowrap}.statusPill.needs-review{background:#fff3d8;color:#8a6115}.statusPill.approved{background:#dcfce7;color:#166534}.setupGrid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px;align-items:start}.mainColumn,.sideColumn{display:grid;gap:16px}.panel,.sidePanel{background:#fff;border:1px solid #dce4dd;border-radius:7px;padding:20px;box-shadow:0 4px 16px rgba(24,44,33,.04)}.panelHeading{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.stepNo{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;background:#e9f1eb;border-radius:4px;color:#346249;font-size:13px;font-weight:800}.panelHeading h2,.sidePanel h2{margin:0 0 4px;color:#21342a;font:500 22px Georgia,serif}.panelHeading p,.sidePanel p{margin:0;color:#718078;font-size:12px;line-height:1.55}.fields,.brandGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.fields label,.brandField{display:grid;gap:6px;color:#46574c;font-size:12px;font-weight:700}.fields input,.fields textarea,.brandField input,.itemDescription textarea,.inlineAdd input,.alternativeRow input,.alternativeRow select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd6ce;border-radius:4px;background:#fff;color:#1e2e24;font:13px Arial,sans-serif}.spanTwo{grid-column:1/-1}.brandField>span{display:flex;align-items:center;justify-content:space-between;gap:8px}.brandField small{color:#587563;font-size:10px;font-weight:600}.brandField .missing{color:#a15b2f}.includeDetails{margin-top:16px;border-top:1px solid #e7ece8;padding-top:13px;color:#53665a;font-size:12px}.includeDetails summary{cursor:pointer;font-weight:700}.includeGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}.includeGrid label{display:flex;align-items:center;gap:5px;font-size:11px}.snapshotNote{margin-top:13px;color:#758179;font-size:11px}.categoryChips{display:flex;flex-wrap:wrap;gap:7px}.categoryChips button{display:inline-flex;align-items:center;gap:8px;border:1px solid #d7e1d9;border-radius:4px;padding:7px 9px;background:#f9fbf9;color:#3b5848;font-size:11px;cursor:pointer}.categoryChips span{font-size:15px;color:#89958c}.inlineAdd{display:flex;gap:8px;margin-top:12px}.inlineAdd button,.aiBar button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #1b5b43;border-radius:4px;padding:9px 12px;background:#174a3a;color:white;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}.aiBar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:14px;border:1px solid #dce8de;border-radius:5px;background:#f4f8f4}.aiBar div{display:grid;gap:4px}.aiBar strong{color:#2d4d39;font-size:13px}.aiBar span{color:#748078;font-size:11px;line-height:1.4}.aiBar button:disabled{opacity:.45;cursor:not-allowed}.reviewSummary{display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 12px}.reviewSummary span{padding:6px 9px;border-radius:3px;background:#eff3ef;color:#55685b;font-size:11px}.gapNotice,.warningBanner{margin:10px 0;padding:11px;border:1px solid #e4d2ad;border-radius:4px;background:#fff8e9;color:#7d5b21;font-size:12px;line-height:1.5}.inclusionItem{margin-top:11px;border:1px solid #e0e7e1;border-radius:5px;padding:14px}.itemTitle{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.categoryLabel{color:#9a6b2f;font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}.itemTitle h3{margin:5px 0;color:#21352a;font:600 16px Georgia,serif}.itemStatus{white-space:nowrap;padding:5px 7px;border-radius:3px;background:#fff3d8;color:#8a6115;font-size:10px;font-weight:800;text-transform:capitalize}.itemStatus.approved{background:#dcfce7;color:#166534}.itemStatus.rejected{background:#fce8e6;color:#9a372d}.productImage{display:block;max-width:100%;width:130px;height:92px;object-fit:contain;background:#f4f6f4;border-radius:3px;margin:9px 0}.productFacts{display:grid;gap:5px;margin:9px 0;color:#627168;font-size:11px}.itemDescription{display:grid;gap:6px;margin:12px 0;color:#4b5d51;font-size:11px;font-weight:700}.alternativeRow{display:grid;grid-template-columns:minmax(140px,.7fr) minmax(180px,1.3fr);gap:8px}.itemActions,.reviewFooter{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.itemActions button,.secondaryButton{display:inline-flex;align-items:center;gap:5px;border:1px solid #d3ddd5;border-radius:4px;padding:7px 9px;background:white;color:#4d6254;font-size:11px;font-weight:700;cursor:pointer}.itemActions button.selected{background:#e6f3e8;border-color:#86b891;color:#1f6637}.itemActions button.selected.reject{background:#fff0ee;border-color:#e6aaa2;color:#943b32}.emptyReview{padding:20px;border:1px dashed #cad5cc;border-radius:4px;color:#77847b;text-align:center;font-size:12px}.reviewFooter{justify-content:space-between;margin-top:14px}.approveButton{padding:9px 12px}.sidePanel{padding:17px}.sidePanel h2{margin-top:8px}.sidePanel p{margin:7px 0 12px}.sideSave{padding:8px 10px;font-size:11px}.sourceState{padding:8px;border-radius:4px;background:#eff5f0;color:#456550;font-size:10px}.errorBanner,.noticeBanner{max-width:1420px;margin:0 auto 14px;padding:11px;border-radius:4px;background:#fff0ee;color:#953b32;font-size:12px}.noticeBanner{background:#e8f5eb;color:#2f6540}.state{max-width:1000px;margin:60px auto;padding:20px;background:white;border:1px solid #dce4dd;color:#617068}@media(max-width:1000px){.setupGrid{grid-template-columns:1fr}.sideColumn{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.setupPage{padding:18px 13px 40px}.topBar{flex-wrap:wrap}.saveState{margin-left:0}.intro{align-items:flex-start;flex-direction:column}.intro h1{font-size:32px}.fields,.brandGrid{grid-template-columns:1fr}.spanTwo{grid-column:auto}.includeGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.alternativeRow{grid-template-columns:1fr}.sideColumn{grid-template-columns:1fr}.panel{padding:15px}.aiBar{align-items:flex-start;flex-direction:column}}
      `}</style>
      <style jsx global>{`.workflowForms.isHidden,.sideColumn.isHidden{display:none}.designerToolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.designerToolbar h2{margin:6px 0;color:#21342a;font:500 24px Georgia,serif}.designerToolbar p{margin:0;color:#718078;font-size:12px}.designerActions{display:flex;flex-wrap:wrap;gap:8px}.generatedState{margin:0 0 12px;padding:9px 11px;border-radius:4px;background:#e8f5eb;color:#2f6540;font-size:12px}.logoPreview{display:flex;align-items:center;gap:10px;margin-top:12px;color:#66746b;font-size:11px}.logoPreview img{width:120px;height:64px;object-fit:contain;border:1px solid #e0e7e1;border-radius:4px;background:#fff}`}</style>
    </>
  );
}
