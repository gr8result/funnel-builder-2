// Repairs Exterior Product Library images that were broken or showed the wrong subject.
// Re-runnable: only the listed records/fields change; JSON keeps 2-space CRLF formatting.
//   - Bradnam's windows: hotlink-protected remote images -> local copies of the same images.
//   - DECKING-GENERIC-TIMBER showed a cabin interior; RETAINING-GENERIC-CONCRETE-SLEEPER showed a
//     living room. No genuine image exists for these generic selections, so the image is removed
//     and the card shows the neutral placeholder.
import fs from "node:fs";

const DIR = "data/product-library/catalogues/exterior";
const VERIFIED_AT = "2026-09-28";

function edit(file, mutate) {
  const target = `${DIR}/${file}`;
  const json = JSON.parse(fs.readFileSync(target, "utf8"));
  const changes = mutate(json.products || []);
  fs.writeFileSync(target, `${JSON.stringify(json, null, 2).replace(/\n/g, "\r\n")}\r\n`);
  console.log(file, changes);
}

const BRADNAMS = {
  "WINDOW-BRADNAMS-SLIDING-WINDOWS": "sliding-windows.webp",
  "WINDOW-BRADNAMS-AWNING-WINDOWS": "awning-windows.webp",
  "WINDOW-BRADNAMS-LOUVRE-WINDOWS": "louvre-windows.webp",
  "WINDOW-BRADNAMS-FIXED-WINDOWS": "fixed-windows.jpg",
  "WINDOW-BRADNAMS-DOUBLE-HUNG-SASH-WINDOWS": "double-hung-sash-windows.webp",
  "WINDOW-BRADNAMS-CASEMENT-WINDOWS": "casement-windows.webp",
};

edit("AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json", (products) => {
  let count = 0;
  products.forEach((product) => {
    const file = BRADNAMS[product.product_code];
    if (!file) return;
    const local = `/images/product-library/windows/bradnams/${file}`;
    if (product.primary_image_url !== local) {
      product.remote_image_url = product.remote_image_url || product.primary_image_url;
      product.primary_image_url = local;
      product.thumbnail_url = local;
      product.image_verified_at = VERIFIED_AT;
      count += 1;
    }
  });
  return `${count} Bradnam's images localised`;
});

const WRONG_SUBJECT = {
  "DECKING-GENERIC-TIMBER": "Previous stock photo showed a cabin interior, not decking.",
  "RETAINING-GENERIC-CONCRETE-SLEEPER": "Previous stock photo showed a living room, not a retaining wall.",
};

edit("AU-EXTERIOR-FINISHES-CATALOGUE.json", (products) => {
  let count = 0;
  products.forEach((product) => {
    const reason = WRONG_SUBJECT[product.product_code];
    if (!reason || !product.primary_image_url) return;
    product.primary_image_url = "";
    product.thumbnail_url = "";
    product.image_status = "missing";
    product.image_note = `${reason} Removed ${VERIFIED_AT}; neutral placeholder until a genuine image is sourced.`;
    count += 1;
  });
  return `${count} wrong-subject images removed`;
});
