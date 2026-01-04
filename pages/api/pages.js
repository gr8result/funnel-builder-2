// /pages/api/pages.js

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (req.method === 'GET') {
    const { funnel_id } = req.query;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/pages?funnel_id=eq.${funnel_id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { funnel_id, title, html } = req.body;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/pages`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ funnel_id, title, html }),
    });

    const data = await response.json();
    res.status(200).json(data[0]);
  }
}
