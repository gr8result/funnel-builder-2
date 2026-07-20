function safeTrim(value) {
  return String(value || "").trim();
}

export function resolveAccordionPanelImageUrl(panel = {}) {
  return safeTrim(
    panel?.imageUrl
    || panel?.image
    || panel?.imageSrc
    || panel?.mediaUrl
    || panel?.src
    || panel?.desktopImage
    || panel?.mobileImage
    || panel?.backgroundImage
  );
}

export function isUnsafeAccordionPanelImageUrl(value = "") {
  const raw = safeTrim(value);
  if (!raw) return false;
  if (/^(blob:|file:)/i.test(raw)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return true;
  if (/^data:/i.test(raw)) return true;
  if (/\/storage\/v1\/object\/sign\//i.test(raw)) return true;
  if (/supabase\.co\/storage\/v1\/object\/sign\//i.test(raw)) return true;
  return false;
}

export function normalizeAccordionPanel(panel = {}) {
  if (!panel || typeof panel !== "object" || Array.isArray(panel)) return panel;
  const imageUrl = resolveAccordionPanelImageUrl(panel);
  const safeImageUrl = isUnsafeAccordionPanelImageUrl(imageUrl) ? "" : imageUrl;
  return {
    ...panel,
    imageUrl: safeImageUrl,
    image: safeImageUrl,
    useBlockImageSettings: panel.useBlockImageSettings !== false,
    imageFit: safeTrim(panel.imageFit) || "",
    imageObjectPosition: safeTrim(panel.imageObjectPosition) || "",
    imageScale: panel.imageScale === "" || panel.imageScale == null ? "" : panel.imageScale,
  };
}

function normalizeAccordionImageSettings(props = {}) {
  return {
    imageFit: safeTrim(props.imageFit) || "contain",
    imageObjectPosition: safeTrim(props.imageObjectPosition) || "center center",
    imageScale: props.imageScale === "" || props.imageScale == null ? 100 : props.imageScale,
    imageMaxHeightMode: safeTrim(props.imageMaxHeightMode) || "auto",
    imageMaxHeightCustom: props.imageMaxHeightCustom === "" || props.imageMaxHeightCustom == null ? 500 : props.imageMaxHeightCustom,
    imagePadding: props.imagePadding === "" || props.imagePadding == null ? 0 : props.imagePadding,
    panelImageHeightMode: safeTrim(props.panelImageHeightMode) || "match",
    panelImageFixedHeight: props.panelImageFixedHeight === "" || props.panelImageFixedHeight == null ? 500 : props.panelImageFixedHeight,
  };
}

export function normalizeAccordionBlock(block = {}) {
  if (!block || typeof block !== "object" || Array.isArray(block)) return block;
  const type = String(block.type || "");
  if (!["scroll-stack", "feature-accordion", "side-scroll-accordion"].includes(type)) return block;
  const props = block.props && typeof block.props === "object" ? block.props : {};
  const { __blockId: _debugBlockId, __blockType: _debugBlockType, ...cleanProps } = props;
  return {
    ...block,
    props: {
      ...cleanProps,
      ...normalizeAccordionImageSettings(cleanProps),
      ...(Array.isArray(cleanProps.panels) ? { panels: cleanProps.panels.map(normalizeAccordionPanel) } : {}),
      ...(Array.isArray(cleanProps.items) ? { items: cleanProps.items.map(normalizeAccordionPanel) } : {}),
    },
  };
}

export function normalizeAccordionBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return blocks;
  const normalized = blocks.map(normalizeAccordionBlock);
  return normalized.filter((block, index) => !isDuplicateStandaloneAccordionImageBlock(block, normalized, index));
}

function isStandaloneImageBlock(block = {}) {
  const type = String(block?.type || "");
  if (!["image", "image-block"].includes(type)) return false;
  const props = block?.props && typeof block.props === "object" ? block.props : {};
  const src = resolveAccordionPanelImageUrl(props);
  if (!src || isUnsafeAccordionPanelImageUrl(src)) return false;
  if (props.caption || props.title || props.heading || props.body || props.link || props.href) return false;
  return true;
}

function accordionPanelImages(block = {}) {
  const type = String(block?.type || "");
  if (!["scroll-stack", "feature-accordion", "side-scroll-accordion"].includes(type)) return [];
  const props = block?.props && typeof block.props === "object" ? block.props : {};
  const panels = Array.isArray(props.panels) ? props.panels : Array.isArray(props.items) ? props.items : [];
  return panels
    .map(resolveAccordionPanelImageUrl)
    .filter((src) => src && !isUnsafeAccordionPanelImageUrl(src));
}

function isKnownWebsiteBuilderDuplicateImage(block = {}) {
  const id = String(block?.id || block?.props?.id || "").trim();
  return id === "wb-no-code-image";
}

function isDuplicateStandaloneAccordionImageBlock(block, blocks, index) {
  if (!isStandaloneImageBlock(block)) return false;
  if (!isKnownWebsiteBuilderDuplicateImage(block)) return false;
  const src = resolveAccordionPanelImageUrl(block.props || {});
  const laterAccordionImages = new Set(
    blocks
      .slice(index + 1)
      .flatMap(accordionPanelImages)
  );
  return laterAccordionImages.has(src);
}
