export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/modules/funnels/new',
      permanent: false,
    },
  };
}

export default function FunnelTemplatesRedirect() {
  return null;
}