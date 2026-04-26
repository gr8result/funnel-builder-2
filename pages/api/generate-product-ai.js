// /pages/api/generate-product-ai.js
// POST { type: 'tags' | 'description', title: string, description?: string }
// Requires OPENAI_API_KEY in .env.local

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { type, title, description } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'Missing required fields' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

  let prompt;
  if (type === 'tags') {
    prompt = `Suggest 5-8 comma-separated SEO tags for a product titled: "${title}".`;
  } else if (type === 'description') {
    prompt = `Write a compelling product description for a product titled: "${title}".`;
    if (description) prompt += `\nCurrent description: ${description}`;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  try {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
      }),
    });
    const data = await completion.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    res.status(200).json({ result: text });
  } catch (err) {
    res.status(500).json({ error: 'AI request failed' });
  }
}
