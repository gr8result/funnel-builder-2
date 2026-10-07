import React from "react";
import { resolvePublishedNavHref } from "./wbAnimations";
import { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";
import { asRichHtml } from "./wbVariantStyles";
import { shouldSkipToolbarBlur } from "./wbBlockHelpers.js";



// --- Framer Portfolio Block (horizontal carousel, click-to-reveal) ------------
export function FramerPortfolioBlock({ props, compact, editor, onUploadImage, onChangeBlock }) {
  const sectionRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const fileInputRefs = React.useRef({});
  const hoveredRef = React.useRef(false);
  const wheelLockRef = React.useRef(0);
  const [cardW, setCardW] = React.useState(0);
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  const cards = Array.isArray(props.cards) ? props.cards : [];
  const bg = props.backgroundColor || "#000";
  const GAP = 12;
  const CARD_HEIGHT = Math.max(180, Number(props.cardHeight || 600));
  const visibleCount = Math.max(1, Number(compact ? 1 : props.visibleCount || 3));
  const autoScrollEnabled = !!props.autoScroll;
  const scrollMode = String(props.scrollMode || "card");
  const loopScroll = props.loopScroll !== false;
  const pauseOnHover = props.pauseOnHover !== false;
  const cardIntervalMs = Math.max(700, Number(props.cardScrollInterval || 2500));
  const continuousSpeed = Math.max(5, Number(props.continuousScrollSpeed || 45));
  const renderCards = autoScrollEnabled && scrollMode === "continuous" && loopScroll && cards.length > 1
    ? [...cards, ...cards]
    : cards;

  // Measure container so cards are exactly 1/3 in pixels
  React.useEffect(() => {
    if (!sectionRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const measuredWidth = entries[0]?.contentRect?.width || 0;
      const fallbackWidth = scrollRef.current?.clientWidth || 0;
      const w = measuredWidth || fallbackWidth;
      const gaps = Math.max(0, Math.ceil(visibleCount) - 1) * GAP;
      setCardW(compact ? w : Math.floor((w - gaps) / visibleCount));
    });
    ro.observe(sectionRef.current);
    return () => ro.disconnect();
  }, [compact, visibleCount]);

  const getCardStep = React.useCallback((el) => {
    const measuredStep = Number(cardW || 0);
    if (measuredStep > 1) return measuredStep + GAP;
    const fallbackVisible = Math.max(1, Number(compact ? 1 : props.visibleCount || 3));
    const fallbackGaps = Math.max(0, Math.ceil(fallbackVisible) - 1) * GAP;
    const fallbackWidth = Math.floor((Math.max(0, el.clientWidth - fallbackGaps)) / fallbackVisible);
    return Math.max(160, fallbackWidth) + GAP;
  }, [cardW, compact, props.visibleCount]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const step = getCardStep(el);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextLeft = el.scrollLeft + dir * step;
    if (loopScroll && nextLeft > maxScroll - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (loopScroll && nextLeft < 0) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const handleWheel = (event) => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= 1) return;

    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const deltaModeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1;
    const delta = rawDelta * deltaModeMultiplier;
    if (!delta) return;

    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft >= maxScroll - 1;

    event.preventDefault();
    event.stopPropagation();

    if (!loopScroll && ((delta < 0 && atStart) || (delta > 0 && atEnd))) return;

    if (scrollMode === "card") {
      const now = Date.now();
      if (now - wheelLockRef.current < 420) return;
      wheelLockRef.current = now;
      scroll(delta > 0 ? 1 : -1);
      return;
    }

    el.scrollBy({ left: delta, behavior: "auto" });
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [cardW, loopScroll, scrollMode]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollEnabled || cards.length <= 1) return undefined;

    if (scrollMode === "card") {
      const timer = window.setInterval(() => {
        if (pauseOnHover && hoveredRef.current) return;
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const step = getCardStep(el);
        const nextLeft = el.scrollLeft + step;
        if (nextLeft > maxScroll - 4) {
          if (loopScroll) el.scrollTo({ left: 0, behavior: "smooth" });
          return;
        }
        el.scrollBy({ left: step, behavior: "smooth" });
      }, cardIntervalMs);
      return () => window.clearInterval(timer);
    }

    let rafId = 0;
    let lastTime = 0;
    const loopPoint = loopScroll ? Math.max(1, el.scrollWidth / 2) : 0;

    function tick(time) {
      rafId = window.requestAnimationFrame(tick);
      if (!lastTime) {
        lastTime = time;
        return;
      }
      const deltaSeconds = Math.min(0.08, (time - lastTime) / 1000);
      lastTime = time;
      if (pauseOnHover && hoveredRef.current) return;

      el.scrollLeft += continuousSpeed * deltaSeconds;
      if (loopScroll && loopPoint > 1 && el.scrollLeft >= loopPoint) {
        el.scrollLeft -= loopPoint;
      } else if (!loopScroll && el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
        window.cancelAnimationFrame(rafId);
      }
    }

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoScrollEnabled, cards.length, cardIntervalMs, continuousSpeed, getCardStep, loopScroll, pauseOnHover, scrollMode]);

  const handleUpload = async (cardIdx, file) => {
    if (!file) return;
    const asset = await Promise.resolve(onUploadImage?.("__fp_card_image__", file));
    if (!asset?.src) return;
    const updated = cards.map((c, i) => i === cardIdx ? { ...c, image: asset.src, imageAssetId: asset.id || "" } : c);
    onChangeBlock?.({ ...props, cards: updated });
  };

  return (
    <section ref={sectionRef} style={{ background: bg, width: "100%", boxSizing: "border-box", position: "relative", overflow: "hidden" }}>

      {/* Left arrow */}
      <button type="button" onClick={() => scroll(-1)} style={{ position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 20, width: 52, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 32, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
        ‹
      </button>

      {/* Scroll track */}
      <div ref={scrollRef} className="__fp_track" style={{ display: "flex", gap: GAP, padding: "0 0", overflowX: "auto", overscrollBehavior: "contain", touchAction: "pan-x", scrollSnapType: scrollMode === "card" ? "x mandatory" : "none", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {renderCards.map((card, idx) => {
          const sourceIdx = cards.length ? idx % cards.length : idx;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={`${card.id || sourceIdx}-${idx}`}
              style={{ flexShrink: 0, width: cardW || `${100 / visibleCount}%`, height: CARD_HEIGHT, scrollSnapAlign: scrollMode === "card" ? "start" : "none", position: "relative", overflow: "hidden", background: "#111", cursor: "pointer" }}
              onMouseEnter={() => { hoveredRef.current = true; setHoveredIdx(idx); }}
              onMouseLeave={() => { hoveredRef.current = false; setHoveredIdx(null); }}
              onDoubleClick={() => { if (editor) fileInputRefs.current[sourceIdx]?.click(); }}
            >
              {/* Full image — contain so nothing is cropped */}
              {card.image
                ? <img src={card.image} alt={card.title || ""} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                : <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "linear-gradient(135deg,#1e1b4b,#312e81)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", fontSize: 16 }}>No image — double-click to upload</div>
              }

              {/* Hover dark overlay */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.55)", opacity: isHovered ? 1 : 0, transition: "opacity 0.25s ease", pointerEvents: "none" }} />

              {/* Editor: always-visible upload button */}
              {editor ? (
                <label
                  style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(0,0,0,0.8)", border: "2px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  🖼️ {card.image ? "Replace image" : "Upload image"}
                  <input
                    ref={(el) => { fileInputRefs.current[sourceIdx] = el; }}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleUpload(sourceIdx, f); }}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Right arrow */}
      <button type="button" onClick={() => scroll(1)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 20, width: 52, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 32, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
        ›
      </button>

      <style>{`.__fp_track::-webkit-scrollbar{display:none}`}</style>
    </section>
  );
}


// --- Hover Cards Block --------------------------------------------------------
export function HoverCardsBlock({ props, compact, editor, navigationContext }) {
  const [flippedIndex, setFlippedIndex] = React.useState(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [hovering, setHovering] = React.useState(false);
  // measured.cardPxWidth = exact px width per card; measured.autoVC = auto-calculated visible cards (fullWidth mode)
  const [measured, setMeasured] = React.useState({ cardPxWidth: 0, autoVC: null });
  const viewportRef = React.useRef(null);

  const cards = Array.isArray(props.cards) ? props.cards : [];
  const fullWidth = !!props.fullWidth;
  const minCardWidth = Number(props.minCardWidth || 280);
  const cardGap = Number(props.cardGap || 16);
  const propVC = Math.max(1, Math.min(cards.length || 1, Number(props.visibleCards || 3)));

  // In fullWidth mode auto-derive visible card count from measured container width
  const visibleCards = compact ? 1 : (fullWidth && measured.autoVC !== null ? measured.autoVC : propVC);

  const cardHeight = Number(props.cardHeight || 320);
  const cardRadius = Number(props.cardRadius || 12);
  const cardPadding = Number(props.cardPadding || 20);
  const backColor = props.hoverBackgroundColor || props.overlayColor || "#000000";
  const buttonColor = props.buttonColor || "#ffffff";
  const buttonTextColor = props.buttonTextColor || "#0f172a";
  const buttonText = props.buttonText || "Learn more ?";
  const arrowBg = props.arrowBg || "#ffffff";
  const arrowColor = props.arrowColor || "#0f172a";
  const autoPlayInterval = Number(props.autoPlayInterval || 3500);
  const maxIndex = Math.max(0, cards.length - visibleCards);
  const seamlessLoop = props.continuousLoop !== false && cards.length > visibleCards;
  const loopSpeed = Math.max(8, Number(props.continuousSpeed || 45));
  const showArrows = !seamlessLoop && maxIndex > 0;

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const vw = el.offsetWidth;
      if (fullWidth && !compact) {
        // Auto-fit as many cards as possible given minimum card width
        const auto = Math.max(1, Math.floor((vw + cardGap) / (minCardWidth + cardGap)));
        const clampedAuto = Math.min(auto, cards.length || 1);
        const w = (vw - (clampedAuto - 1) * cardGap) / clampedAuto;
        setMeasured({ cardPxWidth: w > 0 ? w : 0, autoVC: clampedAuto });
      } else {
        const vc = compact ? 1 : propVC;
        const w = (vw - (vc - 1) * cardGap) / vc;
        setMeasured((prev) => ({ ...prev, cardPxWidth: w > 0 ? w : 0 }));
      }
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fullWidth, compact, minCardWidth, cardGap, propVC, cards.length]);

  React.useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  // Auto-advance loop — pauses while someone is reading a hovered/flipped card.
  React.useEffect(() => {
    if (seamlessLoop) return undefined;
    if (hovering || flippedIndex !== null) return undefined;
    if (maxIndex <= 0) return undefined;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, autoPlayInterval);
    return () => clearInterval(id);
  }, [maxIndex, hovering, flippedIndex, autoPlayInterval, seamlessLoop]);

  const { cardPxWidth } = measured;
  const goTo = (idx) => setCurrentIndex(Math.max(0, Math.min(maxIndex, idx)));
  const offset = currentIndex * (cardPxWidth + cardGap);
  const loopDistance = seamlessLoop && cardPxWidth > 0 ? cards.length * (cardPxWidth + cardGap) : 0;
  const loopDuration = loopDistance > 0 ? Math.max(8, loopDistance / loopSpeed) : 0;
  const loopKeyframeName = `wbHoverCardsLoop_${cards.length}_${Math.round(cardPxWidth)}_${Math.round(cardGap)}`;
  const renderedCards = seamlessLoop ? [...cards, ...cards] : cards;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < maxIndex;

  const sectionSidePad = compact ? 20 : Number(props.paddingSides ?? 40);
  const outerMaxWidth = fullWidth ? "100%" : Number(props.maxWidth || 1200);

  const arrowBtn = (side, enabled, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-label={label}
      style={{
        position: "absolute",
        [side]: 10,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "2px solid rgba(0,0,0,0.1)",
        background: arrowBg,
        color: arrowColor,
        fontSize: 24,
        lineHeight: "1",
        cursor: enabled ? "pointer" : "default",
        opacity: enabled ? 1 : 0.35,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        transition: "opacity 0.2s",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );

  if (compact) {
    return (
      <section style={{
        background: props.backgroundColor || "#f8fafc",
        padding: `${Number(props.paddingTop ?? 48)}px ${sectionSidePad}px ${Number(props.paddingBottom ?? 48)}px`,
        boxSizing: "border-box",
        width: "100%",
      }}>
        {props.sectionTitle ? (
          <h2 style={{
            textAlign: "center",
            fontSize: 22,
            fontWeight: 600,
            color: props.sectionTitleColor || "#0f172a",
            margin: "0 auto 24px",
            lineHeight: 1.2,
            maxWidth: 860,
          }}>
            {props.sectionTitle}
          </h2>
        ) : null}
        <div style={{ maxWidth: outerMaxWidth, margin: "0 auto", display: "grid", gap: cardGap }}>
          {cards.map((card, idx) => (
            <article
              key={card.id || idx}
              style={{
                width: "100%",
                overflow: "hidden",
                borderRadius: cardRadius,
                background: card.hoverBackgroundColor || backColor,
                boxShadow: "0 18px 36px rgba(15,23,42,0.14)",
              }}
            >
              {card.image ? (
                <img src={card.image} alt={card.title || ""} style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block" }} />
              ) : null}
              <div style={{ padding: cardPadding, display: "grid", gap: 10 }}>
                {card.title ? (
                  <div style={{ fontSize: Number(props.backTitleSize || 20), fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>{card.title}</div>
                ) : null}
                {card.description ? (
                  <div style={{ fontSize: Math.max(14, Number(props.backDescSize || 15)), color: "rgba(255,255,255,0.86)", lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{card.description}</div>
                ) : null}
                {card.link ? (
                  <a href={editor ? undefined : resolvePublishedNavHref({ href: card.link }, navigationContext)} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", padding: "10px 18px", borderRadius: 8, background: buttonColor, color: buttonTextColor, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
                    {buttonText}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section style={{
      background: props.backgroundColor || "#f8fafc",
      padding: `${Number(props.paddingTop ?? 48)}px ${sectionSidePad}px ${Number(props.paddingBottom ?? 48)}px`,
      boxSizing: "border-box",
      width: "100%",
    }}>
      {props.sectionTitle ? (
        <h2 style={{
          textAlign: "center",
          fontSize: compact ? 22 : Math.max(18, Number(props.sectionTitleSize || 32)),
          fontWeight: 600,
          color: props.sectionTitleColor || "#0f172a",
          margin: "0 auto 32px",
          lineHeight: 1.2,
          maxWidth: 860,
        }}>
          {props.sectionTitle}
        </h2>
      ) : null}

      {/* Max-width centering wrapper */}
      <div style={{ maxWidth: outerMaxWidth, margin: "0 auto" }}>
        {/*
          Viewport: overflow:clip clips the sliding track without creating a stacking context,
          preserving transform-style:preserve-3d for the card flip animation.
          Arrows are positioned INSIDE this element (overlay on cards) — no negative
          positioning, no external clipping risk.
        */}
        <div
          ref={viewportRef}
          style={{ overflow: "clip", position: "relative" }}
          onMouseLeave={() => { setHovering(false); setFlippedIndex(null); }}
        >
          {showArrows ? arrowBtn("left", canPrev, "Previous", () => goTo(currentIndex - 1)) : null}
          {showArrows ? arrowBtn("right", canNext, "Next", () => goTo(currentIndex + 1)) : null}
          {seamlessLoop && loopDistance > 0 ? (
            <style>{`
              @keyframes ${loopKeyframeName} {
                from { transform: translate3d(0,0,0); }
                to { transform: translate3d(-${loopDistance}px,0,0); }
              }
            `}</style>
          ) : null}

          {/* Track — slides via translateX */}
          <div style={{
            display: "flex",
            gap: cardGap,
            transform: seamlessLoop ? "translateX(0)" : (cardPxWidth > 0 ? `translateX(-${offset}px)` : "translateX(0)"),
            transition: seamlessLoop ? "none" : "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
            animation: seamlessLoop && loopDistance > 0 ? `${loopKeyframeName} ${loopDuration}s linear infinite` : "none",
            animationPlayState: seamlessLoop && hovering ? "paused" : "running",
            willChange: "transform",
          }}>
            {renderedCards.map((card, idx) => {
              const sourceIdx = idx % Math.max(cards.length, 1);
              const flipKey = `${Math.floor(idx / Math.max(cards.length, 1))}-${sourceIdx}`;
              const isFlipped = flippedIndex === flipKey;
              const basis = cardPxWidth > 0
                ? `${cardPxWidth}px`
                : `calc(${100 / visibleCards}% - ${(cardGap * (visibleCards - 1)) / visibleCards}px)`;
              return (
                <div
                  key={`${card.id || sourceIdx}-${idx}`}
                  tabIndex={0}
                  style={{ flex: `0 0 ${basis}`, minWidth: basis, height: cardHeight, perspective: "1000px", flexShrink: 0 }}
                  onMouseEnter={() => { setHovering(true); setFlippedIndex(flipKey); }}
                  onMouseLeave={() => { setHovering(false); setFlippedIndex(null); }}
                  onFocus={() => { setHovering(true); setFlippedIndex(flipKey); }}
                  onBlur={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget)) return;
                    setHovering(false);
                    setFlippedIndex(null);
                  }}
                >
                  {/* Flip container */}
                  <div style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 0.65s cubic-bezier(0.4,0.2,0.2,1)",
                  }}>

                    {/* -- FRONT FACE ----------------------------------- */}
                    <div style={{
                      position: "absolute",
                      top: 0, left: 0, right: 0, bottom: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      borderRadius: cardRadius,
                      overflow: "hidden",
                      background: card.cardColor || props.cardColor || "#dde3ea",
                    }}>
                      {card.image ? (
                        <img src={card.image} alt={card.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 16, fontStyle: "italic" }}>
                          No image
                        </div>
                      )}
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        padding: `${cardPadding * 2.5}px ${cardPadding}px ${cardPadding}px`,
                        background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
                      }}>
                        {card.title ? (
                          <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                            {card.title}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* -- BACK FACE ------------------------------------ */}
                    <div style={{
                      position: "absolute",
                      top: 0, left: 0, right: 0, bottom: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderRadius: cardRadius,
                      overflow: "hidden",
                      background: card.hoverBackgroundColor || backColor,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "flex-end",
                      padding: cardPadding,
                      boxSizing: "border-box",
                    }}>
                      {card.title ? (
                        <div style={{ fontSize: Number(props.backTitleSize || 20), fontWeight: 600, color: "#fff", lineHeight: 1.3, marginBottom: 8 }}>{card.title}</div>
                      ) : null}
                      {card.description ? (
                        <div style={{ fontSize: Number(props.backDescSize || 15), color: "rgba(255,255,255,0.82)", lineHeight: 1.55, marginBottom: 18, whiteSpace: "pre-wrap" }}>{card.description}</div>
                      ) : null}
                      {card.link ? (
                        <a href={editor ? undefined : resolvePublishedNavHref({ href: card.link }, navigationContext)} style={{ display: "inline-flex", alignItems: "center", padding: "10px 22px", borderRadius: 8, background: buttonColor, color: buttonTextColor, fontSize: 16, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                          {buttonText}
                        </a>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", padding: "10px 22px", borderRadius: 8, background: buttonColor, color: buttonTextColor, fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
                          {buttonText}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dot indicators */}
        {!seamlessLoop && maxIndex > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
            {Array.from({ length: maxIndex + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                style={{
                  width: currentIndex === i ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: currentIndex === i ? (props.dotsActiveColor || "#0f172a") : (props.dotsColor || "#cbd5e1"),
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  padding: 0,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}


// --- AvatarMorphBlock ---------------------------------------------------------
// Three avatar images that crossfade as the section scrolls into view.
// Feature blocks fly outward from the avatar center like they're emerging from behind.
// CSS blur + scale on start creates a "materialising from depth" effect.

export const AVATAR_FLY_BLOCK_DEFAULTS = [
  { id: "fb-1", icon: "?", label: "Automation",  value: "Always On",   color: "#f59e0b", endX: -380, endY: -170, delay: 0.00 },
  { id: "fb-2", icon: "⚙️", label: "Precision",   value: "99.9% up",    color: "#3b82f6", endX: -430, endY:   15, delay: 0.10 },
  { id: "fb-3", icon: "📈", label: "Growth",      value: "+240% ROI",   color: "#10b981", endX: -370, endY:  190, delay: 0.20 },
  { id: "fb-4", icon: "★", label: "Quality",     value: "5★ Rated",    color: "#8b5cf6", endX:  -90, endY: -300, delay: 0.05 },
  { id: "fb-5", icon: "🎯", label: "Results",     value: "Day 1 Gains", color: "#ef4444", endX:  -90, endY:  300, delay: 0.15 },
];


export function AvatarMorphBlock({ block, editor = false, compact = false, onChangeBlock, onUploadImage }) {
  const props = block?.props || {};

  const backgroundColor = props.backgroundColor || "#080e1b";
  const accentColor     = props.accentColor     || "#6366f1";
  const textColor       = props.textColor       || "#ffffff";
  const avatarSrc1 = props.avatarArmsIn  || "";
  const avatarSrc2 = props.avatarArmsMid || "";
  const avatarSrc3 = props.avatarArmsOut || "";

  const flyBlockData = React.useMemo(() => {
    const saved = Array.isArray(props.flyBlocks) ? props.flyBlocks : [];
    return AVATAR_FLY_BLOCK_DEFAULTS.map((d, i) => ({ ...d, ...(saved[i] || {}) }));
  }, [props.flyBlocks]);

  const sectionRef = React.useRef(null);
  const img1Ref    = React.useRef(null);
  const img2Ref    = React.useRef(null);
  const img3Ref    = React.useRef(null);
  const flyRefs    = React.useRef([]);

  // Scroll-driven rAF animation — direct DOM mutation, zero React re-renders
  React.useEffect(() => {
    if (editor || typeof window === "undefined") return undefined;

    const container = sectionRef.current;
    if (!container) return undefined;

    let rafId;
    let mounted = true;
    let lastP = -1;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function lerp(a, b, t)    { return a + (b - a) * t; }
    function easeOut(t)        { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

    function tick() {
      if (!mounted) return;
      rafId = requestAnimationFrame(tick);

      const rect = container.getBoundingClientRect();
      const vh   = window.innerHeight;
      // p = 0 when section bottom hits viewport bottom; 1 when section top hits viewport top
      const raw = clamp((vh - rect.top) / (vh + rect.height * 0.55), 0, 1);
      if (Math.abs(raw - lastP) < 0.0015) return;
      lastP = raw;
      const p = raw;

      // -- Avatar crossfade ------------------------------------------------
      // Three-phase: img1 ? img2 (0–0.45), img2 ? img3 (0.45–0.80), hold img3
      let o1, o2, o3;
      if (p < 0.45) {
        const t = easeOut(p / 0.45);
        o1 = 1 - t; o2 = t;  o3 = 0;
      } else if (p < 0.80) {
        const t = easeOut((p - 0.45) / 0.35);
        o1 = 0;  o2 = 1 - t; o3 = t;
      } else {
        o1 = 0;  o2 = 0;     o3 = 1;
      }

      if (img1Ref.current) {
        img1Ref.current.style.opacity = o1;
        img1Ref.current.style.filter  = o1 < 0.6 ? `blur(${((1 - o1) * 3).toFixed(1)}px)` : "";
      }
      if (img2Ref.current) {
        img2Ref.current.style.opacity = o2;
        img2Ref.current.style.filter  = `blur(${((1 - o2) * 2.5).toFixed(1)}px)`;
      }
      if (img3Ref.current) {
        img3Ref.current.style.opacity = o3;
        img3Ref.current.style.filter  = o3 < 0.6 ? `blur(${((1 - o3) * 4).toFixed(1)}px)` : "";
      }

      // -- Flying blocks --------------------------------------------------
      flyRefs.current.forEach((el, i) => {
        if (!el) return;
        const bd  = flyBlockData[i];
        if (!bd) return;
        const bp  = clamp((p - (bd.delay || 0)) / (0.85 - (bd.delay || 0)), 0, 1);
        const ep  = easeOut(bp);
        const x   = lerp(0, bd.endX, ep);
        const y   = lerp(0, bd.endY, ep);
        const sc  = lerp(0.06, 1, ep);
        const op  = clamp(bp * 5, 0, 1);
        const bl  = lerp(14, 0, Math.min(1, bp * 3.5));
        el.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px)) scale(${sc.toFixed(3)})`;
        el.style.opacity   = op.toFixed(3);
        el.style.filter    = bl > 0.3 ? `blur(${bl.toFixed(1)}px)` : "";
      });
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [editor, flyBlockData]);

  // -- Upload helpers ---------------------------------------------------------
  async function handleAvatarUpload(slot, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage(`__avatar_morph_${slot}__`, file));
    if (asset?.src) onChangeBlock?.({ ...props, [slot]: asset.src });
  }

  // -- Shared styles ----------------------------------------------------------
  const avatarImgStyle = {
    position: "absolute", top: 0, left: 0,
    width: "100%", height: "100%",
    objectFit: "contain", objectPosition: "bottom center",
    display: "block", pointerEvents: "none",
  };

  // -- Flying block render ----------------------------------------------------
  function renderFlyBlock(bd, i) {
    const isEditor = editor;
    const editorTransform = `translate(calc(-50% + ${bd.endX}px), calc(-50% + ${bd.endY}px)) scale(1)`;
    return (
      <div
        key={bd.id}
        ref={(el) => { flyRefs.current[i] = el; }}
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: isEditor ? editorTransform : "translate(-50%, -50%) scale(0.06)",
          opacity: isEditor ? 1 : 0,
          zIndex: 10,
          pointerEvents: "none",
          width: compact ? 150 : 188,
          height: compact ? 80  : 104,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${bd.color}1c 0%, ${bd.color}0a 100%)`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${bd.color}50`,
          boxShadow: `0 8px 32px ${bd.color}28, 0 0 0 1px ${bd.color}18 inset`,
          display: "flex",
          alignItems: "center",
          gap: compact ? 10 : 14,
          padding: compact ? "0 14px" : "0 22px",
          willChange: "transform, opacity",
        }}
      >
        <div style={{
          width: compact ? 38 : 48,
          height: compact ? 38 : 48,
          borderRadius: 13,
          background: `linear-gradient(135deg, ${bd.color}35, ${bd.color}18)`,
          border: `1px solid ${bd.color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: compact ? 20 : 26,
          flexShrink: 0,
        }}>
          {bd.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{bd.value}</div>
          <div style={{ fontSize: compact ? 12 : 14, color: "rgba(255,255,255,0.55)", fontWeight: 500, marginTop: 2 }}>{bd.label}</div>
        </div>
      </div>
    );
  }

  // -- Editor upload slot -----------------------------------------------------
  function renderEditorSlot(src, slot, label) {
    return (
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {src ? (
          <>
            <img src={src} alt={label} style={{ width: "100%", height: 170, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "block" }} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, [slot]: "" }); }}
              style={{ position: "absolute", top: 4, right: 4, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 5, padding: "2px 7px", fontSize: 13, cursor: "pointer" }}
            >×</button>
          </>
        ) : (
          <div style={{ height: 170, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "rgba(255,255,255,0.25)", fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 36 }}>🧍</span>
            <span>{label}</span>
          </div>
        )}
        <label
          style={{ display: "block", marginTop: 5, textAlign: "center", padding: "5px 0", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 7, color: "#a5b4fc", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        >
          🖼️ Upload
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleAvatarUpload(slot, f); }} />
        </label>
      </div>
    );
  }

  // -- EDITOR mode ------------------------------------------------------------
  if (editor) {
    return (
      <div style={{ position: "relative", background: backgroundColor, padding: compact ? "40px 24px" : "72px 56px", borderRadius: 16, overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: "25%", right: "30%", width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}1e 0%, transparent 68%)`, pointerEvents: "none" }} />
        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 40, alignItems: "start", position: "relative", zIndex: 2 }}>
          {/* Left: text preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: accentColor, textTransform: "uppercase" }}>{props.eyebrow || "Powered by Intelligent Automation"}</div>
            <div
              contentEditable suppressContentEditableWarning
              data-website-inline-editor="true"
              onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => { if (shouldSkipToolbarBlur(e)) return; onChangeBlock?.({ ...props, title: cleanInlineEditorHtml(e.currentTarget.innerHTML) }); }}
              style={{ fontSize: compact ? 30 : 50, fontWeight: 900, lineHeight: 1.05, color: textColor, outline: "1px dashed rgba(99,102,241,0.4)", borderRadius: 6, margin: 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Watch the system come alive") }}
            />
            <div
              contentEditable suppressContentEditableWarning
              data-website-inline-editor="true"
              onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => { if (shouldSkipToolbarBlur(e)) return; onChangeBlock?.({ ...props, subtitle: cleanInlineEditorHtml(e.currentTarget.innerHTML) }); }}
              style={{ fontSize: 18, lineHeight: 1.75, color: "rgba(255,255,255,0.62)", outline: "1px dashed rgba(99,102,241,0.3)", borderRadius: 6, margin: 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || "Three simple actions — one unstoppable flow.") }}
            />
            {/* Color pickers */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "rgba(99,102,241,0.07)", border: "1px dashed rgba(99,102,241,0.3)", borderRadius: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600 }}>Colors:</span>
              {[["Background","backgroundColor"],["Accent","accentColor"],["Text","textColor"]].map(([lbl, key]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
                  {lbl}
                  <input type="color" value={props[key] || (key === "backgroundColor" ? "#080e1b" : key === "accentColor" ? "#6366f1" : "#ffffff")} onChange={(e) => onChangeBlock?.({ ...props, [key]: e.target.value })} style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
                </label>
              ))}
            </div>
          </div>
          {/* Right: avatar slots + blocks preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>AVATAR IMAGES (scroll sequence: arms in → arms mid → arms out)</div>
            <div style={{ display: "flex", gap: 10 }}>
              {renderEditorSlot(avatarSrc1, "avatarArmsIn",  "Arms In")}
              {renderEditorSlot(avatarSrc2, "avatarArmsMid", "Arms Mid")}
              {renderEditorSlot(avatarSrc3, "avatarArmsOut", "Arms Out")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>FLYING BLOCKS (final positions):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {flyBlockData.map((bd) => (
                <div key={bd.id} style={{ borderRadius: 12, background: `linear-gradient(135deg, ${bd.color}1c, ${bd.color}0a)`, border: `1px solid ${bd.color}44`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{bd.icon}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{bd.value}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{bd.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -- LIVE / PREVIEW mode ----------------------------------------------------
  const hasAnyAvatar = !!(avatarSrc1 || avatarSrc2 || avatarSrc3);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        background: backgroundColor,
        minHeight: compact ? "auto" : "100vh",
        overflow: "visible",
        display: "flex",
        alignItems: "center",
        padding: compact ? "70px 24px" : "110px 60px",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient glow */}
      <div aria-hidden="true" style={{ position: "absolute", top: "15%", right: "22%", width: 560, height: 560, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}1a 0%, transparent 62%)`, pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: "10%", right: "12%", width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}0e 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* 2-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: compact ? 48 : 70, alignItems: "center", width: "100%", maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>

        {/* -- Left: text -- */}
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 18 : 26 }}>
          {props.eyebrow ? <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, letterSpacing: "0.10em", color: accentColor, textTransform: "uppercase" }}>{props.eyebrow}</div> : null}
          <h2 style={{ margin: 0, fontSize: compact ? 32 : 60, fontWeight: 900, lineHeight: 1.03, color: textColor, letterSpacing: "-0.02em" }}>
            {props.title || "Watch the system come alive"}
          </h2>
          <p style={{ margin: 0, fontSize: compact ? 17 : 20, lineHeight: 1.75, color: "rgba(255,255,255,0.62)" }}>
            {props.subtitle || "Three simple actions — one unstoppable flow. Each step fuels the next."}
          </p>
          {props.ctaText ? (
            <a
              href={props.ctaUrl || "#"}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${accentColor}, #818cf8)`, color: "#fff", borderRadius: 14, padding: compact ? "13px 26px" : "17px 34px", fontSize: compact ? 16 : 18, fontWeight: 700, textDecoration: "none", alignSelf: "flex-start", boxShadow: `0 10px 28px ${accentColor}40` }}
            >
              {props.ctaText}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          ) : null}
        </div>

        {/* -- Right: avatar + flying blocks -- */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Avatar image stack */}
          <div style={{ position: "relative", width: compact ? 240 : 400, height: compact ? 340 : 560, flexShrink: 0 }}>
            {/* img3 = arms out — base layer (fades in last) */}
            {avatarSrc3 ? <img ref={img3Ref} src={avatarSrc3} alt="Arms extended" style={{ ...avatarImgStyle, opacity: 0, willChange: "opacity, filter" }} /> : null}
            {/* img2 = arms mid */}
            {avatarSrc2 ? <img ref={img2Ref} src={avatarSrc2} alt="Arms half out" style={{ ...avatarImgStyle, opacity: 0, willChange: "opacity, filter" }} /> : null}
            {/* img1 = arms in — top layer, starts fully visible */}
            {avatarSrc1 ? <img ref={img1Ref} src={avatarSrc1} alt="Arms on chest" style={{ ...avatarImgStyle, opacity: 1, willChange: "opacity, filter" }} /> : null}

            {!hasAnyAvatar ? (
              <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,0.2)", fontSize: 17, fontWeight: 600 }}>
                <span style={{ fontSize: 64 }}>🧍</span>
                Upload avatar images in editor
              </div>
            ) : null}

            {/* Flying blocks — all anchored to avatar center, fly outward on scroll */}
            {!compact ? flyBlockData.map((bd, i) => renderFlyBlock(bd, i)) : null}
          </div>
        </div>

      </div>
    </section>
  );
}
