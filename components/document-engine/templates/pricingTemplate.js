import { createA4Page } from "../core/pageEngine.js";
import { createDynamicFieldObject } from "../objects/dynamicFieldObject.js";
import { createLogoObject } from "../objects/logoObject.js";
import { createTableObject } from "../objects/tableObject.js";
import { createTextObject } from "../objects/textObject.js";
import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand.js";

export function createPricingTemplate(props = {}) {
  const brand = { ...DEFAULT_BUILDER_TEMPLATE_BRAND, ...(props.brand || {}) };
  return createA4Page({
    name: "Pricing",
    objects: [
      createLogoObject({ id: "pricing_logo", x: 72, y: 48, width: 110, height: 74, data: { imageRef: brand.logoUrl, alt: `${brand.name} logo` } }),
      createTextObject({ id: "pricing_heading", x: 72, y: 136, width: 360, height: 56, style: { fontSize: 34, fontWeight: 800, color: brand.primaryColor }, data: { text: "Pricing" } }),
      createTableObject({ id: "pricing_table", x: 72, y: 180, width: 650, height: 360 }),
      createDynamicFieldObject("QUOTE_TOTAL", { id: "pricing_total", x: 420, y: 580, width: 300, height: 48, style: { fontSize: 28, fontWeight: 800, textAlign: "right" } }),
      createTextObject({ id: "pricing_footer_brand", x: 72, y: 1030, width: 520, height: 34, style: { fontSize: 13, fontWeight: 700, color: brand.primaryColor }, data: { text: `${brand.legalName} | ${brand.phone} | ${brand.email}` } }),
    ],
    ...props,
  });
}
