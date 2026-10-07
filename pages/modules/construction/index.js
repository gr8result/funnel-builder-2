// /pages/modules/construction/index.js
//
// The separate "Projects Hub" dashboard has been retired. Its active project
// workflow cards now live in Project Workspace, and job creation moved to the
// "+ New Job" action in the Project Workspace banner.
//
// This route is kept only so existing links and bookmarks keep working; it
// redirects to the Project Workspace landing page.

export async function getServerSideProps(context) {
  const organisationId = typeof context.query.organisationId === "string" ? context.query.organisationId : "";
  const destination = organisationId
    ? `/modules/estimate-builder?page=projectDashboard&organisationId=${encodeURIComponent(organisationId)}`
    : "/modules/estimate-builder?page=projectDashboard";
  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
}

export default function ConstructionHubRedirect() {
  return null;
}
