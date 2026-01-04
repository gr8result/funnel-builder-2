// FILE: /pages/api/email/debug-env.js
export default function handler(req, res) {
  try {
    const sg = process.env.SENDGRID_API_KEY || "";
    res.status(200).json({
      ok: true,
      sendgrid_env_present: Boolean(sg),
      sendgrid_key_length: sg.length,
      supabase_url_present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabase_role_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hint: "If present=false or length=0 → set .env.local and RESTART dev.",
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
