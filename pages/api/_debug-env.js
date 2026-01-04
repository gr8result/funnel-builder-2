// /pages/api/_debug-env.js
export default function handler(req, res) {
  res.status(200).json({
    hasKey: Boolean(process.env.NEXT_PUBLIC_BUILDER_API_KEY),
    keyPreview: (process.env.NEXT_PUBLIC_BUILDER_API_KEY || "").slice(0, 6) + "...",
  });
}
