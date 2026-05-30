import { withAuth } from "../../../lib/withWorkspace";
// /pages/api/account/brand.js
// Replace the values with the client's branding; served from /public.
async function handler(req, res) {
  res.status(200).json({
    name: "Gr8 Result Digital Solutions",
    logo: "/logo/gr8result-logo.png",
  });
}

export default withAuth(handler);
