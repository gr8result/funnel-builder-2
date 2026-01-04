// pages/modules/email/broadcast/index.js
// Safety net for any links to /modules/email/broadcast

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/modules/email",
      permanent: false,
    },
  };
}

export default function Redirecting() {
  if (typeof window !== "undefined") {
    window.location.replace("/modules/email");
  }
  return null;
}





