// /pages/api/account/brand.js
// Replace the values with the client's branding; served from /public.
export default function handler(req, res) {
  res.status(200).json({
    name: "Gr8 Result Digital Solutions",
    logo: "/assets/brand/gr8-logo.png", // put the PNG under /public/assets/brand/
  });
}

