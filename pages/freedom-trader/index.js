/**
 * Retired Freedom page.
 *
 * Freedom was consolidated to three pages: Today's Opportunities (/freedom),
 * My Trades (/freedom/my-trades) and Long-Term Portfolio (/freedom/long-term).
 * This redirect keeps old links and bookmarks working instead of 404ing.
 */

export async function getServerSideProps() {
  return { redirect: { destination: "/freedom", permanent: false } };
}

export default function RetiredFreedomPage() {
  return null;
}
