// Client Selections typography standard. Everything a client is expected to READ (descriptions,
// product names, labels, status, filters, prices, allowances, variations, buttons, modal content)
// is at least CS_TYPE.minimum. Only icon glyphs and purely decorative marks may be smaller.
export const CS_TYPE = Object.freeze({
  minimum: 16,
  body: 16,
  label: 16,
  button: 16,
  productName: 19,
  price: 20,
  cardTitle: 22,
  featureTitle: 24,
  pageTitle: 28,
});

export const csPx = (key) => `${CS_TYPE[key] ?? CS_TYPE.minimum}px`;

export function isReadableFontSize(px) {
  return Number(px) >= CS_TYPE.minimum;
}
