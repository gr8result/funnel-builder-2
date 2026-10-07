export function getPageBuilderRedirect({ resolvedUrl }) {
  const query = resolvedUrl.includes("?") ? resolvedUrl.slice(resolvedUrl.indexOf("?")) : "";

  return {
    redirect: {
      destination: `/modules/website-builder/visual-builder${query}`,
      permanent: false,
    },
  };
}
