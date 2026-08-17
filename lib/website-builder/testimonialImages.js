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

function buildTestimonialAvatarUrlMap(project = {}) {
  const urlsByItemId = new Map();
  const urlsByAssetId = new Map();
  testimonialBlocksFromProject(project).forEach((block) => {
    (Array.isArray(block?.props?.items) ? block.props.items : []).forEach((item) => {
      const url = testimonialAvatarUrl(item);
      if (!isRenderableAvatarUrl(url)) return;
      const itemId = safeTrim(item?.id);
      const assetId = safeTrim(item?.avatarAssetId);
      if (itemId && !urlsByItemId.has(itemId)) urlsByItemId.set(itemId, url);
      if (assetId && !urlsByAssetId.has(assetId)) urlsByAssetId.set(assetId, url);
    });
  });
  return { urlsByItemId, urlsByAssetId };
}

function repairTestimonialBlockAvatarUrls(block, urlMaps) {
  if (block?.type !== "testimonial" || !Array.isArray(block?.props?.items)) return block;
  let changed = false;
  const items = block.props.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    if (isRenderableAvatarUrl(testimonialAvatarUrl(item))) return item;
    const itemId = safeTrim(item.id);
    const assetId = safeTrim(item.avatarAssetId);
    const avatarUrl = (itemId && urlMaps.urlsByItemId.get(itemId)) || (assetId && urlMaps.urlsByAssetId.get(assetId)) || "";
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

export function repairProjectTestimonialAvatarUrls(project = {}) {
  if (!project || typeof project !== "object") return project;
  const urlMaps = buildTestimonialAvatarUrlMap(project);
  if (!urlMaps.urlsByItemId.size && !urlMaps.urlsByAssetId.size) return project;
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
