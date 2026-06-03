/**
 * create-test-page.cjs
 *
 * Adds a "Test Page" to the Gr8 Result website project, demonstrating
 * every major layout/animation pattern available in the builder.
 *
 * Run: node scripts/create-test-page.cjs
 */

require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();

function block(type, props) {
  return { id: uid(), type, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 1 — Animated Cycling-Word Hero (custom-html)
// Demonstrates: CSS @keyframes word-swap, scroll indicator, gradient CTA buttons
// ─────────────────────────────────────────────────────────────────────────────
const CYCLING_HERO_HTML = `
<section style="min-height:100vh;background:linear-gradient(135deg,#0a0a0f 0%,#0d1b2a 60%,#0a0a0f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px;position:relative;overflow:hidden;">
  <style>
    .ch-eyebrow{font-family:'Inter',system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#6366f1;margin-bottom:28px;padding:6px 18px;border:1px solid rgba(99,102,241,.35);border-radius:99px;display:inline-block}
    .ch-headline{font-family:'Inter',system-ui,sans-serif;font-size:clamp(44px,7vw,86px);font-weight:900;line-height:1.05;color:#fff;margin:0 0 4px;letter-spacing:-.02em}
    .ch-cycle-wrap{display:inline-flex;overflow:hidden;height:1.12em;vertical-align:bottom;position:relative}
    .ch-cycle{display:flex;flex-direction:column;animation:ch-slide 10s cubic-bezier(.4,0,.2,1) infinite}
    .ch-cycle span{height:1.12em;display:block;color:#818cf8;white-space:nowrap}
    @keyframes ch-slide{
      0%,14%{transform:translateY(0)}
      20%,34%{transform:translateY(-16.667%)}
      40%,54%{transform:translateY(-33.333%)}
      60%,74%{transform:translateY(-50%)}
      80%,94%{transform:translateY(-66.667%)}
      100%{transform:translateY(0)}
    }
    .ch-sub{font-family:'Inter',system-ui,sans-serif;font-size:clamp(16px,2vw,21px);color:rgba(255,255,255,.6);max-width:600px;margin:32px auto 44px;line-height:1.75}
    .ch-ctas{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
    .ch-btn-primary{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff;padding:16px 38px;border-radius:14px;font-size:16px;font-weight:700;text-decoration:none;transition:transform .2s,box-shadow .2s;font-family:'Inter',system-ui,sans-serif;box-shadow:0 4px 24px rgba(99,102,241,.3)}
    .ch-btn-primary:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(99,102,241,.45)}
    .ch-btn-ghost{background:rgba(255,255,255,.07);color:#fff;padding:16px 38px;border-radius:14px;font-size:16px;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,.14);font-family:'Inter',system-ui,sans-serif;transition:background .2s}
    .ch-btn-ghost:hover{background:rgba(255,255,255,.12)}
    .ch-glow{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.15) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
    .ch-scroll{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;color:rgba(255,255,255,.25);font-family:'Inter',system-ui,sans-serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
    .ch-scroll-bar{width:2px;height:32px;background:rgba(255,255,255,.1);border-radius:2px;position:relative;overflow:hidden}
    .ch-scroll-dot{width:2px;height:14px;background:#6366f1;border-radius:2px;position:absolute;top:0;animation:ch-scroll-anim 1.8s ease-in-out infinite}
    @keyframes ch-scroll-anim{0%{top:-14px}100%{top:32px}}
  </style>
  <div class="ch-glow"></div>
  <div class="ch-eyebrow">All-In-One Business Platform</div>
  <h1 class="ch-headline">
    Stop losing&nbsp;<span class="ch-cycle-wrap"><span class="ch-cycle">
      <span>leads</span>
      <span>time</span>
      <span>revenue</span>
      <span>clients</span>
      <span>leads</span>
    </span></span>
  </h1>
  <p class="ch-sub">Gr8 Result gives your agency one platform for CRM, email, funnels, automation, and reporting — so your team can focus on results, not switching tabs.</p>
  <div class="ch-ctas">
    <a href="#" class="ch-btn-primary">Get a Free Demo</a>
    <a href="#" class="ch-btn-ghost">See the Platform</a>
  </div>
  <div class="ch-scroll"><span>Scroll</span><div class="ch-scroll-bar"><div class="ch-scroll-dot"></div></div></div>
</section>
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 2 — Horizontal Scrolling Marquee Strip
// Demonstrates: infinite CSS scroll marquee with industry keywords
// ─────────────────────────────────────────────────────────────────────────────
const MARQUEE_BLOCK = block("marquee-strip", {
  items: [
    { text: "CRM & Pipeline", icon: "✦" },
    { text: "Email Automation", icon: "✦" },
    { text: "Funnel Builder", icon: "✦" },
    { text: "AI Phone System", icon: "✦" },
    { text: "Social Scheduler", icon: "✦" },
    { text: "Website Builder", icon: "✦" },
    { text: "Affiliate Management", icon: "✦" },
    { text: "Project Intelligence", icon: "✦" },
    { text: "SMS & Broadcasts", icon: "✦" },
    { text: "Reporting & Analytics", icon: "✦" },
  ],
  speed: 35,
  direction: "left",
  backgroundColor: "#0f172a",
  textColor: "#94a3b8",
  accentColor: "#6366f1",
  fontSize: 14,
  fontWeight: "600",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  paddingY: 18,
  gap: 48,
  duplicateCount: 2,
  pauseOnHover: true,
  divider: "dot",
  borderTop: "1px solid rgba(255,255,255,.06)",
  borderBottom: "1px solid rgba(255,255,255,.06)",
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 3 — Animated Stats Counter Section
// Demonstrates: scroll-triggered count-up numbers, spotlight-orbs variant
// ─────────────────────────────────────────────────────────────────────────────
const STATS_BLOCK = block("stats", {
  statsVariant: "spotlight-orbs",
  backgroundColor: "#0a0a0f",
  backgroundGradient: "linear-gradient(180deg,#0a0a0f 0%,#0d1b2a 100%)",
  accentColor: "#6366f1",
  eyebrow: "By the numbers",
  title: "Real results for real businesses",
  textColor: "#ffffff",
  subtleColor: "rgba(255,255,255,.5)",
  sectionAnimation: "fade-up",
  cardAnimation: "fade-up",
  cardStagger: 0.15,
  animationSpeed: 0.9,
  countDuration: 2200,
  items: [
    {
      id: uid(),
      value: 4800,
      prefix: "",
      suffix: "+",
      label: "Active Users",
      description: "Businesses running on the Gr8 Result platform right now",
    },
    {
      id: uid(),
      value: 94,
      prefix: "",
      suffix: "%",
      label: "Client Retention",
      description: "Average 12-month retention rate across all plan tiers",
    },
    {
      id: uid(),
      value: 3,
      prefix: "",
      suffix: "x",
      label: "Revenue Growth",
      description: "Average revenue increase reported by clients after 6 months",
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 4 — Trust Badges / Logo Grid
// Demonstrates: client logo strip with brand logos
// ─────────────────────────────────────────────────────────────────────────────
const TRUST_BADGES_BLOCK = block("trust-badges", {
  title: "Trusted by leading digital agencies",
  titleVisible: true,
  titleAlignment: "center",
  badgeVariant: "logo-row",
  backgroundColor: "#0d1b2a",
  textColor: "rgba(255,255,255,.35)",
  columns: 5,
  logoHeight: 36,
  grayscale: true,
  hoverColor: true,
  paddingY: 56,
  sectionAnimation: "fade-up",
  items: [
    { id: uid(), image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/1200px-Google_2015_logo.svg.png", alt: "Google" },
    { id: uid(), image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/1200px-Netflix_2015_logo.svg.png", alt: "Netflix" },
    { id: uid(), image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1200px-Amazon_logo.svg.png", alt: "Amazon" },
    { id: uid(), image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Microsoft_logo_%282012%29.svg/1280px-Microsoft_logo_%282012%29.svg.png", alt: "Microsoft" },
    { id: uid(), image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/1200px-Spotify_logo_without_text.svg.png", alt: "Spotify" },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 5 — Problem Statement Section (dark, large centered headline)
// Demonstrates: parallax section, full-width dark bg, dramatic typography
// ─────────────────────────────────────────────────────────────────────────────
const PROBLEM_STATEMENT_BLOCK = block("parallax", {
  headline: "Most agencies are duct-taping 10 tools together.",
  subheadline: "CRM here. Email there. Reporting somewhere else. Every tool costs money, creates gaps, and burns your team's time. There's a better way.",
  ctaText: "See the All-In-One Solution",
  ctaLink: "#features",
  headlineAlignment: "center",
  verticalAlign: "center",
  contentX: 50,
  contentY: 58,
  contentWidth: 820,
  contentHeight: 320,
  headlineColor: "#ffffff",
  headlineFontFamily: "'Inter', system-ui, sans-serif",
  headlineFontWeight: "900",
  headlineFontSize: 56,
  subheadlineFontSize: 20,
  textColor: "rgba(255,255,255,.65)",
  fontFamily: "'Inter', system-ui, sans-serif",
  fontWeight: "400",
  buttonColor: "#6366f1",
  buttonTextColor: "#ffffff",
  fullWidthBackground: true,
  enableParallax: true,
  backgroundStyle: "color",
  backgroundColor: "#050810",
  backgroundImage: "",
  backgroundVideoUrl: "",
  backgroundPosition: "center center",
  minHeight: "480px",
  sectionAnimation: "fade-up",
  sectionAnimationDelay: 0,
  sectionAnimationSpeed: 0.9,
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 6 — Split Feature Section 1 (image left, text right)
// Demonstrates: split-block with parallax image, fade-up text, FAQ accordion
// ─────────────────────────────────────────────────────────────────────────────
const SPLIT_FEATURE_1 = block("split-block", {
  splitColorPreset: "violet",
  eyebrow: "CRM & Pipeline",
  headline: "See every deal, every stage, every opportunity.",
  subheadline: "Gr8 Result's visual pipeline gives your sales team a real-time view of every deal in your funnel — with smart reminders, scoring, and one-click actions built right in.",
  headlineBlock: {
    content: "See every deal, every stage, every opportunity.",
    animation: "fade-up",
    animationDelay: 0,
    animationSpeed: 0.85,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "800",
    fontSize: 44,
    lineHeight: 1.15,
    color: "#818cf8",
    alignment: "left",
  },
  bodyBlock: {
    content: "Gr8 Result's visual pipeline gives your sales team a real-time view of every deal in your funnel — with smart reminders, lead scoring, and one-click actions.",
    animation: "fade-in",
    animationDelay: 0.14,
    animationSpeed: 0.9,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "400",
    fontSize: 18,
    lineHeight: 1.7,
    color: "rgba(255,255,255,.65)",
    alignment: "left",
  },
  splitLayout: "50-50",
  fullWidthBackground: true,
  enableParallax: true,
  backgroundStyle: "image",
  backgroundColor: "#0a0a0f",
  backgroundImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
  backgroundPosition: "center center",
  backgroundSize: "cover",
  parallaxStrength: 0.75,
  minHeight: "680px",
  contentPanelBackgroundColor: "rgba(10,10,15,.92)",
  sectionBackgroundColor: "#0a0a0f",
  headlineColor: "#818cf8",
  eyebrowColor: "linear-gradient(90deg,#6366f1 0%,#a78bfa 100%)",
  textColor: "rgba(255,255,255,.65)",
  faqBlock: {
    faqVariant: "source-split",
    faqStartCollapsed: false,
    faqAllowMultipleOpen: false,
    sectionAnimation: "fade-up",
    sectionAnimationDelay: 0.12,
    sectionAnimationSpeed: 0.9,
    faqAnimation: "fade-up",
    faqAnimationDelay: 0.18,
    faqAnimationSpeed: 0.9,
    faqPanelBackgroundColor: "rgba(15,20,40,.4)",
    itemBackgroundColor: "transparent",
    itemBorderColor: "rgba(99,102,241,.25)",
    arrowBackgroundColor: "linear-gradient(135deg,#3730a3 0%,#6366f1 52%,#818cf8 100%)",
    chevronColor: "#ffffff",
    questionColor: "#ffffff",
    questionFontWeight: "700",
    questionFontSize: 18,
    questionLineHeight: 1.4,
    answerColor: "rgba(255,255,255,.65)",
    answerFontSize: 16,
    answerLineHeight: 1.6,
    faqMaxWidth: 340,
    items: [
      { id: uid(), question: "Does it replace my current CRM?", answer: "Yes — Gr8 Result's CRM is built to be your primary pipeline tool. Import your contacts in minutes.", heading: "Does it replace my current CRM?", content: "Yes — Gr8 Result's CRM is built to be your primary pipeline tool." },
      { id: uid(), question: "How many pipelines can I create?", answer: "Growth and above plans include unlimited pipelines — segment by product, region, or team.", heading: "How many pipelines?", content: "Growth and above plans include unlimited pipelines." },
      { id: uid(), question: "Can my whole team use it?", answer: "Every plan includes team seats. Add users and set permission levels easily from Settings.", heading: "Multi-user support?", content: "Every plan includes team seats with configurable permissions." },
    ],
  },
  items: [
    { id: uid(), question: "Does it replace my current CRM?", answer: "Yes — Gr8 Result's CRM is built to be your primary pipeline tool.", heading: "Replace my CRM?", content: "Yes." },
    { id: uid(), question: "How many pipelines?", answer: "Growth and above plans include unlimited pipelines.", heading: "Unlimited pipelines?", content: "Growth plans and above." },
    { id: uid(), question: "Multi-user support?", answer: "Every plan includes team seats.", heading: "Team access?", content: "All plans include team seats." },
  ],
  ctaText: "Explore CRM",
  ctaLink: "#",
  ctaButtonColor: "#6366f1",
  ctaButtonTextColor: "#ffffff",
  showCta: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 7 — Split Feature Section 2 (text left, image right — reversed)
// ─────────────────────────────────────────────────────────────────────────────
const SPLIT_FEATURE_2 = block("split-block", {
  splitColorPreset: "cyan",
  eyebrow: "Email Marketing",
  headline: "Automate your email marketing. Keep it personal.",
  subheadline: "Build drip sequences, broadcast campaigns, and AI-personalised emails that land in inboxes — not spam folders. Drag, drop, send.",
  headlineBlock: {
    content: "Automate your email. Keep it personal.",
    animation: "fade-up",
    animationDelay: 0,
    animationSpeed: 0.85,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "800",
    fontSize: 44,
    lineHeight: 1.15,
    color: "#22d3ee",
    alignment: "left",
  },
  bodyBlock: {
    content: "Build drip sequences, broadcast campaigns, and AI-personalised emails that land in inboxes — not spam folders. Drag, drop, send.",
    animation: "fade-in",
    animationDelay: 0.14,
    animationSpeed: 0.9,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "400",
    fontSize: 18,
    lineHeight: 1.7,
    color: "rgba(255,255,255,.65)",
    alignment: "left",
  },
  splitLayout: "57-43",
  imageLeft: false,
  fullWidthBackground: true,
  enableParallax: true,
  backgroundStyle: "image",
  backgroundColor: "#050a14",
  backgroundImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80",
  backgroundPosition: "center center",
  backgroundSize: "cover",
  parallaxStrength: 0.75,
  minHeight: "680px",
  contentPanelBackgroundColor: "rgba(5,10,20,.92)",
  sectionBackgroundColor: "#050a14",
  headlineColor: "#22d3ee",
  eyebrowColor: "linear-gradient(90deg,#0ea5e9 0%,#22d3ee 100%)",
  textColor: "rgba(255,255,255,.65)",
  faqBlock: {
    faqVariant: "source-split",
    faqStartCollapsed: false,
    faqAllowMultipleOpen: true,
    sectionAnimation: "fade-up",
    sectionAnimationDelay: 0.12,
    sectionAnimationSpeed: 0.9,
    faqAnimation: "fade-up",
    faqAnimationDelay: 0.18,
    faqAnimationSpeed: 0.9,
    faqPanelBackgroundColor: "rgba(5,15,30,.4)",
    itemBackgroundColor: "transparent",
    itemBorderColor: "rgba(14,165,233,.25)",
    arrowBackgroundColor: "linear-gradient(135deg,#0369a1 0%,#0ea5e9 52%,#22d3ee 100%)",
    chevronColor: "#ffffff",
    questionColor: "#ffffff",
    questionFontWeight: "700",
    questionFontSize: 18,
    questionLineHeight: 1.4,
    answerColor: "rgba(255,255,255,.65)",
    answerFontSize: 16,
    answerLineHeight: 1.6,
    faqMaxWidth: 340,
    items: [
      { id: uid(), question: "Does it integrate with SendGrid?", answer: "Yes — Gr8 Result uses SendGrid for deliverability and integrates directly with your domain.", heading: "SendGrid integration?", content: "Yes, built in." },
      { id: uid(), question: "Can I segment my list?", answer: "Advanced segmentation is available on Growth and above plans — by tag, behaviour, lead score, and more.", heading: "List segmentation?", content: "Available on Growth+ plans." },
      { id: uid(), question: "What's the deliverability rate?", answer: "Gr8 Result achieves 99%+ inbox rates through SPF/DKIM/DMARC setup and smart sending.", heading: "Deliverability?", content: "99%+ inbox rate with proper domain setup." },
    ],
  },
  items: [
    { id: uid(), question: "SendGrid integration?", answer: "Yes, built in.", heading: "SendGrid integration?", content: "Yes." },
    { id: uid(), question: "List segmentation?", answer: "Available on Growth+ plans.", heading: "Segmentation?", content: "Growth+ plans." },
    { id: uid(), question: "Deliverability?", answer: "99%+ inbox rate.", heading: "Deliverability?", content: "99%+." },
  ],
  ctaText: "Explore Email Marketing",
  ctaLink: "#",
  ctaButtonColor: "#0ea5e9",
  ctaButtonTextColor: "#ffffff",
  showCta: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 8 — Split Feature Section 3 (image left, text right)
// ─────────────────────────────────────────────────────────────────────────────
const SPLIT_FEATURE_3 = block("split-block", {
  splitColorPreset: "green",
  eyebrow: "Automation",
  headline: "Build automation workflows that actually work.",
  subheadline: "From lead capture to closed deal to onboarding — build trigger-based workflows that nurture, follow up, and close without your team lifting a finger.",
  headlineBlock: {
    content: "Build automation workflows that actually work.",
    animation: "fade-up",
    animationDelay: 0,
    animationSpeed: 0.85,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "800",
    fontSize: 44,
    lineHeight: 1.15,
    color: "#4ade80",
    alignment: "left",
  },
  bodyBlock: {
    content: "From lead capture to closed deal to onboarding — trigger-based workflows that nurture, follow up, and close without your team lifting a finger.",
    animation: "fade-in",
    animationDelay: 0.14,
    animationSpeed: 0.9,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "400",
    fontSize: 18,
    lineHeight: 1.7,
    color: "rgba(255,255,255,.65)",
    alignment: "left",
  },
  splitLayout: "50-50",
  fullWidthBackground: true,
  enableParallax: true,
  backgroundStyle: "image",
  backgroundColor: "#030c0a",
  backgroundImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  backgroundPosition: "center center",
  backgroundSize: "cover",
  parallaxStrength: 0.75,
  minHeight: "680px",
  contentPanelBackgroundColor: "rgba(3,12,10,.92)",
  sectionBackgroundColor: "#030c0a",
  headlineColor: "#4ade80",
  eyebrowColor: "linear-gradient(90deg,#16a34a 0%,#4ade80 100%)",
  textColor: "rgba(255,255,255,.65)",
  faqBlock: {
    faqVariant: "source-split",
    faqStartCollapsed: false,
    faqAllowMultipleOpen: false,
    sectionAnimation: "fade-up",
    sectionAnimationDelay: 0.12,
    sectionAnimationSpeed: 0.9,
    faqAnimation: "fade-up",
    faqAnimationDelay: 0.18,
    faqAnimationSpeed: 0.9,
    faqPanelBackgroundColor: "rgba(5,20,10,.4)",
    itemBackgroundColor: "transparent",
    itemBorderColor: "rgba(74,222,128,.22)",
    arrowBackgroundColor: "linear-gradient(135deg,#14532d 0%,#16a34a 52%,#4ade80 100%)",
    chevronColor: "#ffffff",
    questionColor: "#ffffff",
    questionFontWeight: "700",
    questionFontSize: 18,
    questionLineHeight: 1.4,
    answerColor: "rgba(255,255,255,.65)",
    answerFontSize: 16,
    answerLineHeight: 1.6,
    faqMaxWidth: 340,
    items: [
      { id: uid(), question: "How many workflows can I build?", answer: "Growth plan includes 15 workflows. Scale and Professional plans have unlimited.", heading: "Workflow limits?", content: "Growth: 15. Scale+: unlimited." },
      { id: uid(), question: "Does it support webhooks?", answer: "Yes — you can trigger workflows via incoming webhooks and send data to any third-party endpoint.", heading: "Webhooks?", content: "Full webhook support included." },
      { id: uid(), question: "Can I connect n8n or Zapier?", answer: "Advanced integration with n8n is available natively. Zapier integration is available on request.", heading: "n8n / Zapier?", content: "n8n natively. Zapier on request." },
    ],
  },
  items: [
    { id: uid(), question: "Workflow limits?", answer: "Growth: 15. Scale+: unlimited.", heading: "Workflow limits?", content: "Growth 15, Scale+ unlimited." },
    { id: uid(), question: "Webhooks?", answer: "Full support.", heading: "Webhooks?", content: "Yes, full webhook support." },
    { id: uid(), question: "n8n / Zapier?", answer: "n8n natively.", heading: "n8n / Zapier?", content: "n8n native, Zapier on request." },
  ],
  ctaText: "Explore Automation",
  ctaLink: "#",
  ctaButtonColor: "#16a34a",
  ctaButtonTextColor: "#ffffff",
  showCta: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 9 — Testimonials Carousel
// Demonstrates: testimonial block with stacked-card variant + 5 entries
// ─────────────────────────────────────────────────────────────────────────────
const TESTIMONIALS_BLOCK = block("testimonial", {
  testimonialVariant: "stacked-card",
  spacingScale: "normal",
  backgroundColor: "#0a0a0f",
  textColor: "#ffffff",
  cardBackgroundColor: "#0f1729",
  cardBorderColor: "rgba(99,102,241,.2)",
  accentColor: "#6366f1",
  eyebrow: "Client Stories",
  title: "The platform agencies can't stop talking about",
  sectionAnimation: "fade-up",
  autoplay: true,
  autoplaySpeed: 5000,
  items: [
    {
      id: uid(),
      text: "We switched to Gr8 Result six months ago and cut our tool stack from 9 apps to 1. Our team saves 12 hours a week and our lead-to-close rate is up 40%.",
      author: "Sarah Mitchell",
      role: "CEO, Elevate Digital Agency",
      avatar: "https://i.pravatar.cc/80?img=47",
      rating: 5,
    },
    {
      id: uid(),
      text: "The CRM and email automation alone are worth the price. But the AI phone system? That's what blew our team away. We're handling 3× the leads without adding headcount.",
      author: "James Okafor",
      role: "Founder, Apex Growth Co.",
      avatar: "https://i.pravatar.cc/80?img=12",
      rating: 5,
    },
    {
      id: uid(),
      text: "Their onboarding team had us live in under a week. The website builder replaced our old drag-and-drop tool and the funnel templates are stunning.",
      author: "Priya Nair",
      role: "Marketing Director, LaunchLab",
      avatar: "https://i.pravatar.cc/80?img=31",
      rating: 5,
    },
    {
      id: uid(),
      text: "I've tried every all-in-one platform. Gr8 Result is the first one that doesn't sacrifice depth for breadth. Best decision we made this year.",
      author: "Tom Hargreaves",
      role: "Operations Manager, Sprint Media",
      avatar: "https://i.pravatar.cc/80?img=57",
      rating: 5,
    },
    {
      id: uid(),
      text: "Finally a platform that thinks like an agency. The reporting, the pipelines, the automation — it all clicks together. Support team is exceptional too.",
      author: "Angela Yip",
      role: "Head of Growth, NovaSpark",
      avatar: "https://i.pravatar.cc/80?img=23",
      rating: 5,
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 10 — Feature Accordion
// Demonstrates: two-column expandable feature panels with image + stats
// ─────────────────────────────────────────────────────────────────────────────
const FEATURE_ACCORDION_BLOCK = block("feature-accordion", {
  eyebrow: "Platform Capabilities",
  title: "Everything you need to grow. Nothing you don't.",
  backgroundColor: "#0d1b2a",
  textColor: "#ffffff",
  accentColor: "#6366f1",
  imagePosition: "right",
  cardInset: 24,
  cardGap: 16,
  cardHeight: 440,
  items: [
    {
      id: uid(),
      label: "Visual Funnel Builder",
      panelBg: "#3730a3",
      accentColor: "#818cf8",
      image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Funnel builder interface",
      contentBlocks: [
        { id: uid(), type: "eyebrow", text: "Funnels" },
        { id: uid(), type: "heading", text: "Build high-converting funnels without code" },
        { id: uid(), type: "text", text: "Drag-and-drop funnel pages with A/B testing, conversion tracking, and real-time analytics built right in." },
        { id: uid(), type: "stat", number: "60+", label: "funnel templates" },
        { id: uid(), type: "stat", number: "3.4×", label: "average conversion lift" },
        { id: uid(), type: "tags", tags: ["Drag & Drop", "A/B Testing", "Analytics"] },
        { id: uid(), type: "cta", text: "Explore Funnels", link: "#" },
      ],
    },
    {
      id: uid(),
      label: "AI Reporting Dashboard",
      panelBg: "#0c4a6e",
      accentColor: "#38bdf8",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Analytics dashboard",
      contentBlocks: [
        { id: uid(), type: "eyebrow", text: "Reporting" },
        { id: uid(), type: "heading", text: "Know your numbers. Grow your business." },
        { id: uid(), type: "text", text: "Real-time dashboards for every team. Track pipeline velocity, email performance, ad spend, and team utilisation from one view." },
        { id: uid(), type: "stat", number: "35+", label: "report types" },
        { id: uid(), type: "stat", number: "Real-time", label: "data refresh" },
        { id: uid(), type: "tags", tags: ["Dashboards", "Pipeline", "ROI"] },
        { id: uid(), type: "cta", text: "See Reporting", link: "#" },
      ],
    },
    {
      id: uid(),
      label: "AI Telephone System",
      panelBg: "#14532d",
      accentColor: "#4ade80",
      image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Phone system interface",
      contentBlocks: [
        { id: uid(), type: "eyebrow", text: "Telephony" },
        { id: uid(), type: "heading", text: "An AI phone system that never sleeps" },
        { id: uid(), type: "text", text: "Inbound call routing, AI transcription, call scoring, and CRM logging — all automated. Never miss a lead again." },
        { id: uid(), type: "stat", number: "99.9%", label: "uptime SLA" },
        { id: uid(), type: "stat", number: "AI", label: "call transcription" },
        { id: uid(), type: "tags", tags: ["Inbound", "AI", "Transcription"] },
        { id: uid(), type: "cta", text: "Explore Telephony", link: "#" },
      ],
    },
    {
      id: uid(),
      label: "Affiliate Management",
      panelBg: "#4a1d96",
      accentColor: "#c4b5fd",
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Affiliate dashboard",
      contentBlocks: [
        { id: uid(), type: "eyebrow", text: "Affiliates" },
        { id: uid(), type: "heading", text: "Turn your clients into your best sales team" },
        { id: uid(), type: "text", text: "Launch and manage affiliate programmes with unique links, automated commission tracking, and instant payouts." },
        { id: uid(), type: "stat", number: "Instant", label: "commission tracking" },
        { id: uid(), type: "stat", number: "Unlimited", label: "affiliate partners" },
        { id: uid(), type: "tags", tags: ["Affiliates", "Commissions", "Growth"] },
        { id: uid(), type: "cta", text: "Explore Affiliates", link: "#" },
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 11 — Resource / CTA Cards Grid (3 cards)
// Demonstrates: grid-section with card animations, icons, and CTA links
// ─────────────────────────────────────────────────────────────────────────────
const RESOURCE_CARDS_BLOCK = block("grid-section", {
  title: "Resources to get you started faster",
  columns: 3,
  backgroundColor: "#0a0a0f",
  backgroundGradient: "linear-gradient(180deg,#0a0a0f 0%,#0d1b2a 100%)",
  textColor: "#ffffff",
  borderColor: "rgba(99,102,241,.15)",
  columnBackgroundColor: "#0f1729",
  columnBorderColor: "rgba(99,102,241,.2)",
  columnTitleColor: "#ffffff",
  columnBodyColor: "rgba(255,255,255,.6)",
  columnPadding: 28,
  columnRadius: 20,
  columnShadow: "glow",
  columnContentAlign: "left",
  columnGap: 24,
  columnsTopMargin: 40,
  blockMaxWidth: 1100,
  stretchToCanvas: false,
  sectionAnimation: "fade-up",
  cardAnimation: "fade-up",
  iconAnimation: "fade-up",
  imageAnimation: "zoom",
  titleAnimation: "fade-up",
  bodyAnimation: "fade-up",
  surfaceAnimationSpeed: 0.8,
  cardStagger: 0.12,
  gridVariant: "services",
  iconBackgroundColor: "rgba(99,102,241,.15)",
  iconColor: "#818cf8",
  iconSize: 24,
  imageRadius: 14,
  gridItemMinHeight: 0,
  items: [
    {
      id: uid(),
      title: "Getting Started Guide",
      eyebrow: "Documentation",
      iconName: "book",
      content: "Everything you need to set up your account, import your contacts, and launch your first campaign in under 30 minutes.",
      link: "#",
      image: "https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?auto=format&fit=crop&w=800&q=80",
      imageAlt: "Getting started guide",
      imageHeight: 180,
    },
    {
      id: uid(),
      title: "Live Demo — Book a Slot",
      eyebrow: "Sales",
      iconName: "calendar",
      content: "See Gr8 Result in action with one of our product specialists. We'll show you exactly how it maps to your business in 30 minutes.",
      link: "#",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80",
      imageAlt: "Book a demo",
      imageHeight: 180,
    },
    {
      id: uid(),
      title: "Agency Playbook — Free Download",
      eyebrow: "Resource",
      iconName: "download",
      content: "The complete 47-page playbook for digital agencies scaling to 7-figures using automation and AI tools.",
      link: "#",
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80",
      imageAlt: "Agency playbook download",
      imageHeight: 180,
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 12 — Final CTA Banner (bottom conversion hero)
// Demonstrates: hero block as CTA banner, gradient background, dual CTA
// ─────────────────────────────────────────────────────────────────────────────
const FINAL_CTA_BLOCK = block("hero", {
  headline: "Ready to replace your tool stack?",
  subheadline: "Join thousands of agencies already growing faster with Gr8 Result. No contracts. Cancel anytime. Your first 14 days are on us.",
  ctaText: "Start Free Trial",
  ctaLink: "#",
  ctaSecondaryText: "Book a Demo",
  ctaSecondaryLink: "#",
  headlineAlignment: "center",
  verticalAlign: "center",
  contentX: 50,
  contentY: 58,
  contentWidth: 760,
  contentHeight: 340,
  backgroundStyle: "gradient",
  backgroundGradient: "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#1e1b4b 100%)",
  backgroundColor: "#1e1b4b",
  minHeight: "480px",
  sectionAnimation: "fade-up",
  sectionAnimationDelay: 0,
  sectionAnimationSpeed: 0.9,
  headlineColor: "#ffffff",
  headlineFontFamily: "'Inter', system-ui, sans-serif",
  headlineFontWeight: "900",
  headlineFontSize: 52,
  subheadlineFontSize: 20,
  textColor: "rgba(255,255,255,.75)",
  buttonColor: "#6366f1",
  buttonTextColor: "#ffffff",
  buttonRadius: "12px",
  showSecondaryButton: true,
  secondaryButtonColor: "transparent",
  secondaryButtonTextColor: "#ffffff",
  secondaryButtonBorder: "1px solid rgba(255,255,255,.3)",
});

// ─────────────────────────────────────────────────────────────────────────────
// Assemble the page
// ─────────────────────────────────────────────────────────────────────────────
const testPageBlocks = [
  block("custom-html", { html: CYCLING_HERO_HTML, label: "Animated Cycling Hero" }),
  MARQUEE_BLOCK,
  STATS_BLOCK,
  TRUST_BADGES_BLOCK,
  PROBLEM_STATEMENT_BLOCK,
  SPLIT_FEATURE_1,
  SPLIT_FEATURE_2,
  SPLIT_FEATURE_3,
  TESTIMONIALS_BLOCK,
  FEATURE_ACCORDION_BLOCK,
  RESOURCE_CARDS_BLOCK,
  FINAL_CTA_BLOCK,
];

// ─────────────────────────────────────────────────────────────────────────────
// Block defaults — save each block type's config so it appears pre-configured
// in the left panel whenever the user drags that block type
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_DEFAULTS_TO_SAVE = {
  "marquee-strip": MARQUEE_BLOCK.props,
  stats: STATS_BLOCK.props,
  "trust-badges": TRUST_BADGES_BLOCK.props,
  testimonial: TESTIMONIALS_BLOCK.props,
  "grid-section": RESOURCE_CARDS_BLOCK.props,
  "feature-accordion": FEATURE_ACCORDION_BLOCK.props,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // ── 1. Load existing project ──────────────────────────────────────────────
  console.log(`\nLoading project ${PROJECT_ID}…`);
  const { data: rows, error: fetchErr } = await supabase
    .from("published_websites")
    .select("id, site_data")
    .eq("project_id", `draft:${PROJECT_ID}`)
    .limit(1)
    .single();

  if (fetchErr) {
    // Try without the draft: prefix (in case the row exists differently)
    const { data: rows2, error: fetchErr2 } = await supabase
      .from("published_websites")
      .select("id, site_data")
      .or(`project_id.eq.${PROJECT_ID},project_id.eq.draft:${PROJECT_ID}`)
      .limit(5);

    if (fetchErr2 || !rows2 || rows2.length === 0) {
      console.error("Could not find project row.", fetchErr2 || fetchErr);
      process.exit(1);
    }
    console.log(
      "Found rows:",
      rows2.map((r) => r.project_id || r.id)
    );
    // pick the first one that has site_data
    const row = rows2.find((r) => r.site_data);
    if (!row) {
      console.error("No site_data found in any row.");
      process.exit(1);
    }
    await processRow(row);
    return;
  }

  await processRow(rows);
}

async function processRow(row) {
  const project = row.site_data;
  console.log(`✔ Loaded project: "${project.name || project.id}"`);

  // ── 2. Check page doesn't already exist ──────────────────────────────────
  const PAGE_NAME = "Test Page";
  const existingPages = Array.isArray(project.pages) ? project.pages : [];
  if (existingPages.some((p) => p.name === PAGE_NAME)) {
    console.log(`⚠ Page "${PAGE_NAME}" already exists — removing old version.`);
    project.pages = existingPages.filter((p) => p.name !== PAGE_NAME);
  }

  // ── 3. Add page entry ─────────────────────────────────────────────────────
  const newPage = {
    id: uid(),
    name: PAGE_NAME,
    slug: "test-page",
    title: "Test Page — Feature Showcase",
    description: "A showcase of every layout pattern and animation available in the Gr8 Result website builder.",
  };
  project.pages = [...existingPages.filter((p) => p.name !== PAGE_NAME), newPage];

  // ── 4. Add page blocks ────────────────────────────────────────────────────
  if (!project.pageBlocks) project.pageBlocks = {};
  project.pageBlocks[PAGE_NAME] = testPageBlocks;

  console.log(`✔ Added ${testPageBlocks.length} blocks to "${PAGE_NAME}"`);

  // ── 5. Save back to Supabase ──────────────────────────────────────────────
  const { error: saveErr } = await supabase
    .from("published_websites")
    .update({ site_data: project })
    .eq("id", row.id);

  if (saveErr) {
    console.error("Failed to save project:", saveErr);
    process.exit(1);
  }
  console.log("✔ Project saved to Supabase.");

  // ── 6. Update block defaults in data/website-builder-defaults.json ───────
  const defaultsPath = path.join(__dirname, "..", "data", "website-builder-defaults.json");
  let defaults = {};
  try {
    defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));
  } catch {
    defaults = { templateOverrides: {}, blockDefaults: {} };
  }
  if (!defaults.blockDefaults) defaults.blockDefaults = {};

  for (const [blockType, props] of Object.entries(BLOCK_DEFAULTS_TO_SAVE)) {
    defaults.blockDefaults[blockType] = { ...defaults.blockDefaults[blockType], ...props };
    console.log(`✔ Saved defaults for block type: ${blockType}`);
  }

  fs.writeFileSync(defaultsPath, JSON.stringify(defaults, null, 2), "utf8");
  console.log("✔ Block defaults written to data/website-builder-defaults.json");

  console.log(`
────────────────────────────────────────────────────────
 ✅  Test Page created successfully!
────────────────────────────────────────────────────────
 Sections added (${testPageBlocks.length} blocks):
  1. Animated Cycling-Word Hero (custom-html)
  2. Scrolling Marquee Strip
  3. Animated Stats Counter (spotlight-orbs)
  4. Trust Badges / Logo Grid
  5. Problem Statement (parallax, dark)
  6. Split Feature — CRM (image + text + FAQ)
  7. Split Feature — Email (reversed)
  8. Split Feature — Automation
  9. Testimonials Carousel (stacked-card, 5 entries)
 10. Feature Accordion (4 panels)
 11. Resource Cards Grid (3 cards)
 12. Final CTA Banner

 Open the builder → Tab: "Test Page"
────────────────────────────────────────────────────────
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
