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
  };
}

export function normalizeAccordionBlock(block = {}) {
  if (!block || typeof block !== "object" || Array.isArray(block)) return block;
  const type = String(block.type || "");
  if (!["scroll-stack", "feature-accordion", "side-scroll-accordion"].includes(type)) return block;
  const props = block.props && typeof block.props === "object" ? block.props : {};
  return {
    ...block,
    props: {
      ...props,
      ...(Array.isArray(props.panels) ? { panels: props.panels.map(normalizeAccordionPanel) } : {}),
      ...(Array.isArray(props.items) ? { items: props.items.map(normalizeAccordionPanel) } : {}),
    },
  };
}

export function normalizeAccordionBlocks(blocks = []) {
  return Array.isArray(blocks) ? blocks.map(normalizeAccordionBlock) : blocks;
}
