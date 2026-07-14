import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  agencyResponseItems,
  brand,
  getAgencyProfile,
  pdfSections,
  platformGroups,
} from "../../../lib/founding-growth-partner/content";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;

function wrapText(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function drawTextBlock(page, text, x, y, options) {
  const { font, size, color, maxWidth, lineHeight } = options;
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
  return y - lines.length * lineHeight;
}

function addPageNumber(page, index, font) {
  page.drawText(`Page ${index}`, {
    x: PAGE.width - MARGIN - 48,
    y: 28,
    size: 9,
    font,
    color: rgb(0.38, 0.45, 0.55),
  });
}

async function drawLogo(pdfDoc, page) {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo", "gr8result-logo.png");
    const bytes = fs.readFileSync(logoPath);
    const logo = await pdfDoc.embedPng(bytes);
    const width = 126;
    const height = (logo.height / logo.width) * width;
    page.drawImage(logo, { x: MARGIN, y: PAGE.height - MARGIN - height, width, height });
  } catch {
    page.drawText(brand.name, { x: MARGIN, y: PAGE.height - MARGIN - 18, size: 12 });
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const agency = getAgencyProfile(req.query.agencySlug);
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.03, 0.08, 0.15);
  const blue = rgb(0.03, 0.46, 0.75);
  const slate = rgb(0.2, 0.27, 0.36);

  let page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: rgb(0.96, 0.98, 1) });
  await drawLogo(pdfDoc, page);
  page.drawText("Invitation to Become Our", { x: MARGIN, y: 630, size: 25, font: bold, color: blue });
  page.drawText("Founding Growth Partner", { x: MARGIN, y: 590, size: 38, font: bold, color: navy });
  page.drawText("Gr8 Result Digital Solutions", { x: MARGIN, y: 548, size: 18, font: bold, color: slate });
  const preparedFor = agency?.agencyName ? `Prepared for ${agency.agencyName}` : "Prepared for one exceptional SaaS growth agency";
  drawTextBlock(page, preparedFor, MARGIN, 504, { font: regular, size: 12, color: slate, maxWidth: 420, lineHeight: 17 });
  drawTextBlock(page, "We are seeking a strategic partner to help launch, shape and scale an all-in-one business platform for Australian builders, construction businesses and service-based SMEs.", MARGIN, 448, { font: regular, size: 13, color: slate, maxWidth: 460, lineHeight: 19 });
  addPageNumber(page, 1, regular);

  let pageIndex = 2;
  function newPage() {
    page = pdfDoc.addPage([PAGE.width, PAGE.height]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: rgb(1, 1, 1) });
    page.drawText("Gr8 Result Digital Solutions", { x: MARGIN, y: PAGE.height - 42, size: 10, font: bold, color: blue });
    addPageNumber(page, pageIndex, regular);
    pageIndex += 1;
    return PAGE.height - 78;
  }

  let y = newPage();
  const sections = agency?.reason
    ? [{ title: "Personalised Context", body: [agency.reason] }, ...pdfSections]
    : pdfSections;

  sections.forEach((section) => {
    if (y < 160) y = newPage();
    page.drawText(section.title, { x: MARGIN, y, size: 19, font: bold, color: navy });
    y -= 28;
    section.body.forEach((paragraph) => {
      if (y < 104) y = newPage();
      y = drawTextBlock(page, paragraph, MARGIN, y, { font: regular, size: 10.5, color: slate, maxWidth: PAGE.width - MARGIN * 2, lineHeight: 15 });
      y -= 10;
    });
    y -= 10;
  });

  y = newPage();
  page.drawText("Platform Modules", { x: MARGIN, y, size: 19, font: bold, color: navy });
  y -= 28;
  platformGroups.forEach((group) => {
    if (y < 104) y = newPage();
    page.drawText(group.title, { x: MARGIN, y, size: 12, font: bold, color: blue });
    y -= 17;
    y = drawTextBlock(page, group.modules.join("  |  "), MARGIN, y, { font: regular, size: 10, color: slate, maxWidth: PAGE.width - MARGIN * 2, lineHeight: 14 });
    y -= 13;
  });

  y -= 10;
  page.drawText("Agency Response Checklist", { x: MARGIN, y, size: 17, font: bold, color: navy });
  y -= 24;
  agencyResponseItems.forEach((item) => {
    if (y < 78) y = newPage();
    page.drawText(`- ${item}`, { x: MARGIN, y, size: 10, font: regular, color: slate });
    y -= 15;
  });

  const pdfBytes = await pdfDoc.save();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="gr8-result-founding-growth-partner-guide.pdf"');
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).send(Buffer.from(pdfBytes));
}
