export const PROJECT_ESTIMATE_MVP_PAGE_WIDTH = 794;
export const PROJECT_ESTIMATE_MVP_PAGE_HEIGHT = 1123;

export function clampPageNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function createMvpPage(index = 0, overrides = {}) {
  const order = Number.isFinite(Number(overrides.order)) ? Number(overrides.order) : index;
  return {
    id: overrides.id || `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title || `Page ${order + 1}`,
    page_type: overrides.page_type || "builderCreated",
    source: overrides.source || "builder-created",
    order,
    design: {
      backgroundColor: "#ffffff",
      ...(overrides.design || {}),
    },
    blocks: Array.isArray(overrides.blocks) ? overrides.blocks.map((block, blockIndex) => normaliseMvpBlock(block, blockIndex)) : [],
  };
}

export function moveMvpPage(pages = [], activePageId = "", direction = 0) {
  const next = Array.isArray(pages) ? [...pages] : [];
  const index = next.findIndex((page) => page.id === activePageId);
  const targetIndex = index + Number(direction || 0);
  if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return next;
  const [page] = next.splice(index, 1);
  next.splice(targetIndex, 0, page);
  return next.map((item, order) => ({ ...item, order }));
}

export function createMvpBlock(type = "text", order = 0, overrides = {}) {
  const blockType = type === "image" ? "image" : "text";
  const frame = constrainMvpFrame({
    x: overrides.x ?? overrides.design?.frame?.x ?? 74,
    y: overrides.y ?? overrides.design?.frame?.y ?? 96,
    width: overrides.width ?? overrides.design?.frame?.width ?? (blockType === "image" ? 300 : 320),
    height: overrides.height ?? overrides.design?.frame?.height ?? (blockType === "image" ? 220 : 120),
  });
  const zIndex = Number.isFinite(Number(overrides.zIndex ?? overrides.design?.zIndex)) ? Number(overrides.zIndex ?? overrides.design?.zIndex) : order;
  const locked = Boolean(overrides.locked ?? overrides.design?.locked);
  const content = blockType === "image"
    ? { imageUrl: overrides.src || overrides.content?.imageUrl || "", alt: overrides.content?.alt || "" }
    : { text: overrides.text ?? overrides.content?.text ?? "New text block" };
  const design = {
    color: blockType === "text" ? (overrides.color || overrides.design?.color || "#0f172a") : (overrides.design?.color || "#0f172a"),
    fontSize: Number(overrides.fontSize || overrides.design?.fontSize || 18),
    fontWeight: overrides.fontWeight || overrides.design?.fontWeight || 400,
    textAlign: overrides.align || overrides.design?.textAlign || "left",
    lineHeight: overrides.design?.lineHeight || 1.35,
    objectFit: blockType === "image" ? (overrides.design?.objectFit || "cover") : overrides.design?.objectFit,
    ...(overrides.design || {}),
    frame,
    zIndex,
    locked,
    frameEdited: true,
  };
  return normaliseMvpBlock({
    ...overrides,
    id: overrides.id || `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: blockType,
    order,
    content: { ...content, ...(overrides.content || {}) },
    design,
  }, order);
}

export function normaliseMvpBlock(block = {}, fallbackOrder = 0) {
  const type = block.type === "image" ? "image" : block.type || "text";
  const isImage = type === "image";
  const isText = type === "text";
  const content = { ...(block.content || {}) };
  const design = { ...(block.design || {}) };
  const frame = constrainMvpFrame({
    x: block.x ?? design.frame?.x,
    y: block.y ?? design.frame?.y,
    width: block.width ?? design.frame?.width,
    height: block.height ?? design.frame?.height,
  });
  const order = Number.isFinite(Number(block.order)) ? Number(block.order) : fallbackOrder;
  const zIndex = Number.isFinite(Number(block.zIndex ?? design.zIndex)) ? Number(block.zIndex ?? design.zIndex) : order;
  const locked = Boolean(block.locked ?? design.locked);
  const text = block.text ?? content.text ?? "";
  const src = block.src ?? content.imageUrl ?? content.logoUrl ?? content.defaultImageUrl ?? "";
  return {
    ...block,
    id: block.id || `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    order,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    zIndex,
    locked,
    ...(isImage ? { src } : {}),
    ...(isText ? {
      text,
      fontSize: Number(block.fontSize || design.fontSize || 18),
      fontWeight: block.fontWeight || design.fontWeight || 400,
      color: block.color || design.color || "#0f172a",
      align: block.align || design.textAlign || "left",
    } : {}),
    content: isImage ? { ...content, imageUrl: src } : isText ? { ...content, text } : content,
    design: {
      ...design,
      frame,
      zIndex,
      locked,
      ...(isText ? {
        fontSize: Number(block.fontSize || design.fontSize || 18),
        fontWeight: block.fontWeight || design.fontWeight || 400,
        color: block.color || design.color || "#0f172a",
        textAlign: block.align || design.textAlign || "left",
      } : {}),
    },
  };
}

export function updateMvpBlockFrame(block = {}, frame = {}) {
  return normaliseMvpBlock({
    ...block,
    ...constrainMvpFrame(frame),
    design: {
      ...(block.design || {}),
      frame: constrainMvpFrame(frame),
      frameEdited: true,
    },
  }, block.order || 0);
}

export function serialiseMvpDocument(builder = {}) {
  return {
    ...builder,
    pages: (Array.isArray(builder.pages) ? builder.pages : []).map((page, pageIndex) => ({
      ...page,
      order: pageIndex,
      blocks: (Array.isArray(page.blocks) ? page.blocks : []).map((block, blockIndex) => normaliseMvpBlock(block, blockIndex)),
    })),
  };
}

function constrainMvpFrame(frame = {}) {
  const width = clampPageNumber(frame.width, 24, PROJECT_ESTIMATE_MVP_PAGE_WIDTH);
  const height = clampPageNumber(frame.height, 18, PROJECT_ESTIMATE_MVP_PAGE_HEIGHT);
  const x = clampPageNumber(frame.x, 0, PROJECT_ESTIMATE_MVP_PAGE_WIDTH - width);
  const y = clampPageNumber(frame.y, 0, PROJECT_ESTIMATE_MVP_PAGE_HEIGHT - height);
  return { x, y, width, height };
}
