// pages/funnels.js
// Permanent redirect to /modules/funnels so old links keep working.
export async function getServerSideProps() {
  return {
    redirect: { destination: "/modules/funnels", permanent: true },
  };
}
export default function FunnelsRedirect() { return null; }
