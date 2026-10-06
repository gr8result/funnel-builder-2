import fs from "node:fs/promises";
import path from "node:path";
import { withWorkspace } from '../../../lib/withWorkspace';
import { CURRENT_BUILDER_WORKSPACE_ID } from '../../../lib/builders/currentBuilderSeed';
import { buildApprovedClientSelectionsCatalogue, PRODUCT_LIBRARY_SOURCE_CSV } from "../../../lib/product-library/catalogueModel";

async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // This CSV is the current builder's quote sheet, never a platform catalogue.
    if (req.workspaceId !== CURRENT_BUILDER_WORKSPACE_ID) {
      return res.status(200).json({ products: [], hierarchy: [], productFamilies: [], preview: [], audit: null });
    }
    const csvPath = path.join(process.cwd(), PRODUCT_LIBRARY_SOURCE_CSV);
    const csv = await fs.readFile(csvPath, "utf8");
    const catalogue = buildApprovedClientSelectionsCatalogue(csv, {
      organisationId: req.workspaceId,
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

export default withWorkspace(handler);
