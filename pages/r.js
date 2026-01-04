// /pages/r.js
// FULL REPLACEMENT — fixes "utils/affdb.js can't resolve fs"
// Build-safe redirect endpoint (no fs, no db). Keeps the route alive.

export async function getServerSideProps(ctx) {
  const { to } = ctx.query || {};

  // If you pass ?to=https://example.com it will redirect.
  // Otherwise it goes home.
  const destination =
    typeof to === "string" && to.trim() ? to.trim() : "/";

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
}

export default function RedirectPage() {
  return null;
}
