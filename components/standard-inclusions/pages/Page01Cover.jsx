import { CircleDollarSign, Globe2, Home, Phone, ShieldCheck } from "lucide-react";
import StandardInclusionsPageShell from "../StandardInclusionsPageShell";
import styles from "../standardInclusions.module.css";

function FeatureIcon({ icon, index }) {
  const Icon = icon === "home" || index === 1 ? Home : icon === "value" || index === 2 ? CircleDollarSign : ShieldCheck;
  return <Icon size={22} strokeWidth={2.35} />;
}

export default function Page01Cover({ page, builder, onImageDoubleClick, pageNumber }) {
  return (
    <StandardInclusionsPageShell className={styles.page01} pageNumber={pageNumber}>
      <div className={styles.page01Hero}>
        {page.imageUrl ? <img src={page.imageUrl} alt="" onDoubleClick={() => onImageDoubleClick?.({ type: "cover" })} /> : null}
        <div className={styles.page01Fade} />
        <div className={styles.page01Title}>
          <h1>{page.title}</h1>
          <span className={styles.goldRule} />
        </div>
      </div>
      <div className={styles.featureStrip}>
        {(page.features || []).map((feature, index) => (
          <div key={`${feature.title}-${index}`} className={styles.featureCard}>
            <span className={styles.featureIcon}><FeatureIcon icon={feature.icon} index={index} /></span>
            <strong>{feature.title}</strong>
            <p>{feature.text}</p>
          </div>
        ))}
      </div>
      <div className={styles.page01Info}>
        <p>{page.intro}</p>
        <span className={styles.goldRule} />
        <strong className={styles.tagline}>{page.tagline}</strong>
        <div className={styles.contactRow}>
          <span className={styles.contactItem}><Phone size={16} /> {builder.phone}</span>
          <span className={styles.divider} />
          <span className={styles.contactItem}><Globe2 size={16} /> {builder.website}</span>
        </div>
        {builder.logoUrl ? <img className={styles.coverLogo} src={builder.logoUrl} alt={builder.builderName} onDoubleClick={() => onImageDoubleClick?.({ type: "footerLogo" })} /> : null}
      </div>
    </StandardInclusionsPageShell>
  );
}
