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
import { LuxuryMasterPageHeader, nativeProjectEstimateGroupProps, nativeProjectEstimateImageProps, projectEstimateRichTextProps, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `about-${id}`, type, order, content, design });

const aboutBenefitCardCopy = [
  ["Quality Craftsmanship", "Careful workmanship, disciplined supervision and a finish that feels considered in every room."],
  ["Clear Communication", "Straightforward updates, practical guidance and clear next steps from estimate through to handover."],
  ["On-Time Delivery", "A structured building program and proactive planning keep your project moving with purpose."],
  ["Exclusive Client Portal", "Stay connected to your build 24/7. Track progress, request changes, approve selections, communicate with our team, review important documents and stay informed throughout your build."],
  ["Transparent Fixed Pricing", "Your investment is presented clearly, with scope, inclusions and progress stages explained in plain language."],
  ["Long-Term Support", "Our care continues after handover with practical support and a relationship built to last."],
];

const aboutStatDefaults = [
  { value: "250+", label: "Homes Completed" },
  { value: "18+", label: "Years Experience" },
  { value: "98%", label: "Client Happiness" },
  { value: "96%", label: "On-Time Delivery" },
  { value: "24/7", label: "Client Portal Access" },
  { value: "4.9/5", label: "Average Rating" },
];

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
    block("top-section", "group", -1, { editorLabel: "About Us hero section" }, { children: ["about-heading", "about-about-copy", "about-hero-image", "about-detail-image"], autoFit: true }),
    block("benefit-card-grid", "group", 0, { editorLabel: "About Us benefit cards" }, { autoFit: true }),
    block("stats-grid", "group", 1, { editorLabel: "About Us statistics cards" }, { autoFit: true }),
    block("eyebrow", "text", 2, { text: aboutBuilderDefaults.eyebrow, editorLabel: "Page label" }),
    block("heading", "heading", 3, { text: aboutBuilderDefaults.mainHeading, editorLabel: "Main heading" }, { parentGroupId: "about-top-section" }),
    block("about-copy", "text", 4, { text: aboutBuilderDefaults.aboutText, editorLabel: "About text" }, { parentGroupId: "about-top-section" }),
    block("subhead", "heading", 5, { text: "A premium building experience with clear systems and human care.", editorLabel: "Section heading" }),
    block("hero-image", "image", 6, { imageUrl: "", editorLabel: "Main lifestyle image" }, { parentGroupId: "about-top-section" }),
    block("detail-image", "image", 7, { imageUrl: "", editorLabel: "Detail lifestyle image" }, { parentGroupId: "about-top-section" }),
    block("proof-points", "text", 8, { text: aboutBuilderDefaults.proofPoints, editorLabel: "Proof points" }),
    ...aboutBenefitCardCopy.flatMap(([title, body], index) => [
      block(`benefit-${index}-title`, "text", 20 + index * 2, { text: title, editorLabel: `Benefit ${index + 1} heading` }, { parentGroupId: "about-benefit-card-grid" }),
      block(`benefit-${index}-body`, "text", 21 + index * 2, { text: body, editorLabel: `Benefit ${index + 1} paragraph` }, { parentGroupId: "about-benefit-card-grid" }),
    ]),
    ...aboutStatDefaults.flatMap((stat, index) => [
      block(`stat-${index}-value`, "text", 40 + index * 2, { text: stat.value, editorLabel: `Statistic ${index + 1} value` }, { parentGroupId: "about-stats-grid" }),
      block(`stat-${index}-label`, "text", 41 + index * 2, { text: stat.label, editorLabel: `Statistic ${index + 1} label` }, { parentGroupId: "about-stats-grid" }),
    ]),
  ],
  editorFields: [
    { blockId: "about-eyebrow", label: "Page label", type: "text" },
    { blockId: "about-heading", label: "Main heading", type: "textarea" },
    { blockId: "about-about-copy", label: "About text", type: "textarea" },
    { blockId: "about-subhead", label: "Section heading", type: "textarea" },
    { blockId: "about-proof-points", label: "Proof points", type: "textarea" },
  ],
  validate: (content) => (!String(content?.mainHeading || "").trim() ? ["Main heading is required."] : []),
  Component: AboutBuilderPage,
};

export function AboutBuilderPage({ resolvedTheme, accent, logo, builderName, whyStats = [], content = aboutBuilderDefaults, editorBridge }: EstimatePageProps) {
  const benefitIcons = [BadgeCheck, MessageCircle, CalendarCheck, MonitorSmartphone, FileCheck2, Handshake];
  const blockText = (blockId: string, fallback = "") => editorBridge?.blockById?.[blockId]?.content?.text ?? fallback;
  const aboutHeroImage = editorBridge?.blockById?.["about-hero-image"]?.content?.imageUrl || resolvedTheme?.aboutImageUrl || resolvedTheme?.heroImageUrl || "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=80";
  const aboutDetailImage = editorBridge?.blockById?.["about-detail-image"]?.content?.imageUrl || resolvedTheme?.aboutDetailImageUrl || resolvedTheme?.designImageUrl || "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1400&q=80";
  const subhead = content.subhead || "A premium building experience with clear systems and human care.";
  const headingProps = projectEstimateRichTextProps("about-heading", "text", content.mainHeading, editorBridge);
  const aboutCopyProps = projectEstimateRichTextProps("about-about-copy", "text", content.aboutText, editorBridge);
  const heroImageProps = nativeProjectEstimateImageProps("about-hero-image", editorBridge);
  const detailImageProps = nativeProjectEstimateImageProps("about-detail-image", editorBridge);
  const eyebrowProps = projectEstimateRichTextProps("about-eyebrow", "text", content.eyebrow, editorBridge);
  const subheadProps = projectEstimateRichTextProps("about-subhead", "text", subhead, editorBridge);
  const topGroupProps = nativeProjectEstimateGroupProps("about-top-section", editorBridge);
  const cardGridProps = nativeProjectEstimateGroupProps("about-benefit-card-grid", editorBridge);
  const statsGridProps = nativeProjectEstimateGroupProps("about-stats-grid", editorBridge);

  return (
    <section className="proposal-builder-page" style={aboutPageStyles.page}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="About GoodBuild" accent={accent} />
      <div {...topGroupProps} style={{ ...aboutPageStyles.top, ...(topGroupProps as any).style }}>
        <div style={aboutPageStyles.copy}>
          <h2 {...headingProps} style={{ ...aboutPageStyles.title, ...(headingProps as any).style }} />
          <div {...aboutCopyProps} style={{ ...aboutPageStyles.body, ...(aboutCopyProps as any).style }} />
        </div>
        <div style={aboutPageStyles.imageStack}>
          <img src={aboutHeroImage} alt="Premium residential home" {...heroImageProps} style={{ ...aboutPageStyles.heroImage, ...(heroImageProps as any).style }} />
          <img src={aboutDetailImage} alt="Architectural detail" {...detailImageProps} style={{ ...aboutPageStyles.detailImage, ...(detailImageProps as any).style }} />
        </div>
      </div>
      <div style={aboutPageStyles.lower}>
        <div>
          <div {...eyebrowProps} style={{ ...styles.luxuryEyebrow, color: accent, ...(eyebrowProps as any).style }} />
          <h3 {...subheadProps} style={{ ...aboutPageStyles.subhead, ...(subheadProps as any).style }} />
        </div>
        <div {...cardGridProps} style={{ ...aboutPageStyles.cardGrid, ...(cardGridProps as any).style }}>
          {aboutBenefitCardCopy.map(([title, body], index: number) => {
            const Icon = benefitIcons[index];
            const titleBlockId = `about-benefit-${index}-title`;
            const bodyBlockId = `about-benefit-${index}-body`;
            const titleProps = projectEstimateRichTextProps(titleBlockId, "text", blockText(titleBlockId, title), editorBridge);
            const bodyProps = projectEstimateRichTextProps(bodyBlockId, "text", blockText(bodyBlockId, body), editorBridge);
            return (
              <div key={titleBlockId} style={aboutPageStyles.card}>
                <span style={{ ...aboutPageStyles.icon, background: accent }}><Icon size={15} strokeWidth={2.4} aria-hidden="true" /></span>
                <strong {...titleProps} style={{ ...aboutPageStyles.cardTitle, ...(titleProps as any).style }} />
                <p {...bodyProps} style={{ ...aboutPageStyles.cardBody, ...(bodyProps as any).style }} />
              </div>
            );
          })}
        </div>
      </div>
      <div {...statsGridProps} style={{ ...aboutPageStyles.statsBar, ...(statsGridProps as any).style }}>
        {(whyStats.length ? whyStats : aboutStatDefaults).map((stat: any, index: number) => {
          const valueBlockId = `about-stat-${index}-value`;
          const labelBlockId = `about-stat-${index}-label`;
          const valueProps = projectEstimateRichTextProps(valueBlockId, "text", blockText(valueBlockId, stat.value), editorBridge);
          const labelProps = projectEstimateRichTextProps(labelBlockId, "text", blockText(labelBlockId, stat.label), editorBridge);
          return (
            <div key={labelBlockId} style={aboutPageStyles.statCard}>
              <strong {...valueProps} style={{ ...aboutPageStyles.statValue, color: accent, ...(valueProps as any).style }} />
              <span {...labelProps} style={{ ...(labelProps as any).style }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default AboutBuilderPage;
