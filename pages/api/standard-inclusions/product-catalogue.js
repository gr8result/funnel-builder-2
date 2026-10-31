import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withWorkspace } from "../../../lib/withWorkspace";

let catalogue;

function loadCatalogue() {
  if (!catalogue) {
    catalogue = JSON.parse(readFileSync(
      resolve(process.cwd(), "data/standard-inclusions/canonical-product-catalogue.json"),
      "utf8",
    ));
  }
  return catalogue;
}

async function standardInclusionsProductCatalogueHandler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const canonical = loadCatalogue();
  return res.status(200).json({
    workspace_id: req.workspaceId,
    products: canonical.products || [],
    effective_count: canonical.products?.length || 0,
    source: "canonical-snapshot",
  });
}

export default withWorkspace(standardInclusionsProductCatalogueHandler);
