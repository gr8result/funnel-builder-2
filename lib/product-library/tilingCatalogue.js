export function tileApplicationsFromSupplierData({ area = "", categoryType = "", productName = "" } = {}) {
  const publishedArea = `${area} ${categoryType}`;
  const productType = `${categoryType} ${productName}`;
  const applications = [];
  if (/\bfloor\b/i.test(publishedArea)) applications.push("floor");
  if (/\bwall\b/i.test(publishedArea)) applications.push("wall");
  if (/\bfeature\b/i.test(publishedArea)) applications.push("feature");
  if (/\bmosaics?\b/i.test(productType)) applications.push("mosaic");
  if (/\bpool\b/i.test(`${publishedArea} ${productName}`)) applications.push("pool");
  if (/\b(external|outdoor|alfresco)\b/i.test(`${publishedArea} ${productName}`)) applications.push("external");
  return [...new Set(applications)];
}