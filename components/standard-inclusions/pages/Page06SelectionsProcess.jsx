import StandardInclusionsPageShell from "../StandardInclusionsPageShell";
import styles from "../standardInclusions.module.css";

export default function Page06SelectionsProcess({ page, pageNumber }) {
  return (
    <StandardInclusionsPageShell className={styles.page06} pageNumber={pageNumber}>
      <h2 className={styles.editorialHeading}>{page.heading}</h2>
      <p className={styles.editorialIntro}>{page.intro}</p>
      <div className={styles.cardGrid}>
        {(page.steps || []).map((step) => <div key={step} className={styles.simpleCard}>{step}</div>)}
      </div>
    </StandardInclusionsPageShell>
  );
}
