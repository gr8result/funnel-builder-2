import fs from "node:fs/promises";
import path from "node:path";
import { buildApprovedClientSelectionsCatalogue, PRODUCT_LIBRARY_SOURCE_CSV } from "../../../lib/product-library/catalogueModel";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const csvPath = path.join(process.cwd(), PRODUCT_LIBRARY_SOURCE_CSV);
    const csv = await fs.readFile(csvPath, "utf8");
    const catalogue = buildApprovedClientSelectionsCatalogue(csv, {
      organisationId: String(req.query.organisationId || req.query.workspaceId || "approved-template"),
    });
    res.status(200).json({
      sourcePath: catalogue.sourcePath,
      hierarchy: catalogue.hierarchy,
      productFamilies: catalogue.productFamilies,
      products: catalogue.products,
      preview: catalogue.preview,
      audit: {
        totalPhysicalRows: catalogue.audit.totalPhysicalRows,
        usableRows: catalogue.audit.usableRows.length,
        identifiableProductRows: catalogue.audit.identifiableProductRows.length,
        genericRows: catalogue.audit.genericRows.length,
        rowsAlreadyPriced: catalogue.audit.rowsAlreadyPriced.length,
        rowsMissingPrice: catalogue.audit.rowsMissingPrice.length,
        duplicateRows: catalogue.audit.duplicateDescriptions.length,
        rowsRequiringManualMapping: catalogue.audit.rowsRequiringManualMapping.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Could not build approved Client Selections catalogue." });
  }
}
