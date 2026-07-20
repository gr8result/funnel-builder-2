// @ts-nocheck
import {
  BadgeCheck,
  CalendarCheck,
  FileCheck2,
  Handshake,
  MessageCircle,
  MonitorSmartphone,
} from "lucide-react";
import { aboutBuilderDefaults } from "../defaults/aboutBuilder.defaults";
import { LuxuryMasterPageHeader, nativeProjectEstimateImageProps, nativeProjectEstimateTextProps, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `about-${id}`, type, order, content, design });

const aboutPageStyles = {
  page: { ...styles.luxuryPage, ...styles.luxuryAboutWhyPage, gap: 14, padding: 40 },
  top: { ...styles.luxuryAboutWhyTop, minHeight: 292, alignItems: "start" },
  copy: { ...styles.luxuryAboutWhyCopy, gap: 9 },
  title: { ...styles.luxuryAboutWhyTitle, fontSize: 32, lineHeight: 1.04 },
  body: { ...styles.luxuryAboutWhyBody, fontSize: 15, lineHeight: 1.45 },
  imageStack: { ...styles.luxuryAboutWhyImageStack, minHeight: 292 },
  heroImage: { ...styles.luxuryAboutWhyHeroImage, height: 252 },
  detailImage: { ...styles.luxuryAboutWhyImageInset, height: 118, width: "43%" },
  lower: { ...styles.luxuryAboutWhyLower, gap: 10, paddingTop: 12 },
  subhead: { ...styles.luxuryAboutWhySubhead, margin: "3px 0 0", fontSize: 22, lineHeight: 1.08 },
  cardGrid: { ...styles.luxuryAboutWhyCardGrid, gap: 8 },
  card: { ...styles.luxuryAboutWhyCard, minHeight: 118, padding: 9, gap: 4 },
  cardTitle: { ...styles.luxuryAboutWhyCardTitle, fontSize: 16, lineHeight: 1.14 },
  cardBody: { ...styles.luxuryAboutWhyCardBody, fontSize: 13.8, lineHeight: 1.28 },
  icon: { ...styles.luxuryAboutWhyIcon, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0f1b2d" },
  statsBar: { ...styles.luxuryAboutWhyStatsBar, gap: 7, paddingTop: 9 },
  statCard: { ...styles.luxuryAboutWhyStatCard, padding: "8px 5px", fontSize: 15 },
  statValue: { fontSize: 29, lineHeight: 0.95 },
};

export const aboutBuilderPageDefinition: ProjectEstimatePageDefinition = {
  id: "about",
  navigationTitle: "About Us",
  version: 1,
  defaultContent: aboutBuilderDefaults,
  defaultBlocks: [
    block("eyebrow", "text", 0, { text: aboutBuilderDefaults.eyebrow, editorLabel: "Page label" }),
    block("heading", "heading", 1, { text: aboutBuilderDefaults.mainHeading, editorLabel: "Main heading" }),
    block("about-copy", "text", 2, { text: aboutBuilderDefaults.aboutText, editorLabel: "About text" }),
    block("proof-points", "text", 3, { text: aboutBuilderDefaults.proofPoints, editorLabel: "Proof points" }),
    block("hero-image", "image", 4, { imageUrl: "", defaultImageUrl: "", editorLabel: "Main about image", alt: "Premium residential home" }),
    block("detail-image", "image", 5, { imageUrl: "", defaultImageUrl: "", editorLabel: "Detail about image", alt: "Architectural detail" }),
  ],
  editorFields: [
    { blockId: "about-eyebrow", label: "Page label", type: "text" },
    { blockId: "about-heading", label: "Main heading", type: "textarea" },
    { blockId: "about-about-copy", label: "About text", type: "textarea" },
    { blockId: "about-proof-points", label: "Proof points", type: "textarea" },
  ],
  validate: (content) => (!String(content?.mainHeading || "").trim() ? ["Main heading is required."] : []),
  Component: AboutBuilderPage,
};

export function AboutBuilderPage({ resolvedTheme, accent, logo, builderName, whyStats = [], content = aboutBuilderDefaults, editorBridge = null }: EstimatePageProps) {
  const aboutWhyCards = [
    ["Quality Craftsmanship", "Careful workmanship, disciplined supervision and a finish that feels considered in every room.", BadgeCheck],
    ["Clear Communication", "Straightforward updates, practical guidance and clear next steps from estimate through to handover.", MessageCircle],
    ["On-Time Delivery", "A structured building program and proactive planning keep your project moving with purpose.", CalendarCheck],
    ["Exclusive Client Portal", "Stay connected to your build 24/7. Track progress, request changes, approve selections, communicate with our team, review important documents and stay informed throughout your build.", MonitorSmartphone],
    ["Transparent Fixed Pricing", "Your investment is presented clearly, with scope, inclusions and progress stages explained in plain language.", FileCheck2],
    ["Long-Term Support", "Our care continues after handover with practical support and a relationship built to last.", Handshake],
  ];
  const defaultHeroImage = resolvedTheme?.aboutImageUrl || resolvedTheme?.heroImageUrl || "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=80";
  const defaultDetailImage = resolvedTheme?.aboutDetailImageUrl || resolvedTheme?.designImageUrl || "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1400&q=80";
  const aboutHeroImage = editorBridge?.blockById?.["about-hero-image"]?.content?.imageUrl || defaultHeroImage;
  const aboutDetailImage = editorBridge?.blockById?.["about-detail-image"]?.content?.imageUrl || defaultDetailImage;
  const headingProps = nativeProjectEstimateTextProps("about-heading", "text", editorBridge);
  const bodyProps = nativeProjectEstimateTextProps("about-about-copy", "text", editorBridge);
  const eyebrowProps = nativeProjectEstimateTextProps("about-eyebrow", "text", editorBridge);
  const proofProps = nativeProjectEstimateTextProps("about-proof-points", "text", editorBridge);
  const heroProps = nativeProjectEstimateImageProps("about-hero-image", editorBridge);
  const detailProps = nativeProjectEstimateImageProps("about-detail-image", editorBridge);

  return (
    <section className="proposal-builder-page" style={aboutPageStyles.page}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="About GoodBuild" accent={accent} />
      <div style={aboutPageStyles.top}>
        <div style={aboutPageStyles.copy}>
          <h2 {...headingProps} style={{ ...aboutPageStyles.title, ...(headingProps as any).style }}>{content.mainHeading}</h2>
          <p {...bodyProps} style={{ ...aboutPageStyles.body, ...(bodyProps as any).style }}>{content.aboutText}</p>
        </div>
        <div style={aboutPageStyles.imageStack}>
          <img {...heroProps} src={aboutHeroImage} alt="Premium residential home" style={{ ...aboutPageStyles.heroImage, ...(heroProps as any).style }} />
          <img {...detailProps} src={aboutDetailImage} alt="Architectural detail" style={{ ...aboutPageStyles.detailImage, ...(detailProps as any).style }} />
        </div>
      </div>
      <div style={aboutPageStyles.lower}>
        <div>
          <div {...eyebrowProps} style={{ ...styles.luxuryEyebrow, color: accent, ...(eyebrowProps as any).style }}>{content.eyebrow}</div>
          <h3 {...proofProps} style={{ ...aboutPageStyles.subhead, ...(proofProps as any).style }}>{content.proofPoints || "A premium building experience with clear systems and human care."}</h3>
        </div>
        <div style={aboutPageStyles.cardGrid}>
          {aboutWhyCards.map(([title, body, Icon]: any) => (
            <div key={title} style={aboutPageStyles.card}>
              <span style={{ ...aboutPageStyles.icon, background: accent }}><Icon size={15} strokeWidth={2.4} aria-hidden="true" /></span>
              <strong style={aboutPageStyles.cardTitle}>{title}</strong>
              <p style={aboutPageStyles.cardBody}>{body}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={aboutPageStyles.statsBar}>
        {whyStats.map((stat: any) => (
          <div key={stat.label} style={aboutPageStyles.statCard}>
            <strong style={{ ...aboutPageStyles.statValue, color: accent }}>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AboutBuilderPage;
