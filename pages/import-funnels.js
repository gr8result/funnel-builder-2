// pages/import-funnels.js
export async function getServerSideProps() {
  return { redirect: { destination: "/import", permanent: false } };
}
export default function ImportFunnelsRedirect() { return null; }
