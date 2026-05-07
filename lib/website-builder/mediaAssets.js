function makeAssetId(fileName = "asset") {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `asset_${Date.now()}_${String(fileName).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

const SHARED_MEDIA_BUCKET = "assets";
function safeName(fileName = "asset") {
  return String(fileName || "asset")
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "") || "asset";
}

function inferMimeType(fileName = "") {
  const normalized = String(fileName || "").toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function isImageFileName(fileName = "") {
  return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(String(fileName || ""));
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

export function mergeWebsiteBuilderAssetSources(...sources) {
  const normalizedSources = sources.map((source) => normalizeWebsiteBuilderAssets(source));
  const logo = normalizedSources.find((source) => source?.logo?.src)?.logo || null;
  const seen = new Set();
  const images = [];

  normalizedSources.forEach((source) => {
    (source?.images || []).forEach((image) => {
      const src = String(image?.src || "").trim();
      if (!src || seen.has(src)) return;
      seen.add(src);
      images.push({
        id: image.id || makeAssetId(image.name || "image"),
        name: image.name || "Image",
        type: image.type || inferMimeType(image.name || ""),
        src,
      });
    });
  });

  return { logo, images };
}

export async function listSharedMediaLibraryAssets(supabase, userId) {
  if (!supabase || !userId) return [];

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || '';
    if (token) {
      const response = await fetch('/api/assets/list-library', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (response.ok && payload?.ok) {
        return (payload.images || []).map((image, index) => ({
          id: image.id || `shared-${index}`,
          name: image.name || image.description || 'Image',
          type: inferMimeType(image.name || ''),
          src: image.url || '',
        })).filter((asset) => asset.src);
      }
    }
  } catch (_error) {
    // fall back to direct bucket read below
  }

  const { data, error } = await supabase.storage
    .from(SHARED_MEDIA_BUCKET)
    .list(`${userId}/`, { limit: 500, offset: 0, sortBy: { column: "name", order: "asc" } });

  if (error) return [];

  return (data || [])
    .filter((entry) => isImageFileName(entry?.name))
    .map((entry) => {
      const path = `${userId}/${entry.name}`;
      const { data: urlData } = supabase.storage.from(SHARED_MEDIA_BUCKET).getPublicUrl(path);
      return {
        id: `shared-${userId}-${entry.name}`,
        name: entry.name,
        type: inferMimeType(entry.name),
        src: urlData?.publicUrl || "",
      };
    })
    .filter((asset) => asset.src);
}

export async function seedWebsiteBuilderSharedLibrary(supabase, userId) {
  return true;
}

export async function syncWebsiteBuilderSharedAssetCache({ supabase, userId, currentAssets }) {
  try {
    await seedWebsiteBuilderSharedLibrary(supabase, userId);
  } catch (_error) {
    // Keep the builder usable even if shared library seeding fails.
  }

  const sharedImages = await listSharedMediaLibraryAssets(supabase, userId);
  return mergeWebsiteBuilderAssetSources(currentAssets, { logo: null, images: sharedImages });
}

export async function uploadSharedMediaLibraryAsset(supabase, userId, file, options = {}) {
  if (!supabase || !userId || !file) throw new Error("Missing upload context");

  const tag = String(options.tag || "web").trim() || "web";
  const storagePath = `${userId}/${tag}-${Date.now()}-${safeName(file.name || "upload")}`;
  const { error } = await supabase.storage.from(SHARED_MEDIA_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(SHARED_MEDIA_BUCKET).getPublicUrl(storagePath);
  return {
    id: makeAssetId(file.name || tag),
    name: file.name || `${tag}-upload`,
    type: file.type || inferMimeType(file.name || ""),
    src: data?.publicUrl || "",
  };
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

  const nextProps = {
    ...(props || {}),
    [getAssetIdKey(fieldKey)]: asset.id,
  };

  if (fieldKey === "backgroundImage" && asset?.src) {
    nextProps.backgroundStyle = "image";
  }

  return nextProps;
}

export function normalizeSelectedAsset(asset) {
  if (!asset || typeof asset !== "object") return null;

  const src = String(asset.src || asset.url || "").trim();
  if (!src) return null;

  return {
    ...asset,
    id: asset.id || asset.storage_path || asset.url || asset.name || "",
    src,
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
