import { Award, ClipboardCheck, Globe2, Home, PaintRoller, Phone } from "lucide-react";
import StandardInclusionsPageShell from "../StandardInclusionsPageShell";
import styles from "../standardInclusions.module.css";

const FEATURES = [
  { icon: Award, title: "Quality Included", text: "Carefully selected fixtures, fittings and finishes." },
  { icon: Home, title: "Built For Living", text: "Practical, stylish and made for everyday life." },
  { icon: PaintRoller, title: "Your Choices", text: "Personalise your home with colours, finishes and upgrades." },
  { icon: ClipboardCheck, title: "Confidence & Clarity", text: "All selections documented in your Formal Quotation." },
];

export default function Page04DesignedForLiving({ page, builder, onImageDoubleClick, pageNumber }) {
  return (
    <StandardInclusionsPageShell className={styles.page04DesignedForLiving} pageNumber={pageNumber}>
      <div className={styles.page04DesignedHero}>
        <img src={page.imageUrl} alt="" onDoubleClick={() => onImageDoubleClick?.({ type: "documentPage", pageKey: "selections" })} />
      </div>
      <svg aria-hidden="true" viewBox="0 0 620 180" preserveAspectRatio="none" className={styles.page04DesignedWave}>
        <path d="M0 48 C112 126 236 128 350 78 C460 31 546 37 620 68 L620 180 L0 180 Z" fill="#ffffff" />
      </svg>
      <section className={styles.page04DesignedContent}>
        <div className={styles.page04DesignedMain}>
          <span className={styles.eyebrow}>Premier Inclusions</span>
          <h2>{page.heading}</h2>
          <span className={styles.page04DesignedRule} />
          {String(page.intro || "").split("\n\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className={styles.page04DesignedFeatures}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return <div key={feature.title} className={styles.page04DesignedFeature}><span><Icon size={24} strokeWidth={1.8} /></span><div><strong>{feature.title}</strong><p>{feature.text}</p></div></div>;
          })}
        </div>
      </section>
      <footer className={styles.page04DesignedFooter}>
        {builder.logoUrl ? <img className={styles.footerLogo} src={builder.logoUrl} alt={builder.builderName} onDoubleClick={() => onImageDoubleClick?.({ type: "footerLogo" })} /> : <strong>{builder.builderName}</strong>}
        <div className={styles.contactRow}><span className={styles.contactItem}><Phone size={16} /> {builder.phone}</span><span className={styles.divider} /><span className={styles.contactItem}><Globe2 size={16} /> {builder.website}</span></div>
      </footer>
    </StandardInclusionsPageShell>
  );
}
