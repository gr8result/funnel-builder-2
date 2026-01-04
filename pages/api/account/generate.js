// pages/api/ai/generate.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { mode } = req.body || {};
  const presets = {
    headline: "Limited-time offer for VIP members",
    content:
      "Quick update from Waite and Sea. Fresh deals are live today only. Join the VIP list for early access and member-only pricing.",
    help:
      "Keep the headline under 9 words with one clear benefit. In the body, one idea per paragraph and a single call-to-action.",
  };
  return res.status(200).json({ text: presets[mode] || presets.help });
}

