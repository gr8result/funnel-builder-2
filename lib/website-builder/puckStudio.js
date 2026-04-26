import React from "react";
import { Render } from "@puckeditor/core";
import { renderToStaticMarkup } from "react-dom/server";

const wrap = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "0 20px",
};

const defaultImages = {
  home: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
  about: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
  contact: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
};

function splitLines(value) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStats(value) {
  return splitLines(value).map((line) => {
    const [number, label] = line.split("|");
    return {
      number: (number || "Metric").trim(),
      label: (label || "").trim(),
    };
  });
}

function parseFeatures(value) {
  return splitLines(value).map((line) => {
    const [title, body] = line.split("|");
    return {
      title: (title || "Feature").trim(),
      body: (body || "Add feature detail here.").trim(),
    };
  });
}

function parseFaq(value) {
  return splitLines(value).map((line) => {
    const [question, answer] = line.split("::");
    return {
      question: (question || "Question").trim(),
      answer: (answer || "Answer").trim(),
    };
  });
}

function paragraphText(value, style = {}) {
  return splitLines(value).map((line, index) => (
    <p key={`${line}-${index}`} style={{ margin: 0, ...style }}>
      {line}
    </p>
  ));
}

function buildHeroBackground(backgroundImage, background) {
  if (backgroundImage) {
    return `linear-gradient(135deg, rgba(15,23,42,0.82), rgba(15,23,42,0.45)), url(${backgroundImage}) center / cover no-repeat`;
  }
  return background || "linear-gradient(135deg,#0f172a 0%,#312e81 55%,#0ea5e9 100%)";
}

const HeroSection = ({ eyebrow, title, description, ctaLabel, ctaHref, secondaryLabel, secondaryHref, backgroundImage, background, accentColor }) => (
  <section style={{ padding: "24px 0 0" }}>
    <div
      style={{
        ...wrap,
        borderRadius: 28,
        overflow: "hidden",
        background: buildHeroBackground(backgroundImage, background),
        color: "#fff",
        minHeight: 460,
        display: "grid",
        alignItems: "center",
        boxShadow: "0 26px 70px rgba(15,23,42,0.22)",
      }}
    >
      <div style={{ padding: "64px 32px", display: "grid", gap: 18, maxWidth: 760 }}>
        <span
          style={{
            display: "inline-flex",
            width: "fit-content",
            padding: "7px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
          }}
        >
          {eyebrow || "MODERN WEBSITE"}
        </span>
        <h1 style={{ margin: 0, fontSize: "clamp(2.3rem, 5vw, 4.2rem)", lineHeight: 1.02, letterSpacing: "-0.04em" }}>
          {title || "A better website editing experience"}
        </h1>
        <div style={{ display: "grid", gap: 10, fontSize: 18, lineHeight: 1.65, color: "rgba(255,255,255,0.92)" }}>
          {paragraphText(description || "Lead with a strong outcome, then let visitors understand your offer fast.")}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
          <a
            href={ctaHref || "#contact"}
            style={{
              textDecoration: "none",
              background: accentColor || "#8b5cf6",
              color: "#fff",
              padding: "14px 20px",
              borderRadius: 999,
              fontWeight: 800,
            }}
          >
            {ctaLabel || "Get Started"}
          </a>
          {secondaryLabel ? (
            <a
              href={secondaryHref || "#services"}
              style={{
                textDecoration: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "14px 20px",
                borderRadius: 999,
                fontWeight: 800,
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  </section>
);

const StatsRow = ({ title, statsText, background, textColor, accentColor }) => {
  const items = parseStats(statsText || "120+|Projects launched\n4.9/5|Average satisfaction\n24/7|Website presence");
  return (
    <section style={{ padding: "20px 0" }}>
      <div style={{ ...wrap, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 28, color: textColor || "#0f172a" }}>{title || "Proof points"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {items.map((item) => (
            <article
              key={`${item.number}-${item.label}`}
              style={{
                padding: "20px 18px",
                borderRadius: 18,
                background: background || "#ffffff",
                border: "1px solid rgba(148,163,184,0.22)",
                boxShadow: "0 12px 24px rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 900, color: accentColor || "#7c3aed" }}>{item.number}</div>
              <div style={{ fontSize: 14, color: textColor || "#334155" }}>{item.label}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const FeatureGrid = ({ title, intro, itemsText, background, textColor, accentColor }) => {
  const items = parseFeatures(itemsText || "Clear messaging|Say what you do quickly and well.\nStronger structure|Guide visitors through the page naturally.\nReusable sections|Build pages faster without the old editor feel.");
  return (
    <section style={{ padding: "24px 0" }}>
      <div style={{ ...wrap, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 30, color: textColor || "#0f172a" }}>{title || "What this site includes"}</h2>
        {intro ? <p style={{ margin: 0, color: textColor || "#475569", lineHeight: 1.7 }}>{intro}</p> : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {items.map((item) => (
            <article
              key={item.title}
              style={{
                padding: "22px 18px",
                borderRadius: 20,
                background: background || "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.92))",
                border: "1px solid rgba(148,163,184,0.18)",
                boxShadow: "0 16px 32px rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 999, background: accentColor || "#8b5cf6", marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 20, color: textColor || "#0f172a" }}>{item.title}</h3>
              <p style={{ margin: 0, color: textColor || "#475569", lineHeight: 1.65 }}>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const ImageShowcase = ({ title, imageOne, imageTwo, imageThree }) => {
  const images = [imageOne, imageTwo, imageThree].filter(Boolean);
  return (
    <section style={{ padding: "24px 0" }}>
      <div style={{ ...wrap, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 30, color: "#0f172a" }}>{title || "Visual showcase"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {images.map((src, index) => (
            <div key={`${src}-${index}`} style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 18px 40px rgba(15,23,42,0.12)", minHeight: 220, background: "#e2e8f0" }}>
              <img src={src} alt={title || "Showcase"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const QuoteBand = ({ quote, author, role, background, textColor }) => (
  <section style={{ padding: "24px 0" }}>
    <div
      style={{
        ...wrap,
        borderRadius: 24,
        padding: "26px 24px",
        background: background || "#0f172a",
        color: textColor || "#f8fafc",
        boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
      }}
    >
      <p style={{ margin: 0, fontSize: 24, lineHeight: 1.55, fontWeight: 700 }}>{quote || "A good site should feel intentional, not recycled."}</p>
      <p style={{ margin: "12px 0 0", opacity: 0.86, fontWeight: 600 }}>{author || "Client Name"}{role ? ` • ${role}` : ""}</p>
    </div>
  </section>
);

const FaqSection = ({ title, itemsText }) => {
  const items = parseFaq(itemsText || "What makes this different?::It is a real visual editor layer, not the old funnel canvas.\nCan I tailor each page?::Yes, each page can have different sections, copy, and imagery.");
  return (
    <section style={{ padding: "24px 0" }}>
      <div style={{ ...wrap, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 30, color: "#0f172a" }}>{title || "Frequently asked questions"}</h2>
        {items.map((item) => (
          <article key={item.question} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.22)", background: "#fff", padding: "16px 18px" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#0f172a" }}>{item.question}</h3>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.65 }}>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

const CTASection = ({ title, body, ctaLabel, ctaHref, background, accentColor }) => (
  <section style={{ padding: "24px 0 40px" }}>
    <div
      style={{
        ...wrap,
        borderRadius: 24,
        padding: "28px 24px",
        background: background || "linear-gradient(135deg,#111827,#1d4ed8)",
        color: "#fff",
        display: "grid",
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 32 }}>{title || "Ready to launch a better website?"}</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 760, color: "rgba(255,255,255,0.9)", lineHeight: 1.65 }}>{paragraphText(body || "Use this section to push visitors toward the next action.")}</div>
      <div>
        <a href={ctaHref || "#contact"} style={{ display: "inline-flex", textDecoration: "none", background: accentColor || "#8b5cf6", color: "#fff", padding: "14px 20px", borderRadius: 999, fontWeight: 800 }}>
          {ctaLabel || "Start Now"}
        </a>
      </div>
    </div>
  </section>
);

const ContactPanel = ({ title, body, email, phone }) => (
  <section id="contact" style={{ padding: "24px 0 56px" }}>
    <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      <div style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.22)", padding: "22px 20px", boxShadow: "0 16px 36px rgba(15,23,42,0.08)" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 28, color: "#0f172a" }}>{title || "Contact"}</h2>
        <div style={{ display: "grid", gap: 8, color: "#475569", lineHeight: 1.7 }}>{paragraphText(body || "Tell visitors how to reach you and what happens after they enquire.")}</div>
        <div style={{ display: "grid", gap: 6, marginTop: 14, color: "#0f172a", fontWeight: 700 }}>
          {email ? <span>{email}</span> : null}
          {phone ? <span>{phone}</span> : null}
        </div>
      </div>
      <div style={{ borderRadius: 22, background: "#0f172a", color: "#f8fafc", padding: "22px 20px", boxShadow: "0 18px 40px rgba(15,23,42,0.16)" }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ height: 46, borderRadius: 12, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ height: 46, borderRadius: 12, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ height: 120, borderRadius: 12, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ height: 46, width: 150, borderRadius: 999, background: "#8b5cf6" }} />
        </div>
      </div>
    </div>
  </section>
);

export const puckConfig = {
  components: {
    HeroSection: {
      label: "Hero",
      fields: {
        eyebrow: { type: "text" },
        title: { type: "text" },
        description: { type: "textarea" },
        ctaLabel: { type: "text" },
        ctaHref: { type: "text" },
        secondaryLabel: { type: "text" },
        secondaryHref: { type: "text" },
        backgroundImage: { type: "text" },
        background: { type: "text" },
        accentColor: { type: "text" },
      },
      render: HeroSection,
    },
    StatsRow: {
      label: "Stats",
      fields: {
        title: { type: "text" },
        statsText: { type: "textarea" },
        background: { type: "text" },
        textColor: { type: "text" },
        accentColor: { type: "text" },
      },
      render: StatsRow,
    },
    FeatureGrid: {
      label: "Features",
      fields: {
        title: { type: "text" },
        intro: { type: "textarea" },
        itemsText: { type: "textarea" },
        background: { type: "text" },
        textColor: { type: "text" },
        accentColor: { type: "text" },
      },
      render: FeatureGrid,
    },
    ImageShowcase: {
      label: "Image Showcase",
      fields: {
        title: { type: "text" },
        imageOne: { type: "text" },
        imageTwo: { type: "text" },
        imageThree: { type: "text" },
      },
      render: ImageShowcase,
    },
    QuoteBand: {
      label: "Quote",
      fields: {
        quote: { type: "textarea" },
        author: { type: "text" },
        role: { type: "text" },
        background: { type: "text" },
        textColor: { type: "text" },
      },
      render: QuoteBand,
    },
    FaqSection: {
      label: "FAQ",
      fields: {
        title: { type: "text" },
        itemsText: { type: "textarea" },
      },
      render: FaqSection,
    },
    CTASection: {
      label: "Call To Action",
      fields: {
        title: { type: "text" },
        body: { type: "textarea" },
        ctaLabel: { type: "text" },
        ctaHref: { type: "text" },
        background: { type: "text" },
        accentColor: { type: "text" },
      },
      render: CTASection,
    },
    ContactPanel: {
      label: "Contact",
      fields: {
        title: { type: "text" },
        body: { type: "textarea" },
        email: { type: "text" },
        phone: { type: "text" },
      },
      render: ContactPanel,
    },
  },
};

export function applyPuckThemePreset(data, presetName = "premium") {
  const themes = {
    premium: {
      accent: "#8b5cf6",
      heroBackground: "linear-gradient(135deg,#0f172a 0%,#312e81 55%,#0ea5e9 100%)",
      surface: "#ffffff",
      darkSurface: "#0f172a",
      text: "#0f172a",
      inverseText: "#f8fafc",
    },
    minimal: {
      accent: "#0f172a",
      heroBackground: "linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%)",
      surface: "#ffffff",
      darkSurface: "#e2e8f0",
      text: "#0f172a",
      inverseText: "#0f172a",
    },
    bold: {
      accent: "#f97316",
      heroBackground: "linear-gradient(135deg,#7c3aed 0%,#ec4899 45%,#f97316 100%)",
      surface: "rgba(255,255,255,0.96)",
      darkSurface: "#581c87",
      text: "#111827",
      inverseText: "#ffffff",
    },
  };

  const theme = themes[presetName] || themes.premium;
  const next = data || { content: [] };

  return {
    ...next,
    content: (next.content || []).map((item) => {
      const props = { ...(item.props || {}) };

      if (item.type === "HeroSection") {
        props.background = theme.heroBackground;
        props.accentColor = theme.accent;
      }
      if (item.type === "StatsRow") {
        props.background = theme.surface;
        props.textColor = theme.text;
        props.accentColor = theme.accent;
      }
      if (item.type === "FeatureGrid") {
        props.background = theme.surface;
        props.textColor = theme.text;
        props.accentColor = theme.accent;
      }
      if (item.type === "QuoteBand") {
        props.background = theme.darkSurface;
        props.textColor = theme.inverseText;
      }
      if (item.type === "CTASection") {
        props.background = theme.darkSurface;
        props.accentColor = theme.accent;
      }

      return { ...item, props };
    }),
  };
}

export function buildStarterPuckData(project, activePage = "Home") {
  const businessName = project?.brief?.businessName || project?.name || "Your Business";
  const offer = project?.brief?.offer || "your main offer";
  const audience = project?.brief?.targetAudience || "your ideal customers";
  const goal = project?.brief?.goal || "get more enquiries";
  const lowerPage = String(activePage || "Home").toLowerCase();

  const homeData = {
    content: [
      {
        type: "HeroSection",
        props: {
          eyebrow: "FLAGSHIP WEBSITE",
          title: `${businessName} helps ${audience} move faster`,
          description: `Use this homepage to position ${offer} clearly.\nLead with the outcome and give people a reason to trust you.`,
          ctaLabel: "Get Started",
          ctaHref: "#contact",
          secondaryLabel: "View Services",
          secondaryHref: "#services",
          backgroundImage: defaultImages.home,
        },
      },
      {
        type: "StatsRow",
        props: {
          title: "What visitors should understand quickly",
          statsText: `Fast clarity|Explain ${offer} in seconds\nRight fit|Speak directly to ${audience}\nNext step|Push toward ${goal}`,
        },
      },
      {
        type: "FeatureGrid",
        props: {
          title: "A homepage that actually guides people",
          intro: "This is no longer the old funnel-style canvas. Reorder sections, edit content, and build a real page flow.",
          itemsText: "Clear promise|State the outcome without waffle.\nTrust builders|Use proof, positioning, and clean layout.\nAction focused|Every section should move the visitor forward.",
        },
      },
      {
        type: "ImageShowcase",
        props: {
          title: "Show the work or the brand",
          imageOne: defaultImages.home,
          imageTwo: defaultImages.about,
          imageThree: defaultImages.contact,
        },
      },
      {
        type: "QuoteBand",
        props: {
          quote: `${businessName} now presents the offer clearly and feels far more intentional to visitors.`,
          author: "Example Client",
          role: "Customer",
        },
      },
      {
        type: "FaqSection",
        props: {
          title: "Questions to handle on the page",
          itemsText: `What do you offer?::${offer}\nWho is it for?::${audience}\nWhat should visitors do next?::${goal}`,
        },
      },
      {
        type: "CTASection",
        props: {
          title: "Turn interest into action",
          body: `Make the next step easy.\nKeep the CTA obvious and specific.`,
          ctaLabel: "Start Project",
          ctaHref: "#contact",
        },
      },
      {
        type: "ContactPanel",
        props: {
          title: "Start the conversation",
          body: "Tell visitors what to send and when they can expect a reply.",
          email: "hello@example.com",
          phone: "+1 555 010 100",
        },
      },
    ],
  };

  const aboutData = {
    content: [
      {
        type: "HeroSection",
        props: {
          eyebrow: "ABOUT THE BUSINESS",
          title: `Why ${businessName} exists`,
          description: `Use this page to explain the story, the standards, and what makes the business credible.\nDo not duplicate the homepage word for word.`,
          ctaLabel: "Contact Us",
          ctaHref: "#contact",
          backgroundImage: defaultImages.about,
        },
      },
      {
        type: "FeatureGrid",
        props: {
          title: "What makes the brand credible",
          intro: "Use this page for story, process, values, and team positioning.",
          itemsText: "Origin story|Why the business started.\nWorking style|How clients are supported.\nStandards|What you refuse to compromise on.",
        },
      },
      {
        type: "ImageShowcase",
        props: {
          title: "Behind the scenes",
          imageOne: defaultImages.about,
          imageTwo: defaultImages.home,
          imageThree: defaultImages.contact,
        },
      },
      {
        type: "QuoteBand",
        props: {
          quote: `People trust ${businessName} because the promise is clear and the delivery is consistent.`,
          author: "Founder Note",
          role: "About Page",
        },
      },
      {
        type: "CTASection",
        props: {
          title: "Ready to work together?",
          body: "Close the page with a human, direct invitation.",
          ctaLabel: "Reach Out",
          ctaHref: "#contact",
        },
      },
    ],
  };

  const contactData = {
    content: [
      {
        type: "HeroSection",
        props: {
          eyebrow: "CONTACT",
          title: `Talk to ${businessName}`,
          description: `Use this page to remove friction and make the next step obvious.\nSet expectations clearly so more visitors convert.`,
          ctaLabel: "Send Enquiry",
          ctaHref: "#contact",
          backgroundImage: defaultImages.contact,
        },
      },
      {
        type: "ContactPanel",
        props: {
          title: "Tell us what you need",
          body: "Add contact details, office hours, or onboarding notes here.",
          email: "hello@example.com",
          phone: "+1 555 010 100",
        },
      },
      {
        type: "FaqSection",
        props: {
          title: "Before you contact us",
          itemsText: "How fast do you reply?::Usually within one business day.\nWhat should I send?::Share your goal, timeline, and what outcome you need.",
        },
      },
      {
        type: "CTASection",
        props: {
          title: "Make the enquiry now",
          body: "If they reached this page, remove hesitation and ask for the message.",
          ctaLabel: "Contact Now",
          ctaHref: "#contact",
        },
      },
    ],
  };

  const data = lowerPage.includes("about")
    ? aboutData
    : lowerPage.includes("contact") || lowerPage.includes("book")
      ? contactData
      : homeData;

  const stylePack = project?.stylePack || project?.brief?.stylePack || "executive";
  const presetName = stylePack === "minimal" ? "minimal" : stylePack === "vibrant" ? "bold" : "premium";
  return applyPuckThemePreset(data, presetName);
}

export function renderPuckHtml(data) {
  return renderToStaticMarkup(
    <div style={{ background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, Arial, sans-serif" }}>
      <Render config={puckConfig} data={data || { content: [] }} />
    </div>
  );
}
