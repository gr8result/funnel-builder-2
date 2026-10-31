// Real-catalogue mapping regression for Standard Inclusions packages.
// Run: node --import ./scripts/register-json-import.mjs scripts/test-standard-inclusions-catalogue-mapping.mjs
import assert from "node:assert/strict";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { generateMasterInclusionsSchedule } from "../lib/standard-inclusions/simpleScheduleGenerator.mjs";
import { normalizeCatalogueProduct } from "../lib/standard-inclusions/productProposal.mjs";

const products = getEffectiveProductCatalogue({ organisationId: "mapping-regression" }).products;
const rawById = new Map(products.map((product) => [normalizeCatalogueProduct(product).productId, product]));
const tileApplications = (product) => (rawById.get(product.productId)?.attributes?.tileApplications || []).map((value) => String(value).toLowerCase());

for (const tier of ["Classic", "Premier", "Premium"]) {
  const generated = generateMasterInclusionsSchedule({ scheduleId: `mapping-${tier}`, tier, products });
  const required = generated.items.filter((item) => item.productRequired);
  assert.equal(generated.items.length, 200, `${tier}: 200 structured inclusions`);
  assert.equal(required.length, 92, `${tier}: 92 product requirements`);
  const byTitle = (title) => required.find((item) => item.requirementTitle === title);

  for (const item of required.filter((entry) => entry.requirementCategory === "Floor Tiles" && entry.product)) {
    const applications = tileApplications(item.product);
    assert.ok(!applications.length || applications.includes("floor"), `${tier}: ${item.requirementTitle} uses a floor tile, got ${item.product.name}`);
  }
  for (const item of required.filter((entry) => entry.requirementCategory === "Wall Tiles" && entry.product)) {
    const applications = tileApplications(item.product);
    assert.ok(!applications.length || applications.includes("wall"), `${tier}: ${item.requirementTitle} uses a wall tile, got ${item.product.name}`);
  }
  const handles = byTitle("Cabinet handles").product;
  assert.equal(handles?.familyKey, "handles", `${tier}: cabinet handles come from the cabinet handle family`);
  assert.doesNotMatch(handles.name, /lock|deadbolt|cylinder|entrance|lever set|knob set/i);

  for (const title of ["Exhaust fans", "Bathroom exhaust fan"]) assert.match(byTitle(title).product?.name || "", /exhaust fan/i, `${tier}: ${title}`);
  assert.equal(byTitle("Heating systems").product?.familyKey, "heating", `${tier}: heating system`);
  assert.equal(byTitle("Filtered water tap").product?.familyKey, "boiling-chilled-filtered", `${tier}: filtered water tap`);
  for (const title of ["Benchtop brand and range", "Vanity benchtop", "Laundry benchtop"]) assert.match(byTitle(title).product?.familyKey || "", /benchtops|tops/, `${tier}: ${title}`);

  // Light fittings must never stand in for electrical devices.
  for (const title of ["Power points", "Light switches", "Smoke alarms"]) {
    const product = byTitle(title).product;
    assert.ok(!product || !/downlight|pendant|sconce|wall light|flush mount|bracket/i.test(product.name), `${tier}: ${title} is not a light fitting (${product?.name})`);
  }
  assert.doesNotMatch(byTitle("External lights").product?.name || "", /driver|transformer/i, `${tier}: external light is a light`);
  assert.doesNotMatch(byTitle("LED downlights").product?.name || "", /frame only/i, `${tier}: complete downlight`);

  const matched = required.filter((item) => item.product).length;
  assert.ok(matched >= 89, `${tier}: at least 89 of 92 requirements matched, got ${matched}`);
  console.log(`${tier}: ${matched}/92 matched; gaps: ${required.filter((item) => !item.product).map((item) => item.requirementTitle).join(", ") || "none"}`);
}
console.log("Standard Inclusions real-catalogue mapping regression passed.");

// Release rules for the published brochure, on the real catalogue.
{
  const { buildInclusionsBrochureDocument } = await import("../lib/standard-inclusions/brochureDesignPrototype.mjs");
  const { hasApprovedProductImage } = await import("../lib/standard-inclusions/productProposal.mjs");
  const { inclusionCanBeApproved } = await import("../lib/standard-inclusions/tierScheduleReview.mjs");
  const { buildStandardInclusionsQuotationSeed } = await import("../lib/standard-inclusions/quotationSeed.mjs");
  const generated = generateMasterInclusionsSchedule({ scheduleId: "release-rules", tier: "Premier", products });
  const items = generated.items.map((item) => ({ ...item }));
  const approvedImages = new Set(items.filter((item) => hasApprovedProductImage(item.product)).map((item) => item.product.image));
  const unverified = items.filter((item) => item.productRequired && item.product?.image && !hasApprovedProductImage(item.product));
  const noImage = items.filter((item) => item.productRequired && item.product && !item.product.image);
  const objectsOf = (document) => document.pages.flatMap((page) => page.objects.map((object) => ({ ...object, page })));

  let brochure = buildInclusionsBrochureDocument({ items, name: "Premier", packageChoice: "Mid-range" });
  const productImages = objectsOf(brochure).filter((object) => object.type === "image" && object.data?.productId);
  assert.ok(productImages.length > 40, "product photography is still used");
  for (const object of productImages) assert.ok(approvedImages.has(object.data.imageRef), `only verified product images are rendered (${object.name})`);
  const issues = brochure.metadata.visualIssues;
  for (const item of [...unverified, ...noImage]) {
    const issue = issues.find((entry) => entry.itemId === item.id);
    assert.equal(issue?.issueType, "missing_image", `${item.requirementTitle}: image needs explicit text-only approval`);
    assert.match(issue.issue, item.product.image ? /awaiting Product Library verification/ : /no approved image/);
  }
  console.log(`Premier brochure: ${productImages.length} verified product images; ${unverified.length} unverified and ${noImage.length} missing images held for text-only approval.`);

  // Text-only cards: no photo, accent bar, copy inside the card and readable.
  for (const item of [...unverified, ...noImage]) {
    const objects = objectsOf(brochure).filter((object) => object.name.startsWith(`${item.requirementTitle} `));
    if (!objects.length) continue;
    const card = objects.find((object) => object.name.endsWith("inclusion card"));
    assert.ok(card, `${item.requirementTitle}: card rendered`);
    assert.ok(!objects.some((object) => object.type === "image"), `${item.requirementTitle}: no photo`);
    assert.ok(objects.some((object) => object.name.endsWith(" accent")), `${item.requirementTitle}: accent bar`);
    const title = objects.find((object) => object.name.endsWith(" title"));
    const words = (value) => String(value).replace(/\s+/g, " ").trim();
    assert.ok(words(item.product.name).startsWith(words(title.data.text).replace(/…$/, "").slice(0, 40)), `${item.requirementTitle}: product name shown`);
    for (const object of objects.filter((entry) => entry.type === "text")) {
      assert.ok(object.x >= card.x && object.x + object.width <= card.x + card.width && object.y >= card.y && object.y + object.height <= card.y + card.height, `${item.requirementTitle}: ${object.name} inside card`);
      assert.ok((object.style?.fontSize || object.data?.fontSize || 8) >= 7.5, `${item.requirementTitle}: readable text`);
    }
  }

  // Missing electrical products: a review gap until the builder records a verified specification.
  const electrical = ["Power points", "Light switches", "Smoke alarms"].map((title) => items.find((item) => item.requirementTitle === title));
  for (const item of electrical) {
    assert.equal(item.product, null);
    assert.equal(item.reviewStatus, "needs_review");
    assert.equal(issues.find((entry) => entry.itemId === item.id)?.issueType, "missing_product", `${item.requirementTitle}: blocks publishing while unresolved`);
    assert.equal(inclusionCanBeApproved(item), false, `${item.requirementTitle}: cannot be approved without a specification`);
    Object.assign(item, { reviewResolution: "builder_specification", specification: `${item.requirementTitle} to AS/NZS 3000, positions per approved electrical plan.`, reviewStatus: "approved" });
    assert.equal(inclusionCanBeApproved(item), true, `${item.requirementTitle}: approvable as builder specification`);
  }
  brochure = buildInclusionsBrochureDocument({ items, name: "Premier", packageChoice: "Mid-range" });
  for (const item of electrical) {
    assert.ok(!brochure.metadata.visualIssues.some((entry) => entry.itemId === item.id), `${item.requirementTitle}: resolved specification no longer blocks publishing`);
    const objects = objectsOf(brochure).filter((object) => object.name.startsWith(`${item.requirementTitle} `));
    assert.ok(objects.some((object) => object.data?.text === "Builder-verified specification"), `${item.requirementTitle}: labelled as builder specification`);
    assert.ok(objects.some((object) => String(object.data?.text || "").includes("AS/NZS 3000")), `${item.requirementTitle}: specification shown`);
    assert.ok(!objects.some((object) => object.type === "image"), `${item.requirementTitle}: no invented product photo`);
  }
  const seed = buildStandardInclusionsQuotationSeed({ scheduleId: "s", scheduleVersionId: "v", items: electrical });
  for (const line of seed.lines) {
    assert.equal(line.productId, null, `${line.productName}: no invented product`);
    assert.equal(line.allowance, null, `${line.productName}: no invented price`);
    assert.equal(line.allowanceBasis, "unpriced");
  }
  console.log("Brochure image approval, text-only cards and builder-specification electrical items passed.");
}
