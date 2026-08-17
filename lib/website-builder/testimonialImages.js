function safeTrim(value) {
  return String(value || "").trim();
}

function isRenderableAvatarUrl(value) {
  const raw = safeTrim(value);
  return /^(https?:|\/|data:image\/)/i.test(raw);
}

function testimonialBlocksFromProject(project = {}) {
  const blocks = [];
  Object.values(project?.pageBlocks || {}).forEach((pageBlocks) => {
    (Array.isArray(pageBlocks) ? pageBlocks : []).forEach((block) => {
      if (block?.type === "testimonial") blocks.push(block);
    });
  });
  Object.values(project?.chaiData || {}).forEach((pageData) => {
    (Array.isArray(pageData?.blocks) ? pageData.blocks : []).forEach((block) => {
      if (block?.type === "testimonial") blocks.push(block);
    });
  });
  return blocks;
}

function testimonialAvatarUrl(item = {}) {
  return safeTrim(item.avatarUrl || item.avatar || item.imageUrl || item.image || item.src || item.url);
}

function hasExplicitTestimonialImageRemoval(item = {}) {
  return item?.removeAvatar === true
    || item?.avatarRemoved === true
    || item?.removeImage === true
    || item?.imageRemoved === true
    || item?.deleteAvatar === true
    || item?.avatarDeleted === true
    || item?.imageDeleted === true;
}

function addTestimonialBlockUrlsToMap(urlMaps, block) {
  if (block?.type !== "testimonial" || !Array.isArray(block?.props?.items)) return;
  const blockId = safeTrim(block.id);
  block.props.items.forEach((item) => {
    const url = testimonialAvatarUrl(item);
    if (!isRenderableAvatarUrl(url)) return;
    const itemId = safeTrim(item?.id);
    const assetId = safeTrim(item?.avatarAssetId || item?.imageAssetId || item?.assetId);
    if (blockId && itemId && !urlMaps.urlsByBlockItemId.has(`${blockId}:${itemId}`)) {
      urlMaps.urlsByBlockItemId.set(`${blockId}:${itemId}`, url);
    }
    if (itemId && !urlMaps.urlsByItemId.has(itemId)) urlMaps.urlsByItemId.set(itemId, url);
    if (assetId && !urlMaps.urlsByAssetId.has(assetId)) urlMaps.urlsByAssetId.set(assetId, url);
  });
}

function createEmptyUrlMaps() {
  return {
    urlsByBlockItemId: new Map(),
    urlsByItemId: new Map(),
    urlsByAssetId: new Map(),
  };
}

function buildTestimonialAvatarUrlMap(project = {}) {
  const urlMaps = createEmptyUrlMaps();
  testimonialBlocksFromProject(project).forEach((block) => addTestimonialBlockUrlsToMap(urlMaps, block));
  return urlMaps;
}

function buildTestimonialAvatarUrlMapFromBlocks(blocks = []) {
  const urlMaps = createEmptyUrlMaps();
  (Array.isArray(blocks) ? blocks : []).forEach((block) => addTestimonialBlockUrlsToMap(urlMaps, block));
  return urlMaps;
}

function hasMappedUrls(urlMaps) {
  return !!(urlMaps?.urlsByBlockItemId?.size || urlMaps?.urlsByItemId?.size || urlMaps?.urlsByAssetId?.size);
}

function findMappedAvatarUrl(block, item, urlMaps) {
  const blockId = safeTrim(block?.id);
  const itemId = safeTrim(item?.id);
  const assetId = safeTrim(item?.avatarAssetId || item?.imageAssetId || item?.assetId);
  return (blockId && itemId && urlMaps.urlsByBlockItemId.get(`${blockId}:${itemId}`))
    || (itemId && urlMaps.urlsByItemId.get(itemId))
    || (assetId && urlMaps.urlsByAssetId.get(assetId))
    || "";
}

function mergeUrlMaps(primary, secondary) {
  const merged = createEmptyUrlMaps();
  [primary, secondary].forEach((maps) => {
    if (!maps) return;
    maps.urlsByBlockItemId?.forEach((value, key) => {
      if (!merged.urlsByBlockItemId.has(key)) merged.urlsByBlockItemId.set(key, value);
    });
    maps.urlsByItemId?.forEach((value, key) => {
      if (!merged.urlsByItemId.has(key)) merged.urlsByItemId.set(key, value);
    });
    maps.urlsByAssetId?.forEach((value, key) => {
      if (!merged.urlsByAssetId.has(key)) merged.urlsByAssetId.set(key, value);
    });
  });
  return merged;
}

function repairTestimonialBlockAvatarUrls(block, urlMaps) {
  if (block?.type !== "testimonial" || !Array.isArray(block?.props?.items)) return block;
  let changed = false;
  const items = block.props.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    if (isRenderableAvatarUrl(testimonialAvatarUrl(item)) || hasExplicitTestimonialImageRemoval(item)) return item;
    const avatarUrl = findMappedAvatarUrl(block, item, urlMaps);
    if (!avatarUrl) return item;
    changed = true;
    return { ...item, avatarUrl };
  });
  return changed ? { ...block, props: { ...block.props, items } } : block;
}

function repairBlockList(blocks, urlMaps) {
  return Array.isArray(blocks)
    ? blocks.map((block) => repairTestimonialBlockAvatarUrls(block, urlMaps))
    : blocks;
}

function repairChaiPage(pageData, urlMaps) {
  if (!pageData || typeof pageData !== "object" || !Array.isArray(pageData.blocks)) return pageData;
  return { ...pageData, blocks: repairBlockList(pageData.blocks, urlMaps) };
}

export function preserveExistingTestimonialAvatarUrls(incomingBlocks = [], existingBlocks = []) {
  if (!Array.isArray(incomingBlocks)) return incomingBlocks;
  const urlMaps = buildTestimonialAvatarUrlMapFromBlocks(existingBlocks);
  return hasMappedUrls(urlMaps) ? repairBlockList(incomingBlocks, urlMaps) : incomingBlocks;
}

export function preserveExistingTestimonialChaiAvatarUrls(incomingChaiData = null, existingBlocks = [], existingChaiData = null) {
  if (!incomingChaiData || typeof incomingChaiData !== "object" || !Array.isArray(incomingChaiData.blocks)) return incomingChaiData;
  const blockMaps = buildTestimonialAvatarUrlMapFromBlocks(existingBlocks);
  const chaiMaps = buildTestimonialAvatarUrlMapFromBlocks(existingChaiData?.blocks);
  const urlMaps = mergeUrlMaps(blockMaps, chaiMaps);
  return hasMappedUrls(urlMaps) ? repairChaiPage(incomingChaiData, urlMaps) : incomingChaiData;
}

export function repairProjectTestimonialAvatarUrls(project = {}) {
  if (!project || typeof project !== "object") return project;
  const urlMaps = buildTestimonialAvatarUrlMap(project);
  if (!hasMappedUrls(urlMaps)) return project;
  return {
    ...project,
    pageBlocks: Object.fromEntries(
      Object.entries(project.pageBlocks || {}).map(([pageName, blocks]) => [pageName, repairBlockList(blocks, urlMaps)])
    ),
    chaiData: Object.fromEntries(
      Object.entries(project.chaiData || {}).map(([pageName, pageData]) => [pageName, repairChaiPage(pageData, urlMaps)])
    ),
  };
}
