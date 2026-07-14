import StandardInclusionsPageShell from "../StandardInclusionsPageShell";
import styles from "../standardInclusions.module.css";

export default function Page03CreatingHomes({ page, builder, onImageDoubleClick, pageNumber }) {
  return (
    <StandardInclusionsPageShell className={styles.page03} pageNumber={pageNumber}>
      <img className={styles.page03Image} src={page.imageUrl} alt="" onDoubleClick={() => onImageDoubleClick?.({ type: "documentPage", pageKey: "living" })} />
      <div className={styles.page03Panel}>
        <h2>{page.heading}</h2>
        <p>{page.intro}</p>
      </div>
      {builder.logoUrl ? <img className={styles.floatingLogo} src={builder.logoUrl} alt={builder.builderName} onDoubleClick={() => onImageDoubleClick?.({ type: "footerLogo" })} /> : null}
    </StandardInclusionsPageShell>
  );
}
