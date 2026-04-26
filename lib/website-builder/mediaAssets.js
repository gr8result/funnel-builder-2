function makeAssetId(fileName = "asset") {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `asset_${Date.now()}_${String(fileName).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

export function normalizeWebsiteBuilderAssets(assets) {
  const images = Array.isArray(assets?.images)
    ? assets.images
        .filter(Boolean)
        .map((image, index) => ({
          id: image.id || `legacy-image-${index}`,
          name: image.name || `Image ${index + 1}`,
          type: image.type || "image/jpeg",
          src: image.src || "",
        }))
        .filter((image) => image.src)
    : [];

  const logo = assets?.logo?.src
    ? {
        id: assets.logo.id || "brand-logo",
        name: assets.logo.name || "Logo",
        type: assets.logo.type || "image/png",
        src: assets.logo.src,
      }
    : null;

  return { logo, images };
}

export function getAssetIdKey(fieldKey) {
  return `${String(fieldKey || "")}AssetId`;
}

export function getAssetFromLibrary(assets, assetId) {
  if (!assetId) return null;
  const normalized = normalizeWebsiteBuilderAssets(assets);
  if (normalized.logo?.id === assetId) return normalized.logo;
  return normalized.images.find((image) => image.id === assetId) || null;
}

export function applyAssetToProps(props, fieldKey, asset) {
  if (!asset?.id) return { ...(props || {}) };

  return {
    ...(props || {}),
    [getAssetIdKey(fieldKey)]: asset.id,
  };
}

export function resolveAssetField(props, fieldKey, assets) {
  const directValue = props?.[fieldKey];
  const assetId = props?.[getAssetIdKey(fieldKey)];
  const asset = getAssetFromLibrary(assets, assetId);
  return asset?.src || directValue || "";
}

export async function fileToOptimizedDataUrl(file, options = {}) {
  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality || 0.82;

  if (String(file?.type || "").includes("svg")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${file.name}`));
    img.src = rawDataUrl;
  });

  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return rawDataUrl;
  context.drawImage(image, 0, 0, width, height);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mimeType, mimeType === "image/png" ? undefined : quality);
}

export async function createStoredAsset(file, overrides = {}) {
  const src = await fileToOptimizedDataUrl(file, overrides);
  return {
    id: makeAssetId(file?.name),
    name: file?.name || "Upload",
    type: file?.type || "image/jpeg",
    src,
  };
}
