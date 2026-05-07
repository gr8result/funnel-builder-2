// /pages/api/account/brand.js
// Replace the values with the client's branding; served from /public.
export default function handler(req, res) {
  res.status(200).json({
    name: "Gr8 Result Digital Solutions",
    logo: "/logo/gr8result-logo.png",
  });
}

