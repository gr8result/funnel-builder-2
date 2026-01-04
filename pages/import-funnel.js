// pages/import-funnel.js
export async function getServerSideProps() {
  return { redirect: { destination: "/import", permanent: false } };
}
export default function ImportFunnelRedirect() { return null; }

