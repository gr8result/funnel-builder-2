export async function getServerSideProps() {
  return { redirect: { destination: "/export", permanent: false } };
}
export default function ExportFunnelsRedirect() { return null; }

