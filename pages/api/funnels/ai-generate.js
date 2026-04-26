// pages/api/funnels/ai-generate.js
// POST { productName, headline, description, funnelType }
// Calls OpenAI to generate compelling copy for a sales funnel.
// Returns: { ok, offerName, headline, subheadline, ctaText, offerDescription, bullets[], testimonials[], faqItems[] }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  const { productName, headline, description, funnelType } = req.body || {};

  if (!productName) return res.status(400).json({ error: 'Missing productName' });

  const systemPrompt = `You are a world-class direct response copywriter specialising in high-converting sales funnels. 
You write compelling, benefit-driven copy in the style of top-performing ClickBank and affiliate offers.
Write in second-person ("you"), use power words, be specific with numbers/benefits, and create urgency.
Always respond with valid JSON only — no markdown, no explanation, just the JSON object.`;

  const userPrompt = `Create compelling sales funnel copy for this product/offer:

Product Name: ${productName}
Current Headline: ${headline || '(none)'}
Description: ${description || '(none provided)'}
Funnel Type: ${funnelType || 'sales-funnel'}

Correct spelling, capitalization, and obvious grammar issues in the source details before writing the copy.

Return a JSON object with these exact keys:
{
  "offerName": "A cleaned-up version of the product/offer name with spelling and capitalization fixed",
  "headline": "A powerful, curiosity-driven main headline (max 12 words)",
  "subheadline": "A benefit-rich subheadline that supports the headline (max 20 words)",
  "ctaText": "A compelling call-to-action button text (max 8 words, ALL CAPS)",
  "offerDescription": "A persuasive 2-4 sentence offer description that explains what it is, key benefits, and who it helps",
  "bullets": [
    "Benefit bullet 1 (start with specific result)",
    "Benefit bullet 2",
    "Benefit bullet 3",
    "Benefit bullet 4",
    "Benefit bullet 5"
  ],
  "testimonials": [
    { "name": "First Last", "location": "City, State", "rating": 5, "text": "Short compelling success story (2-3 sentences)" },
    { "name": "First Last", "location": "City, State", "rating": 5, "text": "Short compelling success story (2-3 sentences)" },
    { "name": "First Last", "location": "City, State", "rating": 5, "text": "Short compelling success story (2-3 sentences)" }
  ],
  "faqItems": [
    { "q": "Common objection as a question?", "a": "Reassuring answer that overcomes the objection." },
    { "q": "Question about safety/effectiveness?", "a": "Confident answer with proof." },
    { "q": "Question about guarantee/refund?", "a": "Clear guarantee explanation." },
    { "q": "How fast can I expect results?", "a": "Specific, realistic but optimistic timeline." },
    { "q": "Is this right for me?", "a": "Inclusive answer that speaks to the target audience." }
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'OpenAI error: ' + errText.slice(0, 200) });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return res.status(502).json({ error: 'Empty response from OpenAI' });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'Failed to parse OpenAI JSON response' });
    }

    return res.status(200).json({ ok: true, ...parsed });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Request failed' });
  }
}
