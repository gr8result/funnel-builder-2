function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const VIDEO_HERO_CANONICAL_MEDIA_FIELDS = [
  "videoUrl",
  "videoStoragePath",
  "videoFileName",
  "videoMimeType",
  "posterUrl",
  "autoplay",
  "muted",
  "loop",
  "controls",
  "showControls",
  "startWithAudioWhenAllowed",
  "startWithAudio",
  "playAudioOnInteraction",
  "unmuteOnScroll",
];

export function resolveVideoHeroUrl(props = {}) {
  const candidates = [
    props.videoUrl,
    props.video,
    props.videoSrc,
    props.mediaUrl,
    props.src,
    props.videoURL,
    props.source,
    props.desktopVideo,
    props.backgroundVideo,
    props.uploadedVideo,
  ].map(safeTrim).filter(Boolean);
  return candidates.find((candidate) => !isUnsafeVideoHeroUrl(candidate)) || candidates[0] || "";
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
  const {
    video,
    videoSrc,
    videoURL,
    mediaUrl,
    src,
    source,
    desktopVideo,
    backgroundVideo,
    uploadedVideo,
    posterSrc,
    posterURL,
    ...restProps
  } = props;
  return {
    ...block,
    props: {
      ...restProps,
      videoUrl,
      ...(posterUrl ? { posterUrl } : {}),
      ...(videoUrl && !restProps.videoUpdatedAt ? { videoUpdatedAt: restProps.uploadedAt || restProps.videoUploadedAt || "" } : {}),
    },
  };
}

export function normalizeVideoHeroBlocksForPersistence(blocks = []) {
  return Array.isArray(blocks) ? blocks.map(normalizeVideoHeroBlock) : blocks;
}

export function mergeVideoHeroProps(existingProps = {}, patch = {}, options = {}) {
  const existing = existingProps && typeof existingProps === "object" ? existingProps : {};
  const nextPatch = patch && typeof patch === "object" ? patch : {};
  const legacyResolvedUrl = resolveVideoHeroUrl(existing);
  const explicitVideoUrl = Object.prototype.hasOwnProperty.call(nextPatch, "videoUrl");
  const removeVideo = options.removeVideo === true || (explicitVideoUrl && safeTrim(nextPatch.videoUrl) === "");
  const {
    video,
    videoSrc,
    videoURL,
    mediaUrl,
    src,
    source,
    desktopVideo,
    backgroundVideo,
    uploadedVideo,
    ...restExisting
  } = existing;
  const next = { ...restExisting, ...nextPatch };

  delete next.video;
  delete next.videoSrc;
  delete next.videoURL;
  delete next.mediaUrl;
  delete next.src;
  delete next.source;
  delete next.desktopVideo;
  delete next.backgroundVideo;
  delete next.uploadedVideo;
  delete next.__video_hero_src__;

  if (removeVideo) {
    next.videoUrl = "";
    return next;
  }

  const patchedUrl = explicitVideoUrl ? safeTrim(nextPatch.videoUrl) : "";
  const resolvedUrl = patchedUrl || safeTrim(existing.videoUrl) || legacyResolvedUrl;
  if (resolvedUrl && !isUnsafeVideoHeroUrl(resolvedUrl)) {
    next.videoUrl = resolvedUrl;
  }

  return next;
}
