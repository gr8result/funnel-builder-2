// pages/test-accordion.js
// Standalone test page for the scroll-driven FeatureAccordionBlock
// Navigate to: http://localhost:3000/test-accordion
import Head from "next/head";
import dynamic from "next/dynamic";

// Use dynamic import to avoid SSR issues with scroll/window refs
const FeatureAccordionBlock = dynamic(
  () =>
    import("../components/website-builder/website-renderer/wbBlockComponents").then(
      (mod) => mod.FeatureAccordionBlock
    ),
  { ssr: false }
);

const TEST_BLOCK = {
  backgroundColor: "#0f172a",
  textColor: "#f1f5f9",
  accentColor: "#38bdf8",
  progressColor: "#38bdf8",
  eyebrow: "PLATFORM FEATURES",
  title: "Everything you need to grow your business",
  stickyTopOffset: 0,
  imagePosition: "right",
  itemBorderEnabled: true,
  itemBorderColor: "rgba(148,163,184,0.22)",
  itemBorderStyle: "solid",
  itemBorderWidth: 1,
  activeBorderColor: "#38bdf8",
  items: [
    {
      id: "fa-1",
      label: "CRM & Pipeline Management",
      image:
        "https://placehold.co/900x680/1e3a5f/7dd3fc?text=CRM+Pipeline",
      contentBlocks: [
        { type: "eyebrow", text: "Contact Management" },
        { type: "heading", text: "Keep every deal moving forward" },
        {
          type: "text",
          text: "Track leads, manage contacts, and close deals with a visual pipeline built for your team. See every opportunity at a glance and never let a deal fall through the cracks.",
        },
        { type: "stat", number: "3×", label: "faster deal closing" },
        { type: "cta", text: "Explore CRM", link: "#" },
      ],
    },
    {
      id: "fa-2",
      label: "Email & SMS Marketing",
      image:
        "https://placehold.co/900x680/1a2e4a/7dd3fc?text=Email+%26+SMS",
      contentBlocks: [
        { type: "eyebrow", text: "Campaigns" },
        { type: "heading", text: "Reach your audience at the right moment" },
        {
          type: "text",
          text: "Send beautiful email campaigns and automated SMS sequences that drive real results. Personalise at scale with smart segmentation and behavioural triggers.",
        },
        { type: "stat", number: "98%", label: "deliverability rate" },
        { type: "cta", text: "See Email Tools", link: "#" },
      ],
    },
    {
      id: "fa-3",
      label: "Automation & Workflows",
      image:
        "https://placehold.co/900x680/162840/7dd3fc?text=Automation",
      contentBlocks: [
        { type: "eyebrow", text: "Workflows" },
        { type: "heading", text: "Automate the work, keep the human touch" },
        {
          type: "text",
          text: "Set up trigger-based workflows that nurture leads and onboard customers without manual effort. Build once and let your business run on autopilot.",
        },
        { type: "stat", number: "40h", label: "saved per week" },
        { type: "cta", text: "See How It Works", link: "#" },
      ],
    },
    {
      id: "fa-4",
      label: "Analytics & Reporting",
      image:
        "https://placehold.co/900x680/0f2338/7dd3fc?text=Analytics",
      contentBlocks: [
        { type: "eyebrow", text: "Insights" },
        { type: "heading", text: "Make decisions backed by real data" },
        {
          type: "text",
          text: "Understand what's working with real-time dashboards and detailed reports. Track revenue, conversions, email opens, and pipeline health all in one place.",
        },
        { type: "stat", number: "Live", label: "real-time dashboards" },
        { type: "cta", text: "View Analytics", link: "#" },
      ],
    },
  ],
};

export default function TestAccordion() {
  return (
    <>
      <Head>
        <title>Scroll Accordion Test</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* THE ACCORDION — rendered with editor=false, compact=false */}
      <FeatureAccordionBlock props={TEST_BLOCK} editor={false} compact={false} />

      {/* Content below so the section can un-stick properly */}
      <div
        style={{
          background: "#0f172a",
          padding: "100px 40px",
          textAlign: "center",
          borderTop: "1px solid rgba(148,163,184,0.1)",
        }}
      >
        <h2 style={{ color: "#f1f5f9", fontSize: 36, fontWeight: 600, margin: "0 0 16px" }}>
          You made it past the accordion 🎉
        </h2>
        <p style={{ color: "rgba(148,163,184,0.75)", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
          The sticky section un-pinned when you scrolled past it. Ready to add
          this block to your real site.
        </p>
      </div>
    </>
  );
}

TestAccordion.disableLayout = true;
