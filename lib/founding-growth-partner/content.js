export const foundingPartnerBasePath = "/founding-growth-partner";

export const brand = {
  name: "Gr8 Result Digital Solutions",
  logo: "/logo/gr8result-logo.png",
  canonical: "https://gr8result.solutions/founding-growth-partner",
  founder: "Grant Rohde",
};

export const agencyProfiles = {
  "rocket-agency": {
    agencyName: "Rocket Agency",
    welcomeLine: "Prepared for Rocket Agency as a potential founding growth partner.",
    reason: "Your SaaS and performance marketing experience makes this a relevant strategic conversation.",
  },
  farsiight: {
    agencyName: "Farsiight",
    welcomeLine: "Prepared for Farsiight as a potential founding growth partner.",
    reason: "Your growth and acquisition focus aligns with the launch challenge ahead.",
  },
  kalungi: {
    agencyName: "Kalungi",
    welcomeLine: "Prepared for Kalungi as a potential founding growth partner.",
    reason: "Your B2B SaaS positioning and launch experience is directly relevant to this opportunity.",
  },
};

export function getAgencyProfile(slug = "") {
  const cleanSlug = String(slug || "").trim().toLowerCase();
  return agencyProfiles[cleanSlug] || null;
}

export const platformGroups = [
  {
    title: "Attract",
    modules: ["Website Builder", "Landing Pages", "Social Media Management", "AI Business Tools", "Marketplace"],
  },
  {
    title: "Convert",
    modules: ["CRM", "Email Marketing", "Funnel Builder", "Calendar and Appointment Booking", "Marketing Automation"],
  },
  {
    title: "Manage",
    modules: ["Client Portals", "Reporting and Analytics", "Communities", "Online Courses", "Digital Products", "Physical Products"],
  },
  {
    title: "Deliver",
    modules: ["Construction Estimating", "Takeoff", "Project Management", "Procurement", "Purchase Orders"],
  },
  {
    title: "Grow",
    modules: ["Variations", "Budget vs Actual", "Job Board", "Gantt Scheduling"],
  },
];

export const differenceCards = [
  ["One connected ecosystem", "Replace disconnected tools with a single operating environment."],
  ["Built for real businesses", "Designed around actual workflows rather than isolated features."],
  ["Marketing and operations together", "Connect lead generation, sales, delivery and customer management."],
  ["Industry depth", "Includes advanced construction estimating and project operations."],
  ["Developed in-house", "Rapid product development with direct access to the founder and build process."],
  ["Modular and scalable", "Businesses can adopt the tools they need and expand over time."],
];

export const productShowcase = [
  {
    title: "CRM pipeline",
    outcome: "Turn leads into a managed sales pipeline.",
    image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/crm-list-card-1.png",
  },
  {
    title: "Campaign builder",
    outcome: "Build and launch campaigns without leaving the platform.",
    image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/ai-website-builder-builder-preview.png",
  },
  {
    title: "Website creation",
    outcome: "Move from idea to published web experience inside one workspace.",
    image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/ai-website-builder-no-code.png",
  },
  {
    title: "Lead management",
    outcome: "Keep customer activity visible from first enquiry to follow-up.",
    image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/crm-list-card-2.png",
  },
];

export const launchPhases = [
  ["Phase 1", "Positioning and launch foundation", "Clarify the offer, audience, message, pricing assumptions and launch assets."],
  ["Phase 2", "Pre-launch audience and waiting list", "Build qualified demand before the public launch through focused campaigns and nurture."],
  ["Phase 3", "Beta and founding customer acquisition", "Convert early interest into structured demos, trial users and launch feedback."],
  ["Phase 4", "Public launch", "Move into a wider launch with campaign learnings, conversion systems and clear reporting."],
  ["Phase 5", "Optimisation and recurring subscription growth", "Improve acquisition, onboarding, retention and recurring revenue performance."],
];

export const agencyResponseItems = [
  "Recommended go-to-market approach",
  "Recommended initial investment and allocation",
  "Phased options where appropriate",
  "90-day launch plan",
  "Six-month growth roadmap",
  "Recommended market positioning",
  "Recommended channels and testing strategy",
  "Realistic KPIs, target ranges and assumptions",
  "Expected customer acquisition assumptions",
  "Reporting framework",
  "Team members who would work on the account",
  "Relevant SaaS launch experience",
  "Relevant construction, SME or subscription experience",
  "Case studies with measurable outcomes",
  "Pricing, commercial structure, contract length and exit terms",
  "What the agency requires from Gr8 Result",
];

export const evaluationCriteria = [
  "Strategic thinking",
  "SaaS experience",
  "Quality of proposed team",
  "Ability to challenge assumptions",
  "Creative quality",
  "Paid acquisition expertise",
  "Lifecycle and retention expertise",
  "Measurement and analytics",
  "Willingness to use the platform",
  "Communication",
  "Commercial transparency",
  "Long-term fit",
];

export const successMetrics = [
  "Qualified waiting-list growth",
  "Demo bookings",
  "Trial registrations",
  "Trial-to-paid conversion",
  "Paid subscriptions",
  "Monthly recurring revenue",
  "Customer acquisition cost",
  "Lead-to-customer conversion",
  "Retention",
  "Churn",
  "Campaign efficiency",
  "Product feedback and launch readiness",
];

export const pdfSections = [
  {
    title: "Invitation",
    body: [
      "Gr8 Result Digital Solutions is seeking one exceptional SaaS growth agency to help shape go-to-market strategy, build pre-launch momentum and create a long-term subscription growth engine.",
      "This is a strategic partnership invitation, not a quote request. We want the selected agency to recommend the strategy, investment, allocation and first 90 days required to launch well.",
    ],
  },
  {
    title: "The Vision",
    body: [
      "We are not building another CRM. We are building the operating system for growing businesses.",
      "Gr8 Result combines marketing, sales, customer management, content, digital commerce and industry-specific operations inside one connected environment.",
    ],
  },
  {
    title: "Platform Ecosystem",
    body: platformGroups.map((group) => `${group.title}: ${group.modules.join(", ")}.`),
  },
  {
    title: "Founding Growth Partner Opportunity",
    body: [
      "The selected partner will help lead go-to-market strategy, develop positioning and messaging, build pre-launch demand, create campaigns, plan acquisition, develop nurture systems and provide structured product feedback.",
      "Potential future opportunities may include founding partner recognition, joint case studies, priority feature consideration and future referral or reseller discussions, subject to agreement.",
    ],
  },
  {
    title: "Launch Journey",
    body: launchPhases.map((phase) => `${phase[0]} - ${phase[1]}: ${phase[2]}`),
  },
  {
    title: "Agency Response",
    body: [
      "Please provide recommended strategy, investment, allocation, target ranges, assumptions, leading indicators, test budgets and how forecasts will be validated. Do not guarantee MRR, CAC or ROAS.",
      ...agencyResponseItems,
    ],
  },
  {
    title: "Contact",
    body: [
      "Grant Rohde, Founder, Gr8 Result Digital Solutions",
      "Arrange a strategy conversation or submit agency interest through the microsite.",
    ],
  },
];
