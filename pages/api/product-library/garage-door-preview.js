import { createGaragePreviewHandler } from "../../../lib/product-library/garageDoorPreviewServer.js";

export const config = {
  api: { bodyParser: { sizeLimit: "4kb" }, responseLimit: "16mb" },
  maxDuration: 180,
};

export default createGaragePreviewHandler();
