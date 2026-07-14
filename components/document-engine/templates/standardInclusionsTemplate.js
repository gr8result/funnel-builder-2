import { createDocument } from "../core/documentState.js";
import { createA4Page } from "../core/pageEngine.js";
import { createObject } from "../core/objectEngine.js";

const NAVY = "#0b2545";
const GOLD = "#d29a37";

export function createPremierInclusionsDocument(overrides = {}) {
  const pages = [
    createCoverPage(),
    createIntroPage(),
    createConstructionPage(),
  ];
  return createDocument({
    id: overrides.id,
    name: overrides.name || "Premier Inclusions Schedule",
    pages,
    activePageId: overrides.activePageId || pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      templateName: "Premier Inclusions Master",
      ...(overrides.metadata || {}),
    },
  });
}

function createCoverPage() {
  return createA4Page({
    name: "Cover",
    background: { color: "#ffffff" },
    objects: [
      image("Hero image", "/assets/builders/standard-inclusions-hero.jpg", 0, 0, 794, 690),
      shape("Hero soft overlay", 0, 0, 794, 690, "rgba(255,255,255,0.20)", "transparent", 0),
      text("Premier Inclusions Range", 54, 230, 430, 148, 62, "800", NAVY),
      shape("Gold divider", 55, 356, 98, 5, GOLD, GOLD, 0),
      text("Premier Range\nInclusions Schedule", 56, 392, 330, 86, 26, "500", NAVY),
      shape("Feature strip", 0, 690, 794, 116, NAVY, NAVY, 0),
      text("Quality Inclusions", 148, 724, 136, 22, 16, "800", "#ffffff"),
      text("Carefully selected for performance, durability and style.", 148, 748, 144, 52, 14, "500", "#ffffff"),
      text("Everything You Need", 390, 724, 136, 22, 16, "800", "#ffffff"),
      text("A complete range of inclusions to make building easy.", 390, 748, 144, 52, 14, "500", "#ffffff"),
      text("Great Value", 638, 724, 136, 22, 16, "800", "#ffffff"),
      text("Inclusions that deliver exceptional value for your investment.", 638, 748, 144, 52, 14, "500", "#ffffff"),
      text("Built for life. Backed by quality.", 54, 888, 460, 48, 34, "500", NAVY, "Georgia", "italic"),
      shape("Footer divider", 54, 956, 446, 2, GOLD, GOLD, 0),
      text("1300 1231 456", 88, 1008, 190, 30, 23, "700", NAVY),
      text("goodbuild.com.au", 314, 1008, 230, 30, 23, "700", NAVY),
      logo("Goodbuild logo", "/assets/builders/goodbuild-logo.png", 584, 928, 158, 124),
    ],
  });
}

function createIntroPage() {
  return createA4Page({
    name: "Designed Around the Way You Live",
    background: { color: "#ffffff" },
    objects: [
      image("Family kitchen image", "/assets/builders/standard-inclusions-family-kitchen.jpg", 0, 0, 794, 490),
      shape("White content panel", 0, 440, 794, 683, "#ffffff", "transparent", 0, 0),
      text("PREMIER INCLUSIONS", 56, 575, 320, 32, 24, "800", GOLD),
      text("Designed for\nthe way you live.", 56, 625, 430, 150, 56, "400", NAVY, "Georgia"),
      shape("Gold heading divider", 56, 806, 96, 4, GOLD, GOLD, 0),
      text("Our Premier Inclusions provide the perfect balance of quality, style and value, forming the standard specification for every Project Estimate.\n\nDuring your Selections Process, you'll personalise your home by selecting colours, finishes and approved upgrades, with all final inclusions confirmed in your Formal Quotation before your Building Contract is prepared.", 56, 850, 455, 170, 20, "500", NAVY),
      text("QUALITY INCLUDED\nCarefully selected fixtures, fittings and finishes.", 545, 620, 180, 70, 14, "800", NAVY),
      text("BUILT FOR LIVING\nPractical, stylish and made for everyday life.", 545, 740, 180, 70, 14, "800", NAVY),
      text("YOUR CHOICES\nPersonalise your home with colours, finishes and upgrades.", 545, 860, 180, 70, 14, "800", NAVY),
      text("CONFIDENCE & CLARITY\nAll selections documented in your Formal Quotation.", 545, 980, 180, 70, 14, "800", NAVY),
      logo("Goodbuild logo", "/assets/builders/goodbuild-logo.png", 56, 1040, 135, 58),
    ],
  });
}

function createConstructionPage() {
  return createA4Page({
    name: "Construction Inclusions",
    background: { color: "#ffffff" },
    objects: [
      image("Construction image strip", "/assets/builders/standard-inclusions-construction-strip.png", 0, 0, 794, 188),
      text("Premier Inclusions Schedule", 50, 230, 520, 46, 34, "800", NAVY),
      shape("Title divider", 50, 286, 692, 2, GOLD, GOLD, 0),
      shape("Feature strip", 0, 316, 794, 104, NAVY, NAVY, 0),
      text("Quality Inclusions\nCarefully selected products and finishes designed for quality and value.", 120, 342, 160, 60, 13, "700", "#ffffff"),
      text("Complete Specification\nEverything required to build a quality Premier home has been included.", 370, 342, 160, 60, 13, "700", "#ffffff"),
      text("Exceptional Value\nA balanced specification designed to deliver excellent value.", 620, 342, 140, 60, 13, "700", "#ffffff"),
      section("Site Preparation & Foundations", "Site cut allowance for up to 1 metre cross fall\nEngineer-designed concrete slab system to suit site conditions\nTermite treatment to slab penetrations and perimeter", 52, 470, 325),
      section("Structural & External", "70mm T2 treated timber wall framing\nT2 treated timber roof trusses designed to engineer's requirements\nColorbond steel roofing with insulation blanket", 52, 642, 325),
      section("Laundry", "Choice of 20mm stone benchtops from the builder's standard range\nStainless steel laundry tub\nLaminated cabinetry with soft-close hardware", 52, 790, 325),
      section("Highlight Inclusions", "20mm stone benchtops\nPolytec or Laminex cabinetry\n900mm stainless steel appliance package\nQuality floor coverings\nDulux paint system", 430, 470, 310),
      section("General Inclusions", "Building approvals and standard certification\nEnergy efficiency assessment\nBuilder's internal and external clean\nIndependent quality inspections during construction\n12-month maintenance period following handover", 430, 745, 310),
      section("Driveway", "Exposed aggregate driveway and paths allowance up to 60m2\nColour selected from the builder's standard range", 430, 910, 310),
      logo("Goodbuild logo", "/assets/builders/goodbuild-logo.png", 642, 976, 105, 82),
      text("1300 1231 456", 86, 1090, 175, 24, 18, "800", NAVY),
      text("goodbuild.com.au", 320, 1090, 210, 24, 18, "800", NAVY),
    ].flat(),
  });
}

function text(name, valueOrX, xOrY, yOrWidth, widthOrHeight, heightOrFontSize, fontSizeOrFontWeight, fontWeightOrColor, colorOrFontFamily, fontFamilyOrFontStyle = "Arial", fontStyleValue = "normal") {
  const compact = typeof valueOrX === "number";
  const value = compact ? name : valueOrX;
  const x = compact ? valueOrX : xOrY;
  const y = compact ? xOrY : yOrWidth;
  const width = compact ? yOrWidth : widthOrHeight;
  const height = compact ? widthOrHeight : heightOrFontSize;
  const fontSize = compact ? heightOrFontSize : fontSizeOrFontWeight;
  const fontWeight = compact ? fontSizeOrFontWeight : fontWeightOrColor;
  const color = compact ? fontWeightOrColor : colorOrFontFamily;
  const fontFamily = compact ? (colorOrFontFamily || "Arial") : (fontFamilyOrFontStyle || "Arial");
  const fontStyle = compact ? (fontFamilyOrFontStyle || "normal") : (fontStyleValue || "normal");
  return createObject("text", {
    name,
    x,
    y,
    width,
    height,
    style: { fontFamily, fontStyle, fontSize, fontWeight, color, lineHeight: 1.18, textAlign: "left" },
    data: { text: value },
  });
}

function shape(name, x, y, width, height, fill, stroke = "transparent", strokeWidth = 0, borderRadius = 0) {
  return createObject("shape", {
    name,
    x,
    y,
    width,
    height,
    style: { fill, stroke, strokeWidth, borderRadius },
  });
}

function image(name, imageRef, x, y, width, height) {
  return createObject("image", {
    name,
    x,
    y,
    width,
    height,
    style: { objectFit: "cover" },
    data: { imageRef, alt: name },
  });
}

function logo(name, imageRef, x, y, width, height) {
  return createObject("logo", {
    name,
    x,
    y,
    width,
    height,
    style: { objectFit: "contain" },
    data: { imageRef, alt: name },
  });
}

function section(title, body, x, y, width) {
  return [
    text(title, title.toUpperCase(), x, y, width, 28, 20, "850", GOLD),
    shape(`${title} divider`, x, y + 35, width, 1, GOLD, GOLD, 0),
    text(`${title} bullets`, body.split("\n").map((line) => `- ${line}`).join("\n"), x + 5, y + 48, width - 10, 96, 14, "600", NAVY),
  ];
}
