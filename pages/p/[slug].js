// pages/p/[slug].js
// Public funnel page — renders the GrapesJS-saved HTML for each step.
// Routes: /p/my-funnel         → step 1
//         /p/my-funnel?step=2  → step 2
//         /p/my-funnel?ok=1    → thank-you state

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMissingStepPreview(name = "Your funnel") {
  const safeName = escapeHtml(name || "Your funnel");
  return `
    <section style="min-height:100vh;padding:80px 20px;background:linear-gradient(135deg,#0f172a 0%,#111827 100%);color:#ffffff;display:flex;align-items:center;">
      <div style="max-width:880px;margin:0 auto;text-align:center;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(59,130,246,0.18);color:#93c5fd;font-weight:700;font-size:13px;margin-bottom:16px;">Preview ready</div>
        <h1 style="font-size:46px;line-height:1.1;margin:0 0 14px;">${safeName}</h1>
        <p style="max-width:720px;margin:0 auto 22px;color:rgba(255,255,255,0.82);font-size:18px;line-height:1.6;">
          This funnel does not have a saved page yet. Open the editor, add your content, and click Save Page to publish the real design here.
        </p>
      </div>
    </section>
  `.trim();
}

export default function PublicFunnelPage() {
  const router = useRouter();
  const { slug, step: stepParam, ok, funnelId, preview, canvasWidth: canvasWidthParam, device } = router.query;
  const isPreviewMode = `${preview || ""}` === "1";
  const isMobilePreview = isPreviewMode && `${device || ""}` === "mobile";

  const [state, setState] = useState("loading"); // loading | ok | notfound | empty | error
  const [funnel, setFunnel] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);

  useEffect(() => {
    if (!slug && !funnelId) return;

    (async () => {
      try {
        const params = new URLSearchParams();
        if (slug) params.set("slug", slug);
        if (preview === "1" && funnelId) {
          params.set("preview", "1");
          params.set("funnelId", funnelId);
        }
        const res = await fetch(`/api/funnels/public-page?${params.toString()}`);
        if (res.status === 404) { setState("notfound"); return; }
        if (!res.ok) { setState("error"); return; }

        const json = await res.json();
        const resolvedSteps = Array.isArray(json.steps) ? json.steps : [];
        const idx = stepParam ? Math.max(0, parseInt(stepParam, 10) - 1) : 0;
        const fallbackStep = `${preview || ""}` === "1"
          ? {
              id: "preview-empty",
              title: "Page 1",
              content: buildMissingStepPreview(json?.funnel?.name || "Your funnel"),
            }
          : null;

        setFunnel(json.funnel);
        setSteps(resolvedSteps);
        setCurrentStep(resolvedSteps[idx] || resolvedSteps[0] || fallbackStep || null);
        setState(resolvedSteps.length || fallbackStep ? "ok" : "empty");
      } catch {
        setState("error");
      }
    })();
  }, [slug, stepParam, funnelId, preview]);

  useEffect(() => {
    if (!currentStep) return;

    function syncFaqItem(item) {
      if (!item) return;
      const isOpen = item.getAttribute("data-open") !== "false";
      const answer = item.querySelector(".fb-faq-answer");
      const chevron = item.querySelector("[data-faq-chevron]");
      if (answer) answer.style.display = isOpen ? "block" : "none";
      if (chevron) chevron.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
    }

    function handleFaqClick(event) {
      const btn = event.target.closest(".fb-faq-question");
      if (!btn) return;
      const item = btn.closest(".fb-faq-item");
      if (!item) return;
      event.preventDefault();
      const isOpen = item.getAttribute("data-open") !== "false";
      item.setAttribute("data-open", isOpen ? "false" : "true");
      syncFaqItem(item);
    }

    // Always start collapsed on page view.
    document.querySelectorAll(".fb-faq-item").forEach((item) => {
      item.setAttribute("data-open", "false");
      syncFaqItem(item);
    });
    document.addEventListener("click", handleFaqClick);

    return () => {
      document.removeEventListener("click", handleFaqClick);
    };
  }, [currentStep?.id]);

  useEffect(() => {
    if (!currentStep) return;

    function syncShapeBlocks() {
      document.querySelectorAll("[data-shape-block]").forEach((shape) => {
        if (!(shape instanceof HTMLElement)) return;
        shape.style.pointerEvents = "none";

        const parent = shape.parentElement;
        const baseParentWidth = parseFloat(shape.dataset.shapeBaseParentWidth || "0") || 0;
        const baseParentHeight = parseFloat(shape.dataset.shapeBaseParentHeight || "0") || 0;
        const baseLeft = parseFloat(shape.dataset.shapeBaseLeft || "0") || 0;
        const baseTop = parseFloat(shape.dataset.shapeBaseTop || "0") || 0;
        const baseWidth = parseFloat(shape.dataset.shapeBaseWidth || shape.style.width || "0") || 0;
        const baseHeight = parseFloat(shape.dataset.shapeBaseHeight || shape.style.height || "0") || 0;
        const leftPct = parseFloat(shape.dataset.shapeLeftPct || "") || null;
        const topPct = parseFloat(shape.dataset.shapeTopPct || "") || null;
        const widthPct = parseFloat(shape.dataset.shapeWidthPct || "") || null;
        const heightPct = parseFloat(shape.dataset.shapeHeightPct || "") || null;

        if (!(parent instanceof HTMLElement) || !baseParentWidth || !baseWidth || !baseHeight) return;

        const parentRect = parent.getBoundingClientRect();
        const currentParentWidth = parentRect.width || parent.clientWidth || baseParentWidth;
        const currentParentHeight = parentRect.height || parent.clientHeight || baseParentHeight || baseHeight;
        const widthScale = Math.max(0.2, currentParentWidth / baseParentWidth);
        const heightScale = baseParentHeight > 0 ? Math.max(0.2, currentParentHeight / baseParentHeight) : widthScale;

        const nextLeft = leftPct != null
          ? currentParentWidth * leftPct
          : baseLeft * widthScale;
        const nextTop = topPct != null
          ? currentParentHeight * topPct
          : baseTop * heightScale;
        const nextWidth = widthPct != null
          ? currentParentWidth * widthPct
          : baseWidth * widthScale;
        const nextHeight = heightPct != null
          ? currentParentHeight * heightPct
          : baseHeight * heightScale;

        shape.style.left = `${Math.round(nextLeft * 100) / 100}px`;
        shape.style.top = `${Math.round(nextTop * 100) / 100}px`;
        shape.style.width = `${Math.round(nextWidth * 100) / 100}px`;
        shape.style.height = `${Math.round(nextHeight * 100) / 100}px`;
        shape.style.maxWidth = "none";
      });
    }

    const raf = window.requestAnimationFrame(syncShapeBlocks);
    window.addEventListener("resize", syncShapeBlocks);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncShapeBlocks);
    };
  }, [currentStep?.id, canvasWidthParam, isPreviewMode]);

  useEffect(() => {
    if (!currentStep) return;

    const timers = [];

    function format2(value) {
      return `${Math.max(0, value)}`.padStart(2, "0");
    }

    function setTimerValues(hoursEl, minutesEl, secondsEl, totalSeconds) {
      const safe = Math.max(0, totalSeconds);
      const h = Math.floor(safe / 3600);
      const m = Math.floor((safe % 3600) / 60);
      const s = safe % 60;
      if (hoursEl) hoursEl.textContent = format2(h);
      if (minutesEl) minutesEl.textContent = format2(m);
      if (secondsEl) secondsEl.textContent = format2(s);
    }

    function startCountdown(hoursEl, minutesEl, secondsEl, startSeconds) {
      let remaining = Math.max(0, startSeconds);
      setTimerValues(hoursEl, minutesEl, secondsEl, remaining);
      const id = window.setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        setTimerValues(hoursEl, minutesEl, secondsEl, remaining);
        if (remaining <= 0) window.clearInterval(id);
      }, 1000);
      timers.push(id);
    }

    // New countdown blocks with explicit data hooks
    document.querySelectorAll("[data-countdown-root]").forEach((root) => {
      const hoursEl = root.querySelector("[data-countdown-hours]");
      const minutesEl = root.querySelector("[data-countdown-minutes]");
      const secondsEl = root.querySelector("[data-countdown-seconds]");
      const startSeconds = parseInt(root.getAttribute("data-seconds") || "36000", 10);
      startCountdown(hoursEl, minutesEl, secondsEl, Number.isFinite(startSeconds) ? startSeconds : 36000);
    });

    // Legacy countdown blocks already saved in steps (no data attributes)
    document.querySelectorAll("section").forEach((section) => {
      if (section.querySelector("[data-countdown-root]")) return;
      if (!/timer hits zero/i.test(section.textContent || "")) return;

      const groups = Array.from(section.querySelectorAll("div")).filter((el) => {
        const children = Array.from(el.children || []);
        if (children.length !== 2) return false;
        const label = (children[1].textContent || "").trim().toUpperCase();
        return ["HOURS", "MINS", "SECS"].includes(label);
      });

      if (groups.length < 3) return;

      const byLabel = {
        HOURS: null,
        MINS: null,
        SECS: null,
      };
      groups.forEach((g) => {
        const label = (g.children[1]?.textContent || "").trim().toUpperCase();
        if (byLabel[label] == null) byLabel[label] = g.children[0];
      });

      if (!byLabel.HOURS || !byLabel.MINS || !byLabel.SECS) return;

      const h = parseInt((byLabel.HOURS.textContent || "0").trim(), 10) || 0;
      const m = parseInt((byLabel.MINS.textContent || "0").trim(), 10) || 0;
      const s = parseInt((byLabel.SECS.textContent || "0").trim(), 10) || 0;
      const startSeconds = Math.max(0, h * 3600 + m * 60 + s);
      startCountdown(byLabel.HOURS, byLabel.MINS, byLabel.SECS, startSeconds || 36000);
    });

    return () => {
      timers.forEach((id) => window.clearInterval(id));
    };
  }, [currentStep?.id]);

  // Thank-you screen
  if (ok === "1" || ok === "true") {
    return (
      <>
        <Head><title>Thank you!</title></Head>
        <div style={tyWrap}>
          <div style={tyCard}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h1 style={{ margin: "0 0 10px", fontSize: 32, color: "#e6eef5" }}>Thank you!</h1>
            <p style={{ color: "#a5b5c3", margin: 0 }}>You're all set. Check your inbox for next steps.</p>
          </div>
        </div>
      </>
    );
  }

  if (state === "loading") {
    return (
      <div style={centred}>
        <div style={spinner} />
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <>
        <Head><title>Not found</title></Head>
        <div style={centred}>
          <h2 style={{ color: "#e6eef5" }}>Page not found</h2>
          <p style={{ color: "#a5b5c3" }}>This funnel does not exist or has been unpublished.</p>
        </div>
      </>
    );
  }

  if (state === "empty") {
    return (
      <>
        <Head><title>No pages yet</title></Head>
        <div style={centred}>
          <h2 style={{ color: "#e6eef5" }}>No saved pages yet</h2>
          <p style={{ color: "#a5b5c3", maxWidth: 560, textAlign: "center" }}>
            This funnel exists, but it does not have any saved pages to display yet.
          </p>
        </div>
      </>
    );
  }

  if (state === "error" || !currentStep) {
    return (
      <>
        <Head><title>Error</title></Head>
        <div style={centred}>
          <h2 style={{ color: "#e6eef5" }}>Something went wrong</h2>
          <p style={{ color: "#a5b5c3" }}>Please try again later.</p>
        </div>
      </>
    );
  }

  const stepIndex = steps.findIndex((s) => s.id === currentStep.id);
  const totalSteps = steps.length;
  const parsedCanvasWidth = parseInt(`${canvasWidthParam || ""}`, 10);
  const previewCanvasWidth = Number.isFinite(parsedCanvasWidth) && parsedCanvasWidth > 0
    ? parsedCanvasWidth
    : 1002;
  const previewShellStyle = isPreviewMode
    ? {
        width: isMobilePreview ? 390 : previewCanvasWidth,
        maxWidth: "100%",
        margin: "0 auto",
        minHeight: "100vh",
        background: "#ffffff",
        boxShadow: "0 24px 64px rgba(15, 23, 42, 0.18)",
        overflow: "hidden",
      }
    : null;

  return (
    <>
      <Head>
        <title>{funnel?.name || "Funnel"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #0c121a; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
          .fb-preview-root, .fb-preview-root * { box-sizing: border-box; }
          .fb-preview-root [style*="display:grid"] > :not([style*="position:absolute"]):not([style*="position: absolute"]),
          .fb-preview-root [style*="display: grid"] > :not([style*="position:absolute"]):not([style*="position: absolute"]),
          .fb-preview-root [style*="display:flex"] > :not([style*="position:absolute"]):not([style*="position: absolute"]),
          .fb-preview-root [style*="display: flex"] > :not([style*="position:absolute"]):not([style*="position: absolute"]) {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .fb-preview-root [style*="display:grid"] > :not([style*="position:absolute"]):not([style*="position: absolute"]) > :not([style*="position:absolute"]):not([style*="position: absolute"]),
          .fb-preview-root [style*="display: grid"] > :not([style*="position:absolute"]):not([style*="position: absolute"]) > :not([style*="position:absolute"]):not([style*="position: absolute"]),
          .fb-preview-root [style*="display:flex"] > :not([style*="position:absolute"]):not([style*="position: absolute"]) > :not([style*="position:absolute"]):not([style*="position: absolute"]),
          .fb-preview-root [style*="display: flex"] > :not([style*="position:absolute"]):not([style*="position: absolute"]) > :not([style*="position:absolute"]):not([style*="position: absolute"]) {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .fb-preview-root img,
          .fb-preview-root svg,
          .fb-preview-root video,
          .fb-preview-root iframe {
            max-width: 100%;
          }
        `}</style>
      </Head>

      {/* Multi-step progress bar */}
      {totalSteps > 1 && (
        <div style={progressBarWrap}>
          <div style={{ ...progressBar, width: `${((stepIndex + 1) / totalSteps) * 100}%` }} />
        </div>
      )}

      {/* Rendered page content */}
      <div style={previewShellStyle || undefined}>
        <div
          dangerouslySetInnerHTML={{ __html: currentStep.content || "" }}
          className="fb-preview-root"
          style={{ minHeight: "100vh" }}
        />
      </div>

      {/* Step navigation for multi-step funnels */}
      {totalSteps > 1 && (
        <div style={stepNav}>
          {stepIndex > 0 && (
            <button
              onClick={() => router.push(`/p/${slug}?step=${stepIndex}`)}
              style={backBtn}
            >
              ← Back
            </button>
          )}
          <span style={{ color: "#6a7a89", fontSize: 13 }}>
            Step {stepIndex + 1} of {totalSteps}
          </span>
          {stepIndex < totalSteps - 1 && (
            <button
              onClick={() => router.push(`/p/${slug}?step=${stepIndex + 2}`)}
              style={nextBtn}
            >
              Next →
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* --- styles --- */
const centred = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#0c121a",
  color: "#e6eef5",
};

const tyWrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0c121a",
};

const tyCard = {
  background: "#0f1318",
  border: "1px solid #2b2f36",
  borderRadius: 16,
  padding: "48px 40px",
  textAlign: "center",
  maxWidth: 480,
  width: "90%",
};

const spinner = {
  width: 36,
  height: 36,
  border: "3px solid #2b2f36",
  borderTop: "3px solid #2d6cdf",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const progressBarWrap = {
  height: 4,
  background: "#1e2530",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const progressBar = {
  height: "100%",
  background: "#2d6cdf",
  transition: "width 0.4s ease",
};

const stepNav = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  background: "#0f1318",
  borderTop: "1px solid #1e2530",
};

const backBtn = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #2b2f36",
  background: "#151a21",
  color: "#e6eef5",
  cursor: "pointer",
  fontSize: 13,
};

const nextBtn = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2d6cdf",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
};
