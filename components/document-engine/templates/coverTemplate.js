import { createA4Page } from "../core/pageEngine.js";
import { createDynamicFieldObject } from "../objects/dynamicFieldObject.js";
import { createDividerObject } from "../objects/dividerObject.js";
import { createLogoObject } from "../objects/logoObject.js";
import { createTextObject } from "../objects/textObject.js";
import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand.js";

export function createCoverTemplate(props = {}) {
  const brand = { ...DEFAULT_BUILDER_TEMPLATE_BRAND, ...(props.brand || {}) };
  return createA4Page({
    name: "Cover",
    background: { color: "#ffffff", imageRef: props.backgroundImageRef || null },
    objects: [
      createLogoObject({ id: "cover_logo", x: 72, y: 62, width: 118, height: 86, data: { imageRef: props.logoRef || brand.logoUrl, alt: `${brand.name} logo` } }),
      createDynamicFieldObject("COMPANY_NAME", { id: "cover_company", x: 206, y: 76, width: 300, height: 44, style: { fontSize: 28, fontWeight: 800, color: brand.primaryColor } }),
      createTextObject({ id: "cover_tagline", x: 206, y: 116, width: 360, height: 28, style: { fontSize: 12, fontWeight: 700, color: brand.accentColor, letterSpacing: 2 }, data: { text: brand.tagline } }),
      createDynamicFieldObject("PROJECT_NAME", { id: "cover_project", x: 72, y: 360, width: 520, height: 120, style: { fontSize: 56, fontWeight: 800, lineHeight: 1.05 } }),
      createDividerObject({ id: "cover_divider", x: 72, y: 512, width: 180, height: 4, style: { color: brand.accentColor, thickness: 4 } }),
      createDynamicFieldObject("CLIENT_NAME", { id: "cover_client", x: 72, y: 560, width: 420, height: 36, style: { fontSize: 22, fontWeight: 600 } }),
      createDynamicFieldObject("SITE_ADDRESS", { id: "cover_address", x: 72, y: 604, width: 440, height: 72, style: { fontSize: 18, fontWeight: 400 } }),
      createTextObject({ id: "cover_quote_box", x: 72, y: 720, width: 320, height: 96, style: { fontSize: 18, fontWeight: 500 }, data: { text: "Quote: {{QUOTE_NUMBER}}\nDate: {{QUOTE_DATE}}" } }),
      createTextObject({ id: "cover_footer_brand", x: 72, y: 1030, width: 520, height: 34, style: { fontSize: 13, fontWeight: 700, color: brand.primaryColor }, data: { text: `${brand.legalName} | ${brand.phone} | ${brand.email}` } }),
    ],
    ...props,
  });
}
