// pages/index.js
// Always send home "/" to the dashboard.

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/dashboard",
      permanent: false,
    },
  };
}

export default function Index() {
  // This never renders because of the redirect.
  return null;
}

