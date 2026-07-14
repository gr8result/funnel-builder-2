import styles from "./standardInclusions.module.css";

export default function StandardInclusionsPageShell({ children, className = "", pageNumber = null }) {
  return (
    <article className={`${styles.pageShell} ${className}`}>
      {children}
      {pageNumber ? <span className={styles.pageNumber}>{pageNumber}</span> : null}
    </article>
  );
}
