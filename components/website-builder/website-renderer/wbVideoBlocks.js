import { resolveVideoHeroUrl } from "../../../lib/website-builder/videoHero";
import React from "react";
import { shouldLogHeroVideoDebug } from "./wbBlockHelpers.js";


export function getVideoDebugState(video) {
  if (!video) return {};
  return {
    currentTime: Number.isFinite(video.currentTime) ? Number(video.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : null,
    paused: video.paused,
    ended: video.ended,
    muted: video.muted,
    loop: video.loop,
    autoplay: video.autoplay,
    playsInline: video.playsInline,
    preload: video.preload,
    readyState: video.readyState,
    networkState: video.networkState,
    currentSrc: video.currentSrc || "",
    error: video.error ? { code: video.error.code, message: video.error.message } : null,
  };
}


export function logHeroVideoDebug(label, eventName, video, extra = {}) {
  if (!shouldLogHeroVideoDebug()) return;
  console.info(`[HeroVideoDebug] ${label}: ${eventName}`, {
    ...getVideoDebugState(video),
    ...extra,
  });
}


// --- VideoHeroBlock -----------------------------------------------------------
// Full-bleed video hero with lazy loading via IntersectionObserver.
// The video is hosted on Supabase storage (uploaded via onUploadImage).
// Video src is only set once the element scrolls into view — zero network
// cost until the visitor actually reaches this section.
// Autoplay / muted / loop / playsInline — required for all browsers/mobile.

export function VideoHeroBlock({ block, editor = false, compact = false, isSelected = false, onChangeBlock, onUploadImage }) {
  const props = block?.props || {};

  const videoSrc     = String(resolveVideoHeroUrl(props) || "");
  const posterSrc    = String(props.posterSrc    || props.posterUrl || props.posterURL || "");
  const overlayOpacity = Number(props.overlayOpacity ?? 0.42);
  const overlayColor = String(props.overlayColor || "#000000");
  const heightMode   = compact ? "fixed" : (props.heightMode || "full");
  const fixedHeight  = Number(props.minHeight) || 620;
  const objectFit      = String(props.objectFit      || "cover");
  const objectPosition = String(props.objectPosition || "top center");
  const showText     = props.showText !== false;
  const textColor    = String(props.textColor    || "#ffffff");
  const eyebrow      = String(props.eyebrow      || "");
  const title        = String(props.title        || "");
  const subtitle     = String(props.subtitle     || "");
  const ctaText      = String(props.ctaText      || "");
  const ctaUrl       = String(props.ctaUrl       || "#");
  const accentColor  = String(props.accentColor  || "#6366f1");
  const autoplay     = props.autoplay !== false;
  const loop         = props.loop !== false;
  const showControls = props.showControls === true || props.controls === true;
  const startWithAudio = props.startWithAudio === true || props.playAudioOnInteraction === true || props.unmuteOnScroll === true;
  const initialMuted = props.muted !== false;
  const preloadMode  = autoplay ? "auto" : "metadata";

  const paddingTop    = Number(props.paddingTop    ?? 0);
  const paddingBottom = Number(props.paddingBottom ?? 0);
  const marginTop     = Number(props.marginTop     ?? 0);

  const videoRef     = React.useRef(null);
  const sectionRef   = React.useRef(null);
  const loadedRef = React.useRef(false);
  const loadedSrcRef = React.useRef("");
  const [muted, setMuted] = React.useState(initialMuted);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const [videoReady, setVideoReady] = React.useState(false);
  const debugLabel = `video-hero ${block?.id || "unknown"}`;

  React.useEffect(() => {
    setMuted(initialMuted);
    if (videoRef.current) videoRef.current.muted = initialMuted;
  }, [initialMuted, videoSrc]);

  React.useEffect(() => {
    const video = videoRef.current;
    logHeroVideoDebug(debugLabel, "Hero component mounted", video, { videoSrc, editor });
    return () => logHeroVideoDebug(debugLabel, "Hero component unmounted", video, { videoSrc, editor });
  }, [debugLabel, editor, videoSrc]);

  React.useEffect(() => {
    logHeroVideoDebug(debugLabel, "Video source changed", videoRef.current, { videoSrc });
    setVideoFailed(false);
    setVideoReady(false);
  }, [debugLabel, videoSrc]);

  const debugVideoFields = React.useMemo(() => ({
    video: props.video || "",
    videoUrl: props.videoUrl || "",
    videoSrc: props.videoSrc || "",
    src: props.src || "",
    backgroundVideo: props.backgroundVideo || "",
    backgroundVideoUrl: props.backgroundVideoUrl || "",
  }), [
    props.video,
    props.videoUrl,
    props.videoSrc,
    props.src,
    props.backgroundVideo,
    props.backgroundVideoUrl,
  ]);

  React.useEffect(() => {
    if (!editor) return;
    console.info("[website-builder video-hero] Rendering widget", {
      blockId: block?.id || "",
      videoUrl: videoSrc,
      fields: debugVideoFields,
      widget: block,
    });
  }, [block, debugVideoFields, editor, videoSrc]);

  // React owns the media source; the observer only nudges playback and never
  // reloads an already-active source.
  React.useEffect(() => {
    if (editor || !videoSrc || typeof window === "undefined") return undefined;
    const el = sectionRef.current;
    if (!el) return undefined;

    // Already loaded on this mount
    if (loadedRef.current && loadedSrcRef.current === videoSrc && videoRef.current?.src) return undefined;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && videoRef.current && (!loadedRef.current || loadedSrcRef.current !== videoSrc)) {
          loadedRef.current = true;
          loadedSrcRef.current = videoSrc;
          const currentSrc = videoRef.current.currentSrc || "";
          const attrSrc = videoRef.current.getAttribute("src") || "";
          const sourceAlreadyActive = currentSrc === videoSrc || attrSrc === videoSrc;
          if (!sourceAlreadyActive) {
            videoRef.current.src = videoSrc;
            logHeroVideoDebug(debugLabel, "IntersectionObserver set source", videoRef.current, { videoSrc });
            if (videoRef.current.readyState === 0) {
              videoRef.current.load();
              logHeroVideoDebug(debugLabel, "Video load() called", videoRef.current, { videoSrc });
            }
          } else {
            logHeroVideoDebug(debugLabel, "Video source already active", videoRef.current, { videoSrc });
          }
          if (autoplay) {
            const playResult = videoRef.current.play?.();
            if (playResult && typeof playResult.catch === "function") {
              playResult.catch((error) => logHeroVideoDebug(debugLabel, "Video play() failed", videoRef.current, { videoSrc, error: error?.message || String(error || "") }));
            } else {
              logHeroVideoDebug(debugLabel, "Video play() requested", videoRef.current, { videoSrc });
            }
          } else {
            logHeroVideoDebug(debugLabel, "Video autoplay skipped", videoRef.current, { videoSrc });
          }
          obs.disconnect();
        }
      },
      { threshold: 0.10 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoplay, debugLabel, editor, videoSrc]);

  React.useEffect(() => {
    if (editor || !startWithAudio || typeof window === "undefined") return undefined;

    const enableAudioAfterInteraction = () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      setMuted(false);
      if (autoplay) {
        const playResult = video.play?.();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch((error) => logHeroVideoDebug(debugLabel, "Audio play after interaction failed", video, { videoSrc, error: error?.message || String(error || "") }));
        }
      }
    };

    window.addEventListener("pointerdown", enableAudioAfterInteraction, { once: true, passive: true });
    window.addEventListener("keydown", enableAudioAfterInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enableAudioAfterInteraction);
      window.removeEventListener("keydown", enableAudioAfterInteraction);
    };
  }, [autoplay, debugLabel, editor, startWithAudio, videoSrc]);

  // -- Upload helpers --------------------------------------------------------
  async function handleVideoUpload(file) {
    if (!file || typeof onUploadImage !== "function") return;
    const previousVideoSrc = videoSrc;
    try {
      const asset = await Promise.resolve(onUploadImage("__video_hero_src__", file));
      if (asset?.src) {
        onChangeBlock?.({
          ...props,
          videoUrl: asset.src,
          videoStoragePath: asset.storagePath || props.videoStoragePath || "",
          videoMimeType: asset.type || file.type || props.videoMimeType || "",
          videoFileName: asset.name || file.name || props.videoFileName || "",
          videoUpdatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      onChangeBlock?.({ ...props, videoUrl: previousVideoSrc || "" });
      if (typeof window !== "undefined") {
        window.alert(error?.message || "Video upload failed. Please try again.");
      }
    }
  }

  async function handlePosterUpload(file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__video_hero_poster__", file));
    if (asset?.src) onChangeBlock?.({ ...props, posterUrl: asset.src });
  }

  // -- Shared overlay style --------------------------------------------------
  const overlayStyle = {
    position: "absolute", inset: 0, zIndex: 1,
    background: overlayColor,
    opacity: overlayOpacity,
    pointerEvents: "none",
  };

  // 100svh fills exactly the visible viewport on mobile (no browser-chrome bleed).
  // Falls back to 100vh for older browsers that don't support svh.
  const sectionStyle = {
    position: "relative",
    height: heightMode === "full" ? "100svh" : undefined,
    minHeight: heightMode === "full" ? "100vh" : fixedHeight,
    maxHeight: heightMode === "full" ? "100svh" : undefined,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
    // Padding is applied inside the section so the #000 background covers the full
    // padded area — no transparent strip around the edge.
    paddingTop: paddingTop || undefined,
    paddingBottom: paddingBottom || undefined,
  };

  const applyVideoHeroPatch = (patch, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onChangeBlock?.({ ...props, ...patch });
  };

  const editorOptionButtonStyle = (active) => ({
    padding: "6px 10px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    background: active ? "rgba(99,102,241,0.32)" : "rgba(255,255,255,0.08)",
    border: `1px solid ${active ? "rgba(165,180,252,0.76)" : "rgba(255,255,255,0.18)"}`,
    color: active ? "#c7d2fe" : "rgba(255,255,255,0.78)",
    whiteSpace: "nowrap",
  });

  const editorToggleStyle = (active) => ({
    ...editorOptionButtonStyle(active),
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    userSelect: "none",
  });

  // -- EDITOR mode — controls are in the PropertiesPanel right sidebar ---------
  if (false && editor) {
    return (
      <div style={{ background: "#0d1117", display: "flex", flexDirection: "column", gap: 20, padding: "24px 24px 28px", alignItems: "stretch" }}>
        {/* Video preview if uploaded */}
        {videoSrc ? (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", maxHeight: 220 }}>
            <video
              src={videoSrc}
              poster={posterSrc || undefined}
              muted={muted}
              autoPlay={autoplay}
              loop={loop}
              controls={showControls}
              playsInline
              preload={preloadMode}
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", objectPosition, display: "block" }}
            />
            <div style={overlayStyle} />
            {showText && (title || subtitle) ? (
              <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
                {eyebrow ? <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: accentColor, textTransform: "uppercase" }}>{eyebrow}</div> : null}
                {title   ? <div style={{ fontSize: 22, fontWeight: 900, color: textColor, textAlign: "center", lineHeight: 1.1 }}>{title}</div> : null}
                {subtitle ? <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>{subtitle}</div> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 40 }}>🎬</span>
            <span>No video uploaded yet</span>
            <span style={{ fontSize: 12, fontWeight: 400 }}>MP4 / WebM recommended — keep under 10 MB for fast loads</span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Upload video */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.05em" }}>VIDEO FILE</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 8, color: "#a5b4fc", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
              📹 {videoSrc ? "Replace Video" : "Upload Video"}
              <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleVideoUpload(f); }} />
            </label>
            {videoSrc ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, videoUrl: "" }); }} style={{ marginTop: 5, background: "none", border: "none", color: "rgba(239,68,68,0.7)", fontSize: 12, cursor: "pointer", padding: 0 }}>? Remove video</button>
            ) : null}
          </div>

          {/* Upload poster frame */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.05em" }}>POSTER / THUMBNAIL</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
              🖼️ {posterSrc ? "Replace Poster" : "Upload Poster"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handlePosterUpload(f); }} />
            </label>
            {posterSrc ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, posterUrl: "" }); }} style={{ marginTop: 5, background: "none", border: "none", color: "rgba(239,68,68,0.7)", fontSize: 12, cursor: "pointer", padding: 0 }}>? Remove poster</button>
            ) : null}
          </div>
        </div>

        {/* Text overlay settings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>EYEBROW TEXT</div>
            <input value={eyebrow} onChange={(e) => onChangeBlock?.({ ...props, eyebrow: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Optional eyebrow label" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>HEADLINE</div>
            <input value={title} onChange={(e) => onChangeBlock?.({ ...props, title: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Hero headline" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>SUBHEADLINE</div>
            <input value={subtitle} onChange={(e) => onChangeBlock?.({ ...props, subtitle: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Supporting sentence" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>CTA BUTTON TEXT</div>
            <input value={ctaText} onChange={(e) => onChangeBlock?.({ ...props, ctaText: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Leave blank to hide" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>CTA URL</div>
            <input value={ctaUrl} onChange={(e) => onChangeBlock?.({ ...props, ctaUrl: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="#" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
        </div>

        {/* Overlay + sizing */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.10)", borderRadius: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
            Overlay
            <input type="color" value={overlayColor} onChange={(e) => onChangeBlock?.({ ...props, overlayColor: e.target.value })} style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>
            Opacity
            <input type="range" min={0} max={0.9} step={0.01} value={overlayOpacity} onChange={(e) => onChangeBlock?.({ ...props, overlayOpacity: parseFloat(e.target.value) })} onClick={(e) => e.stopPropagation()} style={{ width: 90 }} />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{Math.round(overlayOpacity * 100)}%</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>
            Accent
            <input type="color" value={accentColor} onChange={(e) => onChangeBlock?.({ ...props, accentColor: e.target.value })} style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
          </label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Height</span>
            {["full", "fixed"].map((m) => (
              <button key={m} type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, heightMode: m }); }}
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: heightMode === m ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${heightMode === m ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`, color: heightMode === m ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                {m === "full" ? "Full screen" : "Fixed px"}
              </button>
            ))}
            {heightMode === "fixed" ? (
              <input type="number" min={200} max={1200} step={10} value={fixedHeight} onChange={(e) => onChangeBlock?.({ ...props, minHeight: Number(e.target.value) || 620 })} onClick={(e) => e.stopPropagation()} style={{ width: 68, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "#fff", fontSize: 13, padding: "3px 7px" }} />
            ) : null}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={showText} onChange={(e) => onChangeBlock?.({ ...props, showText: e.target.checked })} onClick={(e) => e.stopPropagation()} />
            Show text overlay
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: unmuteOnScroll ? "#86efac" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={unmuteOnScroll} onChange={(e) => onChangeBlock?.({ ...props, unmuteOnScroll: e.target.checked })} onClick={(e) => e.stopPropagation()} />
            🔊 Unmute when scrolled into view
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Padding Top</span>
            <input type="number" min={0} max={400} step={8} value={paddingTop} onChange={(e) => onChangeBlock?.({ ...props, paddingTop: Number(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()} style={{ width: 64, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "#fff", fontSize: 13, padding: "3px 7px" }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Bottom</span>
            <input type="number" min={0} max={400} step={8} value={paddingBottom} onChange={(e) => onChangeBlock?.({ ...props, paddingBottom: Number(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()} style={{ width: 64, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "#fff", fontSize: 13, padding: "3px 7px" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["cover", "contain"].map((fit) => (
              <button key={fit} type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, objectFit: fit }); }}
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: objectFit === fit ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${objectFit === fit ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`, color: objectFit === fit ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                {fit}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Position</span>
            {[["top center", "Top"], ["center center", "Mid"], ["bottom center", "Bot"]].map(([val, label]) => (
              <button key={val} type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, objectPosition: val }); }}
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: objectPosition === val ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${objectPosition === val ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`, color: objectPosition === val ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    const compactControls = true;
    const compactVideoStyle = {
      display: "block",
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      position: "relative",
      inset: "auto",
      transform: "none",
      objectFit,
      objectPosition,
      zIndex: 0,
      background: "#000",
    };

    return (
      <div style={marginTop ? { marginTop, width: "100%", maxWidth: "100%", minWidth: 0 } : { width: "100%", maxWidth: "100%", minWidth: 0 }}>
        <section
          ref={sectionRef}
          data-mobile-video-hero="true"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            height: "auto",
            minHeight: 0,
            overflow: "visible",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            background: "#000",
            paddingTop: paddingTop || undefined,
            paddingBottom: paddingBottom || undefined,
            boxSizing: "border-box",
          }}
        >
          <div
            className="mobile-video-wrapper"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              aspectRatio: "16 / 9",
              overflow: "hidden",
              background: "#000",
            }}
          >
            {videoFailed && posterSrc ? (
              <img
                src={posterSrc}
                alt={title || "Video poster"}
                style={{ ...compactVideoStyle, objectFit }}
              />
            ) : (
              <video
                ref={videoRef}
                src={videoSrc || undefined}
                poster={posterSrc || undefined}
                muted={muted}
                autoPlay={autoplay}
                loop={loop}
                controls={compactControls || showControls}
                playsInline
                preload={preloadMode}
                onPlay={(event) => logHeroVideoDebug(debugLabel, "Video started", event.currentTarget)}
                onPause={(event) => logHeroVideoDebug(debugLabel, "Video paused", event.currentTarget)}
                onEnded={(event) => logHeroVideoDebug(debugLabel, "Video ended", event.currentTarget)}
                onStalled={(event) => logHeroVideoDebug(debugLabel, "Video stalled", event.currentTarget)}
                onWaiting={(event) => logHeroVideoDebug(debugLabel, "Video waiting", event.currentTarget)}
                onLoadedData={(event) => {
                  setVideoReady(true);
                  logHeroVideoDebug(debugLabel, "Video loaded data", event.currentTarget);
                }}
                onCanPlay={(event) => {
                  setVideoReady(true);
                  logHeroVideoDebug(debugLabel, "Video can play", event.currentTarget);
                }}
                onError={(event) => {
                  logHeroVideoDebug(debugLabel, "Video error", event.currentTarget);
                  if (posterSrc) setVideoFailed(true);
                }}
                style={compactVideoStyle}
              />
            )}
            {overlayOpacity > 0 ? <div style={{ ...overlayStyle, zIndex: 1 }} /> : null}
            {!videoReady && !posterSrc ? (
              <div style={{ position: "absolute", inset: 0, zIndex: 3, display: "grid", placeItems: "center", pointerEvents: "none", background: "linear-gradient(135deg, rgba(15,23,42,0.52), rgba(2,6,23,0.28))" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 999, padding: "11px 16px", background: "rgba(0,0,0,0.58)", color: "#fff", fontSize: 14, fontWeight: 700, border: "1px solid rgba(255,255,255,0.28)" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.18)", fontSize: 16 }}>▶</span>
                  Play video
                </span>
              </div>
            ) : null}
          </div>

          {showText && (title || subtitle || ctaText) ? (
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14, padding: "0 24px 32px", maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
              {eyebrow ? (
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: accentColor, textTransform: "uppercase" }}>{eyebrow}</div>
              ) : null}
              {title ? (
                <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, lineHeight: 1.03, color: textColor, overflowWrap: "break-word" }}>{title}</h1>
              ) : null}
              {subtitle ? (
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "rgba(255,255,255,0.72)", maxWidth: "100%", overflowWrap: "break-word" }}>{subtitle}</p>
              ) : null}
              {ctaText ? (
                <a
                  href={ctaUrl}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, maxWidth: "100%", background: `linear-gradient(135deg, ${accentColor}, #818cf8)`, color: "#fff", borderRadius: 14, padding: "13px 28px", fontSize: 16, fontWeight: 700, textDecoration: "none", boxShadow: `0 10px 28px ${accentColor}44`, marginTop: 4, overflowWrap: "break-word" }}
                >
                  {ctaText}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  // -- LIVE / PREVIEW mode ---------------------------------------------------
  return (
    <div style={marginTop ? { marginTop } : undefined}>
    <section ref={sectionRef} style={sectionStyle}>
      {editor && isSelected ? (
        <div
          data-no-canvas-drag="true"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 20,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(2,6,23,0.72)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", marginRight: 2 }}>Video Hero</span>
          {["full", "fixed"].map((mode) => (
            <button key={mode} type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ heightMode: mode }, event)} style={editorOptionButtonStyle(heightMode === mode)}>
              {mode === "full" ? "Full screen" : "Fixed px"}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.16)" }} />
          {["cover", "contain"].map((fit) => (
            <button key={fit} type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ objectFit: fit }, event)} style={editorOptionButtonStyle(objectFit === fit)}>
              {fit}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.16)" }} />
          {[["top center", "Top"], ["center center", "Middle"], ["bottom center", "Bottom"]].map(([value, label]) => (
            <button key={value} type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ objectPosition: value }, event)} style={editorOptionButtonStyle(objectPosition === value)}>
              {label}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.16)" }} />
          <label
            data-no-canvas-drag="true"
            style={editorToggleStyle(autoplay)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              applyVideoHeroPatch({ autoplay: !autoplay }, event);
            }}
          >
            <input type="checkbox" checked={autoplay} readOnly tabIndex={-1} style={{ margin: 0 }} />
            Autoplay
          </label>
          <label
            data-no-canvas-drag="true"
            style={editorToggleStyle(!muted)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              applyVideoHeroPatch({ muted: !muted }, event);
            }}
          >
            <input type="checkbox" checked={!muted} readOnly tabIndex={-1} style={{ margin: 0 }} />
            Audio
          </label>
          <label
            data-no-canvas-drag="true"
            style={editorToggleStyle(startWithAudio)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const next = !startWithAudio;
              applyVideoHeroPatch({ startWithAudio: next, playAudioOnInteraction: next, unmuteOnScroll: next }, event);
            }}
          >
            <input type="checkbox" checked={startWithAudio} readOnly tabIndex={-1} style={{ margin: 0 }} />
            Auto audio
          </label>
          <button type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ loop: !loop }, event)} style={editorOptionButtonStyle(loop)}>
            Loop
          </button>
          <button type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ showControls: !showControls, controls: !showControls }, event)} style={editorOptionButtonStyle(showControls)}>
            Controls
          </button>
        </div>
      ) : null}

      {/* Video element: stable src prevents re-renders from restarting playback. */}
      {videoFailed && posterSrc ? (
        <img
          src={posterSrc}
          alt={title || "Video poster"}
          style={{ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%", objectFit, objectPosition, display: "block" }}
        />
      ) : (
        <video
          ref={videoRef}
          src={videoSrc || undefined}
          poster={posterSrc || undefined}
          muted={muted}
          autoPlay={autoplay}
          loop={loop}
          controls={showControls}
          playsInline
          preload={preloadMode}
          onPlay={(event) => logHeroVideoDebug(debugLabel, "Video started", event.currentTarget)}
          onPause={(event) => logHeroVideoDebug(debugLabel, "Video paused", event.currentTarget)}
          onEnded={(event) => logHeroVideoDebug(debugLabel, "Video ended", event.currentTarget)}
          onStalled={(event) => logHeroVideoDebug(debugLabel, "Video stalled", event.currentTarget)}
          onWaiting={(event) => logHeroVideoDebug(debugLabel, "Video waiting", event.currentTarget)}
          onError={(event) => {
            logHeroVideoDebug(debugLabel, "Video error", event.currentTarget);
            if (posterSrc) setVideoFailed(true);
          }}
          style={{
            position: "absolute", inset: 0, zIndex: 0,
            width: "100%", height: "100%",
            objectFit,
            objectPosition,
            display: "block",
          }}
        />
      )}

      {/* Dark overlay for text legibility */}
      <div style={overlayStyle} />

      {/* Editor empty-state hint — only shown in the builder when no video has been uploaded */}
      {editor && !videoSrc ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, pointerEvents: "none" }}>
          <span style={{ fontSize: 48 }}>🎬</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>Video Hero</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>Upload a video in the panel on the right →</span>
        </div>
      ) : null}

      {/* Mute/unmute toggle — bottom-right corner */}
      <button
        type="button"
        aria-label={muted ? "Unmute video" : "Mute video"}
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (videoRef.current) videoRef.current.muted = next;
        }}
        style={{
          position: "absolute", bottom: 18, right: 18, zIndex: 10,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(0,0,0,0.52)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.22)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        {muted ? (
          /* Muted icon — speaker with X */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          /* Unmuted icon — speaker with waves */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        )}
      </button>

      {/* Text overlay */}
      {showText && (title || subtitle || ctaText) ? (
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: compact ? 14 : 22, padding: compact ? "40px 24px" : "60px 48px", maxWidth: 820, width: "100%" }}>
          {eyebrow ? (
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: accentColor, textTransform: "uppercase" }}>{eyebrow}</div>
          ) : null}
          {title ? (
            <h1 style={{ margin: 0, fontSize: compact ? 34 : 64, fontWeight: 900, lineHeight: 1.03, color: textColor, letterSpacing: "-0.02em" }}>{title}</h1>
          ) : null}
          {subtitle ? (
            <p style={{ margin: 0, fontSize: compact ? 17 : 22, lineHeight: 1.7, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>{subtitle}</p>
          ) : null}
          {ctaText ? (
            <a
              href={ctaUrl}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${accentColor}, #818cf8)`, color: "#fff", borderRadius: 14, padding: compact ? "13px 28px" : "17px 36px", fontSize: compact ? 16 : 19, fontWeight: 700, textDecoration: "none", boxShadow: `0 10px 28px ${accentColor}44`, marginTop: 4 }}
            >
              {ctaText}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
    </div>
  );
}
