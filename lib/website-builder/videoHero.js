function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveVideoHeroUrl(props = {}) {
  return safeTrim(
    props.videoUrl
    || props.videoSrc
    || props.videoURL
    || props.video
    || props.mediaUrl
    || props.src
    || props.source
    || props.desktopVideo
    || props.backgroundVideo
    || props.uploadedVideo
  );
}

export function isUnsafeVideoHeroUrl(value = "") {
  const raw = safeTrim(value);
  if (!raw) return false;
  if (/^(blob:|file:)/i.test(raw)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return true;
  if (/^data:/i.test(raw)) return true;
  if (/\/storage\/v1\/object\/sign\//i.test(raw)) return true;
  if (/supabase\.co\/storage\/v1\/object\/sign\//i.test(raw)) return true;
  return false;
}

export function normalizeVideoHeroBlock(block = {}) {
  if (!block || typeof block !== "object" || Array.isArray(block)) return block;
  if (String(block.type || "") !== "video-hero") return block;
  const props = block.props && typeof block.props === "object" ? block.props : {};
  const resolvedUrl = resolveVideoHeroUrl(props);
  const videoUrl = isUnsafeVideoHeroUrl(resolvedUrl) ? "" : resolvedUrl;
  const posterUrl = safeTrim(props.posterUrl || props.posterSrc || props.posterURL);
  return {
    ...block,
    props: {
      ...props,
      videoUrl,
      videoSrc: videoUrl,
      ...(posterUrl ? { posterUrl, posterSrc: posterUrl } : {}),
      ...(videoUrl && !props.uploadedAt ? { uploadedAt: props.uploadedAt || props.videoUploadedAt || "" } : {}),
    },
  };
}

export function normalizeVideoHeroBlocksForPersistence(blocks = []) {
  return Array.isArray(blocks) ? blocks.map(normalizeVideoHeroBlock) : blocks;
}
