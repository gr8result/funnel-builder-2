import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockDefinitions, BlockTypes } from "./pageBlockComponents";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../../components/website-builder/WebsiteBlockRenderer";

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function createBlock(type, props = {}) {
  const definition = BlockDefinitions[type] || BlockDefinitions[BlockTypes.TEXT];
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    props: {
      ...cloneValue(definition.defaultProps),
      ...props,
    },
  };
}

function isWebsiteBlockArray(value) {
  return Array.isArray(value) && value.some((block) => block && BlockDefinitions[block.type]);
}

function buildFallbackBlocks(project, activePage = "Home") {
  const businessName = project?.brief?.businessName || project?.name || "Your Business";
  const offer = project?.brief?.offer || "your main offer";
  const audience = project?.brief?.targetAudience || "your audience";
  const goal = project?.brief?.goal || "get more enquiries";
  const page = String(activePage || "Home").toLowerCase();

  if (page.includes("about")) {
    return [
      createBlock(BlockTypes.HERO, {
        headline: `Why ${businessName} exists`,
        subheadline: `Use this page to tell the story behind ${businessName} and explain why the business can be trusted.`,
        ctaText: "Contact Us",
        backgroundStyle: "image",
        backgroundImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
        minHeight: "520px",
      }),
      createBlock(BlockTypes.TEXT, {
        text: `About ${businessName}\n\nExplain the origin story, the working style, and the standard your team holds itself to.`,
        backgroundColor: "#ffffff",
        textColor: "#0f172a",
      }),
      createBlock(BlockTypes.TEAM, {
        title: "Meet the Team",
      }),
      createBlock(BlockTypes.IMAGE_GALLERY, {
        title: "Behind the Brand",
      }),
    ];
  }

  if (page.includes("contact") || page.includes("book")) {
    return [
      createBlock(BlockTypes.HERO, {
        headline: `Talk to ${businessName}`,
        subheadline: `Remove friction and tell visitors exactly how to start the conversation about ${offer}.`,
        ctaText: "Send Enquiry",
        backgroundStyle: "image",
        backgroundImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
        minHeight: "500px",
      }),
      createBlock(BlockTypes.CONTACT_FORM, {
        title: "Start Your Enquiry",
        subtitle: `Tell us what result you want and how ${businessName} can help.`,
      }),
      createBlock(BlockTypes.FAQ, {
        title: "Before You Contact Us",
      }),
    ];
  }

  if (page.includes("service") || page.includes("pricing") || page.includes("product")) {
    return [
      createBlock(BlockTypes.HERO, {
        headline: `Present ${offer} with a stronger structure`,
        subheadline: `Use this page to show the offer clearly, build trust, and move ${audience} toward ${goal}.`,
        ctaText: "Choose Plan",
        backgroundColor: "linear-gradient(135deg,#7c3aed 0%,#ec4899 45%,#f97316 100%)",
        minHeight: "520px",
      }),
      createBlock(BlockTypes.FEATURE_LIST, {
        title: "What is Included",
        layout: "columns",
      }),
      createBlock(BlockTypes.PRICING_TABLE, {
        title: "Packages",
      }),
      createBlock(BlockTypes.TESTIMONIAL, {
        text: `${businessName} made the next step obvious and easy.`,
      }),
    ];
  }

  return [
    createBlock(BlockTypes.NAV_BAR, {
      brand: businessName,
    }),
    createBlock(BlockTypes.HERO, {
      headline: `${businessName} helps ${audience} take the next step faster`,
      subheadline: `Use this homepage to explain ${offer} clearly, build trust quickly, and move visitors toward ${goal}.`,
      ctaText: "Get Started",
      backgroundStyle: "image",
      backgroundImage: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
      minHeight: "560px",
    }),
    createBlock(BlockTypes.FEATURE_LIST, {
      title: "What this site should communicate",
      items: [
        `Offer: ${offer}`,
        `Audience: ${audience}`,
        `Goal: ${goal}`,
      ],
      layout: "columns",
      featureVariant: "glass-cards",
    }),
    createBlock(BlockTypes.STATS, {
      title: "A website should be the start of the sales system",
      subtitle: "Built to help you launch faster, capture more leads, and manage follow-up from one connected platform.",
      stats: [
        {
          number: "1",
          label: "All-In-One Platform",
          detail: "Build websites, funnels, landing pages, CRM, bookings, email and automation inside one workspace.",
        },
        {
          number: "24/7",
          label: "Lead Capture & Follow-Up",
          detail: "Capture enquiries around the clock and keep prospects moving with automated follow-up.",
        },
        {
          number: "0",
          label: "Code Needed",
          detail: "Update pages, forms, content and campaigns without waiting on a developer.",
        },
        {
          number: "100%",
          label: "Owned Inside Gr8 Result",
          detail: "Keep your website, marketing tools, leads and business systems together in Gr8 Result.",
        },
      ],
    }),
    createBlock(BlockTypes.TESTIMONIAL, {
      text: `${businessName} made our offer clearer and easier to act on.`,
      author: "Example Client",
      role: "Customer",
    }),
    createBlock(BlockTypes.FAQ, {
      title: "Questions before they buy",
    }),
    createBlock(BlockTypes.CONTACT_FORM, {
      title: "Start the conversation",
      subtitle: `Invite ${audience} to enquire now.`,
    }),
  ];
}

export function buildStarterChaiData(project, activePage = "Home") {
  const fromPageBlocks = project?.pageBlocks?.[activePage];
  const fromSavedStudio = project?.chaiData?.[activePage]?.blocks;
  const blocks = isWebsiteBlockArray(fromPageBlocks)
    ? fromPageBlocks
    : isWebsiteBlockArray(fromSavedStudio)
      ? fromSavedStudio
      : buildFallbackBlocks(project, activePage);

  return {
    blocks: blocks.map((block) => createBlock(block.type, block.props || {})),
    theme: { preset: project?.stylePack || project?.brief?.stylePack || "premium" },
    designTokens: {},
  };
}

export function applyChaiThemePreset(data, presetName = "premium") {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const themeMap = {
    premium: {
      navBg: "#0b1220",
      navText: "#f8fafc",
      accent: "#8b5cf6",
      textBg: "#ffffff",
      textColor: "#0f172a",
      featureVariant: "glass-cards",
    },
    minimal: {
      navBg: "#ffffff",
      navText: "#0f172a",
      accent: "#111827",
      textBg: "#ffffff",
      textColor: "#0f172a",
      featureVariant: "minimal-list",
    },
    bold: {
      navBg: "#581c87",
      navText: "#ffffff",
      accent: "#f97316",
      textBg: "#111827",
      textColor: "#f8fafc",
      featureVariant: "cards",
    },
  };
  const theme = themeMap[presetName] || themeMap.premium;

  return {
    ...(data || { blocks: [] }),
    theme: { preset: presetName },
    blocks: blocks.map((block) => {
      const props = { ...(block.props || {}) };
      if (block.type === BlockTypes.NAV_BAR) {
        props.backgroundColor = theme.navBg;
        props.textColor = theme.navText;
        props.buttonColor = theme.accent;
        props.buttonTextColor = "#ffffff";
      }
      if (block.type === BlockTypes.HERO) {
        props.buttonColor = theme.accent;
        props.buttonTextColor = "#ffffff";
      }
      if (block.type === BlockTypes.TEXT) {
        props.backgroundColor = theme.textBg;
        props.textColor = theme.textColor;
      }
      if (block.type === BlockTypes.FEATURE_LIST) {
        props.featureVariant = theme.featureVariant;
      }
      return { ...block, props };
    }),
  };
}

export function renderChaiHtml(data, assets = {}) {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  return renderToStaticMarkup(
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style dangerouslySetInnerHTML={{ __html: websiteBlockKeyframes() }} />
      {blocks.map((block, index) => (
        <React.Fragment key={block.id || `${block.type}-${index}`}>
          {renderWebsiteBlock(block, { editor: false, assets })}
        </React.Fragment>
      ))}
    </div>
  );
}
