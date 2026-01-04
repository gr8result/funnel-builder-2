export async function getServerSideProps() {
  return { redirect: { destination: "/export", permanent: false } };
}
export default function ExportFunnelRedirect() { return null; }
