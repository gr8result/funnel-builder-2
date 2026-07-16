import React from "react";
import { ArrowUp } from "lucide-react";

const SCROLL_THRESHOLD = 350;

function canScroll(element) {
  if (!element) return false;
  return element.scrollHeight - element.clientHeight > 24;
}

function getScrollTop(target) {
  if (!target) return 0;
  if (target === window) return window.scrollY || window.pageYOffset || 0;
  return target.scrollTop || 0;
}

function scrollTargetToTop(target) {
  if (!target) return;
  if (target === window) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  target.scrollTo({ top: 0, behavior: "smooth" });
}

function overlapsBottomRight(rect, viewportWidth, viewportHeight, isMobile) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  const rightZoneStart = viewportWidth - (isMobile ? 124 : 150);
  const nearBottom = rect.bottom >= viewportHeight - 8;
  const inRightZone = rect.right >= rightZoneStart && rect.left <= viewportWidth;
  const banner = rect.width >= viewportWidth * 0.55 && rect.bottom >= viewportHeight - 8;
  return nearBottom && (inRightZone || banner);
}

function getAvoidanceOffset(buttonElement, isMobile) {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const baseBottom = isMobile ? 18 : 28;
  const gap = isMobile ? 12 : 16;
  let offset = 0;

  document.querySelectorAll("body *").forEach((element) => {
    if (!element || element === buttonElement || buttonElement?.contains?.(element) || element.contains?.(buttonElement)) return;
    const style = window.getComputedStyle(element);
    if (!["fixed", "sticky"].includes(style.position)) return;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.04) return;
    const rect = element.getBoundingClientRect();
    if (!overlapsBottomRight(rect, viewportWidth, viewportHeight, isMobile)) return;
    offset = Math.max(offset, Math.ceil(viewportHeight - rect.top + gap - baseBottom));
  });

  return Math.max(0, offset);
}

function findScrollableTarget() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const root = document.scrollingElement || document.documentElement;
  if (canScroll(root)) return window;

  const candidates = Array.from(document.querySelectorAll("main, [data-website-preview-scroll], [data-published-website-scroll], [style*='overflow']"));
  let best = null;
  let bestScore = 0;
  candidates.forEach((element) => {
    const style = window.getComputedStyle(element);
    const overflow = `${style.overflow} ${style.overflowY}`.toLowerCase();
    if (!/(auto|scroll|overlay)/.test(overflow) || !canScroll(element)) return;
    const rect = element.getBoundingClientRect();
    const score = Math.max(0, rect.width) * Math.max(0, rect.height);
    if (score > bestScore) {
      best = element;
      bestScore = score;
    }
  });
  return best || window;
}

export default function BackToTopButton() {
  const buttonRef = React.useRef(null);
  const scrollTargetRef = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [avoidBottom, setAvoidBottom] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frame = 0;
    let target = null;

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const mobile = (window.innerWidth || 0) <= 640;
        setIsMobile(mobile);
        setVisible(getScrollTop(scrollTargetRef.current || target || window) > SCROLL_THRESHOLD);
        setAvoidBottom(getAvoidanceOffset(buttonRef.current, mobile));
      });
    };

    const bind = () => {
      const nextTarget = findScrollableTarget();
      if (target && target !== nextTarget) target.removeEventListener?.("scroll", update);
      target = nextTarget || window;
      scrollTargetRef.current = target;
      target.addEventListener?.("scroll", update, { passive: true });
      update();
    };

    bind();
    window.addEventListener("resize", bind);
    window.addEventListener("orientationchange", bind);
    document.fonts?.ready?.then(bind).catch(() => {});

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(bind) : null;
    observer?.observe(document.body);

    return () => {
      window.cancelAnimationFrame(frame);
      target?.removeEventListener?.("scroll", update);
      window.removeEventListener("resize", bind);
      window.removeEventListener("orientationchange", bind);
      observer?.disconnect();
    };
  }, []);

  const size = isMobile ? 44 : 48;
  const right = isMobile ? 16 : 24;
  const bottom = `calc(env(safe-area-inset-bottom, 0px) + ${isMobile ? 18 : 28}px + ${avoidBottom}px)`;
  const activeTransform = hovered ? "translateY(0) scale(1.07)" : "translateY(0) scale(1)";

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Back to top"
      title="Back to top"
      data-website-back-to-top="true"
      onClick={() => scrollTargetToTop(scrollTargetRef.current || findScrollableTarget() || window)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        position: "fixed",
        right,
        bottom,
        width: size,
        height: size,
        minWidth: 44,
        minHeight: 44,
        zIndex: 99999,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.24)",
        background: hovered ? "#0ea5e9" : "#0f2f57",
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        boxShadow: hovered
          ? "0 18px 38px rgba(14,165,233,0.4), 0 8px 18px rgba(15,23,42,0.24)"
          : "0 14px 30px rgba(15,23,42,0.34), 0 4px 10px rgba(15,23,42,0.18)",
        cursor: visible ? "pointer" : "default",
        opacity: visible ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? activeTransform : "translateY(10px) scale(1)",
        transition: "opacity 210ms ease, visibility 210ms ease, transform 210ms ease, background 210ms ease, box-shadow 210ms ease",
        WebkitTapHighlightColor: "transparent",
        outlineOffset: 4,
      }}
    >
      <ArrowUp aria-hidden="true" size={isMobile ? 21 : 23} strokeWidth={2.8} />
    </button>
  );
}
