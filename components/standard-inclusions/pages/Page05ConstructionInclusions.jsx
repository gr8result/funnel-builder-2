import { Check, CircleDollarSign, Globe2, Home, Phone, ShieldCheck } from "lucide-react";
import StandardInclusionsPageShell from "../StandardInclusionsPageShell";
import styles from "../standardInclusions.module.css";

const FEATURE_CARDS = [
  { icon: ShieldCheck, title: "Quality Inclusions", text: "Carefully selected products and finishes designed for quality, durability and value." },
  { icon: Home, title: "Complete Specification", text: "Everything required to build a quality Premier home has been included." },
  { icon: CircleDollarSign, title: "Exceptional Value", text: "A balanced specification designed to deliver excellent value without compromising quality." },
];

function SectionBlock({ title, bullets = [], highlighted = false }) {
  return (
    <section className={highlighted ? styles.highlightPanel : styles.sectionBlock}>
      <h3>{title}</h3>
      <ul>
        {bullets.map((item) => {
          const label = typeof item === "string" ? item : item.title;
          const detail = typeof item === "string" ? "" : item.detail;
          return (
            <li key={label}>
              {highlighted ? <Check size={12} strokeWidth={3} /> : null}
              <span>{highlighted ? <strong>{label}</strong> : label}{detail ? <small>{detail}</small> : null}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Page05ConstructionInclusions({ page, builder, onImageDoubleClick, pageNumber }) {
  return (
    <StandardInclusionsPageShell className={styles.page05Construction} pageNumber={pageNumber}>
      <div className={styles.page05ConstructionTop}>
        <img src={page.imageUrl} alt="" onDoubleClick={() => onImageDoubleClick?.({ type: "documentPage", pageKey: "specification" })} />
      </div>
      <header className={styles.page05ConstructionTitleArea}><h2 className={styles.page05ConstructionTitle}>{page.heading}</h2></header>
      <div className={styles.page05ConstructionFeatureStrip}>
        {FEATURE_CARDS.map((feature) => {
          const Icon = feature.icon;
          return <div key={feature.title} className={styles.page05ConstructionFeatureItem}><span className={styles.page05ConstructionFeatureIcon}><Icon size={30} strokeWidth={1.7} /></span><strong>{feature.title}</strong><p>{feature.text}</p></div>;
        })}
      </div>
      <main className={styles.page05ConstructionBody}>
        <div className={styles.page05ConstructionColumn}>
          <SectionBlock title="Site Preparation & Foundations" bullets={page.site} />
          <SectionBlock title="Structural & External" bullets={page.structural} />
          <SectionBlock title="Cabinetry" bullets={page.laundry} />
          <SectionBlock title="Driveway" bullets={page.driveway} />
        </div>
        <div className={styles.page05ConstructionColumn}>
          <SectionBlock title="Highlight Inclusions" bullets={page.highlights} highlighted />
          <SectionBlock title="General Inclusions" bullets={page.general} />
        </div>
      </main>
      <footer className={styles.page05ConstructionFooter}>
        <p className={styles.page05ConstructionFooterNotice}>Our Premier Inclusions Schedule outlines the fixtures, fittings, finishes and construction standards included as the pricing basis for each Project Estimate. Final selections and any approved upgrades or downgrades will be confirmed during the Selections Process and documented in the Formal Quotation.</p>
        <span className={styles.page05ConstructionFooterTagline}>Quality by standard.{"\n"}Personalised by choice.</span>
        <div className={styles.page05ConstructionFooterContact}><span className={styles.contactItem}><Phone size={14} /> {builder.phone}</span><span className={styles.divider} /><span className={styles.contactItem}><Globe2 size={14} /> {builder.website}</span></div>
        {builder.logoUrl ? <img className={styles.page05ConstructionFooterLogo} src={builder.logoUrl} alt={builder.builderName} onDoubleClick={() => onImageDoubleClick?.({ type: "footerLogo" })} /> : null}
      </footer>
    </StandardInclusionsPageShell>
  );
}
