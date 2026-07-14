import { createA4Page } from "../core/pageEngine.js";
import { createLogoObject } from "../objects/logoObject.js";
import { createSignatureObject } from "../objects/signatureObject.js";
import { createTextObject } from "../objects/textObject.js";
import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand.js";

export function createAcceptanceTemplate(props = {}) {
  const brand = { ...DEFAULT_BUILDER_TEMPLATE_BRAND, ...(props.brand || {}) };
  return createA4Page({
    name: "Acceptance",
    objects: [
      createLogoObject({ id: "acceptance_logo", x: 72, y: 48, width: 110, height: 74, data: { imageRef: brand.logoUrl, alt: `${brand.name} logo` } }),
      createTextObject({ id: "acceptance_heading", x: 72, y: 136, width: 420, height: 56, style: { fontSize: 34, fontWeight: 800, color: brand.primaryColor }, data: { text: "Acceptance" } }),
      createTextObject({ id: "acceptance_body", x: 72, y: 176, width: 580, height: 160, style: { fontSize: 16, lineHeight: 1.45 }, data: { text: "By signing below, the client accepts this proposal subject to the stated inclusions, exclusions and terms." } }),
      createSignatureObject({ id: "client_signature", x: 72, y: 420, width: 300, height: 96, data: { label: "Client signature" } }),
      createSignatureObject({ id: "builder_signature", x: 420, y: 420, width: 300, height: 96, data: { label: "Builder signature" } }),
      createTextObject({ id: "acceptance_footer_brand", x: 72, y: 1030, width: 520, height: 34, style: { fontSize: 13, fontWeight: 700, color: brand.primaryColor }, data: { text: `${brand.legalName} | ${brand.phone} | ${brand.email}` } }),
    ],
    ...props,
  });
}
