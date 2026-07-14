import StandardInclusionsPageShell from "../StandardInclusionsPageShell";
import styles from "../standardInclusions.module.css";

export default function Page02PremierIntroduction({ page, onImageDoubleClick, pageNumber }) {
  const paragraphs = String(page.intro || "").split("\n\n").filter(Boolean);
  return (
    <StandardInclusionsPageShell className={styles.page02} pageNumber={pageNumber}>
      <img className={styles.page02Image} src={page.imageUrl} alt="" onDoubleClick={() => onImageDoubleClick?.({ type: "documentPage", pageKey: "intro" })} />
      <div className={styles.page02Panel}>
        <h2>{page.heading}</h2>
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </StandardInclusionsPageShell>
  );
}
