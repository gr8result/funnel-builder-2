// pages/api/funnels/create-with-pages.js
// POST { funnelTypeId, brand: { name, headline, subheadline, ctaText, price, accentColor } }
// Creates a funnel record + all steps pre-filled with section HTML.

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { FUNNEL_TYPES, assemblePage } from '../../../lib/funnelSections';

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    + '-' + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  return `${str || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeOfferName(value) {
  return `${value || ''}`
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      if (/^GR8$/i.test(word)) return 'GR8';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function basicPersonalizeHtml(html, brand = {}) {
  const product = normalizeOfferName(brand.name || 'Your Product');
  const headline = (brand.headline || `Discover ${product}`).trim();
  const subheadline = (brand.subheadline || brand.offerDescription || `See how ${product} can help you get better results.`).trim();
  const cta = (brand.ctaText || 'GET STARTED NOW').trim();
  const price = (brand.price || '$49').trim();
  const description = (brand.offerDescription || `${product} is designed to help you get results faster and more consistently.`).trim();
  const shortDesc = description.split('.').slice(0, 2).join('.').trim() || description;
  const audience = (brand.audience || 'people like you').trim();
  const primaryResult = (brand.primaryResult || 'get better results').trim();
  const leadHeadline = headline || `Get Started With ${product}`;
  const leadSubheadline = subheadline || `${product} is built for ${audience} who want ${primaryResult}.`;
  const benefit1 = `Get faster, more consistent results with ${product}.`;
  const benefit2 = `Make the offer feel clear, credible, and easy to act on.`;
  const benefit3 = `See exactly how ${product} helps ${audience} ${primaryResult}.`;
  const ingredient1 = `${product} Core Method`;
  const ingredient2 = `Execution Framework`;
  const ingredient3 = `Optimization Layer`;
  const trialLabel = `Built for ${audience}`;
  const previewLabel = `See what makes ${product} different`;
  const insideLabel = `${product} at a glance`;
  const insideText = `${product} is designed to help ${audience} ${primaryResult}.`;
  const secondaryCardTitle = `What you need to know first`;
  const secondaryCardText = `Use this section to show the core benefits, proof, and next step for ${product}.`;
  const finalCardTitle = `Make the next step obvious`;
  const finalCardText = `Keep the copy focused on ${audience}, the promised result, and why ${product} is worth acting on now.`;
  const formIntro = `Enter your details below to get started with ${product}.`;
  const formNote = `We will use your details to send the next steps and follow-up information related to ${product}.`;

  const map = [
    [/Your Headline That Stops People Dead<br\/>In Their Tracks!/gi, escHtml(headline)],
    [/The Secret \[Audience\] Are Using to Get \[Result\] Fast/gi, escHtml(headline)],
    [/A compelling subheadline that hooks them emotionally and makes them desperate to read on\./gi, escHtml(subheadline)],
    [/Without \[common objection\]\. Even if you've \[tried before and failed\]\./gi, escHtml(subheadline)],
    [/Your Product\s*Name Here™/gi, escHtml(product)],
    [/Get Your Free \[Lead Magnet Name\] Now/gi, escHtml(leadHeadline)],
    [/Enter your details below and we'll deliver it straight to your inbox within seconds/gi, escHtml(leadSubheadline)],
    [/Describe what they get and how it changes their life\. Make it specific and tangible\./gi, escHtml(description)],
    [/Describe another key benefit\. Focus on the emotion and the outcome, not the feature\./gi, escHtml(benefit2)],
    [/Third benefit goes here\. Always connect to a core desire or pain point of your audience\./gi, escHtml(benefit3)],
    [/Benefit One/gi, 'Clear Benefit'],
    [/Benefit Two/gi, 'Real-World Value'],
    [/Benefit Three/gi, 'Why It Matters'],
    [/YES! I WANT ACCESS NOW →/gi, `${escHtml(cta)} →`],
    [/SEND ME FREE ACCESS NOW →/gi, `${escHtml(cta)} →`],
    [/START MY FREE 14-DAY TRIAL →/gi, `${escHtml(cta)} →`],
    [/YES! I WANT THIS NOW →/gi, `${escHtml(cta)} →`],
    [/YES! I'M READY — GET STARTED NOW →/gi, `${escHtml(cta)} →`],
    [/Claim My Discount Now →/gi, `${escHtml(cta)} →`],
    [/ORDER NOW →/gi, `${escHtml(cta)} →`],
    [/Buy Now — Best Deal/gi, escHtml(cta)],
    [/Buy Now/gi, escHtml(cta)],
    [/\$49/gi, escHtml(price)],
    [/Your product description goes here\. Explain what makes this special, what's inside, and why it's different from everything else they've tried\./gi, escHtml(shortDesc)],
    [/Key feature or benefit one/gi, escHtml(benefit1)],
    [/Key feature or benefit two/gi, escHtml(benefit2)],
    [/Key feature or benefit three/gi, escHtml(benefit3)],
    [/Ingredient Name #1/gi, escHtml(ingredient1)],
    [/Ingredient Name #2/gi, escHtml(ingredient2)],
    [/Ingredient Name #3/gi, escHtml(ingredient3)],
    [/Supports \[function\] and helps you \[result\]\. Backed by \[X\] clinical studies showing \[specific benefit\]\. This is why it's been called "nature's answer to \[problem\]\."/gi, escHtml(benefit1)],
    [/Promotes \[function\]\. Clinical studies show it can reduce \[problem\] by up to \[X%\] in just \[timeframe\]\. Ancient cultures have used this for centuries\./gi, escHtml(benefit2)],
    [/Enhances \[function\] and \[result\]\. One of the most researched natural \[category\] compounds in modern science with over \[X\] peer-reviewed studies\./gi, escHtml(benefit3)],
    [/Bonus Title Goes Here/gi, `${escHtml(product)} Quickstart Guide`],
    [/Second Bonus Here/gi, `${escHtml(product)} Troubleshooting Playbook`],
    [/Describe what this bonus does and why it's incredibly valuable\. What specific result will they get\?/gi, escHtml(`Get a step-by-step quickstart so you can implement ${product} correctly from day one.`)],
    [/Describe the second bonus and the transformation it creates\. Why is this alone worth more than the price\?/gi, escHtml(`Get proven fixes for common mistakes so your results stay on track.`)],
    [/This is ideal for anyone who \[target audience description\] and wants to \[primary result\] without \[common objection\]\. If you're ready to finally do something that works, this is for you\./gi, escHtml(shortDesc)],
    [/✨ Start your free 14-day trial and explore the platform before you commit/gi, escHtml(`${product} was built for ${audience} who want ${primaryResult}.`)],
    [/🔒 100% Free\. No Credit Card\. Instant Delivery\./gi, escHtml(`Clear next steps. Focused benefits. A stronger pitch for ${product}.`)],
    [/WHY TEAMS START HERE/gi, escHtml(`WHY ${audience.toUpperCase()} CARE`)],
    [/What You Can Explore In Your Trial/gi, escHtml(`Why ${product} Stands Out`)],
    [/Show the parts of the platform that matter most so the page feels grounded in a real product, not a generic offer\./gi, escHtml(`Show the benefits, differentiators, and proof points that make ${product} relevant to ${audience}.`)],
    [/Built for modern operators:/gi, escHtml(`Made for ${audience}:`)],
    [/📈 Campaigns/gi, escHtml('Key benefits')],
    [/🧩 Automations/gi, escHtml('How it works')],
    [/📨 Email/gi, escHtml('Offer details')],
    [/🤝 CRM/gi, escHtml('Proof points')],
    [/🌏 Australian business/gi, escHtml('Simple next step')],
    [/Create your free 14-day account and take a proper look around the platform before you decide to continue\./gi, escHtml(leadSubheadline)],
    [/14-day free trial/gi, escHtml(trialLabel)],
    [/Digital platform access/gi, escHtml(primaryResult)],
    [/Preview/gi, escHtml(previewLabel)],
    [/A cleaner look at the offer/gi, escHtml(`A clearer picture of ${product}`)],
    [/Inside/gi, escHtml(insideLabel)],
    [/Funnels, CRM, email, and automation in one place\./gi, escHtml(insideText)],
    [/The visual panel is there to make the platform feel like a real product, not a vague promise\./gi, escHtml(`Use the space to show what ${product} does, who it is for, and why it is worth trying.`)],
    [/See the platform first/gi, escHtml(secondaryCardTitle)],
    [/Use generic product-style visuals so the page looks designed, not empty\./gi, escHtml(secondaryCardText)],
    [/Make the next step obvious/gi, escHtml(finalCardTitle)],
    [/Use visuals and clear benefits so the page feels intentional, not generic\./gi, escHtml(finalCardText)],
    [/Start here/gi, escHtml(`Get ${product}`)],
    [/Create your free 14-day account/gi, escHtml(leadHeadline)],
    [/Sign up now and start exploring the platform straight away\./gi, escHtml(formIntro)],
    [/Platform access/gi, escHtml('What you get')],
    [/Create an account and start exploring immediately inside the app\./gi, escHtml(`Get the next step for ${product} and see how it helps ${audience}.`)],
    [/No download claim/gi, escHtml('Focused offer')],
    [/This page is for signing up to a trial account, not promising a file delivery\./gi, escHtml(`This page should stay focused on ${product}, the promised result, and what happens next.`)],
    [/Your details are used to create your trial and send account-related follow-up for this platform\./gi, escHtml(formNote)],
    [/The choice is yours/gi, 'The Choice Is Yours'],
    [/\[Audience\]/gi, 'your audience'],
    [/\[Result\]/gi, 'better results'],
    [/\[problem\]/gi, 'the problem'],
    [/\[Lead Magnet Name\]/gi, escHtml(product)],
    [/\[Company Name\]/gi, escHtml(product)],
  ];

  let out = `${html || ''}`;
  for (const [rx, replacement] of map) out = out.replace(rx, replacement);
  return out;
}

function unwrapHtmlResponse(text) {
  const raw = `${text || ''}`.trim();
  if (!raw) return '';
  return raw
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generateCopyPackWithAI(brand = {}, funnelTypeLabel = '') {
  if (!process.env.OPENAI_API_KEY) return null;

  const system = 'You are a world-class direct response copywriter. Return valid JSON only.';
  const user = `Create a structured copy pack for a ${funnelTypeLabel}.

Offer Name: ${brand.name || ''}
Headline: ${brand.headline || ''}
Subheadline: ${brand.subheadline || ''}
CTA: ${brand.ctaText || ''}
Price: ${brand.price || ''}
Offer Description: ${brand.offerDescription || ''}

Return JSON with these keys exactly:
{
  "headline":"",
  "subheadline":"",
  "heroCta":"",
  "heroProof":"",
  "benefits":[{"title":"","text":""},{"title":"","text":""},{"title":"","text":""}],
  "story":["","",""],
  "features":[{"title":"","text":""},{"title":"","text":""},{"title":"","text":""}],
  "productDescription":"",
  "featureBullets":["","",""],
  "testimonials":[{"name":"","meta":"","text":""},{"name":"","meta":"","text":""},{"name":"","meta":"","text":""}],
  "faq":[{"q":"","a":""},{"q":"","a":""},{"q":"","a":""},{"q":"","a":""},{"q":"","a":""}],
  "bonus1Title":"",
  "bonus1Text":"",
  "bonus2Title":"",
  "bonus2Text":"",
  "guaranteeText":"",
  "thankYouHeadline":"",
  "thankYouText":"",
  "thankYouSteps":["","",""],
  "companyName":""
}`;

  try {
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    }, 12000);

    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function applyCopyPackToHtml(html, pack = {}, brand = {}) {
  if (!pack) return html;
  let out = `${html || ''}`;
  const safe = (value, fallback = '') => escHtml(value || fallback);
  const benefit1 = pack.benefits?.[0] || {};
  const benefit2 = pack.benefits?.[1] || {};
  const benefit3 = pack.benefits?.[2] || {};
  const feature1 = pack.features?.[0] || {};
  const feature2 = pack.features?.[1] || {};
  const feature3 = pack.features?.[2] || {};
  const testimonial1 = pack.testimonials?.[0] || {};
  const testimonial2 = pack.testimonials?.[1] || {};
  const testimonial3 = pack.testimonials?.[2] || {};
  const faq = pack.faq || [];
  const steps = pack.thankYouSteps || [];

  const replacements = [
    [/Your Headline That Stops People Dead<br\/>In Their Tracks!/gi, safe(pack.headline, brand.headline)],
    [/The Secret \[Audience\] Are Using to Get \[Result\] Fast/gi, safe(pack.headline, brand.headline)],
    [/A compelling subheadline that hooks them emotionally and makes them desperate to read on\./gi, safe(pack.subheadline, brand.subheadline || brand.offerDescription)],
    [/Without \[common objection\]\. Even if you've \[tried before and failed\]\./gi, safe(pack.subheadline, brand.subheadline || brand.offerDescription)],
    [/Get Your Free \[Lead Magnet Name\] Now/gi, safe(pack.headline, brand.headline || `Start Your ${normalizeOfferName(brand.name || 'Platform')} Free Trial`)],
    [/Enter your details below and we'll deliver it straight to your inbox within seconds/gi, safe(pack.subheadline, brand.subheadline || brand.offerDescription)],
    [/YES! I WANT ACCESS NOW →/gi, `${safe(pack.heroCta, brand.ctaText || 'GET STARTED NOW')} →`],
    [/SEND ME FREE ACCESS NOW →/gi, `${safe(pack.heroCta, brand.ctaText || 'GET STARTED NOW')} →`],
    [/START MY FREE 14-DAY TRIAL →/gi, `${safe(pack.heroCta, brand.ctaText || 'GET STARTED NOW')} →`],
    [/YES! I WANT THIS NOW →/gi, `${safe(pack.heroCta, brand.ctaText || 'GET STARTED NOW')} →`],
    [/Claim My Discount Now →/gi, `${safe(pack.heroCta, brand.ctaText || 'GET STARTED NOW')} →`],
    [/YES! I'M READY — GET STARTED NOW →/gi, `${safe(pack.heroCta, brand.ctaText || 'GET STARTED NOW')} →`],
    [/Benefit One/gi, safe(benefit1.title, 'Benefit One')],
    [/Benefit Two/gi, safe(benefit2.title, 'Benefit Two')],
    [/Benefit Three/gi, safe(benefit3.title, 'Benefit Three')],
    [/Describe what they get and how it changes their life\. Make it specific and tangible\./gi, safe(benefit1.text, brand.offerDescription)],
    [/Describe another key benefit\. Focus on the emotion and the outcome, not the feature\./gi, safe(benefit2.text, brand.offerDescription)],
    [/Third benefit goes here\. Always connect to a core desire or pain point of your audience\./gi, safe(benefit3.text, brand.offerDescription)],
    [/New research from leading universities has uncovered a little-known condition that affects millions — and that the mainstream completely ignores…/gi, safe(pack.story?.[0], brand.offerDescription)],
    [/Scientists found that <strong>one specific trigger<\/strong> is responsible for the majority of people who struggle with \[problem\]\./gi, safe(pack.story?.[1], brand.offerDescription)],
    [/Continue your story here\. Build the problem bigger\. Amplify the pain\. Then position your solution as the inevitable answer they've been missing\.\.\./gi, safe(pack.story?.[2], brand.offerDescription)],
    [/Ingredient Name #1/gi, safe(feature1.title, 'Feature One')],
    [/Ingredient Name #2/gi, safe(feature2.title, 'Feature Two')],
    [/Ingredient Name #3/gi, safe(feature3.title, 'Feature Three')],
    [/Supports \[function\] and helps you \[result\]\. Backed by \[X\] clinical studies showing \[specific benefit\]\. This is why it's been called "nature's answer to \[problem\]\."/gi, safe(feature1.text, brand.offerDescription)],
    [/Promotes \[function\]\. Clinical studies show it can reduce \[problem\] by up to \[X%\] in just \[timeframe\]\. Ancient cultures have used this for centuries\./gi, safe(feature2.text, brand.offerDescription)],
    [/Enhances \[function\] and \[result\]\. One of the most researched natural \[category\] compounds in modern science with over \[X\] peer-reviewed studies\./gi, safe(feature3.text, brand.offerDescription)],
    [/Your product description goes here\. Explain what makes this special, what's inside, and why it's different from everything else they've tried\./gi, safe(pack.productDescription, brand.offerDescription)],
    [/Key feature or benefit one/gi, safe(pack.featureBullets?.[0], brand.offerDescription)],
    [/Key feature or benefit two/gi, safe(pack.featureBullets?.[1], brand.offerDescription)],
    [/Key feature or benefit three/gi, safe(pack.featureBullets?.[2], brand.offerDescription)],
    [/Bonus Title Goes Here/gi, safe(pack.bonus1Title, `${brand.name || 'Offer'} Quickstart Guide`)],
    [/Second Bonus Here/gi, safe(pack.bonus2Title, `${brand.name || 'Offer'} Playbook`)],
    [/Describe what this bonus does and why it's incredibly valuable\. What specific result will they get\?/gi, safe(pack.bonus1Text, brand.offerDescription)],
    [/Describe the second bonus and the transformation it creates\. Why is this alone worth more than the price\?/gi, safe(pack.bonus2Text, brand.offerDescription)],
    [/Try it for a full 180 days\. If for any reason you're not completely amazed by your results, just let us know and we'll refund every single cent\. No questions asked\. No hassle\. No hard feelings\. You have absolutely nothing to lose\./gi, safe(pack.guaranteeText, 'You are fully protected by our straightforward money-back guarantee.')],
    [/Thank You!/gi, safe(pack.thankYouHeadline, 'Thank You!')],
    [/Check your email inbox — your receipt and access details are on their way\. In the meantime, here's what happens next…/gi, safe(pack.thankYouText, 'Check your email for your confirmation and next steps.')],
    [/Your order confirmation will arrive shortly\. Check your spam folder if you don't see it\./gi, safe(steps[0], 'Check your inbox for your confirmation email.')],
    [/We'll send you everything you need to get started\. Your bonuses will be delivered automatically\./gi, safe(steps[1], 'Watch for your access details and bonus delivery email.')],
    [/Your transformation starts now\. We're so excited to see your results!/gi, safe(steps[2], 'You are ready to start. Review the page, make final edits, and publish.')],
    [/\[Company Name\]/gi, safe(pack.companyName, brand.name)],
  ];

  for (const [rx, replacement] of replacements) out = out.replace(rx, replacement);

  if (faq.length >= 5) {
    const faqAnswers = out.match(/<p style="color:#475569;font-size:18px;line-height:1\.75;margin:18px 0 0;">[\s\S]*?<\/p>/g) || [];
    const faqSummaries = out.match(/<summary style="color:#0f172a;font-size:20px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">[\s\S]*?<span style="color:#64748b;font-size:22px;">▾<\/span><\/summary>/g) || [];
    for (let i = 0; i < Math.min(5, faqSummaries.length, faq.length); i++) {
      out = out.replace(faqSummaries[i], `<summary style="color:#0f172a;font-size:20px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">${safe(faq[i].q)} <span style="color:#64748b;font-size:22px;">▾</span></summary>`);
    }
    for (let i = 0; i < Math.min(5, faqAnswers.length, faq.length); i++) {
      out = out.replace(faqAnswers[i], `<p style="color:#475569;font-size:18px;line-height:1.75;margin:18px 0 0;">${safe(faq[i].a)}</p>`);
    }
  }

  const testimonialTexts = out.match(/"[\s\S]*?"<\/p>/g) || [];
  if (testimonialTexts.length >= 3) {
    [testimonial1, testimonial2, testimonial3].forEach((item, index) => {
      if (item?.text) {
        out = out.replace(testimonialTexts[index], `"${safe(item.text)}"</p>`);
      }
    });
  }

  return out;
}

async function rewriteHtmlWithAI(html, { brand = {}, funnelTypeLabel = '', pageTitle = '' }) {
  if (!process.env.OPENAI_API_KEY) return html;

  const system = 'You are a direct-response funnel copywriter and HTML editor. Rewrite copy only. Keep HTML structure, tag order, attributes, ids, classes, inline styles, form actions, hidden inputs, and links intact. Return HTML only.';
  const user = `Rewrite the visible marketing copy in this HTML so it matches the offer details below.\n\nOffer Name: ${brand.name || ''}\nHeadline: ${brand.headline || ''}\nSubheadline: ${brand.subheadline || ''}\nCTA: ${brand.ctaText || ''}\nPrice: ${brand.price || ''}\nOffer Description: ${brand.offerDescription || ''}\nFunnel Type: ${funnelTypeLabel}\nPage: ${pageTitle}\n\nRules:\n- Keep all HTML tags and inline styles intact\n- Do NOT remove sections\n- Only rewrite user-facing text and placeholders\n- Keep legal/trust style statements realistic\n- Return raw HTML only\n\nHTML:\n${html}`;

  try {
    const r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 7000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    }, 12000);

    if (!r.ok) return html;
    const data = await r.json();
    const content = unwrapHtmlResponse(data?.choices?.[0]?.message?.content);
    if (!content || !content.includes('<')) return html;
    return content;
  } catch {
    return html;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { funnelTypeId, brand = {}, userId: bodyUserId, useAI = true } = req.body || {};

  if (!funnelTypeId) return res.status(400).json({ error: 'Missing funnelTypeId' });

  // Prefer explicit userId from client, but also support Bearer token.
  let userId = bodyUserId || null;
  if (!userId) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error) userId = data?.user?.id || null;
    }
  }
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const funnelType = FUNNEL_TYPES.find(t => t.id === funnelTypeId);
  if (!funnelType) return res.status(400).json({ error: 'Unknown funnelTypeId' });

  const name = (brand.name || funnelType.label).trim();
  const slug = slugify(name);

  const { data: funnel, error: fErr } = await supabaseAdmin
    .from('funnels')
    .insert({
      owner_user_id: userId,
      name,
      slug,
      status: 'draft',
    })
    .select('id')
    .single();

  if (fErr) return res.status(500).json({ error: fErr.message });

  // Build steps
  const aiEnabled = Boolean(useAI && process.env.OPENAI_API_KEY && (brand?.name || brand?.headline || brand?.offerDescription));
  const copyPack = aiEnabled ? await generateCopyPackWithAI(brand, funnelType.label) : null;
  const stepInserts = [];
  for (let i = 0; i < funnelType.pages.length; i++) {
    const page = funnelType.pages[i];
    let content = assemblePage(page.sectionIds);
    content = basicPersonalizeHtml(content, brand);
    content = applyCopyPackToHtml(content, copyPack, brand);

    // Avoid long sequential AI rewrites during funnel creation.
    // If the structured copy pack exists, that's enough to personalize the pages.
    if (aiEnabled && !copyPack && i === 0) {
      content = await rewriteHtmlWithAI(content, {
        brand,
        funnelTypeLabel: funnelType.label,
        pageTitle: page.title,
      });
    }

    stepInserts.push({
      funnel_id: funnel.id,
      title: page.title,
      content,
      order_index: i,
    });
  }

  const { error: sErr } = await supabaseAdmin
    .from('funnel_steps')
    .insert(stepInserts);

  if (sErr) {
    // Clean up orphan funnel if step insert fails
    await supabaseAdmin.from('funnels').delete().eq('id', funnel.id);
    return res.status(500).json({ error: sErr.message });
  }

  return res.status(200).json({ ok: true, funnelId: funnel.id });
}
