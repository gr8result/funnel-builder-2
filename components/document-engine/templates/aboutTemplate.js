import { createA4Page } from "../core/pageEngine.js";
import { createImageObject } from "../objects/imageObject.js";
import { createLogoObject } from "../objects/logoObject.js";
import { createTextObject } from "../objects/textObject.js";
import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand.js";

export function createAboutTemplate(props = {}) {
  const brand = { ...DEFAULT_BUILDER_TEMPLATE_BRAND, ...(props.brand || {}) };
  return createA4Page({
    name: "About",
    objects: [
      createLogoObject({ id: "about_logo", x: 72, y: 56, width: 116, height: 76, data: { imageRef: brand.logoUrl, alt: `${brand.name} logo` } }),
      createTextObject({ id: "about_heading", x: 72, y: 154, width: 360, height: 56, style: { fontSize: 34, fontWeight: 800, color: brand.primaryColor }, data: { text: `About ${brand.name}` } }),
      createTextObject({ id: "about_subtitle", x: 72, y: 206, width: 390, height: 32, style: { fontSize: 17, fontWeight: 700, color: brand.accentColor }, data: { text: brand.tagline } }),
      createTextObject({ id: "about_body", x: 72, y: 258, width: 340, height: 320, style: { fontSize: 15, fontWeight: 400, lineHeight: 1.45 }, data: { text: `${brand.name} is a sample builder profile for this editable template. Replace this text with your company story, credentials, project approach and client promise.` } }),
      createImageObject({ id: "about_image", x: 456, y: 120, width: 260, height: 420, style: { objectFit: "cover", borderRadius: 28 }, data: { imageRef: null, alt: "About image" } }),
      createTextObject({ id: "about_stat_1", x: 72, y: 880, width: 120, height: 78, style: { fontSize: 18, fontWeight: 800, textAlign: "center" }, data: { text: "20+\nYears Experience" } }),
      createTextObject({ id: "about_stat_2", x: 224, y: 880, width: 120, height: 78, style: { fontSize: 18, fontWeight: 800, textAlign: "center" }, data: { text: "150+\nProjects Completed" } }),
      createTextObject({ id: "about_stat_3", x: 376, y: 880, width: 120, height: 78, style: { fontSize: 18, fontWeight: 800, textAlign: "center" }, data: { text: "98%\nClient Satisfaction" } }),
      createTextObject({ id: "about_stat_4", x: 528, y: 880, width: 120, height: 78, style: { fontSize: 18, fontWeight: 800, textAlign: "center" }, data: { text: "100%\nSafety Focused" } }),
    ],
    ...props,
  });
}
