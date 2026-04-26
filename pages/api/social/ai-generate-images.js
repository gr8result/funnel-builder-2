// /pages/api/social/ai-generate-images.js
// Generate images for social media posts using OpenAI DALL-E

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { descriptions, style = 'modern', count = 1 } = req.body;

    if (!descriptions || descriptions.length === 0) {
      return res.status(400).json({ error: 'Image descriptions are required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const images = [];
    
    // Generate images for each description (cap at 10 to control cost and latency)
    const requestedCount = Number.isFinite(Number(count)) ? Number(count) : 1;
    const safeCount = Math.max(1, Math.min(requestedCount, 10));
    const batchSize = Math.min(descriptions.length, safeCount);
    
    console.log(`📸 Starting image generation: requested=${requestedCount}, safe=${safeCount}, batch=${batchSize}`);
    
    for (let i = 0; i < batchSize; i++) {
      const description = descriptions[i];
      console.log(`📸 [${i + 1}/${batchSize}] Generating for: ${description.substring(0, 60)}...`);
      
      const prompt = `Create a high-converting social media image that directly matches this post message:\n"${description}"\n\nStyle direction: ${style}.\nRequirements: product/sales visual clarity, strong focal point, brand-safe, realistic marketing aesthetic, no random textures/backgrounds unrelated to the message, no gibberish text, 1:1 composition for feed posts.`;

      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'high'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`❌ DALL-E error [${i}]:`, error);
          continue;
        }

        const data = await response.json();
        if (data.data && data.data[0]) {
          const item = data.data[0];
          const url = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (!url) {
            console.error(`❌ Image payload missing url/b64_json [${i}]`);
            continue;
          }
          console.log(`✅ Image generated [${i}]`);
          images.push({
            url,
            description: description,
            generatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`❌ Error generating image [${i}]:`, err.message);
        continue;
      }
    }
    
    console.log(`📸 Image generation complete: ${images.length}/${batchSize} successful`);

    if (!images.length) {
      return res.status(200).json({
        ok: false,
        images: [],
        generated: 0,
        requested: batchSize,
        error: 'No AI images were generated for the supplied post descriptions.'
      });
    }

    return res.status(200).json({ 
      ok: true, 
      images,
      generated: images.length,
      requested: batchSize
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
