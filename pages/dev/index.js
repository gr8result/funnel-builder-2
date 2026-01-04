// Redirect /dev -> /dev/spreadsheet to keep a single developer dashboard.
// Pages Router (Next.js 15.x)

export default function DevIndex() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/dev/spreadsheet",
      permanent: false,
    },
  };
}

