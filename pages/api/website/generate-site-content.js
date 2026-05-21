import OpenAI from "openai";
import { BlockDefinitions, BlockTypes } from "../../../lib/website-builder/pageBlockComponents";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeTrim(value) {
  return String(value || "").trim();
}

function joinSentences(parts) {
  return parts
    .map((part) => safeTrim(part))
    .filter(Boolean)
    .map((part) => part.replace(/([.!?])?$/, (match) => match || "."))
    .join(" ");
}

function splitBriefList(value) {
  return String(value || "")
    .split(/\n|,|\|/)
    .map((item) => safeTrim(item))
    .filter(Boolean);
}

function slugify(value) {
  return safeTrim(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function createBlock(type, props = {}) {
  return {
    id: `wb_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    type,
    props: {
      ...deepClone(BlockDefinitions[type]?.defaultProps || {}),
      ...props,
    },
  };
}

function buildAnimationProps(overrides = {}) {
  return {
    sectionAnimation: overrides.sectionAnimation || "blur-in",
    sectionAnimationDelay: overrides.sectionAnimationDelay ?? 0,
    sectionAnimationSpeed: overrides.sectionAnimationSpeed || 1,
    textAnimation: overrides.textAnimation || "slide-up",
    textAnimationDelay: overrides.textAnimationDelay ?? 0.08,
    textAnimationSpeed: overrides.textAnimationSpeed || 0.95,
    subheadlineAnimation: overrides.subheadlineAnimation || "fade-up",
    subheadlineAnimationDelay: overrides.subheadlineAnimationDelay ?? 0.16,
    subheadlineAnimationSpeed: overrides.subheadlineAnimationSpeed || 1.05,
  };
}

function buildGeneratedMotion(block, index, options = {}) {
  const blockType = String(block?.type || "");
  const isHome = !!options.isHome;
  const isSaasHome = !!options.isSaasHome;
  const isPremiumBuild = !!options.isPremiumBuild;
  const baseDelay = Math.max(0, Number(options.baseDelay ?? 0));
  const stagger = Math.max(0.04, Number(options.stagger ?? 0.08));
  const delay = Number((baseDelay + (index * stagger)).toFixed(2));

  const presets = {
    hero: isSaasHome
      ? { sectionAnimation: "zoom", textAnimation: "slide-right", subheadlineAnimation: "slide-left", sectionAnimationSpeed: isPremiumBuild ? 1.12 : 1.08, textAnimationSpeed: 0.96 }
      : isHome
        ? { sectionAnimation: isPremiumBuild ? "light-speed-in" : "blur-in", textAnimation: "slide-right", subheadlineAnimation: "fade-left", sectionAnimationSpeed: isPremiumBuild ? 1.08 : 1.04 }
        : { sectionAnimation: isPremiumBuild ? "fade-right" : "fade-up", textAnimation: "fade-right", subheadlineAnimation: "fade-up" },
    "marquee-strip": { sectionAnimation: "fade-in", textAnimation: "fade-in", subheadlineAnimation: "fade-in", sectionAnimationSpeed: 0.85 },
    text: { sectionAnimation: isPremiumBuild ? "fade-right" : "fade-left", textAnimation: "fade-left", subheadlineAnimation: "fade-up" },
    "feature-list": { sectionAnimation: isHome ? "slide-right" : isPremiumBuild ? "light-speed-in" : "fade-up", textAnimation: "fade-right", subheadlineAnimation: "fade-up" },
    testimonial: { sectionAnimation: isHome ? "fade-in" : isPremiumBuild ? "blur-in" : "fade-up", textAnimation: "slide-left", subheadlineAnimation: "fade-up" },
    "pricing-table": { sectionAnimation: "fade-up", textAnimation: "fade-up", subheadlineAnimation: "fade-up" },
    "contact-form": { sectionAnimation: "slide-up", textAnimation: "fade-right", subheadlineAnimation: "fade-up" },
    "image-gallery": { sectionAnimation: "fade-up", textAnimation: "fade-up", subheadlineAnimation: "fade-up" },
    stats: { sectionAnimation: isSaasHome ? "blur-in" : "fade-up", textAnimation: "fade-up", subheadlineAnimation: "slide-right" },
    team: { sectionAnimation: "fade-right", textAnimation: "fade-right", subheadlineAnimation: "fade-up" },
    faq: { sectionAnimation: "slide-right", textAnimation: "fade-right", subheadlineAnimation: "fade-up" },
    accordion: { sectionAnimation: "slide-right", textAnimation: "fade-right", subheadlineAnimation: "fade-up" },
    newsletter: { sectionAnimation: "fade-up", textAnimation: "fade-up", subheadlineAnimation: "fade-up" },
    "trust-badges": { sectionAnimation: isPremiumBuild ? "slide-up" : "fade-up", textAnimation: "fade-up", subheadlineAnimation: "fade-up", sectionAnimationSpeed: 0.86 },
    footer: { sectionAnimation: "fade-in", textAnimation: "fade-up", subheadlineAnimation: "fade-up", sectionAnimationSpeed: 0.92 },
    "image-stack": { sectionAnimation: "light-speed-in", textAnimation: "rotate-in-down-right", subheadlineAnimation: "fade-up", sectionAnimationSpeed: 1.06 },
    "columns-2": { sectionAnimation: isHome ? "slide-left" : isPremiumBuild ? "fade-right" : "fade-left", textAnimation: "fade-left", subheadlineAnimation: "fade-up" },
    "columns-3": { sectionAnimation: "fade-up", textAnimation: "fade-up", subheadlineAnimation: "fade-up" },
    "cta-button": { sectionAnimation: isHome ? "rubber-band" : "fade-up", textAnimation: "fade-up", subheadlineAnimation: "fade-up", sectionAnimationSpeed: 0.94 },
  };

  const selected = presets[blockType] || {
    sectionAnimation: "fade-up",
    textAnimation: "fade-up",
    subheadlineAnimation: "fade-up",
  };

  return {
    ...selected,
    sectionAnimationDelay: selected.sectionAnimationDelay ?? delay,
    textAnimationDelay: selected.textAnimationDelay ?? Math.max(0, Number((delay + 0.06).toFixed(2))),
    subheadlineAnimationDelay: selected.subheadlineAnimationDelay ?? Math.max(0, Number((delay + 0.14).toFixed(2))),
    sectionAnimationSpeed: selected.sectionAnimationSpeed || 1,
    textAnimationSpeed: selected.textAnimationSpeed || 0.96,
    subheadlineAnimationSpeed: selected.subheadlineAnimationSpeed || 1.02,
  };
}

function applyGeneratedMotion(blocks, options = {}) {
  return (Array.isArray(blocks) ? blocks : []).map((block, index) => {
    if (!block || typeof block !== "object") return block;

    const props = block.props && typeof block.props === "object" ? block.props : {};
    const motion = buildGeneratedMotion(block, index, options);

    return {
      ...block,
      props: {
        ...props,
        sectionAnimation: props.sectionAnimation || motion.sectionAnimation,
        sectionAnimationDelay: props.sectionAnimationDelay ?? motion.sectionAnimationDelay,
        sectionAnimationSpeed: props.sectionAnimationSpeed || motion.sectionAnimationSpeed,
        textAnimation: props.textAnimation || motion.textAnimation,
        textAnimationDelay: props.textAnimationDelay ?? motion.textAnimationDelay,
        textAnimationSpeed: props.textAnimationSpeed || motion.textAnimationSpeed,
        subheadlineAnimation: props.subheadlineAnimation || motion.subheadlineAnimation,
        subheadlineAnimationDelay: props.subheadlineAnimationDelay ?? motion.subheadlineAnimationDelay,
        subheadlineAnimationSpeed: props.subheadlineAnimationSpeed || motion.subheadlineAnimationSpeed,
      },
    };
  });
}

function pickBriefImageUrls(brief) {
  const matches = String(brief?.imageUrls || "").match(/https?:\/\/[^\s,]+/g) || [];
  return Array.from(new Set(matches.map((value) => safeTrim(value)).filter(Boolean)));
}

function buildRequestedImageLabels(brief) {
  const requested = splitBriefList(brief?.imageRequests);
  if (requested.length) return requested;
  return [
    `${safeTrim(brief?.offer) || safeTrim(brief?.businessName) || "Brand"} hero image`,
    `${safeTrim(brief?.businessName) || "Brand"} team or process image`,
    `${safeTrim(brief?.offer) || "Offer"} supporting visual`,
  ];
}

function inferIndustryKey({ templateSlug = "", businessName = "", offer = "", targetAudience = "", goal = "", notes = "" } = {}) {
  const text = `${templateSlug} ${businessName} ${offer} ${targetAudience} ${goal} ${notes}`.toLowerCase();
  if (/(coach|consultant|speaker|author|personal brand)/.test(text)) return "coach";
  if (/(saas|software|app|platform|crm|automation|dashboard|ai tool)/.test(text)) return "saas";
  if (/(restaurant|cafe|bar|dining|venue|food)/.test(text)) return "restaurant";
  if (/(medical|clinic|dental|physio|skin clinic|doctor|health practice)/.test(text)) return "medical";
  if (/(law|legal|solicitor|attorney)/.test(text)) return "law";
  if (/(real estate|realtor|property|mortgage|broker)/.test(text)) return "property";
  if (/(salon|spa|beauty|cosmetic|skin|lashes|brows)/.test(text)) return "beauty";
  if (/(fitness|gym|coach|nutrition|wellness|pilates|yoga)/.test(text)) return "fitness";
  if (/(plumb|electric|hvac|roof|reno|renovation|builder|construction|painting|fencing|landscap|cleaning|service)/.test(text)) return "trade";
  if (/(accounting|bookkeeping|finance|wealth|tax|advisory)/.test(text)) return "finance";
  if (/(shop|store|ecommerce|product|retail)/.test(text)) return "ecommerce";
  if (/(creative|designer|photographer|videographer|portfolio|studio|agency)/.test(text)) return "creative";
  return "business";
}

const INDUSTRY_IMAGE_SETS = {
  business: [
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1400&q=80",
  ],
  coach: [
    "https://images.pexels.com/photos/4761663/pexels-photo-4761663.jpeg?auto=compress&cs=tinysrgb&w=1600",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1400&q=80",
  ],
  saas: [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80",
  ],
  restaurant: [
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1400&q=80",
  ],
  medical: [
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1504813184591-01572f98c85f?auto=format&fit=crop&w=1400&q=80",
  ],
  law: [
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1528747008803-f9f36cccaf32?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=80",
  ],
  property: [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80",
  ],
  beauty: [
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80",
  ],
  fitness: [
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1518611012118-fb92b0c5f6bb?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1400&q=80",
  ],
  trade: [
    "https://images.unsplash.com/photo-1581091215367-59ab6dcef35b?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?auto=format&fit=crop&w=1400&q=80",
  ],
  finance: [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1400&q=80",
  ],
  ecommerce: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1400&q=80",
  ],
  creative: [
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1800&q=80",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1400&q=80",
  ],
};

function buildImagePack(industryKey, businessName, brief = {}) {
  const set = INDUSTRY_IMAGE_SETS[industryKey] || INDUSTRY_IMAGE_SETS.business;
  const custom = pickBriefImageUrls(brief);
  const labels = buildRequestedImageLabels(brief);
  const pool = Array.from(new Set([...custom, ...set].filter(Boolean)));
  return {
    hero: pool[0] || set[0],
    gallery: pool.slice(0, 3).map((src, index) => ({
      src,
      alt: labels[index] || `${businessName} image ${index + 1}`,
      caption: labels[index] || (index === 0 ? "Signature result" : index === 1 ? "Customer experience" : "Behind the scenes"),
    })),
    stack: pool.slice(0, 2),
    media: pool[3] || pool[1] || pool[0] || set[0],
    support: pool[4] || pool[2] || pool[0] || set[0],
  };
}

function buildPageLinks(pages) {
  const sourcePages = Array.isArray(pages) && pages.length ? pages : [{ name: "Home" }];
  return sourcePages
    .filter((page) => safeTrim(page?.name))
    .map((page) => {
      const pageName = safeTrim(page.name);
      const key = slugify(pageName) || "home";
      return {
        label: pageName,
        href: key === "home" ? "#home" : `#${key}`,
      };
    });
}

function extractNumericFragments(value) {
  return Array.from(new Set((safeTrim(value).match(/\d+(?:\/\d+)?%?\+?/g) || []).map((item) => item.toLowerCase())));
}

function hasUnsupportedNumericClaim(value, allowedFragments) {
  const fragments = extractNumericFragments(value);
  return fragments.length > 0 && fragments.some((fragment) => !allowedFragments.has(fragment));
}

function inferServiceArea(brief) {
  const sources = [brief?.targetAudience, brief?.notes, brief?.goal].map((value) => safeTrim(value)).filter(Boolean);
  for (const source of sources) {
    const match = source.match(/\b(?:in|across|throughout|serving)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function buildFooterContactDetails(brief, businessName) {
  const serviceArea = inferServiceArea(brief);
  return {
    contactEmail: safeTrim(brief?.contactEmail || brief?.email || ""),
    contactPhone: safeTrim(brief?.contactPhone || brief?.phone || ""),
    contactAddress: serviceArea ? `Serving ${serviceArea}` : "",
    copyrightText: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
  };
}

function normalizeItems(items, minCount, factory) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  const next = [...safe];
  while (next.length < minCount) {
    next.push(factory(next.length));
  }
  return next.slice(0, Math.max(minCount, next.length));
}

function buildFallbackTestimonialItems({ businessName, offer, audience, goal, differentiators, proofPoints, pageName }) {
  return [
    {
      quote: `${businessName} made it much easier to understand the offer, trust the process, and take the next step without second guessing anything.`,
      author: "Satisfied Client",
      role: audience,
    },
    {
      quote: `The site finally explained what we do, who it is for, and why it matters. That clarity helped more of the right people move toward ${goal}.`,
      author: "Business Owner",
      role: `${pageName} client`,
    },
    {
      quote: `What stood out was how clearly ${offer} was positioned. The messaging felt specific, practical, and grounded in what buyers actually care about.`,
      author: "Project Lead",
      role: differentiators[0] || "Returning customer",
    },
    {
      quote: `From first impression to final CTA, everything felt more credible and easier to act on. ${proofPoints[0] ? `The proof around ${proofPoints[0]} helped a lot.` : "The trust signals were finally doing real work."}`,
      author: "Operations Manager",
      role: `${businessName} customer`,
    },
  ];
}

function buildFallbackContent({ brief, pages }) {
  const businessName = safeTrim(brief.businessName) || "Your Business";
  const offer = safeTrim(brief.offer) || "your main offer";
  const audience = safeTrim(brief.targetAudience) || "your ideal customer";
  const goal = safeTrim(brief.goal) || "generate more qualified enquiries";
  const keywords = splitBriefList(brief.primaryKeywords).slice(0, 5);
  const serviceAreas = splitBriefList(brief.serviceAreas).slice(0, 3);
  const differentiators = splitBriefList(brief.differentiators).slice(0, 3);
  const proofPoints = splitBriefList(brief.proofPoints).slice(0, 3);
  const mustIncludeSections = splitBriefList(brief.mustIncludeSections).slice(0, 4);
  const tone = safeTrim(brief.tone) || "clear, premium, and confident";
  const imageLabels = buildRequestedImageLabels(brief);
  const keywordPhrase = keywords.length ? keywords.join(", ") : `${offer}, ${businessName}`;
  const serviceAreaLine = serviceAreas.length ? ` Serving ${serviceAreas.join(", ")}.` : "";
  const differentiatorLine = differentiators.length ? ` Differentiators include ${differentiators.join(", ")}.` : "";
  const proofLine = proofPoints.length ? ` Proof points: ${proofPoints.join(", ")}.` : "";

  return {
    siteTitle: businessName,
    siteTagline: `${businessName} helps ${audience} with ${offer}.${serviceAreaLine}`,
    navCtaText: /book|call|consult/i.test(goal) ? "Book Now" : "Get Started",
    footerTagline: `${offer} for ${audience}. ${keywordPhrase}`,
    pages: (Array.isArray(pages) ? pages : []).map((page, index) => ({
      name: page.name,
      heroEyebrow: keywords[0] || offer,
      heroHeadline: index === 0 ? `${businessName} for ${audience} who want ${goal}` : `${page.name} at ${businessName}`,
      heroSubheadline: joinSentences([
        page.objective || `${offer} built to ${goal}`,
        `${businessName} helps ${audience} understand the offer quickly, see why it matters, and move toward a clear next step`,
        serviceAreas.length ? `The message is grounded in ${serviceAreas.join(", ")} so the site feels locally relevant as well as commercially strong` : "",
        differentiators.length ? `It leans on differentiators like ${differentiators.join(", ")} instead of vague claims` : "",
      ]),
      ctaText: /book|call|consult/i.test(goal) ? "Book a Call" : /buy|shop|order/i.test(goal) ? "View Options" : "Get Started",
      introTitle: index === 0 && keywords[0] ? `${page.name}: ${keywords[0]}` : page.name,
      introBody: `${joinSentences([
        `${businessName} offers ${offer} for ${audience}`,
        `This page is built to ${goal}`,
        `The copy should feel ${tone} while still making the commercial case clearly and without filler`,
      ])}\n\n${joinSentences([
        serviceAreas.length ? `${businessName} is positioned to serve ${serviceAreas.join(", ")}` : "",
        differentiators.length ? `The strongest points of difference are ${differentiators.join(", ")}` : "",
        proofPoints.length ? `Proof should show up naturally through details like ${proofPoints.join(", ")}` : "",
        `Every section should help a visitor understand what the business does, why it is credible, and what to do next`,
      ])}`,
      features: [
        { title: differentiators[0] || `Built for ${audience}`, body: `${offer} is positioned for the people most likely to buy, with messaging tuned to ${keywordPhrase} and written to feel specific instead of generic.` },
        { title: differentiators[1] || "Clear next step", body: `Each section explains what happens, why it matters, and how visitors can move toward ${goal} without needing to guess.` },
        { title: differentiators[2] || "Trust-first presentation", body: `Proof, visuals, and CTA hierarchy work together so the page feels ready to publish and easy to trust.${proofLine}` },
        { title: mustIncludeSections[0] || "Relevant detail", body: `The copy should answer practical buying questions, reduce hesitation, and connect the offer to the real problem facing ${audience}.` },
        { title: mustIncludeSections[1] || "Commercial clarity", body: `${businessName} should sound credible, capable, and clear about outcomes, scope, and fit rather than leaning on vague hype.` },
      ],
      stats: [
        { number: proofPoints[0] || "Focused", label: "Clear positioning", detail: `Explain ${offer} quickly and clearly for ${audience}.` },
        { number: proofPoints[1] || "Relevant", label: "Visual trust", detail: `Use imagery like ${imageLabels[0] || "a strong hero visual"} across the site.` },
        { number: proofPoints[2] || "Ready", label: "Conversion flow", detail: `Move visitors toward ${goal} with direct CTAs and SEO-focused copy.` },
        { number: serviceAreas[0] || "Specific", label: "Market relevance", detail: `Tie the offer to the audience, service area, and buying context so the page feels grounded in the real business.` },
      ],
      faq: [
        { question: `Who is ${offer} for?`, answer: `${offer} is built for ${audience}.` },
        { question: "What happens next?", answer: `The page guides visitors to ${goal} with a clear next step.` },
        { question: "Why choose this business?", answer: `${businessName} combines ${differentiators.join(", ") || "clear positioning, relevant proof, and a stronger user journey"}.` },
        { question: `What makes ${businessName} different?`, answer: differentiators.length ? `${businessName} stands out through ${differentiators.join(", ")}, which gives buyers a clearer reason to choose it over a generic alternative.` : `${businessName} is presented with stronger clarity, trust signals, and a more complete explanation of the offer.` },
        { question: `How does ${page.name} help a buyer decide?`, answer: `This page explains the offer in plain language, shows why it matters, and reduces uncertainty by answering the most common objections before the CTA.` },
      ],
      marqueeItems: [...keywords, ...mustIncludeSections, ...differentiators, ...proofPoints].filter(Boolean).slice(0, 8),
      galleryCaptions: [imageLabels[0] || "Signature experience", imageLabels[1] || "Process and presentation", imageLabels[2] || "Proof and trust"],
      testimonial: {
        quote: `${businessName} made the next step obvious and easy by explaining the offer properly, answering the real questions, and giving the page a much stronger sense of trust.`,
        author: "Satisfied Client",
        role: "Customer",
      },
      testimonialItems: buildFallbackTestimonialItems({ businessName, offer, audience, goal, differentiators, proofPoints, pageName: page.name }),
      contactTitle: /contact|book|apply/i.test(page.name) ? page.name : `Talk to ${businessName}`,
      contactSubtitle: page.objective || `Reach out to learn how ${offer} can help.`,
      trustBadges: [offer, audience, goal, serviceAreas[0], differentiators[0]].filter(Boolean),
    })),
  };
}

function normalizeAiPayload(raw, requestedPages, fallback) {
  const allowedNumericClaims = new Set(
    extractNumericFragments(
      [
        raw?.siteTitle,
        raw?.siteTagline,
        fallback.siteTitle,
        fallback.siteTagline,
        ...requestedPages.flatMap((page) => [page?.name, page?.objective]),
      ].join(" ")
    )
  );
  const briefNumericClaims = new Set();
  fallback.pages.forEach((page) => {
    extractNumericFragments([
      page.heroHeadline,
      page.heroSubheadline,
      page.introBody,
      ...(page.stats || []).map((item) => `${item.number} ${item.label} ${item.detail}`),
      ...(page.faq || []).flatMap((item) => [item.question, item.answer]),
      ...(page.trustBadges || []),
    ].join(" ")).forEach((fragment) => briefNumericClaims.add(fragment));
  });
  const allowedFragments = new Set([...allowedNumericClaims, ...briefNumericClaims]);
  const requestedByName = new Map((requestedPages || []).map((page) => [safeTrim(page?.name).toLowerCase(), page]));
  const pagePayload = Array.isArray(raw?.pages) ? raw.pages : [];

  const normalizedPages = (requestedPages || []).map((page) => {
    const matching = pagePayload.find((entry) => safeTrim(entry?.name).toLowerCase() === safeTrim(page?.name).toLowerCase()) || {};
    const fallbackPage = fallback.pages.find((entry) => safeTrim(entry?.name).toLowerCase() === safeTrim(page?.name).toLowerCase()) || {};
    const normalizedStats = normalizeItems(matching.stats, 4, (index) => fallbackPage.stats?.[index] || { number: "Strong", label: `Point ${index + 1}`, detail: "Add proof." }).map((item, index) => {
      const fallbackStat = fallbackPage.stats?.[index] || { number: "Strong", label: `Point ${index + 1}`, detail: "Add proof." };
      const nextNumber = safeTrim(item?.number) || fallbackStat.number;
      return {
        number: hasUnsupportedNumericClaim(nextNumber, allowedFragments) ? fallbackStat.number : nextNumber,
        label: safeTrim(item?.label) || fallbackStat.label,
        detail: safeTrim(item?.detail) || fallbackStat.detail,
      };
    });
    return {
      name: page.name,
      heroEyebrow: safeTrim(matching.heroEyebrow) || fallbackPage.heroEyebrow,
      heroHeadline: safeTrim(matching.heroHeadline) || fallbackPage.heroHeadline,
      heroSubheadline: safeTrim(matching.heroSubheadline) || fallbackPage.heroSubheadline,
      ctaText: safeTrim(matching.ctaText) || fallbackPage.ctaText,
      introTitle: safeTrim(matching.introTitle) || fallbackPage.introTitle,
      introBody: safeTrim(matching.introBody) || fallbackPage.introBody,
      features: normalizeItems(matching.features, 5, (index) => fallbackPage.features?.[index] || { title: `Feature ${index + 1}`, body: "Add supporting detail." }).map((item, index) => ({
        title: safeTrim(item?.title) || fallbackPage.features?.[index]?.title || `Feature ${index + 1}`,
        body: safeTrim(item?.body) || fallbackPage.features?.[index]?.body || "Add supporting detail.",
      })),
      stats: normalizedStats,
      faq: normalizeItems(matching.faq, 5, (index) => fallbackPage.faq?.[index] || { question: `Question ${index + 1}?`, answer: "Answer here." }).map((item, index) => ({
        question: safeTrim(item?.question) || fallbackPage.faq?.[index]?.question || `Question ${index + 1}?`,
        answer: safeTrim(item?.answer) || fallbackPage.faq?.[index]?.answer || "Answer here.",
      })),
      marqueeItems: normalizeItems(matching.marqueeItems, 6, (index) => fallbackPage.marqueeItems?.[index] || `Message ${index + 1}`).map((item) => safeTrim(item)),
      galleryCaptions: normalizeItems(matching.galleryCaptions, 3, (index) => fallbackPage.galleryCaptions?.[index] || `Visual ${index + 1}`),
      testimonial: {
        quote: safeTrim(matching?.testimonial?.quote) || fallbackPage?.testimonial?.quote,
        author: safeTrim(matching?.testimonial?.author) || fallbackPage?.testimonial?.author,
        role: safeTrim(matching?.testimonial?.role) || fallbackPage?.testimonial?.role,
      },
      testimonialItems: normalizeItems(matching.testimonialItems, 4, (index) => fallbackPage.testimonialItems?.[index] || { quote: `Quote ${index + 1}`, author: `Author ${index + 1}`, role: "Customer" }).map((item, index) => ({
        quote: safeTrim(item?.quote) || fallbackPage.testimonialItems?.[index]?.quote || `Quote ${index + 1}`,
        author: safeTrim(item?.author) || fallbackPage.testimonialItems?.[index]?.author || `Author ${index + 1}`,
        role: safeTrim(item?.role) || fallbackPage.testimonialItems?.[index]?.role || "Customer",
      })),
      contactTitle: safeTrim(matching.contactTitle) || fallbackPage.contactTitle,
      contactSubtitle: safeTrim(matching.contactSubtitle) || fallbackPage.contactSubtitle,
      trustBadges: normalizeItems(matching.trustBadges, 5, (index) => fallbackPage.trustBadges?.[index] || `Badge ${index + 1}`).map((item) => safeTrim(item)).filter(Boolean),
    };
  });

  // Extract and validate design tokens from the AI response
  const rawDesign = raw?.design && typeof raw.design === "object" ? raw.design : {};
  const validHeroVariants = new Set(["split", "editorial", "framed", "spotlight"]);
  const validFeatureVariants = new Set(["glass-cards", "editorial-strip", "minimal-list", "cards"]);
  const validStatsVariants = new Set(["spotlight-orbs", "split-scoreboard", "minimal-ticker", "data-ribbon", "editorial-band"]);
  const validTestimonialVariants = new Set(["wall", "spotlight", "bubble", "stacked-card", "split-banner"]);
  const validPersonalities = new Set(["bold", "refined", "warm", "playful", "authoritative", "modern", "minimal"]);
  const isHexOrRgba = (v) => typeof v === "string" && /^(#[0-9a-fA-F]{3,8}|rgba?\(|linear-gradient|radial-gradient)/.test(safeTrim(v));

  const design = {
    personality: validPersonalities.has(safeTrim(rawDesign.personality)) ? safeTrim(rawDesign.personality) : null,
    heroVariant: validHeroVariants.has(safeTrim(rawDesign.heroVariant)) ? safeTrim(rawDesign.heroVariant) : null,
    featureVariant: validFeatureVariants.has(safeTrim(rawDesign.featureVariant)) ? safeTrim(rawDesign.featureVariant) : null,
    statsVariant: validStatsVariants.has(safeTrim(rawDesign.statsVariant)) ? safeTrim(rawDesign.statsVariant) : null,
    testimonialVariant: validTestimonialVariants.has(safeTrim(rawDesign.testimonialVariant)) ? safeTrim(rawDesign.testimonialVariant) : null,
    colorPrimary: isHexOrRgba(rawDesign.colorPrimary) ? safeTrim(rawDesign.colorPrimary) : null,
    colorAccent: isHexOrRgba(rawDesign.colorAccent) ? safeTrim(rawDesign.colorAccent) : null,
    colorBg: isHexOrRgba(rawDesign.colorBg) ? safeTrim(rawDesign.colorBg) : null,
    colorSurface: isHexOrRgba(rawDesign.colorSurface) ? safeTrim(rawDesign.colorSurface) : null,
    colorText: isHexOrRgba(rawDesign.colorText) ? safeTrim(rawDesign.colorText) : null,
    heroGradient: isHexOrRgba(rawDesign.heroGradient) ? safeTrim(rawDesign.heroGradient) : null,
    ctaGradient: isHexOrRgba(rawDesign.ctaGradient) ? safeTrim(rawDesign.ctaGradient) : null,
    darkSections: typeof rawDesign.darkSections === "boolean" ? rawDesign.darkSections : true,
  };

  return {
    siteTitle: safeTrim(raw?.siteTitle) || fallback.siteTitle,
    siteTagline: safeTrim(raw?.siteTagline) || fallback.siteTagline,
    navCtaText: safeTrim(raw?.navCtaText) || fallback.navCtaText,
    footerTagline: safeTrim(raw?.footerTagline) || fallback.footerTagline,
    design,
    pages: normalizedPages,
  };
}

function inferStackCostReference(brief) {
  const text = [brief?.proofPoints, brief?.notes, brief?.goal].map((value) => safeTrim(value)).filter(Boolean).join(" ");
  const currencyMatch = text.match(/\$\s?\d[\d,]*(?:\+)?(?:\s*(?:\/|per)\s*(?:mo|month|user|seat))?/i);
  if (currencyMatch?.[0]) {
    return currencyMatch[0].replace(/\s+/g, " ").trim();
  }
  const monthlyMatch = text.match(/\b\d[\d,]*(?:\+)?\s*(?:\/|per)\s*month\b/i);
  if (monthlyMatch?.[0]) {
    return monthlyMatch[0].replace(/\s+/g, " ").trim();
  }
  return "$1,300+/mo";
}

function buildSaasTestimonialItems(businessName, stackCostReference) {
  return [
    {
      id: "saas-testimonial-1",
      text: `We stopped bouncing between inboxes, spreadsheets, and disconnected automations. The whole follow-up flow finally lives in one place instead of costing us ${stackCostReference}.`,
      author: "Sales Ops Lead",
      role: "B2B revenue team",
      rating: 5,
    },
    {
      id: "saas-testimonial-2",
      text: `${businessName} gave our team one record, one timeline, and one process. Response times improved because nobody had to hunt through five tools to find context.`,
      author: "Revenue Manager",
      role: "Growth-focused service business",
      rating: 5,
    },
    {
      id: "saas-testimonial-3",
      text: `Instead of paying for a patchwork stack, we consolidated sales, email, SMS, and automation into one system our team actually uses every day.`,
      author: "Founder",
      role: "Scaling SME",
      rating: 5,
    },
    {
      id: "saas-testimonial-4",
      text: `The biggest win was visibility. Leads, conversations, tasks, and campaigns now sit in one place, so follow-up is faster and far less manual.`,
      author: "Operations Director",
      role: "Service-led business",
      rating: 5,
    },
    {
      id: "saas-testimonial-5",
      text: `Before switching, we were paying for overlap everywhere. After consolidating, the team spent less time managing software and more time moving deals forward.`,
      author: "Commercial Lead",
      role: "Multi-channel sales team",
      rating: 5,
    },
    {
      id: "saas-testimonial-6",
      text: `What changed immediately was simplicity. New staff could learn one platform quickly instead of being trained across a messy stack of separate tools.`,
      author: "Customer Success Manager",
      role: "High-volume support team",
      rating: 5,
    },
  ];
}

function buildSaasPricingPlans(businessName, stackCostReference) {
  return [
    {
      id: "saas-pricing-1",
      name: "Fragmented Stack",
      price: stackCostReference,
      description: "What many teams end up paying across separate CRM, email, SMS, automation, form, scheduling, and reporting tools.",
      includedFeatures: ["Multiple subscriptions", "Duplicated contacts and data", "Manual handoffs", "Admin-heavy setup"],
      features: ["Multiple subscriptions", "Duplicated contacts and data", "Manual handoffs", "Admin-heavy setup"],
      extras: ["More logins", "More integration issues"],
      cta: "Keep patching",
    },
    {
      id: "saas-pricing-2",
      name: businessName,
      price: "1 platform",
      description: "A unified system for sales, follow-up, automations, email, SMS, forms, scheduling, and reporting.",
      includedFeatures: ["Single source of truth", "Sales and marketing together", "Automation built in", "Less admin, faster follow-up"],
      features: ["Single source of truth", "Sales and marketing together", "Automation built in", "Less admin, faster follow-up"],
      extras: ["Cleaner reporting", "Lower software sprawl"],
      cta: "Book a demo",
      highlighted: true,
    },
    {
      id: "saas-pricing-3",
      name: "Scale Setup",
      price: "Custom",
      description: "For teams that need migration, advanced automation, custom pipelines, and rollout support.",
      includedFeatures: ["Migration planning", "Advanced workflows", "Custom onboarding", "Team rollout support"],
      features: ["Migration planning", "Advanced workflows", "Custom onboarding", "Team rollout support"],
      extras: ["Implementation guidance", "Growth-stage configuration"],
      cta: "Talk to sales",
    },
  ];
}

function buildSaasFaqItems(pageContent, brief, businessName, offer, stackCostReference) {
  const audience = safeTrim(brief?.targetAudience) || "growing teams";
  return [
    {
      question: `Why replace a stack that already kind of works?`,
      answer: `Because “kind of works” usually means your team is paying ${stackCostReference}, switching tabs all day, duplicating data, and losing speed in every handoff. ${businessName} is built to replace that friction with one connected workflow.`,
    },
    {
      question: `What does ${businessName} actually bring together?`,
      answer: `${businessName} is designed to bring CRM, lead capture, pipeline tracking, email, SMS, automations, forms, scheduling, and reporting into one platform so ${audience} can work from one source of truth instead of stitching tools together.` ,
    },
    {
      question: `How does this help sales teams close more deals?`,
      answer: `Speed and context. When every lead, message, task, and workflow sits in one system, follow-up happens faster, ownership is clearer, and the team can move opportunities forward without hunting through disconnected apps.` ,
    },
    {
      question: `Will we still need other software around it?`,
      answer: `That depends on your setup, but the goal is to reduce software sprawl, not add to it. Most teams use ${businessName} to replace several tools and dramatically simplify the day-to-day operating stack.` ,
    },
    {
      question: `Is this only for large businesses?`,
      answer: `No. ${businessName} is especially valuable for businesses that have grown into a messy stack too early and want a more cost-effective system before complexity gets worse.` ,
    },
    {
      question: `What happens during setup and migration?`,
      answer: `We map your current workflows, identify the tools causing duplication or drag, and configure a cleaner system around the way your team actually sells, follows up, and reports.` ,
    },
  ].concat((pageContent.faq || []).slice(0, 2));
}

function buildProjectBlueprint({ brief, pages, templateSlug, siteContent, buildType }) {
  const businessName = safeTrim(siteContent.siteTitle || brief.businessName) || "Your Business";
  const industryKey = inferIndustryKey({ ...brief, templateSlug });
  const isPremiumBuild = /(flagship|premium|signature|luxury|world\s*class)/i.test(`${safeTrim(buildType)} ${safeTrim(templateSlug)} ${safeTrim(brief?.notes)} ${safeTrim(brief?.goal)}`);
  const visuals = buildImagePack(industryKey, businessName, brief);
  const pageLinks = buildPageLinks(pages);
  const footerContact = buildFooterContactDetails(brief, businessName);
  const stackCostReference = inferStackCostReference(brief);
  const primaryOffer = safeTrim(brief.offer) || "your platform";

  // Apply AI-generated design tokens with sensible fallbacks per industry
  const design = siteContent.design && typeof siteContent.design === "object" ? siteContent.design : {};
  const personality = design.personality || null;

  // Industry-informed defaults for when AI design tokens are absent
  const industryDefaults = {
    saas: { heroVariant: "split", featureVariant: "glass-cards", statsVariant: "split-scoreboard", testimonialVariant: "wall", colorBg: "#020617", colorPrimary: "#38bdf8", colorAccent: "#22d3ee", ctaGradient: "linear-gradient(135deg,#22d3ee,#38bdf8)", heroGradient: "linear-gradient(135deg,#020617,#0f172a 56%,#1d4ed8)" },
    coach: { heroVariant: "editorial", featureVariant: "editorial-strip", statsVariant: "spotlight-orbs", testimonialVariant: "bubble", colorBg: "#1a0a00", colorPrimary: "#ea580c", colorAccent: "#fbbf24", ctaGradient: "linear-gradient(135deg,#ea580c,#dc2626)", heroGradient: "linear-gradient(135deg,#1a0a00,#3b1108)" },
    medical: { heroVariant: "framed", featureVariant: "minimal-list", statsVariant: "minimal-ticker", testimonialVariant: "stacked-card", colorBg: "#f0f9ff", colorPrimary: "#0284c7", colorAccent: "#06b6d4", ctaGradient: "linear-gradient(135deg,#0284c7,#0369a1)", heroGradient: "linear-gradient(135deg,#0f172a,#0c4a6e)" },
    law: { heroVariant: "editorial", featureVariant: "editorial-strip", statsVariant: "data-ribbon", testimonialVariant: "stacked-card", colorBg: "#1c1917", colorPrimary: "#b45309", colorAccent: "#d97706", ctaGradient: "linear-gradient(135deg,#b45309,#92400e)", heroGradient: "linear-gradient(135deg,#1c1917,#292524)" },
    finance: { heroVariant: "framed", featureVariant: "minimal-list", statsVariant: "data-ribbon", testimonialVariant: "stacked-card", colorBg: "#0f172a", colorPrimary: "#1d4ed8", colorAccent: "#3b82f6", ctaGradient: "linear-gradient(135deg,#1d4ed8,#1e40af)", heroGradient: "linear-gradient(135deg,#0f172a,#1e293b)" },
    property: { heroVariant: "split", featureVariant: "glass-cards", statsVariant: "spotlight-orbs", testimonialVariant: "wall", colorBg: "#0f0f0f", colorPrimary: "#16a34a", colorAccent: "#22c55e", ctaGradient: "linear-gradient(135deg,#16a34a,#15803d)", heroGradient: "linear-gradient(135deg,#0f0f0f,#1a2e1a)" },
    beauty: { heroVariant: "editorial", featureVariant: "editorial-strip", statsVariant: "spotlight-orbs", testimonialVariant: "bubble", colorBg: "#1a0a12", colorPrimary: "#be185d", colorAccent: "#ec4899", ctaGradient: "linear-gradient(135deg,#be185d,#9d174d)", heroGradient: "linear-gradient(135deg,#1a0a12,#2d1b2e)" },
    fitness: { heroVariant: "spotlight", featureVariant: "glass-cards", statsVariant: "spotlight-orbs", testimonialVariant: "wall", colorBg: "#0a0a0a", colorPrimary: "#dc2626", colorAccent: "#f97316", ctaGradient: "linear-gradient(135deg,#dc2626,#ea580c)", heroGradient: "linear-gradient(135deg,#0a0a0a,#1c0505)" },
    trade: { heroVariant: "spotlight", featureVariant: "cards", statsVariant: "split-scoreboard", testimonialVariant: "wall", colorBg: "#111827", colorPrimary: "#d97706", colorAccent: "#f59e0b", ctaGradient: "linear-gradient(135deg,#d97706,#b45309)", heroGradient: "linear-gradient(135deg,#111827,#1f2937)" },
    restaurant: { heroVariant: "editorial", featureVariant: "editorial-strip", statsVariant: "minimal-ticker", testimonialVariant: "bubble", colorBg: "#1c1106", colorPrimary: "#b45309", colorAccent: "#f59e0b", ctaGradient: "linear-gradient(135deg,#b45309,#92400e)", heroGradient: "linear-gradient(135deg,#1c1106,#2d1a06)" },
    ecommerce: { heroVariant: "split", featureVariant: "glass-cards", statsVariant: "spotlight-orbs", testimonialVariant: "wall", colorBg: "#0f172a", colorPrimary: "#7c3aed", colorAccent: "#a78bfa", ctaGradient: "linear-gradient(135deg,#7c3aed,#6d28d9)", heroGradient: "linear-gradient(135deg,#0f172a,#1e1b4b)" },
    creative: { heroVariant: "framed", featureVariant: "editorial-strip", statsVariant: "minimal-ticker", testimonialVariant: "stacked-card", colorBg: "#0f0f0f", colorPrimary: "#0891b2", colorAccent: "#22d3ee", ctaGradient: "linear-gradient(135deg,#0891b2,#0e7490)", heroGradient: "linear-gradient(135deg,#0f0f0f,#0c1a1f)" },
    business: { heroVariant: "editorial", featureVariant: "glass-cards", statsVariant: "editorial-band", testimonialVariant: "spotlight", colorBg: "#0f172a", colorPrimary: "#2563eb", colorAccent: "#3b82f6", ctaGradient: "linear-gradient(135deg,#2563eb,#1d4ed8)", heroGradient: "linear-gradient(135deg,#0f172a,#1e293b)" },
  };

  const ind = industryDefaults[industryKey] || industryDefaults.business;

  // Resolved design values: AI design > industry default
  const resolvedHeroVariant = design.heroVariant || ind.heroVariant;
  const resolvedFeatureVariant = design.featureVariant || ind.featureVariant;
  const resolvedStatsVariant = design.statsVariant || ind.statsVariant;
  const resolvedTestimonialVariant = design.testimonialVariant || ind.testimonialVariant;
  const resolvedColorPrimary = design.colorPrimary || ind.colorPrimary;
  const resolvedColorAccent = design.colorAccent || ind.colorAccent;
  const resolvedColorBg = design.colorBg || ind.colorBg;
  const resolvedColorSurface = design.colorSurface || "rgba(255,255,255,0.08)";
  const resolvedColorText = design.colorText || "#f8fafc";
  const resolvedHeroGradient = design.heroGradient || ind.heroGradient;
  const resolvedCtaGradient = design.ctaGradient || ind.ctaGradient;

  const globalNavBlock = createBlock(BlockTypes.NAV_BAR, {
    brand: businessName,
    links: pageLinks,
    ctaText: siteContent.navCtaText,
    ctaLink: "#contact",
    variant: "boxed-brand",
    stickyMode: industryKey === "saas" ? "sticky-solid" : "sticky",
    showLogo: true,
    linkHoverEffect: "glow",
    brandFontSize: industryKey === "saas" ? 20 : 18,
    logoWidth: industryKey === "saas" ? 60 : 44,
    fullWidthBackground: true,
    backgroundColor: industryKey === "saas" ? `rgba(2,6,23,0.92)` : `${resolvedColorBg}e8`,
    borderColor: `rgba(148,163,184,0.2)`,
    textColor: resolvedColorText,
    buttonColor: resolvedCtaGradient,
    buttonTextColor: personality === "refined" || personality === "warm" ? "#1c1917" : "#ffffff",
    ...buildAnimationProps({ sectionAnimation: "fade-in" }),
  });

  const globalFooterBlock = createBlock(BlockTypes.FOOTER, {
    brand: businessName,
    tagline: siteContent.footerTagline,
    navLinks: pageLinks,
    contactEmail: footerContact.contactEmail,
    contactPhone: footerContact.contactPhone,
    contactAddress: footerContact.contactAddress,
    copyrightText: footerContact.copyrightText,
    logoWidth: industryKey === "saas" ? 84 : 48,
    footerVariant: industryKey === "saas" ? "editorial" : "service-grid",
    footerEyebrow: industryKey === "saas" ? "One platform. Less sprawl. Faster follow-up." : "Closing note",
    spotlightItems: industryKey === "saas" ? ["CRM", "Email", "SMS", "Automation", "Reporting"] : [],
    spotlightHeading: industryKey === "saas" ? "Why teams switch" : "",
    spotlightText: industryKey === "saas" ? `Replace disconnected tools, reduce admin, and stop paying ${stackCostReference} for a fragmented stack.` : "",
    showNewsletter: false,
  });

  const pageBlocks = {};
  const pagesContent = {};

  siteContent.pages.forEach((pageContent, pageIndex) => {
    const pageName = safeTrim(pageContent.name) || `Page ${pageIndex + 1}`;
    const pageKey = slugify(pageName);
    const isHome = pageIndex === 0 || pageKey === "home";
    const isSaasHome = isHome && industryKey === "saas";
    const isContact = /(contact|book|apply|quote)/i.test(pageName);
    const isOffer = /(service|product|pricing|offer|solution)/i.test(pageName);
    const isStory = /(about|story|team)/i.test(pageName);
    const isProof = /(result|case|portfolio|gallery|work|testimonial)/i.test(pageName);

    const galleryImages = visuals.gallery.map((image, index) => ({
      ...image,
      alt: `${businessName} ${pageName} image ${index + 1}`,
      caption: safeTrim(pageContent.galleryCaptions[index]) || image.caption,
    }));

    const commonHero = createBlock(BlockTypes.HERO, {
      eyebrow: pageContent.heroEyebrow,
      headline: isSaasHome ? `${businessName} replaces the disconnected tools slowing your revenue team down` : pageContent.heroHeadline,
      subheadline: isSaasHome
        ? `Bring CRM, email, SMS, automations, forms, scheduling, and reporting into one platform. Stop paying ${stackCostReference} for a fragmented stack and give your team one system built to move deals faster.`
        : pageContent.heroSubheadline,
      ctaText: pageContent.ctaText,
      ctaLink: "#contact",
      backgroundStyle: "image",
      backgroundImage: visuals.hero,
      heroVariant: isSaasHome ? "split" : resolvedHeroVariant,
      minHeight: isSaasHome ? "780px" : isHome ? "720px" : "640px",
      enableParallax: true,
      backgroundColor: resolvedHeroGradient,
      contentBackground: isSaasHome ? "linear-gradient(160deg, rgba(2,6,23,0.76), rgba(15,23,42,0.48))" : `linear-gradient(160deg, ${resolvedColorBg}cc, ${resolvedColorBg}66)`,
      headlineColor: resolvedColorText,
      textColor: `${resolvedColorText}cc`,
      headlineFontSize: isSaasHome ? 68 : undefined,
      subheadlineFontSize: isSaasHome ? 22 : undefined,
      buttonColor: isSaasHome ? "linear-gradient(135deg,#22d3ee,#38bdf8)" : resolvedCtaGradient,
      buttonTextColor: isSaasHome ? "#031525" : (personality === "refined" || personality === "warm" ? "#1c1917" : "#ffffff"),
      floatingImage: isSaasHome ? visuals.media || visuals.gallery[1]?.src || "" : isHome ? visuals.gallery[1]?.src || "" : "",
      floatingWidth: isSaasHome ? 560 : isHome ? 320 : undefined,
      floatingHeight: isSaasHome ? 360 : isHome ? 420 : undefined,
      floatingX: isSaasHome ? 52 : isHome ? 72 : undefined,
      floatingY: isSaasHome ? 18 : isHome ? 54 : undefined,
      ...buildAnimationProps({ sectionAnimation: "zoom", textAnimation: "slide-right", subheadlineAnimation: "slide-left" }),
    });

    const marqueeBlock = createBlock("marquee-strip", {
      backgroundColor: resolvedColorBg,
      textColor: resolvedColorText,
      accentColor: resolvedColorAccent,
      speed: isHome ? 22 : 26,
      items: (pageContent.marqueeItems || []).filter(Boolean),
      ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.04 }),
    });

    const introText = createBlock(BlockTypes.TEXT, {
      text: `${pageContent.introTitle}\n\n${pageContent.introBody}`,
      backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)",
      textColor: "#0f172a",
      textFontSize: 20,
      ...buildAnimationProps({ sectionAnimation: "slide-left", sectionAnimationDelay: 0.04, textAnimation: "slide-left", subheadlineAnimation: "fade-in" }),
    });

    const saasPainBlock = createBlock(BlockTypes.COLUMNS_2, {
      title: "Too many tools. Too much admin. Too much cost.",
      leftTitle: "What teams are dealing with now",
      leftContent: `CRM in one tool. Email in another. SMS somewhere else. Forms, automations, reporting, and scheduling living in separate apps. The result is duplicated data, slower follow-up, and software costs that can climb to ${stackCostReference} or more.`,
      rightTitle: `What ${businessName} changes`,
      rightContent: `Replace the patchwork with one connected platform for sales, follow-up, marketing, and reporting. Your team works from one record, one timeline, and one workflow, so leads move faster and admin stops eating the day.`,
      leftImage: visuals.gallery[0]?.src || visuals.hero,
      rightImage: visuals.gallery[1]?.src || visuals.media,
      ratio: "50-50",
      backgroundColor: "linear-gradient(135deg,#020617,#0f172a)",
      columnBackgroundColor: "rgba(255,255,255,0.06)",
      columnBorderColor: "rgba(148,163,184,0.18)",
      columnTitleColor: "#f8fafc",
      columnBodyColor: "#cbd5e1",
      textColor: "#e2e8f0",
      columnShadow: "strong",
      columnRadius: 28,
      columnPadding: 28,
      minHeight: "560px",
      ...buildAnimationProps({ sectionAnimation: "slide-left", sectionAnimationDelay: 0.08, textAnimation: "slide-left", subheadlineAnimation: "fade-up" }),
    });

    const saasCapabilityBlock = createBlock(BlockTypes.TRUST_BADGES, {
      trustBadgeVariant: "soft-cards",
      badges: [
        { icon: "📈", label: "Pipeline visibility" },
        { icon: "✉️", label: "Email campaigns" },
        { icon: "💬", label: "SMS follow-up" },
        { icon: "⚙️", label: "Built-in automations" },
        { icon: "🧾", label: "Forms and capture" },
        { icon: "📊", label: "Reporting and attribution" },
      ],
      backgroundColor: "linear-gradient(180deg,#e0f2fe,#f8fafc)",
      textColor: "#0f172a",
      borderColor: "rgba(125,211,252,0.42)",
      badgeBackgroundColor: "linear-gradient(180deg,#ffffff,#eff6ff)",
      badgeFontSize: 16,
      badgePadding: 18,
      ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.12, textAnimation: "fade-up", subheadlineAnimation: "fade-up" }),
    });

    const featuresBlock = createBlock(BlockTypes.FEATURE_LIST, {
      title: pageContent.introTitle,
      items: pageContent.features.map((item, index) => ({
        title: safeTrim(item?.title) || `Feature ${index + 1}`,
        body: safeTrim(item?.body) || "Add supporting detail.",
        image: galleryImages[index]?.src || visuals.hero,
      })),
      layout: "vertical",
      featureVariant: resolvedFeatureVariant,
      backgroundColor: resolvedFeatureVariant === "editorial-strip" ? "linear-gradient(180deg,#fffaf2,#f6f3ee)" : resolvedFeatureVariant === "minimal-list" ? "linear-gradient(180deg,#f8fafc,#f1f5f9)" : "linear-gradient(180deg,#ffffff,#eef2ff)",
      ...buildAnimationProps({ sectionAnimation: "slide-right", sectionAnimationDelay: 0.08, textAnimation: "slide-right", subheadlineAnimation: "fade-up" }),
    });

    const galleryBlock = createBlock(BlockTypes.IMAGE_GALLERY, {
      title: `${pageName} visuals`,
      galleryVariant: isProof ? "editorial-mosaic" : "balanced-grid",
      images: galleryImages,
      columns: 3,
      ...buildAnimationProps({ sectionAnimation: "slide-left", sectionAnimationDelay: 0.12, textAnimation: "slide-left", subheadlineAnimation: "fade-up" }),
    });

    const statsBlock = createBlock(BlockTypes.STATS, {
      title: isSaasHome ? "Why unified platforms win" : `${pageName} proof`,
      subtitle: isSaasHome ? `Consolidate software, reduce handoffs, and stop paying ${stackCostReference} for overlap.` : pageContent.heroSubheadline,
      statsVariant: isSaasHome ? "split-scoreboard" : resolvedStatsVariant,
      backgroundColor: isSaasHome ? "linear-gradient(180deg,#020617,#111827)" : resolvedStatsVariant === "minimal-ticker" || resolvedStatsVariant === "data-ribbon" ? "linear-gradient(180deg,#f8fafc,#f1f5f9)" : resolvedHeroGradient,
      textColor: isSaasHome || resolvedStatsVariant === "spotlight-orbs" || resolvedStatsVariant === "split-scoreboard" ? resolvedColorText : "#0f172a",
      cardBackgroundColor: resolvedColorSurface,
      accentColor: resolvedColorAccent,
      stats: (isSaasHome ? [
        { number: "5+", label: "Tools replaced", detail: "Reduce the patchwork of separate apps your team is switching between all day." },
        { number: stackCostReference, label: "Typical stack cost", detail: "What some teams are paying before they consolidate sales, follow-up, and marketing." },
        { number: "1", label: "Source of truth", detail: "One platform for leads, conversations, automations, reporting, and next steps." },
      ] : pageContent.stats).map((item, index) => ({
        number: safeTrim(item?.number) || `Point ${index + 1}`,
        label: safeTrim(item?.label) || `Result ${index + 1}`,
        detail: safeTrim(item?.detail) || "Add supporting proof.",
      })),
      ...buildAnimationProps({ sectionAnimation: "blur-in", sectionAnimationDelay: 0.16, textAnimation: "fade-up", subheadlineAnimation: "slide-right" }),
    });

    const saasPricingBlock = createBlock(BlockTypes.PRICING_TABLE, {
      title: "What software sprawl really costs",
      pricingVariant: "contrast",
      backgroundColor: "linear-gradient(180deg,#f8fbff,#eef6ff)",
      borderColor: "rgba(148,163,184,0.2)",
      accentColor: "#22d3ee",
      plans: buildSaasPricingPlans(businessName, stackCostReference),
      ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.18, textAnimation: "fade-up", subheadlineAnimation: "fade-up" }),
    });

    const faqBlock = createBlock(BlockTypes.FAQ, {
      title: isSaasHome ? "Questions teams ask before they consolidate their stack" : `Questions about ${pageName}`,
      items: (isSaasHome ? buildSaasFaqItems(pageContent, brief, businessName, primaryOffer, stackCostReference) : pageContent.faq).map((item, index) => ({
        id: `${pageKey}-faq-${index + 1}`,
        question: safeTrim(item?.question) || `Question ${index + 1}?`,
        answer: safeTrim(item?.answer) || "Answer here.",
        heading: safeTrim(item?.question) || `Question ${index + 1}?`,
        content: safeTrim(item?.answer) || "Answer here.",
      })),
      backgroundColor: resolvedHeroGradient,
      faqPanelBackgroundColor: design.darkSections !== false ? `linear-gradient(180deg,${resolvedColorBg}f5,${resolvedColorBg}e0)` : "rgba(255,255,255,0.94)",
      headlineColor: resolvedColorText,
      questionColor: resolvedColorText,
      answerColor: `${resolvedColorText}cc`,
      chevronColor: resolvedColorAccent,
      itemBackgroundColor: resolvedColorSurface,
      itemBorderColor: `rgba(148,163,184,0.16)`,
      headlineFontSize: isSaasHome ? 40 : undefined,
      questionFontSize: isSaasHome ? 22 : undefined,
      answerFontSize: isSaasHome ? 18 : undefined,
      ...buildAnimationProps({ sectionAnimation: "slide-right", sectionAnimationDelay: 0.2, textAnimation: "slide-right", subheadlineAnimation: "fade-up" }),
    });
    const testimonialBlock = createBlock(BlockTypes.TESTIMONIAL, {
      title: isSaasHome ? "What consolidation feels like after the switch" : undefined,
      text: pageContent.testimonial.quote,
      author: pageContent.testimonial.author,
      role: pageContent.testimonial.role,
      items: isSaasHome ? buildSaasTestimonialItems(businessName, stackCostReference) : pageContent.testimonialItems,
      testimonialVariant: isSaasHome ? "wall" : resolvedTestimonialVariant,
      backgroundColor: isSaasHome ? "linear-gradient(135deg,#020617,#1e293b)" : resolvedHeroGradient,
      textColor: resolvedColorText,
      cardBackgroundColor: resolvedColorSurface,
      borderColor: `rgba(148,163,184,0.18)`,
      accentColor: resolvedColorAccent,
      ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.24, textAnimation: "slide-left", subheadlineAnimation: "fade-up" }),
    });

    const trustBadges = createBlock(BlockTypes.TRUST_BADGES, {
      badges: pageContent.trustBadges.map((label, index) => ({
        icon: index === 0 ? "⚡" : index === 1 ? "🎯" : index === 2 ? "✅" : index === 3 ? "🔐" : "⭐",
        label: safeTrim(label) || `Badge ${index + 1}`,
      })),
      backgroundColor: resolvedHeroGradient,
      textColor: resolvedColorText,
      ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.28 }),
    });

    const contactBlock = createBlock(BlockTypes.CONTACT_FORM, {
      title: isSaasHome ? `See how ${businessName} can replace your current stack` : pageContent.contactTitle,
      subtitle: isSaasHome ? `If your team is juggling too many tools, too much admin, and too much software cost, we will map the simplest path into one cleaner platform.` : pageContent.contactSubtitle,
      mediaPosition: "right",
      mediaImage: visuals.media,
      mediaAlt: `${businessName} contact image`,
      formVariant: "split-card",
      sectionGradient: isSaasHome ? "linear-gradient(135deg,#020617,#1d4ed8)" : resolvedHeroGradient,
      cardBackgroundColor: "rgba(255,255,255,0.96)",
      buttonBackgroundColor: resolvedCtaGradient,
      buttonTextColor: personality === "refined" || personality === "warm" ? "#1c1917" : "#ffffff",
      submitText: isSaasHome ? "Book a walkthrough" : undefined,
      ...buildAnimationProps({ sectionAnimation: "slide-up", sectionAnimationDelay: 0.32, textAnimation: "slide-right", subheadlineAnimation: "fade-up" }),
    });
    const stackBlock = createBlock(BlockTypes.IMAGE_STACK, {
      title: `${businessName} in motion`,
      backgroundColor: "linear-gradient(135deg,#fff1f2,#eef2ff 45%,#ecfeff)",
      minHeight: "760px",
      images: [
        { id: `${pageKey}-stack-1`, kind: "image", src: visuals.stack[0] || visuals.hero, assetId: "", x: 40, y: 56, width: 420, height: 300, rotation: -8, radius: 28, zIndex: 1 },
        { id: `${pageKey}-stack-2`, kind: "image", src: visuals.stack[1] || visuals.media, assetId: "", x: 300, y: 240, width: 340, height: 250, rotation: 7, radius: 28, zIndex: 2 },
        { id: `${pageKey}-stack-text`, kind: "text", content: `${pageContent.introTitle}\n${pageContent.ctaText}`, x: 660, y: 120, width: 320, height: 220, rotation: -2, radius: 24, zIndex: 3, fontSize: 38, fontWeight: "700", textAlign: "center", verticalAlign: "center", textColor: "#111827", background: "rgba(255,255,255,0.88)" },
      ],
      ...buildAnimationProps({ sectionAnimation: "slide-right", sectionAnimationDelay: 0.1, textAnimation: "slide-right", subheadlineAnimation: "fade-up" }),
    });

    const teamBlock = createBlock(BlockTypes.TEAM, {
      title: `Meet ${businessName}`,
      subtitle: pageContent.introBody,
      teamVariant: "spotlight-strip",
      members: [
        { id: `${pageKey}-team-1`, name: "Strategy Lead", role: "Planning & positioning", image: visuals.gallery[0]?.src || visuals.hero, bio: pageContent.features[0]?.body || "Shapes the messaging and offer framing." },
        { id: `${pageKey}-team-2`, name: "Creative Lead", role: "Design & presentation", image: visuals.gallery[1]?.src || visuals.media, bio: pageContent.features[1]?.body || "Turns the strategy into a clear visual experience." },
        { id: `${pageKey}-team-3`, name: "Delivery Lead", role: "Execution & follow-through", image: visuals.gallery[2]?.src || visuals.support, bio: pageContent.features[2]?.body || "Keeps the client journey moving toward conversion." },
      ],
      ...buildAnimationProps({ sectionAnimation: "slide-right", sectionAnimationDelay: 0.18, textAnimation: "slide-right", subheadlineAnimation: "fade-up" }),
    });

    const columnsBlock = createBlock(BlockTypes.COLUMNS_2, {
      title: pageContent.introTitle,
      leftTitle: pageContent.features[0]?.title || `For ${businessName}`,
      leftContent: pageContent.features[0]?.body || pageContent.introBody,
      leftImage: visuals.gallery[0]?.src || visuals.hero,
      rightTitle: pageContent.features[1]?.title || "Why it matters",
      rightContent: pageContent.features[1]?.body || pageContent.heroSubheadline,
      rightImage: visuals.gallery[1]?.src || visuals.media,
      ratio: "60-40",
      backgroundColor: resolvedHeroGradient,
      columnBackgroundColor: resolvedColorSurface,
      columnBorderColor: "rgba(255,255,255,0.16)",
      columnTitleColor: resolvedColorText,
      columnBodyColor: `${resolvedColorText}cc`,
      columnShadow: "strong",
      columnRadius: 24,
      columnPadding: 22,
      minHeight: "540px",
      ...buildAnimationProps({ sectionAnimation: "slide-left", sectionAnimationDelay: 0.14, textAnimation: "slide-left", subheadlineAnimation: "fade-up" }),
    });

    const blocks = isSaasHome
      ? [commonHero, marqueeBlock, saasPainBlock, statsBlock, saasCapabilityBlock, saasPricingBlock, testimonialBlock, faqBlock, contactBlock]
      : isHome
      ? [commonHero, marqueeBlock, introText, stackBlock, statsBlock, columnsBlock, featuresBlock, galleryBlock, trustBadges, testimonialBlock, faqBlock, contactBlock]
      : isStory
        ? [commonHero, introText, galleryBlock, statsBlock, teamBlock, testimonialBlock, contactBlock]
        : isOffer
          ? [commonHero, introText, columnsBlock, featuresBlock, galleryBlock, trustBadges, faqBlock, testimonialBlock, contactBlock]
          : isContact
            ? [commonHero, trustBadges, contactBlock, faqBlock, galleryBlock]
            : isProof
              ? [commonHero, introText, columnsBlock, galleryBlock, statsBlock, trustBadges, testimonialBlock, faqBlock, contactBlock]
              : [commonHero, introText, columnsBlock, featuresBlock, galleryBlock, trustBadges, testimonialBlock, faqBlock, contactBlock];

    pageBlocks[pageName] = applyGeneratedMotion(blocks, {
      isHome,
      isSaasHome,
      isPremiumBuild,
      baseDelay: isPremiumBuild ? 0 : isHome ? 0.02 : 0.04,
      stagger: isPremiumBuild ? 0.05 : isSaasHome ? 0.06 : 0.08,
    });
    pagesContent[pageName] = "";
  });

  return {
    name: businessName,
    pageBlocks,
    pagesContent,
    globalNavBlock,
    globalFooterBlock,
  };
}

async function generateAiSiteContent({ brief, pages, buildType, templateSlug }) {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.82,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a world-class brand strategist, senior copywriter, and creative director who builds premium custom websites. Return valid JSON only.

Your job is to produce a complete website brief that feels uniquely built for this specific business — not a generic template fill-in. Every headline, subheading, and feature point must reflect the real voice, positioning, and audience of this business.

Copy rules:
- Write in the brand's authentic voice. A premium law firm sounds different from a local gym. A SaaS startup sounds different from a boutique spa. Let the personality come through.
- Make every sentence earn its place. No filler words like "cutting-edge", "industry-leading", "world-class", or "innovative solutions".
- Avoid vague claims. Say what the business actually does, for whom, and what outcome they can expect.
- Do not invent specific percentages, numbers, or statistics unless they were provided in the brief.
- The home page should feel like a complete, publishable sales page after light editing.

Design rules:
- Choose a visual personality that genuinely fits this brand: bold for disruptors, refined for premium service firms, warm for community-focused brands, authoritative for professional services, playful for consumer brands, modern for tech.
- Select a color palette that reflects the personality. Avoid defaulting to generic blue/dark palettes when another color would serve the brand better.
- Pick section layout variants that reinforce the brand personality (see schema below).
- Dark hero backgrounds suit bold/modern/SaaS brands. Light or editorial backgrounds suit refined/premium/professional brands.`,
      },
      {
        role: "user",
        content: `Create production-ready starter website copy and a design brief for this business.

Business Name: ${safeTrim(brief.businessName) || "(not provided)"}
Offer: ${safeTrim(brief.offer) || "(not provided)"}
Target Audience: ${safeTrim(brief.targetAudience) || "(not provided)"}
Main Goal: ${safeTrim(brief.goal) || "(not provided)"}
SEO Keywords: ${safeTrim(brief.primaryKeywords) || "(not provided)"}
Service Areas: ${safeTrim(brief.serviceAreas) || "(not provided)"}
Differentiators: ${safeTrim(brief.differentiators) || "(not provided)"}
Proof Points: ${safeTrim(brief.proofPoints) || "(not provided)"}
Brand Tone: ${safeTrim(brief.tone) || "(not provided)"}
Must-Have Sections: ${safeTrim(brief.mustIncludeSections) || "(not provided)"}
Requested Images: ${safeTrim(brief.imageRequests) || "(not provided)"}
Image URLs: ${safeTrim(brief.imageUrls) || "(not provided)"}
Public Contact Email: ${safeTrim(brief.contactEmail) || "(not provided)"}
Public Contact Phone: ${safeTrim(brief.contactPhone) || "(not provided)"}
Notes: ${safeTrim(brief.notes) || "(none)"}
Build Type: ${safeTrim(buildType) || "website"}
Recommended Template: ${safeTrim(templateSlug) || "(none)"}
Pages: ${(Array.isArray(pages) ? pages : []).map((page) => `${page.name}: ${page.objective || ""}`).join(" | ")}

Return JSON in this exact shape:
{
  "siteTitle": "Business Name or polished site title",
  "siteTagline": "one short brand line",
  "navCtaText": "2-4 word CTA",
  "footerTagline": "short footer tagline",
  "design": {
    "personality": "one of: bold | refined | warm | playful | authoritative | modern | minimal",
    "heroVariant": "one of: split | editorial | framed | spotlight",
    "featureVariant": "one of: glass-cards | editorial-strip | minimal-list | cards",
    "statsVariant": "one of: spotlight-orbs | split-scoreboard | minimal-ticker | data-ribbon | editorial-band",
    "testimonialVariant": "one of: wall | spotlight | bubble | stacked-card | split-banner",
    "colorPrimary": "#hex — main CTA and button color",
    "colorAccent": "#hex — highlights, markers, eyebrow labels",
    "colorBg": "#hex — hero section and dark block background",
    "colorSurface": "rgba or hex — card surface color on dark sections",
    "colorText": "#hex — body text color on dark backgrounds",
    "heroGradient": "CSS gradient for hero background (e.g. linear-gradient(135deg,#1a1a2e,#16213e))",
    "ctaGradient": "CSS gradient for CTA buttons (e.g. linear-gradient(135deg,#f59e0b,#ef4444))",
    "darkSections": true
  },
  "pages": [
    {
      "name": "Page Name",
      "heroEyebrow": "short keyword-rich label",
      "heroHeadline": "clear, specific headline — avoid generic phrases",
      "heroSubheadline": "3-5 sentence subheadline specific to this business and page",
      "ctaText": "2-4 word CTA",
      "introTitle": "section title",
      "introBody": "2 substantial paragraphs — specific to the business, offer, and audience",
      "features": [
        { "title": "feature title", "body": "specific supporting sentence — no filler" },
        { "title": "feature title", "body": "specific supporting sentence — no filler" },
        { "title": "feature title", "body": "specific supporting sentence — no filler" },
        { "title": "feature title", "body": "specific supporting sentence — no filler" },
        { "title": "feature title", "body": "specific supporting sentence — no filler" }
      ],
      "stats": [
        { "number": "short metric or proof word", "label": "label", "detail": "specific proof or benefit line" },
        { "number": "short metric or proof word", "label": "label", "detail": "specific proof or benefit line" },
        { "number": "short metric or proof word", "label": "label", "detail": "specific proof or benefit line" },
        { "number": "short metric or proof word", "label": "label", "detail": "specific proof or benefit line" }
      ],
      "faq": [
        { "question": "question", "answer": "answer" },
        { "question": "question", "answer": "answer" },
        { "question": "question", "answer": "answer" },
        { "question": "question", "answer": "answer" },
        { "question": "question", "answer": "answer" }
      ],
      "marqueeItems": ["short message", "short message", "short message", "short message", "short message", "short message"],
      "galleryCaptions": ["caption 1", "caption 2", "caption 3"],
      "testimonial": { "quote": "quote", "author": "name", "role": "role" },
      "testimonialItems": [
        { "quote": "quote", "author": "name", "role": "role" },
        { "quote": "quote", "author": "name", "role": "role" },
        { "quote": "quote", "author": "name", "role": "role" },
        { "quote": "quote", "author": "name", "role": "role" }
      ],
      "contactTitle": "contact section title",
      "contactSubtitle": "contact section subtitle",
      "trustBadges": ["badge 1", "badge 2", "badge 3", "badge 4", "badge 5"]
    }
  ]
}

Design variant selection guide:
- heroVariant "split": SaaS, tech, modern. Creates a side-by-side layout with floating image.
- heroVariant "editorial": Premium service businesses, law, finance, luxury brands. Warm editorial feel.
- heroVariant "framed": Clean corporate, professional services, medical. Minimal with a framed container.
- heroVariant "spotlight": Bold impactful brands, fitness, trade, coaches. Full-bleed centred statement.
- featureVariant "editorial-strip": Premium/refined brands. Alternating image-text strips.
- featureVariant "glass-cards": Modern/dark brands, SaaS. Glass effect cards.
- featureVariant "minimal-list": Clean/corporate. Compact list with thumbnail.
- featureVariant "cards": Standard. Classic card grid.
- statsVariant "spotlight-orbs": Bold/impactful brands. Large glowing number orbs.
- statsVariant "split-scoreboard": Data-heavy/SaaS. Side-by-side scoreboard style.
- statsVariant "minimal-ticker": Clean minimal. Small horizontal ticker.
- statsVariant "data-ribbon": Clean ribbon with numbers.
- statsVariant "editorial-band": Standard editorial.
- testimonialVariant "wall": Social proof heavy, ecommerce, SaaS.
- testimonialVariant "bubble": Conversational/warm brands, coaches, community.
- testimonialVariant "stacked-card": Premium, refined.
- testimonialVariant "split-banner": High-impact featured testimonial.
- testimonialVariant "spotlight": Single featured testimonial with emphasis.

Copy rules:
- Every page must be aligned to its specific objective.
- Copy must be specific to this business, offer, audience, and goal.
- Use SEO keywords naturally in headings and body copy.
- Make the home page feel like a complete sales page with enough depth to publish after light editing.
- Do not write placeholder lorem ipsum style copy or generic phrases.
- Keep CTA text short and concrete.
- Write enough copy to fully explain the business, the offer, why it matters, and what the next step is.
- Return one page object for every requested page name.`,
      },
    ],
  });

  const content = completion?.choices?.[0]?.message?.content || "";
  return JSON.parse(content);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const brief = req.body?.brief && typeof req.body.brief === "object" ? req.body.brief : {};
  const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
  const templateSlug = safeTrim(req.body?.templateSlug);
  const buildType = safeTrim(req.body?.buildType) || "website";

  if (!pages.length) {
    return res.status(400).json({ ok: false, error: "No pages provided" });
  }

  const fallback = buildFallbackContent({ brief, pages });

  try {
    let siteContent = fallback;

    if (process.env.OPENAI_API_KEY) {
      try {
        const aiRaw = await generateAiSiteContent({ brief, pages, buildType, templateSlug });
        siteContent = normalizeAiPayload(aiRaw, pages, fallback);
      } catch (aiError) {
        console.error("generate-site-content ai error:", aiError);
        siteContent = fallback;
      }
    }

    const blueprint = buildProjectBlueprint({ brief, pages, templateSlug, siteContent, buildType });
    return res.status(200).json({ ok: true, ...blueprint, siteContent });
  } catch (error) {
    console.error("generate-site-content error:", error);
    return res.status(500).json({ ok: false, error: "Failed to generate site content" });
  }
}