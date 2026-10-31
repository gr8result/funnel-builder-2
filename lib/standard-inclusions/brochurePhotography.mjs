import { createObject } from "../../components/document-engine/core/objectEngine.js";

const assets = "/standard-inclusions/assets/";
const builders = "/assets/builders/";

const pools = [
  [/preliminar|design|approval|planning|site/i, [`${assets}image34.png`, `${assets}image35.png`]],
  [/earth|excavat|drainage|concrete|slab|footing/i, [`${assets}image33.png`, `${assets}image35.png`]],
  [/structur|framing|roof|carpentry|insulation/i, [`${assets}image35.png`, `${builders}standard-inclusions-construction-strip.png`]],
  [/kitchen|cabinet|benchtop|appliance|joinery|pantry/i, [`${assets}image19.jpeg`, `${assets}image47.jpeg`, `${assets}image53.jpeg`, `${assets}image45.jpeg`, `${assets}image46.jpeg`, `${builders}standard-inclusions-premier-kitchen.jpg`, `${builders}standard-inclusions-kitchen-black-white.webp`]],
  [/external|window|garage|cladding|outdoor|facade|landscap|driveway|pool|fenc/i, [`${assets}image55.jpeg`, `${builders}standard-inclusions-hero.jpg`, `${assets}image2.png`]],
  [/family|living|bed|robe|flooring|paint|internal/i, [`${builders}standard-inclusions-premier-living.jpg`, `${builders}standard-inclusions-family-kitchen.jpg`, `${assets}image54.jpeg`]],
];
const general = [`${builders}standard-inclusions-premier-living.jpg`, `${assets}image55.jpeg`, `${builders}standard-inclusions-family-kitchen.jpg`, `${builders}standard-inclusions-hero.jpg`, `${assets}image47.jpeg`, `${assets}image54.jpeg`];

export function brochurePhotograph(section = "", index = 0, previous = "") {
  const pool = pools.find(([pattern]) => pattern.test(section))?.[1] || general;
  const choices = [...pool, ...general.filter(source => !pool.includes(source))];
  for (let offset = 0; offset < choices.length; offset += 1) {
    const source = choices[(index + offset) % choices.length];
    if (source !== previous) return source;
  }
  return choices[0];
}

export function isBrochurePhotograph(asset) {
  const description = `${asset.name || ""} ${(asset.tags || []).join(" ")}`;
  return Boolean(asset.src)
    && /home|house|kitchen|bathroom|ensuite|living|interior|exterior|cabinet|construction|architect|framing|excavat|landscap/i.test(description)
    && !/software|pipeline|robot|fox|screenshot|dashboard/i.test(description);
}

// A landscape photograph sits behind the top right of each page, faded to the
// left and bottom. Text geometry is never changed.
export function applyBrochurePhotography(pages, { selectedImages = [], sectionAssignments = {} } = {}) {
  let previous = "";
  const used = new Map();
  return pages.map((page, index) => {
    const objects = (page.objects || []).filter(object => !object.data?.brochurePhotography)
      .map(object => {
        const original = object.data?.brochureOriginalLayer;
        return original === undefined ? object : { ...object, layer: original, data: { ...object.data, brochureOriginalLayer: undefined } };
      });
    const overlay = (name, fill, x, y, width, height, layer) => createObject("shape", {
      name, x, y, width, height, layer, locked: true,
      style: { fill, stroke: "transparent", strokeWidth: 0 },
      data: { brochurePhotography: true },
    });
    if (index === 0) {
      const cover = objects.find(object => object.type === "image");
      if (!cover) return { ...page, objects };
      return { ...page, objects: [...objects, overlay("Cover photographic vignette",
        "radial-gradient(ellipse at center, rgba(0,0,0,0) 48%, rgba(0,0,0,0.28) 100%)",
        cover.x, cover.y, cover.width, cover.height, cover.layer + 0.5)] };
    }
    if (index === 1) return { ...page, objects };
    const section = objects.find(object => object.name === "Section heading")?.data?.text || page.name || "";
    const selected = selectedImages.find(asset => sectionAssignments[asset.id] === section && isBrochurePhotograph(asset));
    const count = used.get(section) || 0;
    used.set(section, count + 1);
    const source = selected?.src || brochurePhotograph(section, index + count, previous);
    previous = source;
    const x = 284;
    const width = page.width - x;
    const height = 430;
    const photo = createObject("image", {
      name: `${section} - residential inspiration, not a product specification`,
      x, y: 0, width, height, layer: 0, opacity: 0.5,
      style: { objectFit: "cover" },
      data: { imageRef: source, alt: `${section} inspiration`, brochurePhotography: true, illustrativeOnly: true },
    });
    return {
      ...page,
      objects: [
        photo,
        overlay("Photographic side fade", "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0) 100%)", x, 0, width, height, 1),
        overlay("Photographic bottom fade", "linear-gradient(180deg, rgba(255,255,255,0) 40%, rgba(255,255,255,1) 100%)", x, 0, width, height, 2),
        overlay("Photographic vignette", "radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.7) 100%)", x, 0, width, height, 3),
        ...objects.map(object => ({ ...object, layer: (object.layer ?? 0) + 4, data: { ...object.data, brochureOriginalLayer: object.layer ?? 0 } })),
      ],
    };
  });
}
