// 2-Column Text Section
export function sectionTwoColumnText() {
  return `<section style="${F}background:#fff;padding:64px 24px;">
    <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;">
      <div>
        <h2 style="color:#0f172a;font-size:36px;font-weight:900;margin:0 0 18px;">Left Column Title</h2>
        <p style="color:#475569;font-size:20px;line-height:1.7;margin:0;">Left column text goes here. Use this space for your main message, features, or story. You can add more paragraphs as needed.</p>
      </div>
      <div>
        <h2 style="color:#0f172a;font-size:36px;font-weight:900;margin:0 0 18px;">Right Column Title</h2>
        <p style="color:#475569;font-size:20px;line-height:1.7;margin:0;">Right column text goes here. Use this for testimonials, supporting points, or a call to action. Add more content as needed.</p>
      </div>
    </div>
  </section>`;
}

// 3-Column Text Section
export function sectionThreeColumnText() {
  return `<section style="${F}background:#fff;padding:64px 24px;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr 1fr;gap:36px;align-items:start;">
      <div>
        <h3 style="color:#0f172a;font-size:28px;font-weight:800;margin:0 0 12px;">Column One</h3>
        <p style="color:#475569;font-size:18px;line-height:1.7;margin:0;">Text for the first column. Use this for a feature, benefit, or story point.</p>
      </div>
      <div>
        <h3 style="color:#0f172a;font-size:28px;font-weight:800;margin:0 0 12px;">Column Two</h3>
        <p style="color:#475569;font-size:18px;line-height:1.7;margin:0;">Text for the second column. Highlight another key idea or testimonial.</p>
      </div>
      <div>
        <h3 style="color:#0f172a;font-size:28px;font-weight:800;margin:0 0 12px;">Column Three</h3>
        <p style="color:#475569;font-size:18px;line-height:1.7;margin:0;">Text for the third column. Use for a call to action, guarantee, or summary.</p>
      </div>
    </div>
  </section>`;
}
// lib/funnelSections.js
// Professional sales-page section templates for the Funnel Builder.
// All styles are inline — no external CSS required.
// Designed to look like top-converting ClickBank/affiliate sales pages.

const F = 'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;';

// ─────────────────────────────────────────────
// INDIVIDUAL SECTION FUNCTIONS
// ─────────────────────────────────────────────

export function sectionAnnouncementBar() {
  return `<div style="${F}background:linear-gradient(90deg,#f59e0b,#ef4444);padding:14px 24px;text-align:center;">
  <p style="margin:0;color:#fff;font-size:18px;font-weight:800;letter-spacing:0.3px;">✨ Start your free 14-day trial and explore the platform before you commit</p>
</div>`;
}

export function sectionHero() {
  return `<section style="${F}background:linear-gradient(135deg,#0f2247 0%,#1e4da8 60%,#2d6cdf 100%);padding:90px 24px;text-align:center;">
  <div style="max-width:880px;margin:0 auto;">
    <p style="color:#fcd34d;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:3px;margin:0 0 20px;">⭐ THE BREAKTHROUGH EVERYONE IS TALKING ABOUT ⭐</p>
    <h1 style="color:#fff;font-size:58px;font-weight:900;margin:0 0 24px;line-height:1.1;">Your Headline That Stops People Dead<br/>In Their Tracks!</h1>
    <p style="color:rgba(255,255,255,0.88);font-size:22px;margin:0 0 44px;line-height:1.6;max-width:700px;margin-left:auto;margin-right:auto;">A compelling subheadline that hooks them emotionally and makes them desperate to read on.</p>
    <a href="#order" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:22px 60px;border-radius:50px;font-size:24px;font-weight:900;text-decoration:none;box-shadow:0 8px 40px rgba(34,197,94,0.5);letter-spacing:0.5px;">YES! I WANT ACCESS NOW →</a>
    <p style="color:rgba(255,255,255,0.55);margin:22px 0 0;font-size:16px;">⭐⭐⭐⭐⭐ Trusted by 96,000+ Satisfied Customers · 180-Day Money-Back Guarantee</p>
  </div>
</section>`;
}

export function sectionHeroLight() {
  return `<section style="${F}background:#fff;padding:90px 24px;text-align:center;border-bottom:1px solid #e2e8f0;">
  <div style="max-width:880px;margin:0 auto;">
    <p style="color:#ef4444;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:3px;margin:0 0 20px;">FREE INSTANT ACCESS</p>
    <h1 style="color:#0f172a;font-size:56px;font-weight:900;margin:0 0 22px;line-height:1.1;">The Secret [Audience] Are Using to Get [Result] Fast</h1>
    <p style="color:#475569;font-size:22px;margin:0 0 44px;line-height:1.6;">Without [common objection]. Even if you've [tried before and failed].</p>
    <a href="#optin" style="display:inline-block;background:linear-gradient(135deg,#ef465d,#b5224a);color:#fff;padding:22px 60px;border-radius:50px;font-size:24px;font-weight:900;text-decoration:none;box-shadow:0 8px 40px rgba(239,70,93,0.4);">SEND ME FREE ACCESS NOW →</a>
    <p style="color:#94a3b8;margin:20px 0 0;font-size:16px;">🔒 100% Free. No Credit Card. Instant Delivery.</p>
  </div>
</section>`;
}

export function sectionVideoHero() {
  return `<section style="${F}background:linear-gradient(135deg,#1e293b,#0f172a);padding:80px 24px;text-align:center;">
  <div style="max-width:900px;margin:0 auto;">
    <p style="color:#fcd34d;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:3px;margin:0 0 16px;">Watch This Short Video First — Sound On</p>
    <h1 style="color:#fff;font-size:52px;font-weight:900;margin:0 0 32px;line-height:1.15;">Discover The [Number]-Second Secret That Is Changing Everything</h1>
    <div style="position:relative;padding-bottom:56.25%;background:#0c121a;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.5);border:2px solid #1e2d45;margin-bottom:36px;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;">
        <div style="width:88px;height:88px;background:linear-gradient(135deg,#ef465d,#b5224a);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:38px;margin-bottom:16px;box-shadow:0 8px 32px rgba(239,70,93,0.5);">▶</div>
        <p style="margin:0;font-size:18px;color:rgba(255,255,255,0.6);">Paste your YouTube/Vimeo embed URL here</p>
        <p style="margin:8px 0 0;font-size:16px;color:rgba(255,255,255,0.4);">Replace this div with: &lt;iframe src="..." /&gt;</p>
      </div>
    </div>
    <a href="#order" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:22px 60px;border-radius:50px;font-size:24px;font-weight:900;text-decoration:none;box-shadow:0 8px 40px rgba(34,197,94,0.5);">YES! I WANT THIS NOW →</a>
  </div>
</section>`;
}

export function sectionSocialProofBar() {
  return `<section style="${F}background:#1e293b;padding:28px 24px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:18px;">
    <span style="color:#94a3b8;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Built for modern operators:</span>
    <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#fff;font-size:16px;font-weight:700;">📈 Campaigns</span>
    <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#fff;font-size:16px;font-weight:700;">🧩 Automations</span>
    <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#fff;font-size:16px;font-weight:700;">📨 Email</span>
    <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#fff;font-size:16px;font-weight:700;">🤝 CRM</span>
    <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#fff;font-size:16px;font-weight:700;">🌏 Australian business</span>
  </div>
</section>`;
}

export function sectionBenefitsGrid() {
  return `<section style="${F}background:#fff;padding:88px 24px;">
  <div style="max-width:1100px;margin:0 auto;">
    <p style="text-align:center;color:#2d6cdf;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">WHY TEAMS START HERE</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;margin:0 0 16px;line-height:1.15;">What You Can Explore In Your Trial</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;margin:0 0 60px;max-width:700px;margin-left:auto;margin-right:auto;">Show the parts of the platform that matter most so the page feels grounded in a real product, not a generic offer.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px;align-items:stretch;">
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid #bfdbfe;border-radius:20px;padding:36px;text-align:center;display:flex;flex-direction:column;min-height:320px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="font-size:56px;margin-bottom:18px;">⚡</div>
        <h3 style="color:#0f172a;font-size:24px;font-weight:800;margin:0 0 14px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">Benefit One</h3>
        <p style="color:#475569;font-size:18px;margin:0;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Describe what they get and how it changes their life. Make it specific and tangible.</p>
      </div>
      <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #bbf7d0;border-radius:20px;padding:36px;text-align:center;display:flex;flex-direction:column;min-height:320px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="font-size:56px;margin-bottom:18px;">🔥</div>
        <h3 style="color:#0f172a;font-size:24px;font-weight:800;margin:0 0 14px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">Benefit Two</h3>
        <p style="color:#475569;font-size:18px;margin:0;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Describe another key benefit. Focus on the emotion and the outcome, not the feature.</p>
      </div>
      <div style="background:linear-gradient(135deg,#fdf4ff,#f3e8ff);border:2px solid #e9d5ff;border-radius:20px;padding:36px;text-align:center;display:flex;flex-direction:column;min-height:320px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="font-size:56px;margin-bottom:18px;">🎯</div>
        <h3 style="color:#0f172a;font-size:24px;font-weight:800;margin:0 0 14px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">Benefit Three</h3>
        <p style="color:#475569;font-size:18px;margin:0;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Third benefit goes here. Always connect to a core desire or pain point of your audience.</p>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionStoryCopy() {
  return `<section style="${F}background:#fff;padding:88px 24px;">
  <div style="max-width:760px;margin:0 auto;">
    <p style="color:#ef4444;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">BREAKING RESEARCH</p>
    <h2 style="color:#0f172a;font-size:44px;font-weight:900;margin:0 0 28px;line-height:1.25;">Scientists Reveal The Hidden Cause of [Your Problem]<br/><em style="color:#2d6cdf;">And It Has Nothing To Do With What You Think</em></h2>
    <p style="color:#334155;font-size:20px;line-height:1.85;margin:0 0 24px;">It's not your age. It's not your willpower. And it's definitely not your fault.</p>
    <p style="color:#334155;font-size:20px;line-height:1.85;margin:0 0 24px;">New research from leading universities has uncovered a little-known condition that affects millions — and that the mainstream completely ignores…</p>
    <p style="color:#334155;font-size:20px;line-height:1.85;margin:0 0 32px;">Scientists found that <strong>one specific trigger</strong> is responsible for the majority of people who struggle with [problem].</p>
    <blockquote style="border-left:5px solid #2d6cdf;margin:0 0 32px;padding:22px 32px;background:#eff6ff;border-radius:0 16px 16px 0;">
      <p style="color:#1e293b;font-size:22px;font-style:italic;margin:0 0 14px;line-height:1.7;">"It's like flipping a switch. Once you know this, everything changes — and your body does the rest automatically."</p>
      <p style="color:#64748b;font-size:17px;margin:0;font-style:normal;font-weight:600;">— Dr. [Name], [Institution/Title]</p>
    </blockquote>
    <p style="color:#334155;font-size:20px;line-height:1.85;margin:0;">Continue your story here. Build the problem bigger. Amplify the pain. Then position your solution as the inevitable answer they've been missing...</p>
  </div>
</section>`;
}

export function sectionIngredients() {
  return `<section style="${F}background:#f8fafc;padding:88px 24px;">
  <div style="max-width:920px;margin:0 auto;">
    <p style="text-align:center;color:#2d6cdf;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">THE FORMULA</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;margin:0 0 16px;">What's Inside</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;margin:0 0 56px;">Every ingredient chosen for a specific, science-backed purpose</p>
    <div style="display:grid;gap:20px;">
      <div style="background:#fff;border-radius:18px;padding:28px 32px;display:flex;align-items:flex-start;gap:22px;box-shadow:0 2px 16px rgba(0,0,0,0.06);border:1px solid #f1f5f9;">
        <div style="width:60px;height:60px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🍊</div>
        <div><h3 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 10px;">Ingredient Name #1</h3><p style="color:#475569;font-size:18px;margin:0;line-height:1.7;">Supports [function] and helps you [result]. Backed by [X] clinical studies showing [specific benefit]. This is why it's been called "nature's answer to [problem]."</p></div>
      </div>
      <div style="background:#fff;border-radius:18px;padding:28px 32px;display:flex;align-items:flex-start;gap:22px;box-shadow:0 2px 16px rgba(0,0,0,0.06);border:1px solid #f1f5f9;">
        <div style="width:60px;height:60px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🌿</div>
        <div><h3 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 10px;">Ingredient Name #2</h3><p style="color:#475569;font-size:18px;margin:0;line-height:1.7;">Promotes [function]. Clinical studies show it can reduce [problem] by up to [X%] in just [timeframe]. Ancient cultures have used this for centuries.</p></div>
      </div>
      <div style="background:#fff;border-radius:18px;padding:28px 32px;display:flex;align-items:flex-start;gap:22px;box-shadow:0 2px 16px rgba(0,0,0,0.06);border:1px solid #f1f5f9;">
        <div style="width:60px;height:60px;background:linear-gradient(135deg,#2d6cdf,#1a4fa8);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🔬</div>
        <div><h3 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 10px;">Ingredient Name #3</h3><p style="color:#475569;font-size:18px;margin:0;line-height:1.7;">Enhances [function] and [result]. One of the most researched natural [category] compounds in modern science with over [X] peer-reviewed studies.</p></div>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionTestimonials() {
  return `<section style="${F}background:#f8fafc;padding:88px 24px;">
  <div style="max-width:1100px;margin:0 auto;">
    <p style="text-align:center;color:#ef4444;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">REAL RESULTS</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;margin:0 0 16px;">Real People. Real Life-Changing Results.</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;margin:0 0 56px;">Here's what our customers are experiencing…</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">
      <div style="background:#fff;border-radius:20px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="color:#f59e0b;font-size:24px;margin-bottom:18px;letter-spacing:2px;">★★★★★</div>
        <p style="color:#334155;font-size:18px;line-height:1.8;margin:0 0 28px;">"I didn't expect it to work this fast. Within a week my clothes were looser and my energy was through the roof. I've seen amazing results and I feel incredible at [age]!"</p>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:52px;height:52px;background:linear-gradient(135deg,#ef465d,#b5224a);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;flex-shrink:0;">T</div>
          <div><p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;">Tasha M., Age 41</p><p style="margin:4px 0 0;font-size:15px;color:#64748b;">✓ Verified Buyer · Austin, TX</p></div>
        </div>
      </div>
      <div style="background:#fff;border-radius:20px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="color:#f59e0b;font-size:24px;margin-bottom:18px;letter-spacing:2px;">★★★★★</div>
        <p style="color:#334155;font-size:18px;line-height:1.8;margin:0 0 28px;">"My [problem] just disappeared within days. My [doctor/specialist] noticed the difference, and I honestly feel younger than I have in a decade. This changed my life."</p>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:52px;height:52px;background:linear-gradient(135deg,#2d6cdf,#1a4fa8);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;flex-shrink:0;">N</div>
          <div><p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;">Neil C., Age 57</p><p style="margin:4px 0 0;font-size:15px;color:#64748b;">✓ Verified Buyer · Asheville, NC</p></div>
        </div>
      </div>
      <div style="background:#fff;border-radius:20px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="color:#f59e0b;font-size:24px;margin-bottom:18px;letter-spacing:2px;">★★★★★</div>
        <p style="color:#334155;font-size:18px;line-height:1.8;margin:0 0 28px;">"This gave me [result] back. I was sceptical but within [timeframe] I was [outcome]. I'm back to being the version of myself I actually like. Worth every penny."</p>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:52px;height:52px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;flex-shrink:0;">E</div>
          <div><p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;">Elizabeth V., Age 62</p><p style="margin:4px 0 0;font-size:15px;color:#64748b;">✓ Verified Buyer · Boise, ID</p></div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionPricing() {
  return `<section id="order" style="${F}background:#f8fafc;padding:88px 24px;">
  <div style="max-width:1040px;margin:0 auto;">
    <p style="text-align:center;color:#ef4444;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">CLAIM YOUR DISCOUNT NOW</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;margin:0 0 12px;">Choose Your Package</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;margin:0 0 52px;">Select the best value option for you below</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;align-items:center;">
      <div style="background:#fff;border:2px solid #e2e8f0;border-radius:24px;padding:40px 28px;text-align:center;">
        <p style="color:#64748b;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">BASIC</p>
        <h3 style="color:#0f172a;font-size:30px;font-weight:900;margin:0 0 4px;">1 Month</h3>
        <p style="color:#94a3b8;font-size:17px;margin:0 0 24px;">30-day supply</p>
        <div style="margin:0 0 8px;"><span style="font-size:52px;font-weight:900;color:#0f172a;">$79</span></div>
        <p style="color:#22c55e;font-size:17px;font-weight:700;margin:0 0 28px;">You Save $159!</p>
        <a href="#" style="display:block;background:#0f172a;color:#fff;padding:18px;border-radius:14px;font-size:18px;font-weight:700;text-decoration:none;">Buy Now</a>
        <p style="color:#94a3b8;font-size:15px;margin:14px 0 0;">+ Shipping</p>
      </div>
      <div style="background:linear-gradient(145deg,#0f2247,#1e4da8,#2d6cdf);border:3px solid #60a5fa;border-radius:24px;padding:40px 28px;text-align:center;box-shadow:0 24px 80px rgba(45,108,223,0.35);transform:scale(1.05);">
        <p style="color:#fcd34d;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">⭐ MOST POPULAR</p>
        <h3 style="color:#fff;font-size:30px;font-weight:900;margin:0 0 4px;">3 Months</h3>
        <p style="color:rgba(255,255,255,0.7);font-size:17px;margin:0 0 16px;">90-day supply · 2 Free Bonuses</p>
        <div style="margin:0 0 8px;"><span style="font-size:52px;font-weight:900;color:#fff;">$49</span><span style="color:rgba(255,255,255,0.6);font-size:20px;">/mo</span></div>
        <p style="color:#4ade80;font-size:17px;font-weight:700;margin:0 0 28px;">You Save $390 + Free Bonuses!</p>
        <a href="#" style="display:block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:20px;border-radius:14px;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 8px 28px rgba(34,197,94,0.4);">Buy Now — Best Deal</a>
        <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:14px 0 0;">Free USA Shipping Included</p>
      </div>
      <div style="background:#fff;border:2px solid #e2e8f0;border-radius:24px;padding:40px 28px;text-align:center;">
        <p style="color:#64748b;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">BEST VALUE</p>
        <h3 style="color:#0f172a;font-size:30px;font-weight:900;margin:0 0 4px;">6 Months</h3>
        <p style="color:#94a3b8;font-size:17px;margin:0 0 24px;">180-day supply · Free Shipping</p>
        <div style="margin:0 0 8px;"><span style="font-size:52px;font-weight:900;color:#0f172a;">$39</span><span style="color:#94a3b8;font-size:20px;">/mo</span></div>
        <p style="color:#22c55e;font-size:17px;font-weight:700;margin:0 0 28px;">You Save $900 + Free Shipping!</p>
        <a href="#" style="display:block;background:linear-gradient(135deg,#ef465d,#b5224a);color:#fff;padding:18px;border-radius:14px;font-size:18px;font-weight:700;text-decoration:none;">Buy Now</a>
        <p style="color:#94a3b8;font-size:15px;margin:14px 0 0;">Free USA Shipping Included</p>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionCountdown() {
  return `<section style="${F}background:linear-gradient(135deg,#ef4444,#b91c1c);padding:52px 24px;text-align:center;">
  <div style="max-width:840px;margin:0 auto;">
    <p style="color:#fef2f2;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">⚠️ WARNING: THIS OFFER EXPIRES SOON</p>
    <h2 style="color:#fff;font-size:42px;font-weight:900;margin:0 0 28px;line-height:1.2;">Your Discount Disappears When<br/>The Timer Hits Zero</h2>
    <div data-countdown-root data-seconds="36000" style="display:inline-flex;gap:16px;background:rgba(0,0,0,0.35);border-radius:20px;padding:22px 40px;margin-bottom:36px;">
      <div style="text-align:center;min-width:60px;"><div data-countdown-hours style="color:#fff;font-size:54px;font-weight:900;line-height:1;">10</div><div style="color:rgba(255,255,255,0.65);font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">HOURS</div></div>
      <div style="color:rgba(255,255,255,0.6);font-size:54px;font-weight:900;line-height:1;align-self:flex-start;">:</div>
      <div style="text-align:center;min-width:60px;"><div data-countdown-minutes style="color:#fff;font-size:54px;font-weight:900;line-height:1;">00</div><div style="color:rgba(255,255,255,0.65);font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">MINS</div></div>
      <div style="color:rgba(255,255,255,0.6);font-size:54px;font-weight:900;line-height:1;align-self:flex-start;">:</div>
      <div style="text-align:center;min-width:60px;"><div data-countdown-seconds style="color:#fff;font-size:54px;font-weight:900;line-height:1;">00</div><div style="color:rgba(255,255,255,0.65);font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">SECS</div></div>
    </div>
    <div><a href="#order" style="display:inline-block;background:#fff;color:#ef4444;padding:22px 56px;border-radius:50px;font-size:22px;font-weight:900;text-decoration:none;box-shadow:0 8px 32px rgba(0,0,0,0.2);">Claim My Discount Now →</a></div>
  </div>
</section>`;
}

export function sectionGuarantee() {
  return `<section style="${F}background:#1e293b;padding:88px 24px;">
  <div style="max-width:720px;margin:0 auto;text-align:center;">
    <div style="width:128px;height:128px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;margin:0 auto 32px;display:flex;align-items:center;justify-content:center;font-size:64px;box-shadow:0 16px 60px rgba(34,197,94,0.4);">🛡️</div>
    <p style="color:#4ade80;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">100% RISK-FREE PURCHASE</p>
    <h2 style="color:#fff;font-size:48px;font-weight:900;margin:0 0 8px;line-height:1.15;">180-Day Money-Back<br/>Guarantee</h2>
    <p style="color:#94a3b8;font-size:20px;line-height:1.8;margin:28px 0 0;">Try it for a full 180 days. If for any reason you're not completely amazed by your results, just let us know and we'll refund every single cent. No questions asked. No hassle. No hard feelings. You have absolutely nothing to lose.</p>
  </div>
</section>`;
}

export function sectionBonuses() {
  return `<section style="${F}background:#fff;padding:88px 24px;">
  <div style="max-width:960px;margin:0 auto;">
    <p style="text-align:center;color:#ef4444;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">ORDER TODAY &amp; RECEIVE</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;margin:0 0 12px;">2 FREE Bonuses</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;margin:0 0 52px;">Worth $194 — Yours FREE When You Order Today</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:24px;">
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid #93c5fd;border-radius:24px;padding:36px;display:flex;gap:22px;align-items:flex-start;">
        <div style="background:#fff;border-radius:14px;padding:14px;font-size:40px;line-height:1;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,0.08);">📗</div>
        <div>
          <p style="color:#2d6cdf;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">FREE BONUS #1</p>
          <h3 style="color:#0f172a;font-size:24px;font-weight:900;margin:0 0 12px;">Bonus Title Goes Here</h3>
          <p style="color:#475569;font-size:18px;margin:0 0 16px;line-height:1.7;">Describe what this bonus does and why it's incredibly valuable. What specific result will they get?</p>
          <p style="color:#64748b;font-size:17px;margin:0;"><s style="color:#94a3b8;">Retail Value: $97</s> → <strong style="color:#22c55e;font-size:18px;">FREE Today!</strong></p>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#fdf4ff,#f3e8ff);border:2px solid #c084fc;border-radius:24px;padding:36px;display:flex;gap:22px;align-items:flex-start;">
        <div style="background:#fff;border-radius:14px;padding:14px;font-size:40px;line-height:1;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,0.08);">📘</div>
        <div>
          <p style="color:#9333ea;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">FREE BONUS #2</p>
          <h3 style="color:#0f172a;font-size:24px;font-weight:900;margin:0 0 12px;">Second Bonus Here</h3>
          <p style="color:#475569;font-size:18px;margin:0 0 16px;line-height:1.7;">Describe the second bonus and the transformation it creates. Why is this alone worth more than the price?</p>
          <p style="color:#64748b;font-size:17px;margin:0;"><s style="color:#94a3b8;">Retail Value: $97</s> → <strong style="color:#22c55e;font-size:18px;">FREE Today!</strong></p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionFAQ() {
  return `<section style="${F}background:#fff;padding:88px 24px;">
  <div style="max-width:820px;margin:0 auto;">
    <p style="text-align:center;color:#2d6cdf;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">GOT QUESTIONS?</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;margin:0 0 16px;">Frequently Asked Questions</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;margin:0 0 56px;">Everything you need to know before getting started</p>
    <div style="display:grid;gap:16px;">
      <div class="fb-faq-item" data-open="true" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:18px;padding:20px 24px;">
        <button type="button" class="fb-faq-question" style="width:100%;background:transparent;border:none;padding:0;margin:0;cursor:pointer;text-align:left;color:#0f172a;font-size:20px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
          Is this right for me?
          <span data-faq-chevron style="color:#64748b;font-size:22px;line-height:1;transition:transform .2s ease;">▾</span>
        </button>
        <div class="fb-faq-answer" style="display:block;">
          <p style="color:#475569;font-size:18px;line-height:1.75;margin:14px 0 0;">This is ideal for anyone who [target audience description] and wants to [primary result] without [common objection]. If you're ready to finally do something that works, this is for you.</p>
        </div>
      </div>
      <div class="fb-faq-item" data-open="true" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:18px;padding:20px 24px;">
        <button type="button" class="fb-faq-question" style="width:100%;background:transparent;border:none;padding:0;margin:0;cursor:pointer;text-align:left;color:#0f172a;font-size:20px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
          How quickly will I see results?
          <span data-faq-chevron style="color:#64748b;font-size:22px;line-height:1;transition:transform .2s ease;">▾</span>
        </button>
        <div class="fb-faq-answer" style="display:block;">
          <p style="color:#475569;font-size:18px;line-height:1.75;margin:14px 0 0;">Most customers notice a real difference within the first 7–14 days. For the best and most lasting results, we recommend a full 90-day commitment.</p>
        </div>
      </div>
      <div class="fb-faq-item" data-open="true" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:18px;padding:20px 24px;">
        <button type="button" class="fb-faq-question" style="width:100%;background:transparent;border:none;padding:0;margin:0;cursor:pointer;text-align:left;color:#0f172a;font-size:20px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
          What if it doesn't work for me?
          <span data-faq-chevron style="color:#64748b;font-size:22px;line-height:1;transition:transform .2s ease;">▾</span>
        </button>
        <div class="fb-faq-answer" style="display:block;">
          <p style="color:#475569;font-size:18px;line-height:1.75;margin:14px 0 0;">You're fully protected by our 180-day money-back guarantee. If you're not happy for any reason whatsoever, contact us and we'll refund every penny. No questions. No hassle.</p>
        </div>
      </div>
      <div class="fb-faq-item" data-open="true" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:18px;padding:20px 24px;">
        <button type="button" class="fb-faq-question" style="width:100%;background:transparent;border:none;padding:0;margin:0;cursor:pointer;text-align:left;color:#0f172a;font-size:20px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
          Is my payment secure?
          <span data-faq-chevron style="color:#64748b;font-size:22px;line-height:1;transition:transform .2s ease;">▾</span>
        </button>
        <div class="fb-faq-answer" style="display:block;">
          <p style="color:#475569;font-size:18px;line-height:1.75;margin:14px 0 0;">Absolutely. Your order is processed through 256-bit SSL encryption — the same technology used by major banks. Your personal and payment information is completely protected.</p>
        </div>
      </div>
      <div class="fb-faq-item" data-open="true" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:18px;padding:20px 24px;">
        <button type="button" class="fb-faq-question" style="width:100%;background:transparent;border:none;padding:0;margin:0;cursor:pointer;text-align:left;color:#0f172a;font-size:20px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
          Is this a one-time payment?
          <span data-faq-chevron style="color:#64748b;font-size:22px;line-height:1;transition:transform .2s ease;">▾</span>
        </button>
        <div class="fb-faq-answer" style="display:block;">
          <p style="color:#475569;font-size:18px;line-height:1.75;margin:14px 0 0;">Yes! Your order today is a one-time payment only. There are no hidden subscriptions, monthly charges, or automatic renewals. You pay once and that's it.</p>
        </div>
      </div>
    </div>
  </div>
  <script>
    (function () {
      if (window.__fbFaqAccordionBound) return;
      window.__fbFaqAccordionBound = true;

      function syncFaqItem(item) {
        if (!item) return;
        var isOpen = item.getAttribute("data-open") !== "false";
        var answer = item.querySelector(".fb-faq-answer");
        var chevron = item.querySelector("[data-faq-chevron]");
        if (answer) answer.style.display = isOpen ? "block" : "none";
        if (chevron) chevron.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
      }

      document.querySelectorAll(".fb-faq-item").forEach(syncFaqItem);

      document.addEventListener("click", function (event) {
        var btn = event.target.closest(".fb-faq-question");
        if (!btn) return;
        var item = btn.closest(".fb-faq-item");
        if (!item) return;
        var isOpen = item.getAttribute("data-open") !== "false";
        item.setAttribute("data-open", isOpen ? "false" : "true");
        syncFaqItem(item);
      });
    })();
  </script>
</section>`;
}

export function sectionLeadCaptureForm() {
  return `<section id="optin" style="${F}background:linear-gradient(135deg,#071a3d 0%,#123d8f 48%,#2d6cdf 100%);padding:88px 24px;position:relative;overflow:hidden;">
  <div style="position:absolute;left:-140px;top:-120px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 72%);"></div>
  <div style="position:absolute;right:-120px;bottom:-160px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(34,197,94,0.16) 0%,transparent 72%);"></div>
  <div style="max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:36px;align-items:stretch;position:relative;z-index:1;">
    <div style="display:grid;gap:22px;align-content:start;">
      <div>
        <p style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:10px 18px;color:#fcd34d;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 18px;">🎁 FREE INSTANT ACCESS</p>
        <h2 style="color:#fff;font-size:58px;font-weight:900;margin:0 0 16px;line-height:1.06;max-width:620px;">Get Your Free [Lead Magnet Name] Now</h2>
        <p style="color:rgba(255,255,255,0.86);font-size:21px;margin:0 0 24px;line-height:1.65;max-width:620px;">Enter your details below and we'll deliver it straight to your inbox within seconds.</p>
      </div>
      <div style="display:grid;gap:12px;max-width:620px;">
        <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:16px 18px;">
          <span style="width:30px;height:30px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;flex-shrink:0;">✓</span>
          <div><p style="color:#fff;font-size:18px;font-weight:800;line-height:1.35;margin:0 0 4px;">Key feature or benefit one</p><p style="color:#dbeafe;font-size:15px;line-height:1.55;margin:0;">Describe what they get and how it changes their life. Make it specific and tangible.</p></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:16px 18px;">
          <span style="width:30px;height:30px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;flex-shrink:0;">✓</span>
          <div><p style="color:#fff;font-size:18px;font-weight:800;line-height:1.35;margin:0 0 4px;">Key feature or benefit two</p><p style="color:#dbeafe;font-size:15px;line-height:1.55;margin:0;">Describe another key benefit. Focus on the emotion and the outcome, not the feature.</p></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:16px 18px;">
          <span style="width:30px;height:30px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;flex-shrink:0;">✓</span>
          <div><p style="color:#fff;font-size:18px;font-weight:800;line-height:1.35;margin:0 0 4px;">Key feature or benefit three</p><p style="color:#dbeafe;font-size:15px;line-height:1.55;margin:0;">Third benefit goes here. Always connect to a core desire or pain point of your audience.</p></div>
        </div>
      </div>
      <div style="background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.16);border-radius:28px;padding:24px;box-shadow:0 24px 70px rgba(2,6,23,0.28);max-width:620px;display:grid;gap:18px;">
        <div style="background:linear-gradient(135deg,#f8fafc,#e2e8f0);border-radius:24px;min-height:320px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(15,23,42,0.08);padding:24px;box-sizing:border-box;overflow:hidden;">
          <div style="text-align:center;max-width:340px;">
            <div style="width:132px;height:132px;border-radius:28px;margin:0 auto 18px;background:linear-gradient(135deg,#ef465d,#f59e0b);display:flex;align-items:center;justify-content:center;color:#fff;font-size:64px;box-shadow:0 18px 40px rgba(239,70,93,0.28);">📦</div>
            <p style="color:#0f172a;font-size:24px;font-weight:900;line-height:1.2;margin:0 0 10px;">Add your product image or lead magnet mockup here</p>
            <p style="color:#475569;font-size:16px;line-height:1.6;margin:0;">Use this area for a protein tub, ebook cover, sample pack, before-and-after visual, or any hero image that makes the offer obvious.</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          <div style="background:rgba(255,255,255,0.9);border-radius:18px;padding:16px 18px;box-shadow:0 10px 28px rgba(15,23,42,0.14);">
            <p style="color:#0f172a;font-size:15px;font-weight:800;line-height:1.35;margin:0 0 6px;">What they get</p>
            <p style="color:#475569;font-size:14px;line-height:1.55;margin:0;">Show the main promise, bonus, or quick reason they should opt in now.</p>
          </div>
          <div style="background:rgba(255,255,255,0.9);border-radius:18px;padding:16px 18px;box-shadow:0 10px 28px rgba(15,23,42,0.14);">
            <p style="color:#0f172a;font-size:15px;font-weight:800;line-height:1.35;margin:0 0 6px;">Why it matters</p>
            <p style="color:#475569;font-size:14px;line-height:1.55;margin:0;">Keep the image, benefits, and CTA aligned so the page feels specific, not generic.</p>
          </div>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:stretch;">
      <div style="width:100%;background:rgba(7,18,40,0.34);border:1px solid rgba(255,255,255,0.16);border-radius:28px;padding:30px;backdrop-filter:blur(12px);box-shadow:0 26px 80px rgba(2,6,23,0.34);display:grid;gap:20px;align-content:start;">
        <div>
          <p style="color:#dbeafe;font-size:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 10px;">Start here</p>
          <h3 style="color:#fff;font-size:34px;font-weight:900;line-height:1.15;margin:0 0 12px;">Claim your free copy now</h3>
          <p style="color:rgba(255,255,255,0.76);font-size:18px;line-height:1.65;margin:0;">Enter your details below and we'll deliver it straight to your inbox within seconds.</p>
        </div>
        <form method="post" action="/api/forms/submit" style="display:grid;gap:16px;text-align:left;">
          <input type="hidden" name="funnel_id" value="" />
          <input type="hidden" name="list_id" value="" />
          <input type="hidden" name="success_url" value="?ok=1" />
          <input name="name" placeholder="Your First Name" style="padding:20px 22px;border-radius:16px;border:2px solid rgba(255,255,255,0.16);background:rgba(7,18,40,0.52);color:#fff;font-size:18px;outline:none;width:100%;box-sizing:border-box;" />
          <input name="email" type="email" required placeholder="Your Best Email Address" style="padding:20px 22px;border-radius:16px;border:2px solid rgba(255,255,255,0.16);background:rgba(7,18,40,0.52);color:#fff;font-size:18px;outline:none;width:100%;box-sizing:border-box;" />
          <button type="submit" style="padding:22px;border-radius:16px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:22px;font-weight:900;cursor:pointer;box-shadow:0 12px 36px rgba(34,197,94,0.35);letter-spacing:0.3px;">SEND ME FREE ACCESS NOW →</button>
        </form>
        <div style="display:grid;gap:12px;">
          <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 16px;">
            <span style="font-size:20px;line-height:1;">⚡</span>
            <div><p style="color:#fff;font-size:16px;font-weight:700;line-height:1.35;margin:0 0 4px;">Instant access</p><p style="color:#cbd5e1;font-size:14px;line-height:1.5;margin:0;">Make it clear what happens next after they opt in.</p></div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 16px;">
            <span style="font-size:20px;line-height:1;">📩</span>
            <div><p style="color:#fff;font-size:16px;font-weight:700;line-height:1.35;margin:0 0 4px;">Lead capture form</p><p style="color:#cbd5e1;font-size:14px;line-height:1.5;margin:0;">Use this form to collect contact details and deliver the lead magnet or next step.</p></div>
          </div>
        </div>
        <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:0;">Your details are used to deliver the offer and send relevant follow-up related to this page.</p>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionCTA() {
  return `<section style="${F}background:linear-gradient(135deg,#22c55e,#16a34a);padding:88px 24px;text-align:center;">
  <div style="max-width:840px;margin:0 auto;">
    <p style="color:rgba(255,255,255,0.8);font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">THE CHOICE IS YOURS</p>
    <h2 style="color:#fff;font-size:52px;font-weight:900;margin:0 0 20px;line-height:1.15;">Are You Ready To Finally Get The [Result] You Deserve?</h2>
    <p style="color:rgba(255,255,255,0.88);font-size:22px;margin:0 0 48px;line-height:1.7;">Don't let this be another thing you almost did. You've tried everything else. This is different. This is the one that works.</p>
    <a href="#order" style="display:inline-block;background:#fff;color:#16a34a;padding:24px 64px;border-radius:50px;font-size:24px;font-weight:900;text-decoration:none;box-shadow:0 16px 56px rgba(0,0,0,0.2);">YES! I'M READY — GET STARTED NOW →</a>
    <p style="color:rgba(255,255,255,0.65);font-size:17px;margin:22px 0 0;">180-Day Money-Back Guarantee · Secure Encrypted Checkout · Ships Fast</p>
  </div>
</section>`;
}

export function sectionProductShowcase() {
  return `<section style="${F}background:#fff;padding:80px 24px;">
  <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
    <div style="background:#f8fafc;border-radius:24px;padding:48px;text-align:center;border:2px solid #e2e8f0;min-height:320px;display:flex;align-items:center;justify-content:center;">
      <div><div style="font-size:80px;margin-bottom:16px;">📦</div><p style="color:#94a3b8;font-size:18px;margin:0;">Add your product image here</p></div>
    </div>
    <div>
      <p style="color:#ef4444;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">INTRODUCING</p>
      <h2 style="color:#0f172a;font-size:44px;font-weight:900;margin:0 0 20px;line-height:1.2;">Your Product<br/>Name Here™</h2>
      <p style="color:#475569;font-size:20px;line-height:1.75;margin:0 0 32px;">Your product description goes here. Explain what makes this special, what's inside, and why it's different from everything else they've tried.</p>
      <div style="display:grid;gap:14px;margin-bottom:36px;">
        <div style="display:flex;align-items:center;gap:12px;"><div style="width:28px;height:28px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</div><span style="color:#334155;font-size:18px;">Key feature or benefit one</span></div>
        <div style="display:flex;align-items:center;gap:12px;"><div style="width:28px;height:28px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</div><span style="color:#334155;font-size:18px;">Key feature or benefit two</span></div>
        <div style="display:flex;align-items:center;gap:12px;"><div style="width:28px;height:28px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</div><span style="color:#334155;font-size:18px;">Key feature or benefit three</span></div>
      </div>
      <a href="#order" style="display:inline-block;background:linear-gradient(135deg,#ef465d,#b5224a);color:#fff;padding:20px 44px;border-radius:50px;font-size:20px;font-weight:800;text-decoration:none;box-shadow:0 8px 32px rgba(239,70,93,0.4);">ORDER NOW →</a>
    </div>
  </div>
</section>`;
}

export function sectionTrustBadges() {
  return `<section style="${F}background:#f8fafc;padding:52px 24px;border-top:1px solid #e2e8f0;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <p style="color:#94a3b8;font-size:17px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">WHAT'S INSIDE</p>
    <h2 style="color:#0f172a;font-size:40px;font-weight:900;line-height:1.15;margin:0 0 16px;">Relevant details at a glance</h2>
    <p style="color:#64748b;font-size:19px;line-height:1.7;max-width:720px;margin:0 auto 34px;">Use this section to reinforce what matters most about the offer instead of relying on generic badges that do not fit the product.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;text-align:left;align-items:stretch;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,0.06);display:flex;flex-direction:column;min-height:250px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;">⚡</div>
        <p style="color:#0f172a;font-size:20px;font-weight:800;line-height:1.3;margin:0 0 8px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">Benefit One</p>
        <p style="color:#475569;font-size:17px;line-height:1.65;margin:0;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Describe what they get and how it changes their life. Make it specific and tangible.</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,0.06);display:flex;flex-direction:column;min-height:250px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;">🧭</div>
        <p style="color:#0f172a;font-size:20px;font-weight:800;line-height:1.3;margin:0 0 8px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">Benefit Two</p>
        <p style="color:#475569;font-size:17px;line-height:1.65;margin:0;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Describe another key benefit. Focus on the emotion and the outcome, not the feature.</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,0.06);display:flex;flex-direction:column;min-height:250px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#fde68a,#fcd34d);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;">🧩</div>
        <p style="color:#0f172a;font-size:20px;font-weight:800;line-height:1.3;margin:0 0 8px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">Benefit Three</p>
        <p style="color:#475569;font-size:17px;line-height:1.65;margin:0;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Third benefit goes here. Always connect to a core desire or pain point of your audience.</p>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 10px 28px rgba(15,23,42,0.06);display:flex;flex-direction:column;min-height:250px;height:auto;overflow:hidden;min-width:0;width:100%;">
        <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;">💻</div>
        <p style="color:#0f172a;font-size:20px;font-weight:800;line-height:1.3;margin:0 0 8px;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;">14-Day Free Trial</p>
        <p style="color:#475569;font-size:17px;line-height:1.65;margin:0;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;white-space:normal;max-width:100%;min-width:0;width:100%;">Create an account, explore the platform, and decide whether it suits your business before moving to a paid plan.</p>
      </div>
    </div>
  </div>
</section>`;
}

export function sectionThankYou() {
  return `<section style="${F}background:linear-gradient(135deg,#0f2247,#2d6cdf);min-height:100vh;padding:96px 24px;display:flex;align-items:center;justify-content:center;text-align:center;">
  <div style="max-width:720px;margin:0 auto;">
    <div style="font-size:80px;margin-bottom:24px;">🎉</div>
    <h1 style="color:#fff;font-size:56px;font-weight:900;margin:0 0 18px;line-height:1.1;">Thank You!</h1>
    <p style="color:#fcd34d;font-size:22px;font-weight:700;margin:0 0 28px;">Your order has been confirmed!</p>
    <p style="color:rgba(255,255,255,0.85);font-size:20px;line-height:1.75;margin:0 0 48px;">Check your email inbox — your receipt and access details are on their way. In the meantime, here's what happens next…</p>
    <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:40px;margin-bottom:40px;text-align:left;">
      <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:24px;"><div style="background:#22c55e;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex-shrink:0;">1</div><div><p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 4px;">Check Your Email</p><p style="color:rgba(255,255,255,0.7);font-size:17px;margin:0;">Your order confirmation will arrive shortly. Check your spam folder if you don't see it.</p></div></div>
      <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:24px;"><div style="background:#22c55e;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex-shrink:0;">2</div><div><p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 4px;">Watch Your Inbox</p><p style="color:rgba(255,255,255,0.7);font-size:17px;margin:0;">We'll send you everything you need to get started. Your bonuses will be delivered automatically.</p></div></div>
      <div style="display:flex;gap:16px;align-items:flex-start;"><div style="background:#22c55e;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex-shrink:0;">3</div><div><p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 4px;">Get Ready</p><p style="color:rgba(255,255,255,0.7);font-size:17px;margin:0;">Your transformation starts now. We're so excited to see your results!</p></div></div>
    </div>
    <p style="color:rgba(255,255,255,0.5);font-size:16px;">Questions? Contact support@yourdomain.com — we respond within 24 hours.</p>
  </div>
</section>`;
}

export function sectionSpacer() {
  return `<div style="height:60px;background:transparent;"></div>`;
}

export function sectionDivider() {
  return `<div style="${F}background:#f8fafc;padding:32px 24px;display:flex;align-items:center;gap:24px;max-width:840px;margin:0 auto;">
  <div style="flex:1;height:2px;background:linear-gradient(90deg,transparent,#e2e8f0);"></div>
  <div style="color:#94a3b8;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:3px;white-space:nowrap;">• • •</div>
  <div style="flex:1;height:2px;background:linear-gradient(90deg,#e2e8f0,transparent);"></div>
</div>`;
}

export function sectionPageFooter() {
  return `<footer style="${F}background:#0f172a;padding:40px 24px;text-align:center;">
  <div style="max-width:900px;margin:0 auto;">
    <p style="color:#475569;font-size:16px;margin:0 0 16px;">© 2026 [Company Name]. All Rights Reserved.</p>
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:24px;margin-bottom:24px;">
      <a href="#" style="color:#64748b;font-size:16px;text-decoration:none;">Privacy Policy</a>
      <a href="#" style="color:#64748b;font-size:16px;text-decoration:none;">Terms of Service</a>
      <a href="#" style="color:#64748b;font-size:16px;text-decoration:none;">Contact Us</a>
      <a href="#" style="color:#64748b;font-size:16px;text-decoration:none;">Refund Policy</a>
    </div>
    <p style="color:#334155;font-size:14px;line-height:1.7;margin:0;">Examples, testimonials, and outcomes are illustrative. Actual results depend on your offer, market, implementation, and traffic. Review the trial, billing, and support terms that apply to this offer before purchase.</p>
  </div>
</footer>`;
}

function serviceInitials(name) {
  return `${name || ''}`
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\n\s*/g, ' ').trim())}`;
}

function trimVisualText(value, maxLength = 44) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getServiceImageKeywords(theme, variant = 'hero', options = {}) {
  const slugKeywordMap = {
    'general-trades': ['tradesman', 'service', 'worksite'],
    plumbing: ['plumber', 'pipes', 'repair'],
    electrician: ['electrician', 'switchboard', 'wiring'],
    handyman: ['handyman', 'tools', 'repair'],
    mechanic: ['mechanic', 'garage', 'car'],
    cleaning: ['cleaning', 'home', 'spray'],
    painter: ['painter', 'paint', 'interior'],
    'lawn-care': ['lawn', 'mowing', 'garden'],
    'car-detailing': ['car', 'detailing', 'vehicle'],
    'pressure-washing': ['pressure', 'washing', 'driveway'],
    roofing: ['roofing', 'roof', 'trade'],
    hvac: ['hvac', 'aircon', 'technician'],
  };

  const derived = [
    ...(slugKeywordMap[theme.slug] || theme.slug.split('-')),
    ...String(options.title || '').toLowerCase().split(/[^a-z0-9]+/),
    ...String(options.subtitle || '').toLowerCase().split(/[^a-z0-9]+/),
  ]
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .slice(0, 4);

  if (variant === 'gallery') derived.push('service');
  if (variant === 'card') derived.push('professional');

  return Array.from(new Set(derived)).slice(0, 5);
}

function hashServiceImageSeed(...parts) {
  const input = parts.filter(Boolean).join('|');
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickTradePoolImages(slug, pool, count = 5) {
  const uniquePool = Array.from(new Set((pool || []).filter(Boolean)));
  if (!uniquePool.length) return [];
  if (uniquePool.length <= count) return uniquePool.slice(0, count);

  const startIndex = hashServiceImageSeed(slug, uniquePool.length) % uniquePool.length;
  const picked = [];

  for (let index = 0; index < uniquePool.length && picked.length < count; index += 1) {
    picked.push(uniquePool[(startIndex + index) % uniquePool.length]);
  }

  return picked;
}

const SERVICE_IMAGE_TERMS_BY_SLUG = {
  'general-trades': ['handyman', 'home repair', 'property maintenance', 'house service'],
  plumbing: ['plumber', 'pipe repair', 'sink repair', 'bathroom plumbing'],
  electrician: ['electrician', 'wiring', 'switchboard', 'lighting install'],
  handyman: ['handyman', 'home repair', 'fixing', 'property maintenance'],
  mechanic: ['mechanic', 'auto shop', 'car service', 'vehicle diagnostics'],
  cleaning: ['house cleaning', 'clean home', 'vacuuming', 'kitchen cleaning'],
  painter: ['house painter', 'interior paint', 'paint roller', 'wall painting'],
  'lawn-care': ['lawn mowing', 'front yard', 'grass cutting', 'suburban home'],
  'car-detailing': ['car detailing', 'clean car', 'sports car', 'car interior'],
  'pressure-washing': ['pressure washing', 'driveway cleaning', 'house washing', 'exterior cleaning'],
  'pest-control': ['pest control', 'home treatment', 'technician spray', 'property protection'],
  glazing: ['window repair', 'glass installation', 'house windows', 'glazier'],
  roofing: ['roofing', 'roof repair', 'roofer', 'house roof'],
  removals: ['moving truck', 'furniture moving', 'house move', 'packing boxes'],
  'appliance-repair': ['appliance repair', 'washing machine repair', 'oven repair', 'technician'],
  flooring: ['flooring', 'hardwood floor', 'vinyl plank', 'interior room'],
  tiling: ['tiler', 'bathroom tiles', 'kitchen tiles', 'tile installation'],
  fencing: ['fence installation', 'backyard fence', 'gate install', 'boundary fence'],
  'pool-service': ['swimming pool', 'pool cleaning', 'pool maintenance', 'backyard pool'],
  locksmith: ['locksmith', 'door lock', 'keys', 'lock repair'],
  hvac: ['air conditioning', 'hvac technician', 'split system', 'ventilation'],
  concreting: ['concrete driveway', 'concrete slab', 'pathway concrete', 'concreting'],
  solar: ['solar panels', 'rooftop solar', 'battery system', 'solar install'],
  'tree-lopping': ['arborist', 'tree removal', 'tree service', 'chainsaw work'],
  'bathroom-renovation': ['bathroom renovation', 'shower remodel', 'vanity install', 'bathroom design'],
  'kitchen-renovation': ['kitchen renovation', 'kitchen design', 'cabinet install', 'benchtop'],
  waterproofing: ['waterproofing', 'bathroom waterproof', 'membrane install', 'shower base'],
  'garage-doors': ['garage door', 'roller door', 'garage door repair', 'garage entry'],
  guttering: ['gutter repair', 'gutter cleaning', 'downpipe', 'roof gutter'],
  plastering: ['plastering', 'wall finish', 'gyprock', 'plasterer'],
  rendering: ['house rendering', 'exterior render', 'facade finish', 'rendered wall'],
  'security-screens': ['security screen', 'screen door', 'window screen', 'home security'],
  irrigation: ['irrigation', 'sprinkler system', 'garden watering', 'lawn sprinkler'],
  'epoxy-flooring': ['epoxy floor', 'garage floor', 'industrial floor', 'resin coating'],
  'shutters-blinds': ['window blinds', 'plantation shutters', 'interior window', 'blind installation'],
  'concrete-cutting': ['concrete cutting', 'slab cutting', 'concrete saw', 'construction service'],
  shopfitting: ['shopfitting', 'retail fitout', 'store interior', 'commercial fitout'],
  carpentry: ['carpentry', 'woodworking', 'cabinet install', 'home joinery'],
};

function buildTradeSpecificImagePool(slug) {
  const groupKey = SERVICE_IMAGE_GROUP_BY_SLUG[slug];
  const pool = groupKey ? (SERVICE_IMAGE_POOLS[groupKey] || []) : [];
  return pickTradePoolImages(slug, pool, 5);
}

const SERVICE_IMAGE_POOLS = {
  trades: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1590725175008-dfb2d25408c6?auto=format&fit=crop&w=1600&q=80',
  ],
  localTrades: [
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1581578017426-1ea3c5f2d0cb?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
  ],
  serviceHome: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1581578017426-1ea3c5f2d0cb?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
  ],
  propertyExterior: [
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1600&q=80',
  ],
  plumbing: [
    'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1600&q=80',
  ],
  electrician: [
    'https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1754620906571-9ba64bd3ffb4?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1754620906703-496ec2451744?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1591142126430-3fe8547599dd?auto=format&fit=crop&w=1600&q=80',
  ],
  cleaning: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1581578017426-1ea3c5f2d0cb?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1600&q=80',
  ],
  paintingFinishes: [
    'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80',
  ],
  outdoorCleaning: [
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1600&q=80',
  ],
  pressureWashing: [
    'https://images.pexels.com/photos/5652626/pexels-photo-5652626.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=1600',
    'https://images.pexels.com/photos/35153375/pexels-photo-35153375.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=1600',
    'https://images.pexels.com/photos/20296972/pexels-photo-20296972.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=1600',
    'https://images.pexels.com/photos/30958770/pexels-photo-30958770.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=1600',
    'https://images.pexels.com/photos/6873122/pexels-photo-6873122.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=1600',
  ],
  workshopAuto: [
    'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&w=1600&q=80',
  ],
  carDetailing: [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1502161254066-6c74afbf07aa?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1600&q=80',
  ],
  interiorsProperty: [
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
  ],
  lawnGarden: [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1600&q=80',
  ],
  poolService: [
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80',
  ],
  glazingShutters: [
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80',
  ],
  roofingSolar: [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1592833159057-c62dfc12016b?auto=format&fit=crop&w=1600&q=80',
  ],
  applianceClimate: [
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1600&q=80',
  ],
  renovationSurfaces: [
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80',
  ],
  outdoorProperty: [
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
  ],
  treeCare: [
    'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80',
  ],
  logistics: [
    'https://images.unsplash.com/photo-1465447142348-e9952c393450?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1519010470956-6d877008eaa4?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1600&q=80',
  ],
};

const SERVICE_IMAGE_GROUP_BY_SLUG = {
  'general-trades': 'localTrades',
  plumbing: 'plumbing',
  electrician: 'electrician',
  handyman: 'serviceHome',
  mechanic: 'workshopAuto',
  cleaning: 'cleaning',
  painter: 'paintingFinishes',
  'lawn-care': 'lawnGarden',
  'car-detailing': 'carDetailing',
  'pressure-washing': 'pressureWashing',
  'pest-control': 'serviceHome',
  glazing: 'glazingShutters',
  roofing: 'roofingSolar',
  removals: 'logistics',
  'appliance-repair': 'applianceClimate',
  flooring: 'renovationSurfaces',
  tiling: 'renovationSurfaces',
  fencing: 'propertyExterior',
  'pool-service': 'poolService',
  locksmith: 'serviceHome',
  hvac: 'applianceClimate',
  concreting: 'propertyExterior',
  solar: 'roofingSolar',
  'tree-lopping': 'treeCare',
  'bathroom-renovation': 'renovationSurfaces',
  'kitchen-renovation': 'renovationSurfaces',
  waterproofing: 'renovationSurfaces',
  'garage-doors': 'applianceClimate',
  guttering: 'roofingSolar',
  plastering: 'renovationSurfaces',
  rendering: 'renovationSurfaces',
  'security-screens': 'glazingShutters',
  irrigation: 'lawnGarden',
  'epoxy-flooring': 'renovationSurfaces',
  'shutters-blinds': 'glazingShutters',
  'concrete-cutting': 'propertyExterior',
  shopfitting: 'renovationSurfaces',
  carpentry: 'localTrades',
};

export function getFunnelTemplateLibraryAssets() {
  const seen = new Set();
  const assets = [];

  Object.keys(SERVICE_IMAGE_TERMS_BY_SLUG).forEach((slug) => {
    const label = String(slug || 'service').replace(/-/g, ' ');
    const theme = { slug, label };
    [
      {
        variant: 'hero',
        slot: '1',
        title: `${label} Australia`,
        subtitle: `Australian ${label} marketing image for a local business website`,
        service: `Australian ${label} business`,
      },
      {
        variant: 'gallery',
        slot: '2',
        title: `${label} service detail`,
        subtitle: `Australian ${label} job or finished result`,
        service: `Australian ${label} service detail`,
      },
    ].forEach((brief, index) => {
      const src = buildServiceTemplateImageUrl(theme, brief.variant, {
        title: brief.title,
        subtitle: brief.subtitle,
        service: brief.service,
        slot: brief.slot,
      });
      const normalized = String(src || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      assets.push({
        id: `funnel-template-${slug}-${index + 1}`,
        name: `Funnel ${label} ${index + 1}`,
        type: 'image/png',
        src: normalized,
        fallbackUrl: getServiceFallbackImageUrlBySlug(slug, brief.variant, {
          title: brief.title,
          subtitle: brief.subtitle,
          service: brief.service,
          slot: brief.slot,
        }),
      });
    });
  });

  return assets;
}

function getServiceImagePool(theme) {
  const tradeSpecificPool = buildTradeSpecificImagePool(theme?.slug);
  if (tradeSpecificPool.length) return tradeSpecificPool;

  const group = SERVICE_IMAGE_GROUP_BY_SLUG[theme?.slug] || 'trades';
  return SERVICE_IMAGE_POOLS[group] || SERVICE_IMAGE_POOLS.trades;
}

export function getServiceFallbackImageUrlBySlug(slug, variant = 'hero', options = {}) {
  const tradeSpecificPool = buildTradeSpecificImagePool(slug);
  const group = SERVICE_IMAGE_GROUP_BY_SLUG[slug] || 'trades';
  const pool = tradeSpecificPool.length ? tradeSpecificPool : (SERVICE_IMAGE_POOLS[group] || SERVICE_IMAGE_POOLS.trades);
  const variantOffset = variant === 'hero' ? 0 : variant === 'gallery' ? 1 : 2;
  const imageIndex = hashServiceImageSeed(
    slug,
    variant,
    options.title || '',
    options.subtitle || '',
    options.caption || '',
    options.service || ''
  );
  const slotText = String(options.slot || '').trim();
  const slotMatch = slotText.match(/(\d+)$/);
  const parsedSlot = Number.parseInt(slotMatch?.[1] || slotText, 10);
  if (Number.isFinite(parsedSlot) && parsedSlot >= 0) {
    return pool[(variantOffset + parsedSlot) % pool.length] || pool[0] || '';
  }

  const slotOffset = slotText ? hashServiceImageSeed(slug, variant, slotText) : 0;
  return pool[(imageIndex + variantOffset + slotOffset) % pool.length] || pool[0] || '';
}

function buildServiceTemplateImageUrl(theme, variant = 'hero', options = {}) {
  const params = new URLSearchParams();
  params.set('slug', String(theme?.slug || 'service'));
  params.set('variant', variant);
  params.set('trade', String(theme?.label || 'Local Service'));
  params.set('title', String(options.title || theme?.sectionHeadline || theme?.label || 'Service Image'));

  const subtitle = String(options.subtitle || theme?.sectionIntro || theme?.visualHeadline || '').trim();
  if (subtitle) params.set('subtitle', subtitle);

  const serviceDetail = String(options.service || options.caption || '').trim();
  if (serviceDetail) params.set('service', serviceDetail);

  const slot = String(options.slot || '').trim();
  if (slot) params.set('slot', slot);

  const keywords = [
    ...(SERVICE_IMAGE_TERMS_BY_SLUG[theme?.slug] || []),
    theme?.slug,
    theme?.label,
    options.title,
    options.caption,
    options.subtitle,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');

  if (keywords) params.set('keywords', keywords);
  return `/api/funnels/template-image?${params.toString()}`;
}

function getServiceImageUrl(theme, variant = 'hero', options = {}) {
  return buildServiceTemplateImageUrl(theme, variant, options);
}

function buildServiceSectionImageBand(theme, options = {}) {
  const image = getServiceImageUrl(theme, options.variant || 'hero', {
    title: options.title || theme.label,
    subtitle: options.subtitle || theme.visualHeadline,
    caption: options.caption || theme.services?.[0]?.title || theme.responseLine,
    slot: options.slot || `band-${options.variant || 'hero'}`,
    icon: options.icon || theme.icon,
    secondaryIcon: options.secondaryIcon || theme.secondaryIcon,
  });

  return `<div style="position:relative;width:100%;min-height:${options.height || 320}px;background-image:linear-gradient(90deg,rgba(15,23,42,${options.overlayStart || 0.24}) 0%,rgba(15,23,42,${options.overlayEnd || 0.06}) 100%),url('${image}');background-size:cover;background-position:center;overflow:hidden;">
    <div style="position:absolute;inset:0;background:${options.tint || `linear-gradient(135deg, ${theme.accentDark}22, ${theme.accent}18)`};mix-blend-mode:multiply;"></div>
    <div style="position:relative;z-index:1;max-width:1500px;margin:0 auto;min-height:${options.height || 320}px;display:flex;align-items:flex-end;padding:clamp(24px,5vw,48px) clamp(24px,6vw,72px);box-sizing:border-box;">
      <div style="display:grid;gap:10px;max-width:760px;">
        <span style="display:inline-flex;align-items:center;gap:10px;width:max-content;max-width:100%;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:10px 16px;color:#fff;font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">${theme.icon} ${options.eyebrow || theme.heroVisualTagline}</span>
        <h2 style="color:#fff;font-size:clamp(34px,4vw,52px);font-weight:900;line-height:1.05;margin:0;">${options.title || theme.sectionHeadline || theme.label}</h2>
        <p style="color:rgba(255,255,255,0.88);font-size:clamp(16px,1.8vw,20px);line-height:1.7;margin:0;">${options.subtitle || theme.sectionIntro || theme.visualHeadline}</p>
      </div>
    </div>
  </div>`;
}

function getServiceArchetype(theme) {
  if (theme?.archetype) return theme.archetype;

  if (['plumbing', 'electrician', 'locksmith', 'hvac', 'appliance-repair', 'garage-doors'].includes(theme.slug)) {
    return 'emergency-response';
  }

  if (['cleaning', 'lawn-care', 'pest-control', 'pool-service', 'irrigation', 'guttering'].includes(theme.slug)) {
    return 'maintenance-plan';
  }

  if (['painting', 'car-detailing', 'pressure-washing', 'flooring', 'tiling', 'epoxy-flooring', 'rendering', 'shutters-blinds'].includes(theme.slug)) {
    return 'premium-visual';
  }

  return 'project-led';
}

function getServiceLongFormSectionIds(theme) {
  const archetype = getServiceArchetype(theme);

  switch (archetype) {
    case 'emergency-response':
      return [`${theme.slug}-hero`, `${theme.slug}-difference`, `${theme.slug}-services`, `${theme.slug}-faq`, `${theme.slug}-quote`, 'footer'];
    case 'maintenance-plan':
      return [`${theme.slug}-hero`, `${theme.slug}-services`, `${theme.slug}-testimonials`, `${theme.slug}-faq`, `${theme.slug}-quote`, 'footer'];
    case 'premium-visual':
      return [`${theme.slug}-hero`, `${theme.slug}-proof`, `${theme.slug}-services`, `${theme.slug}-testimonials`, `${theme.slug}-quote`, 'footer'];
    default:
      return [`${theme.slug}-hero`, `${theme.slug}-services`, `${theme.slug}-difference`, `${theme.slug}-proof`, `${theme.slug}-quote`, 'footer'];
  }
}

function getServiceShortFormSectionIds(theme) {
  const archetype = getServiceArchetype(theme);

  switch (archetype) {
    case 'emergency-response':
      return [`${theme.slug}-hero`, `${theme.slug}-difference`, `${theme.slug}-quote`, 'footer'];
    case 'maintenance-plan':
      return [`${theme.slug}-hero`, `${theme.slug}-testimonials`, `${theme.slug}-quote`, 'footer'];
    case 'premium-visual':
      return [`${theme.slug}-hero`, `${theme.slug}-proof`, `${theme.slug}-quote`, 'footer'];
    default:
      return [`${theme.slug}-hero`, `${theme.slug}-services`, `${theme.slug}-quote`, 'footer'];
  }
}

function getServiceVariantDescription(theme, variant) {
  const archetype = getServiceArchetype(theme);

  if (variant === 'short') {
    switch (archetype) {
      case 'emergency-response':
        return `Short-form ${theme.label.toLowerCase()} page for urgent or high-intent traffic that mainly needs trust, fast response cues, and a clean quote path.`;
      case 'maintenance-plan':
        return `Short-form ${theme.label.toLowerCase()} page built for repeat, referral, and local traffic that mostly needs social proof and a low-friction enquiry flow.`;
      case 'premium-visual':
        return `Short-form ${theme.label.toLowerCase()} page that leans on presentation, visual proof, and a tighter booking path for warmer traffic.`;
      default:
        return `Short-form ${theme.label.toLowerCase()} page for visitors who already understand the service and mainly need scope clarity plus a fast quote form.`;
    }
  }

  switch (archetype) {
    case 'emergency-response':
      return `Long-form ${theme.label.toLowerCase()} page that prioritises urgency, reassurance, clear trust signals, and a practical quote path.`;
    case 'maintenance-plan':
      return `Long-form ${theme.label.toLowerCase()} page built for recurring service value, reliability, and low-friction local enquiries.`;
    case 'premium-visual':
      return `Long-form ${theme.label.toLowerCase()} page built around presentation, visual proof, and higher-perceived-value service positioning.`;
    default:
      return `Long-form ${theme.label.toLowerCase()} page for project-led or scope-led enquiries with richer proof, clearer service framing, and a stronger quote path.`;
  }
}

function buildServiceShowcase(theme) {
  const featureImage = getServiceImageUrl(theme, 'gallery', {
    title: theme.label,
    subtitle: theme.visualHeadline,
    caption: theme.services?.[0]?.title,
    slot: 'showcase-feature',
  });
  const detailImages = (theme.services || []).slice(0, 2).map((service, index) => getServiceImageUrl(theme, 'card', {
    title: service.title,
    subtitle: index === 0 ? theme.heroVisualTagline : theme.responseLine,
    caption: service.title,
    slot: `showcase-detail-${index}`,
    icon: service.icon || theme.icon,
    secondaryIcon: index === 0 ? theme.secondaryIcon : theme.icon,
  }));

  return `<div style="position:relative;z-index:1;display:grid;gap:18px;height:100%;align-content:start;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:10px 16px;color:#fff;font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${theme.icon} ${theme.heroVisualTagline}</span>
      <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(15,23,42,0.42);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#dbeafe;font-size:14px;font-weight:700;">${theme.responseLine}</span>
    </div>
    <div style="background:linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08));border:1px solid rgba(255,255,255,0.16);border-radius:30px;padding:24px;box-shadow:0 24px 80px rgba(2,6,23,0.22);">
      <div style="background:linear-gradient(180deg,rgba(248,250,252,0.98),rgba(226,232,240,0.92));border-radius:24px;min-height:340px;padding:24px;position:relative;overflow:hidden;display:grid;gap:18px;">
        <div style="position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,${theme.glow} 0%,transparent 70%);"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;position:relative;z-index:1;">
          <div>
            <p style="color:#64748b;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">Featured visual</p>
            <h3 style="color:#0f172a;font-size:24px;font-weight:900;line-height:1.2;margin:0;">${theme.visualHeadline}</h3>
          </div>
          <div style="min-width:70px;height:70px;border-radius:20px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:34px;box-shadow:0 18px 40px rgba(15,23,42,0.14);">${theme.icon}</div>
        </div>
        <div style="background:#fff;border:1px solid #dbeafe;border-radius:22px;padding:18px;box-shadow:0 16px 40px rgba(15,23,42,0.08);display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:center;position:relative;z-index:1;">
          <div style="display:grid;gap:12px;">
            <img src="${featureImage}" alt="${theme.label} featured image" style="display:block;width:100%;height:240px;object-fit:cover;border-radius:20px;box-shadow:0 18px 48px rgba(15,23,42,0.12);" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              ${detailImages.map((image, index) => `<img src="${image}" alt="${theme.services?.[index]?.title || theme.label} image" style="display:block;width:100%;height:132px;object-fit:cover;border-radius:18px;border:1px solid #dbeafe;box-shadow:0 12px 32px rgba(15,23,42,0.08);" />`).join('')}
            </div>
          </div>
          <div style="display:grid;gap:10px;">
            <div style="background:#f8fafc;border:1px solid #dbeafe;border-radius:16px;padding:12px 14px;">
              <p style="color:#64748b;font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 4px;">Company logo</p>
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;flex-shrink:0;">${serviceInitials(theme.logo)}</div>
                <div>
                  <p style="color:#0f172a;font-size:15px;font-weight:800;margin:0;">${theme.logo}</p>
                  <p style="color:#64748b;font-size:13px;margin:2px 0 0;">${theme.logoTagline}</p>
                </div>
              </div>
            </div>
            ${theme.heroChecks.map((item) => `<div style="background:#fff;border:1px solid #dbeafe;border-radius:16px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 10px 24px rgba(15,23,42,0.06);"><span style="width:24px;height:24px;border-radius:50%;background:${theme.accent};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#0f172a;font-size:14px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#64748b;font-size:13px;line-height:1.5;margin:0;">${item.text}</p></div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildServiceHeroSection(theme) {
  const heroImage = getServiceImageUrl(theme, 'hero', {
    title: theme.label,
    subtitle: theme.visualHeadline,
    caption: theme.services?.[0]?.title,
    slot: 'hero-main',
  });

  return `<section style="${F}position:relative;overflow:hidden;padding:96px 24px;background-image:linear-gradient(90deg,rgba(15,23,42,0.86) 0%,rgba(15,23,42,0.7) 40%,rgba(15,23,42,0.46) 100%),radial-gradient(circle at 15% 15%,${theme.glow} 0%,transparent 26%),radial-gradient(circle at 85% 10%,rgba(255,255,255,0.10) 0%,transparent 22%),url('${heroImage}'),linear-gradient(135deg,${theme.accentDark} 0%,${theme.accent} 52%,#0f172a 100%);background-size:cover,auto,auto,cover,cover;background-position:center,center,center,center,center;">
  <div style="max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:42px;align-items:center;">
    <div style="display:grid;gap:22px;align-content:start;">
      <div style="display:inline-flex;align-items:center;gap:14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:999px;padding:12px 18px;width:max-content;max-width:100%;box-sizing:border-box;">
        <div style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;flex-shrink:0;">${serviceInitials(theme.logo)}</div>
        <div>
          <p style="color:#dbeafe;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;margin:0 0 2px;">Company logo</p>
          <p style="color:#fff;font-size:15px;font-weight:800;margin:0;">${theme.logo}</p>
        </div>
      </div>
      <p style="color:${theme.badgeColor};font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">${theme.badge}</p>
      <h1 style="color:#fff;font-size:58px;font-weight:900;line-height:1.06;margin:0;max-width:760px;">${theme.headline}</h1>
      <p style="color:rgba(255,255,255,0.86);font-size:21px;line-height:1.7;margin:0;max-width:700px;">${theme.subheadline}</p>
      <div style="display:grid;gap:12px;max-width:660px;">
        ${theme.highlights.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;"><span style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#fff;font-size:17px;font-weight:800;line-height:1.4;margin:0 0 4px;">${item.title}</p><p style="color:#dbeafe;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;">
        <a href="#quote" style="display:inline-block;background:#fff;color:${theme.accentDark};padding:20px 34px;border-radius:999px;font-size:18px;font-weight:900;text-decoration:none;box-shadow:0 18px 50px rgba(2,6,23,0.26);">${theme.cta}</a>
        <span style="display:inline-flex;align-items:center;gap:10px;color:#dbeafe;font-size:16px;font-weight:700;">${theme.secondaryIcon} ${theme.responseLine}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;max-width:760px;">
        ${theme.stats.map((item) => `<div style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:18px 16px;"><p style="color:#fff;font-size:28px;font-weight:900;line-height:1;margin:0 0 6px;">${item.value}</p><p style="color:#dbeafe;font-size:14px;line-height:1.5;margin:0;">${item.label}</p></div>`).join('')}
      </div>
    </div>
    ${buildServiceShowcase(theme)}
  </div>
</section>`;
}

function buildServiceOffersSection(theme) {
  return `<section style="${F}background:linear-gradient(180deg,${theme.accentSoft} 0%, #f8fafc 34%, #eef2ff 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'hero', height: 360, title: theme.sectionHeadline, subtitle: theme.sectionIntro, eyebrow: 'Service scope', overlayStart: 0.38, overlayEnd: 0.14 })}
  <div style="max-width:1160px;margin:0 auto;padding:88px 24px;">
    <p style="text-align:center;color:${theme.accent};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">What this page is built to sell</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;line-height:1.15;margin:0 0 16px;">${theme.sectionHeadline}</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;line-height:1.7;max-width:760px;margin:0 auto 52px;">${theme.sectionIntro}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;align-items:stretch;">
      ${theme.services.map((service, index) => `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:18px;box-shadow:0 18px 48px rgba(15,23,42,0.06);display:grid;gap:14px;overflow:hidden;">
        <img src="${getServiceImageUrl(theme, 'card', { title: service.title, subtitle: theme.label, caption: service.title, slot: `service-card-${index}`, icon: service.icon || theme.icon, secondaryIcon: theme.secondaryIcon })}" alt="${service.title} image" style="display:block;width:100%;height:180px;object-fit:cover;border-radius:18px;" />
        <div style="width:56px;height:56px;border-radius:18px;background:${index % 2 === 0 ? `linear-gradient(135deg,${theme.accentSoft},#ffffff)` : `linear-gradient(135deg,#ffffff,${theme.accentSoft})`};display:flex;align-items:center;justify-content:center;font-size:26px;">${service.icon}</div>
        <h3 style="color:#0f172a;font-size:24px;font-weight:800;line-height:1.2;margin:0;">${service.title}</h3>
        <p style="color:#475569;font-size:17px;line-height:1.7;margin:0;">${service.text}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

function buildServiceProofSection(theme) {
  const archetype = getServiceArchetype(theme);
  const proofHeading = archetype === 'premium-visual'
    ? 'Use this section to sell the finish, the care, and the visible outcome'
    : archetype === 'emergency-response'
      ? 'Use this section to reassure fast-moving leads before they bounce'
      : archetype === 'maintenance-plan'
        ? 'Use this section to show consistency, service standards, and repeatable quality'
        : 'Use this section to frame the work clearly and make the business feel established';
  const proofIntro = archetype === 'premium-visual'
    ? 'Premium-looking service pages convert better when the work feels tangible. Pair this layout with real project images, vehicle shots, before-and-after examples, or strong finished-job photography.'
    : archetype === 'emergency-response'
      ? 'High-intent service buyers are usually deciding quickly. This section gives them the fast reassurance they need around trust, response, and fit before they submit the form.'
      : archetype === 'maintenance-plan'
        ? 'Recurring local-service businesses win by feeling dependable, not flashy. Use this area to show routine quality, care standards, and why people keep rebooking.'
        : 'Project-led service businesses need a page that feels credible before the quote request. This layout helps you reinforce scope, reliability, and visible proof without falling back into generic filler.';

  return `<section style="${F}background:linear-gradient(180deg,#ffffff 0%, ${theme.accentSoft} 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'gallery', height: 340, title: proofHeading, subtitle: proofIntro, eyebrow: 'Visual proof', overlayStart: 0.42, overlayEnd: 0.16 })}
  <div style="max-width:1160px;margin:0 auto;padding:88px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:26px;align-items:stretch;">
    <div style="background:linear-gradient(135deg,${theme.accentDark},${theme.accent});border-radius:30px;padding:32px;color:#fff;box-shadow:0 26px 72px rgba(15,23,42,0.16);display:grid;gap:18px;">
      <div>
        <p style="color:${theme.badgeColor};font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Visual and trust proof</p>
        <h2 style="font-size:42px;font-weight:900;line-height:1.12;margin:0 0 14px;">${proofHeading}</h2>
        <p style="color:#dbeafe;font-size:18px;line-height:1.75;margin:0;">${proofIntro}</p>
      </div>
      <div style="display:grid;gap:12px;">
        ${theme.heroChecks.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.14);border-radius:18px;padding:14px 16px;"><span style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="font-size:16px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#dbeafe;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
    <div style="display:grid;gap:18px;align-content:start;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:28px;padding:28px;box-shadow:0 18px 48px rgba(15,23,42,0.06);display:grid;gap:18px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;">
          <div>
            <p style="color:${theme.accent};font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:1.8px;margin:0 0 8px;">Suggested proof assets</p>
            <h3 style="color:#0f172a;font-size:28px;font-weight:900;line-height:1.15;margin:0;">${theme.visualHeadline}</h3>
          </div>
          <div style="min-width:62px;height:62px;border-radius:18px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;box-shadow:0 16px 40px rgba(15,23,42,0.12);">${theme.icon}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;">
          ${theme.stats.map((item) => `<div style="background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:18px 16px;"><p style="color:${theme.accentDark};font-size:24px;font-weight:900;line-height:1;margin:0 0 6px;">${item.value}</p><p style="color:#64748b;font-size:14px;line-height:1.5;margin:0;">${item.label}</p></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
          ${(theme.services || []).slice(0, 3).map((service, index) => `<div style="display:grid;gap:10px;">
            <img src="${getServiceImageUrl(theme, 'gallery', { title: service.title, subtitle: index === 0 ? theme.visualHeadline : theme.heroVisualTagline, caption: service.title, slot: `proof-gallery-${index}`, icon: service.icon || theme.icon, secondaryIcon: theme.secondaryIcon })}" alt="${service.title} gallery image" style="display:block;width:100%;height:160px;object-fit:cover;border-radius:20px;box-shadow:0 16px 36px rgba(15,23,42,0.08);" />
            <p style="color:#475569;font-size:14px;line-height:1.5;margin:0;">${service.title}</p>
          </div>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
        ${theme.trustPoints.map((item) => `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:22px;box-shadow:0 16px 40px rgba(15,23,42,0.05);display:grid;gap:10px;"><span style="font-size:24px;line-height:1;">${item.icon}</span><p style="color:#0f172a;font-size:18px;font-weight:800;line-height:1.35;margin:0;">${item.title}</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0;">${item.text}</p></div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
}

function buildServiceDifferenceSection(theme) {
  return `<section style="${F}background:#fff;padding:88px 24px;">
  <div style="max-width:1120px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px;align-items:start;">
    <div style="background:linear-gradient(180deg,#ffffff,#f8fafc);border:1px solid #e2e8f0;border-radius:28px;padding:32px;box-shadow:0 18px 48px rgba(15,23,42,0.06);">
      <p style="color:${theme.accent};font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Why customers choose this offer</p>
      <h2 style="color:#0f172a;font-size:42px;font-weight:900;line-height:1.15;margin:0 0 18px;">${theme.differenceHeadline}</h2>
      <p style="color:#475569;font-size:18px;line-height:1.75;margin:0 0 26px;">${theme.differenceIntro}</p>
      <div style="display:grid;gap:14px;">
        ${theme.differentiators.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:16px 18px;"><span style="width:28px;height:28px;border-radius:50%;background:${theme.accent};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#0f172a;font-size:17px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#64748b;font-size:15px;line-height:1.6;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
    <div style="display:grid;gap:18px;">
      <div style="background:linear-gradient(135deg,${theme.accentDark},${theme.accent});border-radius:28px;padding:30px;color:#fff;box-shadow:0 24px 72px rgba(15,23,42,0.14);">
        <p style="color:rgba(255,255,255,0.78);font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">How the page flows</p>
        <h3 style="font-size:30px;font-weight:900;line-height:1.15;margin:0 0 16px;">Built to convert quote-ready visitors into booked work</h3>
        <div style="display:grid;gap:12px;">
          ${theme.process.map((step, index) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;"><div style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0;">${index + 1}</div><div><p style="font-size:16px;font-weight:800;margin:0 0 4px;">${step.title}</p><p style="color:#dbeafe;font-size:14px;line-height:1.55;margin:0;">${step.text}</p></div></div>`).join('')}
        </div>
      </div>
      <div style="background:#0f172a;border-radius:28px;padding:28px;display:grid;gap:12px;box-shadow:0 18px 48px rgba(15,23,42,0.12);">
        <p style="color:#93c5fd;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">Trust signals</p>
        ${theme.trustPoints.map((item) => `<div style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px 16px;"><span style="font-size:18px;line-height:1;">${item.icon}</span><div><p style="color:#fff;font-size:16px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#cbd5e1;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
}

function buildServiceTestimonialsSection(theme) {
  return `<section style="${F}background:linear-gradient(180deg,${theme.accentDark} 0%, #0f172a 28%, #f8fafc 28%, #f8fafc 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'gallery', height: 320, title: 'Trade-specific proof should look visual, not generic.', subtitle: `Real ${theme.label.toLowerCase()} pages convert harder when the proof feels tied to visible work and real customers.`, eyebrow: 'Customer proof', overlayStart: 0.52, overlayEnd: 0.22, tint: `linear-gradient(135deg, ${theme.accentDark}66, ${theme.accent}33)` })}
  <div style="max-width:1120px;margin:0 auto;padding:88px 24px;">
    <p style="text-align:center;color:${theme.accent};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Recent customer feedback</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;line-height:1.15;margin:0 0 16px;">Proof that feels believable because it is specific</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;line-height:1.7;max-width:760px;margin:0 auto 52px;">These examples are written for ${theme.customerGroup.toLowerCase()}, not supplements, info products, or generic ecommerce offers.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">
      ${theme.testimonials.map((item) => `<div style="background:#fff;border-radius:24px;padding:30px;border:1px solid #e2e8f0;box-shadow:0 18px 44px rgba(15,23,42,0.06);display:grid;gap:18px;">
        <div style="color:#f59e0b;font-size:24px;letter-spacing:2px;">★★★★★</div>
        <p style="color:#334155;font-size:18px;line-height:1.78;margin:0;">"${item.quote}"</p>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:50px;height:50px;border-radius:16px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;flex-shrink:0;">${item.name.charAt(0)}</div>
          <div><p style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">${item.name}</p><p style="margin:4px 0 0;font-size:14px;color:#64748b;">${item.meta}</p></div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

function buildServiceFaqSection(theme) {
  return `<section style="${F}background:linear-gradient(180deg,#ffffff 0%, ${theme.accentSoft} 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'card', height: 280, title: 'Answer the questions people ask before they enquire.', subtitle: 'Clear answers work better when they sit inside a section that still feels designed, visual, and specific to the trade.', eyebrow: 'FAQ section', overlayStart: 0.4, overlayEnd: 0.14 })}
  <div style="max-width:860px;margin:0 auto;padding:88px 24px;">
    <p style="text-align:center;color:${theme.accent};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Questions customers actually ask</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;line-height:1.15;margin:0 0 16px;">Frequently asked questions</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;line-height:1.7;max-width:720px;margin:0 auto 48px;">Clear, service-relevant answers reduce friction and make the quote form easier to complete.</p>
    <div style="display:grid;gap:16px;">
      ${theme.faqs.map((item) => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;padding:22px 24px;"><p style="color:#0f172a;font-size:20px;font-weight:800;line-height:1.4;margin:0 0 10px;">${item.q}</p><p style="color:#475569;font-size:17px;line-height:1.75;margin:0;">${item.a}</p></div>`).join('')}
    </div>
  </div>
</section>`;
}

function buildServiceQuoteFormSection(theme) {
  return `<section id="quote" style="${F}position:relative;overflow:hidden;padding:92px 24px;background-image:radial-gradient(circle at 12% 18%,${theme.glow} 0%,transparent 22%),linear-gradient(135deg,#0f172a 0%,${theme.accentDark} 58%,${theme.accent} 100%);">
  <div style="max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px;align-items:start;">
    <div style="display:grid;gap:18px;align-content:start;">
      <p style="color:${theme.badgeColor};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">Request a quote</p>
      <h2 style="color:#fff;font-size:50px;font-weight:900;line-height:1.08;margin:0;">${theme.formHeadline}</h2>
      <p style="color:#dbeafe;font-size:20px;line-height:1.7;margin:0;max-width:640px;">${theme.formIntro}</p>
      <div style="display:grid;gap:12px;max-width:640px;">
        ${theme.formPoints.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;"><span style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#fff;font-size:16px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#cbd5e1;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:30px;padding:28px;backdrop-filter:blur(12px);box-shadow:0 28px 80px rgba(2,6,23,0.32);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        <div>
          <p style="color:#dbeafe;font-size:14px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;margin:0 0 6px;">Fast enquiry form</p>
          <h3 style="color:#fff;font-size:32px;font-weight:900;line-height:1.15;margin:0;">${theme.formCardTitle}</h3>
        </div>
        <span style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:10px 14px;color:#fff;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">${theme.icon} ${theme.formBadge}</span>
      </div>
      <form method="post" action="/api/forms/submit" style="display:grid;gap:14px;">
        <input type="hidden" name="funnel_id" value="" />
        <input type="hidden" name="list_id" value="" />
        <input type="hidden" name="success_url" value="?ok=1" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <input name="name" placeholder="Full name" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
          <input name="phone" type="tel" placeholder="Phone number" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <input name="email" type="email" placeholder="Email address" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
          <input name="suburb" placeholder="Suburb or service area" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
        </div>
        <select name="service_type" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;">
          <option value="">Select the service you need</option>
          ${theme.serviceOptions.map((option) => `<option value="${option}">${option}</option>`).join('')}
        </select>
        <textarea name="details" placeholder="Tell us what you need, what has happened, and any timing requirements" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;min-height:150px;resize:vertical;"></textarea>
        <button type="submit" style="padding:20px;border:none;border-radius:18px;background:#fff;color:${theme.accentDark};font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 18px 48px rgba(2,6,23,0.24);">${theme.formCta}</button>
      </form>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:14px 0 0;">${theme.formDisclaimer}</p>
    </div>
  </div>
</section>`;
}

const SERVICE_PAGE_THEMES = [
  {
    slug: 'general-trades',
    label: 'Trades / Local Service Quote',
    icon: '🔧',
    secondaryIcon: '🚚',
    accent: '#0369a1',
    accentDark: '#0f172a',
    accentSoft: '#dbeafe',
    glow: 'rgba(56,189,248,0.24)',
    badgeColor: '#bae6fd',
    logo: 'Summit Service Group',
    logoTagline: 'Local trade and field service specialists',
    badge: 'Electricians • painters • mechanics • detailing • pressure washing • more',
    headline: 'Use the generic trades page when the service matters more than the niche.',
    subheadline: 'This template is for broad local-service businesses that still need a polished, production-ready quote page: electricians, painters, mechanics, car detailers, mobile repairers, pressure washers, glazing teams, pest control operators, and other trade or field services.',
    cta: 'REQUEST A SERVICE QUOTE',
    responseLine: 'Built for local service businesses that need flexibility without generic fluff.',
    heroVisualTagline: 'Flexible service visual',
    visualHeadline: 'Show branded vehicles, team imagery, tools, finished jobs, or a strong service photo',
    heroChecks: [
      { title: 'Broad enough for many trades', text: 'Useful when the business does not fit neatly into one narrow vertical but still needs strong trade-specific messaging.' },
      { title: 'Still grounded in real service work', text: 'It is written for quoting, site work, mobile service, and local-area trust, not ecommerce products or info offers.' },
    ],
    highlights: [
      { title: 'Works across many local-service categories', text: 'Ideal for electricians, painters, mechanics, mobile detailers, wash crews, installers, pest control, repair services, and more.' },
      { title: 'Keeps the message quote-focused', text: 'The page is built around credibility, service scope, response expectations, and a practical enquiry flow.' },
      { title: 'Easy to customise fast', text: 'Swap in the trade name, imagery, service list, and local area and the template becomes launch-ready quickly.' },
    ],
    stats: [
      { value: 'Flexible', label: 'Built to adapt across multiple trades and mobile services' },
      { value: 'Local', label: 'Strong fit for suburb, city, and service-area marketing' },
      { value: 'Quote-ready', label: 'Designed to collect serious service enquiries quickly' },
    ],
    sectionHeadline: 'A broad trade template that still feels relevant to real service buyers',
    sectionIntro: 'This is the fallback page when the business is not plumbing, lawn care, cleaning, or carpentry, but still needs copy that sounds like a legitimate trade or field service company.',
    services: [
      { icon: '⚡', title: 'Installations, repairs, and callouts', text: 'Useful for electricians, mechanics, glazing, appliance repair, mobile service work, and other trades where customers need a practical fix or install.' },
      { icon: '🎨', title: 'Improvement, detailing, and presentation work', text: 'Works well for painters, car detailers, pressure washers, surface restoration, coatings, and other visible-finish services.' },
      { icon: '🧰', title: 'Routine, commercial, and ongoing service work', text: 'Good fit for maintenance teams, recurring service rounds, managed sites, and businesses that win work through reliability and local trust.' },
    ],
    differenceHeadline: 'Why this works as the generic trade option',
    differenceIntro: 'Not every trade deserves its own dedicated page on day one. This version gives you a serious local-service structure that can flex across many industries without collapsing back into generic funnel nonsense.',
    differentiators: [
      { title: 'Trade-relevant without being over-specific', text: 'The message stays grounded in service work, quoting, local coverage, reliability, and proof, while leaving room to tailor the exact trade quickly.' },
      { title: 'Safer than forcing the wrong niche template', text: 'An electrician should not feel like a plumber, and a mechanic should not sound like a cleaner. This page avoids that mismatch.' },
      { title: 'Ready for brand assets and real proof', text: 'It gives you clear slots for team imagery, vehicles, finished jobs, suburb coverage, trade licences, and real customer reviews.' },
    ],
    process: [
      { title: 'Establish credibility fast', text: 'The first screen makes it clear the business is local, responsive, and set up to handle real service jobs.' },
      { title: 'Clarify the kinds of work you handle', text: 'The middle sections help visitors self-qualify and understand whether you are the right fit before they enquire.' },
      { title: 'Capture the essentials for quoting', text: 'The form is designed to gather job type, location, and practical details so your team can follow up properly.' },
    ],
    trustPoints: [
      { icon: '📍', title: 'Local-service credibility', text: 'Works well for suburb targeting, Google Business traffic, referrals, and direct-response local ads.' },
      { icon: '📸', title: 'Photo-driven proof', text: 'The template becomes much stronger when paired with real site photos, vehicles, uniforms, and finished work examples.' },
      { icon: '🪪', title: 'Room for licences and credentials', text: 'If the trade requires insurance, licences, manufacturer approvals, or other credentials, they fit naturally here.' },
    ],
    customerGroup: 'homeowners, site managers, property managers, and local service buyers',
    testimonials: [
      { name: 'Darren P.', meta: 'Electrical upgrade enquiry • Logan', quote: 'The page looked like a real service company, not a generic landing page. It explained the work clearly, made it easy to enquire, and the follow-up felt professional from the start.' },
      { name: 'Michelle A.', meta: 'Exterior painting quote • Ipswich', quote: 'We needed something flexible because our jobs vary a lot. This format made sense immediately, and it still felt relevant to the kind of work we actually do.' },
      { name: 'Aaron G.', meta: 'Mobile detailing booking • Gold Coast', quote: 'The structure worked perfectly for a service business that is local and visual. It gave us a proper brand presence, clear service scope, and a much better enquiry flow.' },
    ],
    faqs: [
      { q: 'Who should use this generic trade page?', a: 'Use it when the business is clearly a local service or trade operation but does not need, or does not yet have, its own dedicated niche template. It is especially useful for electricians, painters, mechanics, mobile detailers, pressure washers, pest control, and similar services.' },
      { q: 'Will it still feel specific enough to convert?', a: 'Yes, if you customise the service list, images, logo, response messaging, and trust points properly. The structure is generic, but it is still built around real trade-service buying behaviour.' },
      { q: 'What should I change first to make it feel like my industry?', a: 'Update the headline, service cards, photo block, service options, and testimonials so they reflect the actual work, language, and proof your buyers expect.' },
      { q: 'Can I start here and later upgrade to a dedicated niche template?', a: 'Yes. This is designed as the strong generic option, not a dead end. It gives you a launch-ready trade page now and a clean path to more specialised versions later.' },
    ],
    formHeadline: 'Collect better trade and service enquiries without forcing a niche that does not fit.',
    formIntro: 'Use this form when you need one solid quote page that can support multiple service categories while still gathering the details required for sensible follow-up.',
    formPoints: [
      { title: 'Useful across many trade categories', text: 'A good fit when your business spans several related services or when you are building out niche pages over time.' },
      { title: 'Structured for practical quoting', text: 'The form gathers enough context to route or price a job properly without overwhelming the lead.' },
      { title: 'Easy to turn into a branded asset', text: 'Add a real logo, photos, suburb coverage, and service list and this becomes a credible launch page fast.' },
    ],
    formCardTitle: 'Request a service quote',
    formBadge: 'Flexible trade form',
    serviceOptions: ['Electrical work', 'Painting', 'Mechanical repairs', 'Car detailing', 'Pressure washing', 'Pest control', 'Glazing', 'General trade service'],
    formCta: 'SEND MY SERVICE ENQUIRY',
    formDisclaimer: 'Replace the service options and supporting proof with the exact categories you want to promote most heavily in your market.',
  },
  {
    slug: 'plumbing',
    label: 'Plumbing Service Quote',
    icon: '🚰',
    secondaryIcon: '🧰',
    accent: '#0f766e',
    accentDark: '#134e4a',
    accentSoft: '#ccfbf1',
    glow: 'rgba(45,212,191,0.24)',
    badgeColor: '#99f6e4',
    logo: 'Harbour Plumbing Co.',
    logoTagline: 'Licensed plumbing and hot water specialists',
    badge: 'Licensed plumbers • blocked drains • hot water • maintenance',
    headline: 'Book a plumber people trust when the job actually matters.',
    subheadline: 'Use a quote page built for urgent repairs, routine maintenance, hot water replacements, and leak investigations, with copy that sounds like a real plumbing business instead of a generic sales funnel.',
    cta: 'REQUEST A PLUMBING QUOTE',
    responseLine: 'Fast reply windows and straightforward quoting.',
    heroVisualTagline: 'On-site repair visual',
    visualHeadline: 'Show a technician, van shot, or finished install',
    heroChecks: [
      { title: 'Trusted brand presence', text: 'Logo placement, service focus, and strong proof points make the page feel established from the first screen.' },
      { title: 'Ready for emergency and maintenance work', text: 'Position callouts, repairs, and scheduled jobs without sounding vague or generic.' },
    ],
    highlights: [
      { title: 'Position same-day help without sounding desperate', text: 'Make it clear you handle urgent issues professionally, with transparent arrival windows and clear communication.' },
      { title: 'Show exactly what you do', text: 'Blocked drains, leak detection, burst pipes, tap repairs, toilets, gas, and hot water systems all deserve specific language.' },
      { title: 'Build trust before the phone rings', text: 'Relevant proof beats hype. This layout gives you room for licences, workmanship promises, and suburb coverage.' },
    ],
    stats: [
      { value: '24/7', label: 'Emergency option for urgent plumbing issues' },
      { value: 'Licensed', label: 'Built to highlight compliance, safety, and insurance' },
      { value: 'Same day', label: 'Useful when your buyers need fast action' },
    ],
    sectionHeadline: 'Designed for the plumbing jobs customers actually enquire about',
    sectionIntro: 'The message stays grounded in plumbing work so homeowners, landlords, and property managers know you are relevant before they reach the form.',
    services: [
      { icon: '💧', title: 'Leaks, blockages, and urgent repairs', text: 'Speak directly to blocked drains, burst pipes, leaking taps, overflowing toilets, and water pressure problems.' },
      { icon: '🔥', title: 'Hot water systems and replacements', text: 'Show experience with repairs, changeovers, and advice on the right system for the property and budget.' },
      { icon: '🏠', title: 'Maintenance, installs, and preventative work', text: 'Cover kitchen, bathroom, laundry, outdoor plumbing, and planned maintenance without making the page feel cluttered.' },
    ],
    differenceHeadline: 'Why this works for plumbing',
    differenceIntro: 'Plumbing buyers are often stressed, short on time, and deciding quickly. The page needs to reassure them you are competent, responsive, and safe to let into the property.',
    differentiators: [
      { title: 'Clear arrival windows', text: 'Set expectations up front so you do not sound like every other trades business that promises the world and disappears for half a day.' },
      { title: 'Workmanship-first messaging', text: 'Lead with fixes, safety, tidy workmanship, and practical outcomes instead of hype or fake urgency.' },
      { title: 'Right-fit quoting', text: 'Encourage better enquiries by asking what has happened, what needs fixing, and when access is available.' },
    ],
    process: [
      { title: 'Lead with the specific service', text: 'Visitors immediately recognise you handle the exact issue they are dealing with.' },
      { title: 'Reassure them with credible trust points', text: 'Licences, insured work, tidy clean-up, and clear communication reduce friction fast.' },
      { title: 'Capture the right details', text: 'The form gathers enough context to quote properly or dispatch the right technician.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Licence and insurance ready', text: 'Promote compliance, safety, and professional workmanship in plain English.' },
      { icon: '🧽', title: 'Respectful in occupied homes', text: 'Useful for households that care about cleanliness, shoe covers, and tidy finish-offs.' },
      { icon: '📍', title: 'Service area coverage', text: 'Make suburb coverage and callout zones obvious so leads know you service their area.' },
    ],
    customerGroup: 'homeowners, landlords, and property managers',
    testimonials: [
      { name: 'Melissa R.', meta: 'Kitchen leak repair • Ashgrove', quote: 'They told me exactly when they would arrive, explained the issue clearly, and had the leak fixed that afternoon. No vague promises, no mess left behind, and no surprise add-ons.' },
      { name: 'Daniel T.', meta: 'Hot water replacement • North Lakes', quote: 'We lost hot water overnight and thought it would turn into a week-long ordeal. Their page made it easy to request a quote, and the replacement was organised faster than we expected.' },
      { name: 'Sophie and Marc J.', meta: 'Blocked drain callout • Camp Hill', quote: 'The page felt professional and specific to the problem we had. Once we submitted the form, the communication was clear, the technician was excellent, and the drain issue was sorted properly.' },
    ],
    faqs: [
      { q: 'Do you handle emergency plumbing callouts?', a: 'Yes. This template is written to support urgent work as well as scheduled maintenance, so you can position emergency availability without sounding chaotic or overblown.' },
      { q: 'Can customers request quotes for hot water systems and replacements?', a: 'Absolutely. The copy makes room for repairs, changeovers, supply and install jobs, and straightforward advice on what system suits the property.' },
      { q: 'Will this still work if most jobs come from Google Business Profile or referrals?', a: 'Yes. The short version is especially useful for warm traffic that already knows your name and only needs reassurance, a service list, and a fast way to enquire.' },
      { q: 'What proof should I add to make this stronger?', a: 'Use technician photos, van or site imagery, suburb coverage, licences, years in business, before-and-after examples, and short customer reviews that mention the actual plumbing job completed.' },
    ],
    formHeadline: 'Get a plumbing quote without the back-and-forth.',
    formIntro: 'Use the form to capture the job type, the property location, and enough detail to price correctly or call back quickly for urgent work.',
    formPoints: [
      { title: 'Built for real service enquiries', text: 'The fields collect the information your team actually needs, not a generic lead magnet form.' },
      { title: 'Works for emergency and non-urgent jobs', text: 'Use the message to separate urgent repairs from planned installs and maintenance work.' },
      { title: 'Easy to customise by suburb or offer', text: 'Swap in your local service area, your phone number, and your actual images and it is ready to go.' },
    ],
    formCardTitle: 'Request your plumbing quote',
    formBadge: 'Fast quote form',
    serviceOptions: ['Blocked drain', 'Leak or burst pipe', 'Hot water system', 'Toilet or tap repair', 'Gas plumbing', 'General maintenance'],
    formCta: 'SEND MY PLUMBING ENQUIRY',
    formDisclaimer: 'Set your expected response time, service area, and emergency coverage in the fine print or supporting copy.',
  },
  {
    slug: 'electrician',
    label: 'Electrician Service Quote',
    icon: '⚡',
    secondaryIcon: '💡',
    accent: '#1d4ed8',
    accentDark: '#172554',
    accentSoft: '#dbeafe',
    glow: 'rgba(96,165,250,0.24)',
    badgeColor: '#bfdbfe',
    logo: 'Voltage Electrical',
    logoTagline: 'Residential, commercial, and maintenance electrical work',
    badge: 'Electricians • switchboards • lighting • safety • fault finding',
    headline: 'Electrician pages need to feel safe, capable, and immediately credible.',
    subheadline: 'This version is tailored for electricians handling fault finding, upgrades, installs, safety checks, lighting, and day-to-day electrical work where trust and compliance matter before the quote is even requested.',
    cta: 'REQUEST AN ELECTRICAL QUOTE',
    responseLine: 'Strong for urgent issues, quoted installs, and local service work.',
    heroVisualTagline: 'Licensed electrical visual',
    visualHeadline: 'Use switchboard, lighting, van, or on-site technician imagery',
    heroChecks: [
      { title: 'Built around safety and trust', text: 'The page positions the business as licensed, organised, and safe to have on site.' },
      { title: 'Useful for both installs and callouts', text: 'Support upgrades, repairs, inspections, and lighting work without making the service feel vague.' },
    ],
    highlights: [
      { title: 'Show the types of electrical work you do', text: 'Lighting, switchboards, smoke alarms, data points, safety switches, rewiring, and fault finding all deserve clear language.' },
      { title: 'Lead with reliability, not hype', text: 'Electrical buyers want competence, clean communication, and proof that the work will be done properly.' },
      { title: 'Capture better enquiries', text: 'The page helps customers explain whether the job is urgent, planned, residential, or commercial before your team responds.' },
    ],
    stats: [
      { value: 'Licensed', label: 'Ideal for highlighting credentials and compliance' },
      { value: 'Fast', label: 'Useful for urgent electrical issues and quick site response' },
      { value: 'Quoted', label: 'Strong fit for installations, upgrades, and maintenance work' },
    ],
    sectionHeadline: 'Built for electrical jobs customers are actively searching for',
    sectionIntro: 'This is written for real electrical service work, not generic contractor language. It makes room for urgent issues, quoted installs, and longer-term maintenance relationships.',
    services: [
      { icon: '🔦', title: 'Fault finding and electrical repairs', text: 'Position power loss, tripping circuits, switchboard issues, outlet faults, and troubleshooting work clearly.' },
      { icon: '💡', title: 'Lighting, power, and upgrades', text: 'Ideal for downlights, feature lighting, fans, power points, EV chargers, switchboards, and renovation electrical work.' },
      { icon: '🧾', title: 'Safety, testing, and compliance work', text: 'Useful for smoke alarms, safety switches, rental compliance, inspections, and scheduled maintenance work.' },
    ],
    differenceHeadline: 'Why this works for electricians',
    differenceIntro: 'Electrician buyers are risk-sensitive. They want a business that sounds licensed, organised, and technically competent, not one that feels like a generic lead-gen page.',
    differentiators: [
      { title: 'Compliance-first tone', text: 'The copy naturally supports licences, insured work, testing, and safety messaging without sounding forced.' },
      { title: 'Good fit for urgent and planned jobs', text: 'It works whether the customer needs fast help now or wants to book quoted upgrade work.' },
      { title: 'Supports residential and commercial positioning', text: 'The structure can be tailored to homeowners, landlords, businesses, or managed sites with minimal effort.' },
    ],
    process: [
      { title: 'Establish competence immediately', text: 'The hero and trust sections signal safe, professional electrical work from the first screen.' },
      { title: 'Clarify the exact electrical need', text: 'The service cards help visitors understand whether you are the right fit before they enquire.' },
      { title: 'Collect quote-ready details', text: 'The form captures enough context to prioritise urgent issues and scope planned work correctly.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Licence-ready messaging', text: 'Perfect for displaying licence numbers, insured work, and manufacturer approvals.' },
      { icon: '🏠', title: 'Residential and commercial fit', text: 'Useful when you service homes, shops, offices, or mixed-use local clients.' },
      { icon: '📍', title: 'Local electrical coverage', text: 'Strong for suburb pages, search traffic, and Google Business profile visits.' },
    ],
    customerGroup: 'homeowners, landlords, business owners, and site managers',
    testimonials: [
      { name: 'Troy M.', meta: 'Switchboard upgrade • Coorparoo', quote: 'The page made the business feel properly licensed and professional before we even called. The quote was clear, the communication was sharp, and the work was done neatly and on time.' },
      { name: 'Jodie P.', meta: 'Fault finding callout • Aspley', quote: 'We had power issues and needed someone competent fast. The site felt specific to electrical work, not generic tradie copy, and the problem was diagnosed quickly.' },
      { name: 'Ben H.', meta: 'Lighting and fan installs • Stafford', quote: 'The quote flow was simple and the service list matched exactly what we needed. It felt like a real electrical business from the first click.' },
    ],
    faqs: [
      { q: 'Can this page work for urgent electrical issues and quoted upgrade jobs?', a: 'Yes. It is structured to support urgent callouts, planned installs, safety work, and larger quoted projects without confusion.' },
      { q: 'What proof should I add to strengthen the page?', a: 'Use technician photos, switchboard or lighting imagery, licence details, reviews mentioning the exact job completed, and any manufacturer or safety credentials that matter in your market.' },
      { q: 'Is this suitable for commercial electrical work as well?', a: 'Yes. The messaging can support commercial maintenance, fit-out work, and business clients just as easily as residential enquiries.' },
      { q: 'What should I customise first?', a: 'Update the service cards, local area coverage, logo, licence details, and imagery so the page reflects the exact kind of electrical work you want to win most often.' },
    ],
    formHeadline: 'Collect electrical enquiries with enough detail to quote or dispatch properly.',
    formIntro: 'The form is designed to separate urgent issues from planned installs while capturing location, service type, and enough scope to respond intelligently.',
    formPoints: [
      { title: 'Useful for urgent and non-urgent work', text: 'Capture both emergency-type problems and larger quoted installations in one clean flow.' },
      { title: 'Built for safer follow-up', text: 'The details gathered help your team understand the job before calling back.' },
      { title: 'Easy to brand quickly', text: 'Add your licence details, service area, and real photos and the page becomes launch-ready fast.' },
    ],
    formCardTitle: 'Request an electrical quote',
    formBadge: 'Licensed-service form',
    serviceOptions: ['Fault finding', 'Switchboard upgrade', 'Lighting installation', 'Power points and wiring', 'Smoke alarms and safety', 'Commercial electrical'],
    formCta: 'SEND MY ELECTRICAL ENQUIRY',
    formDisclaimer: 'Use the follow-up or thank-you step to explain response windows, emergency coverage, and any callout or inspection fees.',
  },
  {
    slug: 'handyman',
    label: 'Handyman Service Quote',
    icon: '🛠️',
    secondaryIcon: '🏡',
    accent: '#b45309',
    accentDark: '#78350f',
    accentSoft: '#fef3c7',
    glow: 'rgba(251,191,36,0.24)',
    badgeColor: '#fde68a',
    logo: 'Northside Handyman',
    logoTagline: 'Repairs, installs, odd jobs, and home maintenance',
    badge: 'Reliable handyman help • repairs • installs • property upkeep',
    headline: 'The handyman page should feel practical, helpful, and easy to book.',
    subheadline: 'This version is written for the everyday work a strong handyman business wins: property repairs, patching, hanging, fixing, assembling, and the jobs homeowners keep putting off.',
    cta: 'BOOK A HANDYMAN QUOTE',
    responseLine: 'Great for referral, local search, and repeat-client traffic.',
    heroVisualTagline: 'Property maintenance visual',
    visualHeadline: 'Show your team, tools, van, or a tidy finished result',
    heroChecks: [
      { title: 'Feels useful instead of salesy', text: 'Handyman customers want confidence and convenience, not exaggerated claims.' },
      { title: 'Perfect for repeatable jobs', text: 'Support repairs, installs, maintenance visits, and property manager work with relevant language.' },
    ],
    highlights: [
      { title: 'List the jobs you actually do', text: 'Make it obvious you handle door repairs, patching, mounting, assembly, odd jobs, and general maintenance.' },
      { title: 'Appeal to homeowners and property managers', text: 'The copy balances residential trust with commercial clarity so the page works across multiple lead sources.' },
      { title: 'Make booking feel low friction', text: 'Handyman buyers usually want a quick sense of capability, price fit, and availability before they enquire.' },
    ],
    stats: [
      { value: 'Multi-trade', label: 'Ideal when one visit can solve several small problems' },
      { value: 'Fast', label: 'Good for jobs customers want done this week' },
      { value: 'Tidy', label: 'Highlights respect for occupied homes and rental properties' },
    ],
    sectionHeadline: 'Position your handyman business for practical, everyday jobs',
    sectionIntro: 'This is not written like a premium renovation company or an ecommerce offer. It is designed for straightforward repair and maintenance enquiries.',
    services: [
      { icon: '🚪', title: 'Repairs and adjustments', text: 'Doors that stick, locks and latches, small patching jobs, trim fixes, shelving, and general problem-solving work.' },
      { icon: '🖼️', title: 'Installs and assembly', text: 'TV mounting, furniture assembly, curtain tracks, wall fixtures, cabinetry hardware, and the jobs that never make it off the weekend list.' },
      { icon: '🔩', title: 'Property maintenance visits', text: 'Helpful for landlords, Airbnb hosts, and property managers who need a reliable set of hands for recurring issues.' },
    ],
    differenceHeadline: 'Why this works for handyman services',
    differenceIntro: 'People book a handyman when they want convenience, competence, and clear communication. The page needs to communicate that quickly and without fluff.',
    differentiators: [
      { title: 'Broad capability, clear scope', text: 'Explain the kinds of jobs you take on so leads understand where you are the right fit and where they may need a specialist trade.' },
      { title: 'Simple quoting language', text: 'The page supports hourly work, half-day visits, and fixed-price small jobs without confusion.' },
      { title: 'Useful for repeat business', text: 'Property managers, landlords, and past clients can land here, recognise the offer fast, and rebook without phone tag.' },
    ],
    process: [
      { title: 'Show the types of jobs you cover', text: 'This filters out poor leads and improves the quality of quote requests.' },
      { title: 'Create confidence with tidy, reliable messaging', text: 'The promise is professionalism, not hype or unrealistic guarantees.' },
      { title: 'Capture the job list up front', text: 'A short but relevant form helps you estimate the visit and respond properly.' },
    ],
    trustPoints: [
      { icon: '📋', title: 'Scope clarity', text: 'Perfect for pages that need to explain what is included and how quotes are handled.' },
      { icon: '🏠', title: 'Residential friendly', text: 'Useful for owner-occupiers, rental turnover jobs, and small property upgrades.' },
      { icon: '🗓️', title: 'Easy rebooking', text: 'Great for local customers who come back every few months with another list of jobs.' },
    ],
    customerGroup: 'homeowners, landlords, and property managers',
    testimonials: [
      { name: 'Karen W.', meta: 'Rental touch-up list • Chermside', quote: 'I had a list of little repairs that kept getting pushed back. Their page made it obvious they handled exactly this kind of work, and the handyman smashed through the list efficiently and neatly.' },
      { name: 'Brad P.', meta: 'TV mounting and shelving • Redcliffe', quote: 'It felt like a real service business, not a generic lead page. I sent through the job details, got a clear response, and the install work was done properly the first time.' },
      { name: 'Mina L.', meta: 'Door and patch repairs • Clayfield', quote: 'We needed a mix of small fixes before family arrived. The enquiry process was simple, the communication was great, and the work made the whole place feel finished again.' },
    ],
    faqs: [
      { q: 'Can I list multiple small jobs in one request?', a: 'Yes. This template is built for exactly that, so customers can explain several repairs or installations in one form instead of making separate enquiries.' },
      { q: 'What if some work needs a licensed specialist trade?', a: 'The copy helps position handyman work clearly while leaving room to explain where a licensed electrician, plumber, or other specialist may be required.' },
      { q: 'Is this good for property managers and landlords?', a: 'Yes. The messaging works well for recurring maintenance, pre-tenant touch-ups, and everyday repair work where speed and clear communication matter.' },
      { q: 'What should I add to make it stronger?', a: 'Before-and-after photos, a simple job gallery, suburb coverage, and a short list of common jobs all make the page feel even more credible.' },
    ],
    formHeadline: 'Make it easy for people to send through a handyman job list.',
    formIntro: 'This form works best when customers can quickly describe the jobs, property type, and desired timing without having to make a call first.',
    formPoints: [
      { title: 'Useful for multi-job requests', text: 'Capture several small tasks in one enquiry so your team can quote more intelligently.' },
      { title: 'Built for practical local leads', text: 'Ideal for referral traffic, repeat clients, and people searching for a reliable general handyman.' },
      { title: 'Easier to customise by suburb or service area', text: 'Add your local area, minimum callout, and availability rules and the page becomes operational quickly.' },
    ],
    formCardTitle: 'Request a handyman quote',
    formBadge: 'Low-friction booking',
    serviceOptions: ['General repairs', 'Wall mounting', 'Furniture assembly', 'Patch and paint prep', 'Doors and locks', 'Property maintenance list'],
    formCta: 'SEND MY HANDYMAN REQUEST',
    formDisclaimer: 'Use the confirmation message to explain your quoting process, minimum charge, and when someone can expect a callback.',
  },
  {
    slug: 'mechanic',
    label: 'Mechanic / Auto Service Quote',
    icon: '🚗',
    secondaryIcon: '🔩',
    accent: '#dc2626',
    accentDark: '#450a0a',
    accentSoft: '#fee2e2',
    glow: 'rgba(248,113,113,0.24)',
    badgeColor: '#fecaca',
    logo: 'Redline Auto Care',
    logoTagline: 'Mechanical repairs, servicing, diagnostics, and fleet work',
    badge: 'Mechanics • servicing • diagnostics • brakes • suspension • fleet',
    headline: 'Mechanic pages need to sound competent, honest, and easy to deal with.',
    subheadline: 'This version is built for workshops and mobile mechanics handling servicing, diagnostics, repairs, brakes, suspension, roadworthy prep, and ongoing vehicle maintenance where credibility matters more than flashy copy.',
    cta: 'REQUEST A MECHANIC QUOTE',
    responseLine: 'Great for workshop bookings, diagnostics, and repeat servicing traffic.',
    heroVisualTagline: 'Workshop or vehicle visual',
    visualHeadline: 'Use workshop shots, technician imagery, vehicles, or inspection visuals',
    heroChecks: [
      { title: 'Feels like a real automotive service business', text: 'The tone is built for trust, clear diagnosis, and honest maintenance messaging.' },
      { title: 'Works for everyday and higher-value repairs', text: 'Use it for routine servicing, fault diagnosis, repair jobs, and fleet enquiries.' },
    ],
    highlights: [
      { title: 'Support the jobs mechanics actually quote', text: 'Logbook servicing, brakes, suspension, battery issues, diagnostics, and repair work can all be positioned clearly.' },
      { title: 'Reduce fear around quoting', text: 'Vehicle owners want clarity, professionalism, and a sense that they will not be sold nonsense.' },
      { title: 'Good fit for repeat customers', text: 'Mechanic businesses win a lot of repeat work, so the page needs to feel trustworthy and easy to revisit.' },
    ],
    stats: [
      { value: 'Routine', label: 'Strong for repeat servicing and maintenance clients' },
      { value: 'Diagnostics', label: 'Useful when the customer does not yet know the exact issue' },
      { value: 'Quoted', label: 'Good for repairs, inspections, and fleet maintenance work' },
    ],
    sectionHeadline: 'Written for the mechanical work people actually book',
    sectionIntro: 'This template is aimed at real automotive service businesses, with language that supports workshop bookings, diagnosis, and practical maintenance without sounding generic or salesy.',
    services: [
      { icon: '🛠️', title: 'Servicing and preventative maintenance', text: 'Ideal for logbook servicing, regular maintenance, fluid changes, tune-ups, and keeping vehicles reliable long-term.' },
      { icon: '🧪', title: 'Diagnostics and repair work', text: 'Useful for warning lights, drivability issues, noises, starting problems, overheating, and repairs that need investigation before pricing.' },
      { icon: '🚚', title: 'Fleet, trade, and ongoing vehicle support', text: 'Great for business vehicles, local fleets, and repeat customers who value a dependable mechanic relationship.' },
    ],
    differenceHeadline: 'Why this works for mechanics',
    differenceIntro: 'Mechanic buyers are wary of vague promises and inflated language. The page needs to project honesty, competence, and practical vehicle knowledge right away.',
    differentiators: [
      { title: 'Trust-first automotive tone', text: 'The messaging is built around clarity, diagnosis, and straightforward service rather than hype or gimmicks.' },
      { title: 'Useful for workshop and mobile mechanics', text: 'The structure can flex to either business model while still sounding grounded in real mechanical work.' },
      { title: 'Supports repeat and referral traffic', text: 'Once customers trust a mechanic, they come back. This page is designed to reinforce that relationship from the start.' },
    ],
    process: [
      { title: 'Frame the work clearly', text: 'The service sections help vehicle owners recognise whether you handle their exact issue.' },
      { title: 'Reduce anxiety around the booking', text: 'A calmer, clearer tone makes the business feel more trustworthy and professional.' },
      { title: 'Capture useful vehicle context', text: 'The form encourages better briefing so your team can quote, inspect, or book efficiently.' },
    ],
    trustPoints: [
      { icon: '🔧', title: 'Real workshop credibility', text: 'Ideal for technician photos, workshop shots, tooling, and service-bay imagery.' },
      { icon: '📘', title: 'Service-plan friendly', text: 'Useful for recurring maintenance customers, fleet servicing, and return bookings.' },
      { icon: '⭐', title: 'Review-driven local trust', text: 'Works especially well when paired with Google reviews mentioning the actual repair or service provided.' },
    ],
    customerGroup: 'vehicle owners, tradies, and fleet managers',
    testimonials: [
      { name: 'Jason R.', meta: 'Brake and suspension quote • Tingalpa', quote: 'The site felt like a proper workshop, not a generic lead page. They explained the work clearly, quoted honestly, and the job was handled exactly how they said it would be.' },
      { name: 'Amanda K.', meta: 'Logbook service booking • Indooroopilly', quote: 'It was easy to request the service, the page made the business feel trustworthy, and the whole process was straightforward from booking through to collection.' },
      { name: 'Corey L.', meta: 'Diagnostic enquiry • Eight Mile Plains', quote: 'We did not know exactly what the issue was, but the enquiry flow made it simple to explain the symptoms. The follow-up was professional and the diagnosis was spot on.' },
    ],
    faqs: [
      { q: 'Can this page work for routine servicing and bigger repair jobs?', a: 'Yes. It is designed to support both repeat service bookings and higher-consideration repair or diagnostic work without confusion.' },
      { q: 'What should I include to make this stronger?', a: 'Use workshop photos, vehicle imagery, customer reviews mentioning real repair jobs, service menu highlights, and any fleet or specialist capabilities you want to promote.' },
      { q: 'Is this good for mobile mechanics too?', a: 'Yes. The core messaging still fits, and you can easily adapt the trust points and form wording to reflect mobile service areas and on-site work.' },
      { q: 'What should I customise first?', a: 'Update the service options, workshop or mobile-service positioning, imagery, and testimonials so the page reflects the exact automotive work you want to attract.' },
    ],
    formHeadline: 'Make it easier for customers to request servicing or mechanical help.',
    formIntro: 'This form is built to capture vehicle issues, service type, and enough context for your team to quote, diagnose, or book the vehicle properly.',
    formPoints: [
      { title: 'Good for booked service work', text: 'Ideal for routine maintenance, inspections, and return customers.' },
      { title: 'Useful when the issue is not yet fully diagnosed', text: 'Let customers describe symptoms so your team can respond more intelligently.' },
      { title: 'Flexible for workshops or mobile mechanics', text: 'You can quickly tune the page to your operating model and local market.' },
    ],
    formCardTitle: 'Request a mechanic quote',
    formBadge: 'Workshop-ready form',
    serviceOptions: ['Logbook service', 'Diagnostic inspection', 'Brake work', 'Suspension repair', 'Battery or starting issue', 'Fleet servicing'],
    formCta: 'SEND MY MECHANIC ENQUIRY',
    formDisclaimer: 'Use the follow-up flow to explain inspection fees, workshop availability, towing advice, or whether the vehicle should be driven before assessment.',
  },
  {
    slug: 'cleaning',
    label: 'Cleaning Service Quote',
    icon: '🧼',
    secondaryIcon: '✨',
    accent: '#2563eb',
    accentDark: '#1e3a8a',
    accentSoft: '#dbeafe',
    glow: 'rgba(96,165,250,0.24)',
    badgeColor: '#bfdbfe',
    logo: 'Bright Nest Cleaning',
    logoTagline: 'Home, office, end-of-lease, and deep cleaning',
    badge: 'Professional cleaning • regular visits • deep cleans • move-out work',
    headline: 'A cleaning page should feel polished, calm, and trustworthy from the first scroll.',
    subheadline: 'This version is tailored for recurring house cleaning, deep cleans, office cleaning, end-of-lease jobs, and clients who care about reliability, presentation, and attention to detail.',
    cta: 'REQUEST A CLEANING QUOTE',
    responseLine: 'Perfect for recurring home and office cleaning leads.',
    heroVisualTagline: 'Clean-home visual',
    visualHeadline: 'Use bright, high-quality imagery that signals a well-kept space',
    heroChecks: [
      { title: 'Designed for trust and presentation', text: 'Cleaning pages need to feel neat, calm, and professional, not hard-sell or overhyped.' },
      { title: 'Works for one-off and recurring jobs', text: 'Position regular visits, deep cleans, and move-out work without confusing the customer.' },
    ],
    highlights: [
      { title: 'Promote outcomes customers care about', text: 'Consistency, communication, cleaner spaces, and less stress matter more here than gimmicky sales lines.' },
      { title: 'Separate home, office, and special cleans', text: 'Use distinct service cards so customers instantly recognise whether you handle their type of job.' },
      { title: 'Support quote-ready decisions', text: 'The form helps you gather property size, cleaning type, and any special requirements before you call back.' },
    ],
    stats: [
      { value: 'Weekly', label: 'Great for recurring clients who want ongoing help' },
      { value: 'Deep clean', label: 'Ideal for first visits, spring cleans, and catch-up work' },
      { value: 'Move-out', label: 'Strong fit for end-of-lease and pre-sale enquiries' },
    ],
    sectionHeadline: 'Made for cleaning enquiries that feel specific and professional',
    sectionIntro: 'Cleaning is about trust, consistency, and presentation. These sections reflect that instead of recycling supplement-style hype or irrelevant guarantees.',
    services: [
      { icon: '🏠', title: 'Regular home cleaning', text: 'Position recurring visits, family homes, busy households, and consistent cleaning routines that reduce stress week after week.' },
      { icon: '🧽', title: 'Deep cleans and catch-up cleans', text: 'Perfect for first-time clients, seasonal resets, and properties that need more detail than a standard maintenance clean.' },
      { icon: '📦', title: 'End-of-lease and move-related work', text: 'Useful when customers need a fresh start, a handover-ready property, or help preparing a space for new tenants or sale.' },
    ],
    differenceHeadline: 'Why this works for cleaning businesses',
    differenceIntro: 'Cleaning customers want to know whether you are reliable, careful, easy to deal with, and thorough. That needs to be obvious well before they submit the form.',
    differentiators: [
      { title: 'Presentation-first copy', text: 'The tone is clean, calm, and competent, which suits cleaning businesses far better than aggressive discount language.' },
      { title: 'Service-type clarity', text: 'Home, office, deep clean, and move-out work are framed clearly so customers know they are in the right place.' },
      { title: 'Good fit for recurring work', text: 'The page supports long-term housekeeping clients as well as one-off enquiries, which matters for real cleaning businesses.' },
    ],
    process: [
      { title: 'Set a polished first impression', text: 'The page immediately signals organisation, care, and professionalism.' },
      { title: 'Clarify exactly what kind of clean they need', text: 'This reduces confusion and improves the quality of form submissions.' },
      { title: 'Make the next step feel easy', text: 'A clear form and strong supporting copy lower friction for busy households and office managers.' },
    ],
    trustPoints: [
      { icon: '🫧', title: 'Presentation matters', text: 'Use brand imagery, uniforms, before-and-after examples, and checklists to elevate perceived quality.' },
      { icon: '🗝️', title: 'Access and reliability', text: 'Important for clients who need someone trustworthy in their home, office, or rental property.' },
      { icon: '📍', title: 'Suburb-based marketing', text: 'This template is strong when paired with local service pages, Google traffic, and referral campaigns.' },
    ],
    customerGroup: 'busy households, property managers, and office clients',
    testimonials: [
      { name: 'Alisha G.', meta: 'Fortnightly home cleaning • Paddington', quote: 'The page looked clean and professional, which was exactly what I wanted. The quote process was quick, the communication was excellent, and the standard of cleaning has been consistently high.' },
      { name: 'Tom H.', meta: 'End-of-lease clean • South Brisbane', quote: 'I needed someone who understood a move-out clean properly. The site explained the service clearly, and the team delivered exactly what was promised without any drama.' },
      { name: 'Megan S.', meta: 'Office clean • Milton', quote: 'We were looking for a cleaner who felt organised and reliable. This page made the service feel premium and well run, and that matched the experience after we booked.' },
    ],
    faqs: [
      { q: 'Can this page work for regular cleaning and one-off deep cleans?', a: 'Yes. The copy is structured so you can clearly present recurring visits, first cleans, and heavier one-off jobs without creating confusion.' },
      { q: 'Is this suitable for end-of-lease cleaning?', a: 'Absolutely. Cleaning buyers often have different motivations depending on the job, and this template gives you room to position move-out, pre-sale, or reset cleaning clearly.' },
      { q: 'What proof should I add to make it stronger?', a: 'Use real team photos, uniformed staff imagery, before-and-after details, suburb reviews, and a checklist of what is included in each cleaning type.' },
      { q: 'What if I only service a small set of suburbs?', a: 'That is actually a strength. Local cleaning services often convert better when the page clearly states service areas and feels neighbourhood-specific.' },
    ],
    formHeadline: 'Let customers request the right type of clean in one go.',
    formIntro: 'The form is built to capture the property location, the clean type, and any key details like pets, frequency, or move-out timing so your team can quote accurately.',
    formPoints: [
      { title: 'Works for ongoing and one-off cleans', text: 'Useful whether the lead wants recurring home cleaning or a detailed one-off job.' },
      { title: 'Built for smoother quoting', text: 'Capture the information your team needs without overwhelming the customer.' },
      { title: 'Easy to personalise', text: 'Add your suburb list, team photos, and inclusions list to make the page launch-ready quickly.' },
    ],
    formCardTitle: 'Request a cleaning quote',
    formBadge: 'Polished enquiry flow',
    serviceOptions: ['Regular home clean', 'Deep clean', 'End-of-lease clean', 'Office clean', 'Airbnb turnover', 'Move-in freshen-up'],
    formCta: 'SEND MY CLEANING ENQUIRY',
    formDisclaimer: 'Use your confirmation and follow-up emails to outline availability, property access, and whether you quote from square metres, bedrooms, or photos.',
  },
  {
    slug: 'painter',
    label: 'Painting Service Quote',
    icon: '🎨',
    secondaryIcon: '🖌️',
    accent: '#7c3aed',
    accentDark: '#3b0764',
    accentSoft: '#ede9fe',
    glow: 'rgba(167,139,250,0.24)',
    badgeColor: '#ddd6fe',
    logo: 'True Coat Painting',
    logoTagline: 'Interior, exterior, commercial, and repaint specialists',
    badge: 'Painters • interiors • exteriors • repaints • commercial finishes',
    headline: 'Painting pages should feel polished, premium, and visually confident.',
    subheadline: 'This version is built for residential and commercial painters quoting interior repaints, exteriors, feature walls, offices, shopfronts, and finish-focused work where presentation does a lot of the selling.',
    cta: 'REQUEST A PAINTING QUOTE',
    responseLine: 'Strong for repaint projects, presentation-focused jobs, and local quote traffic.',
    heroVisualTagline: 'Finish-quality visual',
    visualHeadline: 'Use finished-room imagery, exterior projects, or clean crew-on-site photos',
    heroChecks: [
      { title: 'Presentation does heavy lifting here', text: 'The page is built to feel visually clean and quality-led, which suits painting services much better than generic contractor copy.' },
      { title: 'Works for interior and exterior projects', text: 'You can clearly position homes, commercial premises, repaints, and detail-focused finishing work.' },
    ],
    highlights: [
      { title: 'Sell the finish, not just the labour', text: 'Customers want to know the result will look sharp, last well, and be handled professionally from prep through to clean-up.' },
      { title: 'Useful for homeowners and commercial clients', text: 'The structure can support residential repaints, offices, retail spaces, and strata-style work without losing clarity.' },
      { title: 'Good fit for visual proof', text: 'Painters benefit heavily from project imagery, before-and-after examples, and finish detail, and this page makes room for that.' },
    ],
    stats: [
      { value: 'Interior', label: 'Strong for walls, ceilings, trims, and full-home repaints' },
      { value: 'Exterior', label: 'Great for presentation upgrades and weather-exposed surfaces' },
      { value: 'Commercial', label: 'Useful for offices, retail, and managed property work' },
    ],
    sectionHeadline: 'Position the painting work customers actually care about',
    sectionIntro: 'Painting buyers respond to finish quality, preparation standards, reliability, and visible proof. This template is built around that reality.',
    services: [
      { icon: '🏠', title: 'Interior repaints and room refreshes', text: 'Perfect for walls, ceilings, trims, touch-ups, and full interior projects where homeowners care about presentation and tidy work.' },
      { icon: '🌤️', title: 'Exterior painting and weather-facing surfaces', text: 'Useful for facades, timberwork, render, decks, fences, and projects where durability matters as much as the finish.' },
      { icon: '🏢', title: 'Commercial and presentation-focused work', text: 'Great for offices, shopfronts, property refreshes, handover work, and any job where appearance directly affects perception.' },
    ],
    differenceHeadline: 'Why this works for painters',
    differenceIntro: 'Painting is a visual service. The page needs to feel clean, premium, and well-finished before the customer ever sees your portfolio or gets a quote.',
    differentiators: [
      { title: 'Finish-led messaging', text: 'The copy supports preparation, quality materials, neat execution, and a result people feel proud of.' },
      { title: 'Better fit for visual selling', text: 'This structure works especially well once you add before-and-after photos, project shots, and room or facade imagery.' },
      { title: 'Useful across residential and commercial work', text: 'The language is broad enough to support homes, offices, retail, and property presentation jobs without feeling generic.' },
    ],
    process: [
      { title: 'Lead with visible quality', text: 'The hero and support sections are designed to make the page itself feel better finished.' },
      { title: 'Clarify project type early', text: 'The service cards help visitors understand whether you handle interiors, exteriors, commercial spaces, or all three.' },
      { title: 'Capture practical quote details', text: 'The form helps your team gather the scope, location, and timing needed to quote more accurately.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Portfolio-ready layout', text: 'Perfect for project imagery, colour work, finish details, and before-and-after case studies.' },
      { icon: '🧹', title: 'Prep and clean-up credibility', text: 'Useful when your buyers care about tidy sites, masking, protection, and professional finish standards.' },
      { icon: '📍', title: 'Local repaint traffic fit', text: 'Works well for suburbs, local ads, and quote requests from owners preparing a home or business for a refresh.' },
    ],
    customerGroup: 'homeowners, property managers, and commercial clients',
    testimonials: [
      { name: 'Rachel V.', meta: 'Interior repaint • New Farm', quote: 'The page looked polished and professional, which made it easy to trust the business. The quoting process was smooth, the team was tidy, and the finish lifted the whole house.' },
      { name: 'Sam E.', meta: 'Exterior painting quote • Morningside', quote: 'We were comparing a few painters and this page stood out because it felt specific to the kind of work we needed. The communication was clear and the job came up beautifully.' },
      { name: 'Olivia P.', meta: 'Retail refresh • West End', quote: 'It felt like a proper painting company from the first screen. The quote was straightforward, the scheduling was handled well, and the finished space looked excellent.' },
    ],
    faqs: [
      { q: 'Can this page work for both interior and exterior painting?', a: 'Yes. It is designed to support both, and you can easily adjust the service cards and imagery depending on which kind of work you want to push hardest.' },
      { q: 'What will make this page convert better?', a: 'Real project photos, before-and-after examples, a clear explanation of prep and finish standards, and reviews that mention cleanliness and final result all help a lot.' },
      { q: 'Is this suitable for commercial painting work?', a: 'Yes. The tone and structure can support commercial jobs, retail spaces, offices, and property presentation projects just as well as residential repaints.' },
      { q: 'What should I customise first?', a: 'Update the project imagery, service list, service area, and testimonials so the page reflects the exact kind of painting jobs you want to attract.' },
    ],
    formHeadline: 'Capture painting quote requests with a page that already feels premium.',
    formIntro: 'The form is built to gather the property type, the painting work required, and the timing or presentation goals so your team can quote with more context.',
    formPoints: [
      { title: 'Useful for residential and commercial jobs', text: 'A good fit whether the enquiry is for a home repaint, office, or presentation-focused project.' },
      { title: 'Supports visual-first selling', text: 'Once you add project images, the page becomes a strong sales asset for finish-led work.' },
      { title: 'Easy to brand and tailor', text: 'Swap in your colours, project photos, and service area details and it is ready to move quickly.' },
    ],
    formCardTitle: 'Request a painting quote',
    formBadge: 'Finish-led quote form',
    serviceOptions: ['Interior repaint', 'Exterior painting', 'Feature wall or detail work', 'Commercial painting', 'Fence or deck coating', 'Property presentation refresh'],
    formCta: 'SEND MY PAINTING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether you quote from photos first, provide colour guidance, or need a site visit before final pricing.',
  },
  {
    slug: 'lawn-care',
    label: 'Lawn Care Service Quote',
    icon: '🌿',
    secondaryIcon: '🚜',
    accent: '#15803d',
    accentDark: '#14532d',
    accentSoft: '#dcfce7',
    glow: 'rgba(74,222,128,0.24)',
    badgeColor: '#bbf7d0',
    logo: 'Greenline Lawn Care',
    logoTagline: 'Mowing, edging, tidy-ups, and yard maintenance',
    badge: 'Lawn mowing • edging • seasonal tidy-ups • yard maintenance',
    headline: 'Lawn care buyers want a page that looks neat, local, and dependable.',
    subheadline: 'This version is designed for mowing rounds, recurring yard maintenance, overgrown tidy-ups, and homeowners who want their outdoor spaces looking sharp without chasing contractors for a callback.',
    cta: 'REQUEST A LAWN CARE QUOTE',
    responseLine: 'Strong for local search, repeat work, and seasonal enquiries.',
    heroVisualTagline: 'Fresh-yard visual',
    visualHeadline: 'Show a crisp finished lawn, edging detail, or a crew on site',
    heroChecks: [
      { title: 'Feels local and practical', text: 'Lawn care pages should feel tidy, clear, and grounded in the actual service area.' },
      { title: 'Supports recurring and one-off work', text: 'Position regular mowing visits as confidently as overgrown rescue jobs or seasonal tidy-ups.' },
    ],
    highlights: [
      { title: 'Sell the visible result', text: 'A neat finish, defined edges, and easier upkeep are the outcomes that matter most here.' },
      { title: 'Make recurring maintenance easy to understand', text: 'The copy can support weekly, fortnightly, and as-needed yard care without sounding generic.' },
      { title: 'Capture the right scope up front', text: 'Ask for yard size, service type, and job details so callbacks are faster and quotes are cleaner.' },
    ],
    stats: [
      { value: 'Weekly', label: 'Useful for regular mowing rounds and repeat work' },
      { value: 'Seasonal', label: 'Great for overgrowth, tidy-ups, and one-off resets' },
      { value: 'Local', label: 'Works best when paired with suburb-specific targeting' },
    ],
    sectionHeadline: 'Built around the lawn care services homeowners actually book',
    sectionIntro: 'This is tailored for mowing and yard maintenance businesses, with language that matches what customers need instead of sounding like a generic contractor page.',
    services: [
      { icon: '✂️', title: 'Mowing, edging, and regular visits', text: 'Perfect for weekly or fortnightly maintenance plans and customers who want the property to stay sharp with minimal effort.' },
      { icon: '🍃', title: 'Seasonal tidy-ups and overgrowth', text: 'Position clean-ups, catch-up visits, and neglected yards with copy that reflects the work involved.' },
      { icon: '🌳', title: 'General yard presentation', text: 'Great for hedging add-ons, leaf clearing, and the visible finishing touches that make a property feel cared for.' },
    ],
    differenceHeadline: 'Why this works for lawn care and yard maintenance',
    differenceIntro: 'Lawn care pages need to feel crisp, local, and outcome-driven. Customers want to know the yard will look better, stay manageable, and be handled reliably.',
    differentiators: [
      { title: 'Strong local-service tone', text: 'The message feels neighbourhood-focused and practical, which matches the way many lawn care businesses win work.' },
      { title: 'Good fit for recurring revenue', text: 'Recurring mowing visits and maintenance plans are supported naturally without forcing hard-sell language.' },
      { title: 'Specific enough for one-off tidy-ups', text: 'The copy also works when the job is a rescue clean-up, a property presentation push, or a pre-sale refresh.' },
    ],
    process: [
      { title: 'Show the visible outcome fast', text: 'A tidy lawn and clean edges should be front and centre in the message.' },
      { title: 'Clarify whether the lead wants recurring or one-off work', text: 'This improves quote quality and helps you prioritise the right jobs.' },
      { title: 'Gather enough detail to route efficiently', text: 'Property size, access, and yard condition all affect the quote and should be captured early.' },
    ],
    trustPoints: [
      { icon: '📆', title: 'Recurring schedule ready', text: 'Great for pages focused on weekly and fortnightly maintenance rounds.' },
      { icon: '📸', title: 'Before-and-after friendly', text: 'This vertical benefits heavily from real imagery showing visible transformation.' },
      { icon: '🏘️', title: 'Neighbourhood marketing fit', text: 'Works well for suburb pages, local ads, and flyer or referral traffic.' },
    ],
    customerGroup: 'homeowners, landlords, and property sellers',
    testimonials: [
      { name: 'Chris D.', meta: 'Fortnightly mowing • Wynnum', quote: 'The page looked like a real local service business, not a generic ad landing page. We booked regular mowing and the yard has looked sharp ever since.' },
      { name: 'Paula N.', meta: 'Overgrown yard tidy-up • Capalaba', quote: 'We needed help fast before an inspection and the site made it obvious they handled overgrowth and tidy-ups. The result looked fantastic and the process was simple.' },
      { name: 'Nathan F.', meta: 'Pre-sale lawn refresh • Carina', quote: 'The quote flow was easy and the messaging actually matched what we needed. They turned a tired-looking yard into something presentation-ready before photos and open homes.' },
    ],
    faqs: [
      { q: 'Can this page work for recurring mowing clients?', a: 'Yes. It is well suited to weekly and fortnightly maintenance plans, especially when you want the page to feel trustworthy and local rather than flashy.' },
      { q: 'Will it still fit one-off tidy-up jobs?', a: 'Absolutely. The service sections and form support clean-up, catch-up, and overgrown yard enquiries as well as regular lawn care.' },
      { q: 'What imagery should I add to improve conversions?', a: 'Use crisp finished-lawn photos, edging close-ups, crew imagery, branded trailers or utes, and before-and-after shots that show visible change.' },
      { q: 'What if I only service a few suburbs?', a: 'That is often ideal for this vertical. Strong suburb messaging can outperform broad, generic coverage claims.' },
    ],
    formHeadline: 'Capture lawn care enquiries with enough detail to quote properly.',
    formIntro: 'This form helps you separate recurring maintenance from one-off yard jobs and gather the details that affect time on site and pricing.',
    formPoints: [
      { title: 'Useful for recurring work', text: 'Make it easy for long-term clients to enquire without a phone call.' },
      { title: 'Good for one-off tidy-ups', text: 'Capture yard condition, property size, and urgency to quote more confidently.' },
      { title: 'Built for local campaigns', text: 'Strong fit for suburb-targeted traffic from search, flyers, or referrals.' },
    ],
    formCardTitle: 'Request a lawn care quote',
    formBadge: 'Local-service ready',
    serviceOptions: ['Regular mowing', 'One-off tidy-up', 'Overgrown yard clean-up', 'Edging and presentation', 'Seasonal maintenance', 'Property sale refresh'],
    formCta: 'SEND MY LAWN CARE REQUEST',
    formDisclaimer: 'If you quote from photos or property size, mention that in the follow-up so expectations stay clear from the start.',
  },
  {
    slug: 'car-detailing',
    label: 'Car Detailing Quote',
    icon: '🚘',
    secondaryIcon: '✨',
    accent: '#0f766e',
    accentDark: '#042f2e',
    accentSoft: '#ccfbf1',
    glow: 'rgba(45,212,191,0.22)',
    badgeColor: '#99f6e4',
    logo: 'Gloss Auto Detailing',
    logoTagline: 'Mobile and studio detailing, paint correction, and protection',
    badge: 'Detailing • paint correction • ceramic protection • fleet and private vehicles',
    headline: 'Detailing pages should feel premium, visual, and obviously worth the money.',
    subheadline: 'This version is built for mobile and studio detailers selling interior cleans, paint correction, ceramic protection, pre-sale detailing, and high-presentation vehicle care where the finish is the proof.',
    cta: 'REQUEST A DETAILING QUOTE',
    responseLine: 'Strong for high-intent leads who care about finish and presentation.',
    heroVisualTagline: 'Vehicle finish visual',
    visualHeadline: 'Use clean vehicle imagery, gloss reflections, or service-in-progress shots',
    heroChecks: [
      { title: 'Built for premium perception', text: 'Detailing buyers are heavily influenced by presentation, so the page is designed to feel polished and high-value.' },
      { title: 'Good for mobile or studio businesses', text: 'The structure supports both service models while keeping the message focused on quality and visible results.' },
    ],
    highlights: [
      { title: 'Sell the finish and the care', text: 'Paint correction, protection, gloss, interior reset, and vehicle presentation are framed clearly instead of buried under generic offer copy.' },
      { title: 'Perfect for visual proof', text: 'This is one of the strongest verticals for before-and-after shots, reflection shots, and premium vehicle imagery.' },
      { title: 'Useful for enthusiasts and everyday owners', text: 'The page can support premium detail packages as well as practical clean-up, pre-sale, or maintenance work.' },
    ],
    stats: [
      { value: 'Paint', label: 'Ideal for correction, enhancement, and protection work' },
      { value: 'Interior', label: 'Useful for deep clean, restoration, and reset packages' },
      { value: 'Mobile', label: 'Strong fit for local area campaigns and on-site service' },
    ],
    sectionHeadline: 'Built for the detailing jobs customers actually pay premium rates for',
    sectionIntro: 'Detailing is a visual, trust-driven service. This template is designed to help the work feel premium and the enquiry path feel worthwhile from the first interaction.',
    services: [
      { icon: '🧽', title: 'Interior detailing and deep reset work', text: 'Great for full interior cleans, stain removal, seat and trim care, odour treatment, and presentation-focused interior jobs.' },
      { icon: '🌟', title: 'Paint enhancement, correction, and protection', text: 'Ideal for gloss restoration, swirl removal, ceramic packages, and buyers who care deeply about finish quality.' },
      { icon: '📷', title: 'Pre-sale, prestige, and presentation detailing', text: 'Useful for vehicle sale prep, enthusiast cars, business fleets, and clients who want the car to feel looked after properly.' },
    ],
    differenceHeadline: 'Why this works for car detailing',
    differenceIntro: 'Detailing is one of the most visual service categories in this set. The page needs to feel cleaner, sharper, and more premium than a generic local-service template.',
    differentiators: [
      { title: 'Visual-first structure', text: 'This layout is designed to get stronger as soon as you add real vehicle imagery and before-and-after proof.' },
      { title: 'Good fit for premium packages', text: 'The tone supports high-value protection and correction work without sounding fake or overblown.' },
      { title: 'Flexible for mobile or shop-based service', text: 'You can tailor the messaging easily depending on whether customers come to you or you travel to them.' },
    ],
    process: [
      { title: 'Set a premium impression fast', text: 'The hero and support sections help the service feel more valuable before the customer even sees pricing.' },
      { title: 'Clarify which detailing service they need', text: 'Interior, correction, protection, and presentation work each need their own space.' },
      { title: 'Capture useful vehicle and service details', text: 'The form helps your team understand the vehicle, the goal, and the likely package fit before following up.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Before-and-after friendly', text: 'This vertical benefits enormously from strong real imagery showing finish quality and transformation.' },
      { icon: '🚗', title: 'Vehicle-owner trust', text: 'The messaging supports care, respect, and finish standards, which matters when customers are handing over high-value vehicles.' },
      { icon: '📍', title: 'Local premium-service fit', text: 'Works well for suburb traffic, high-intent search leads, and social campaigns with strong visuals.' },
    ],
    customerGroup: 'car owners, enthusiasts, dealerships, and fleet clients',
    testimonials: [
      { name: 'Mitch C.', meta: 'Paint correction package • Bulimba', quote: 'The page looked premium before I even enquired, which mattered because this was not a cheap service. The result was unreal and the whole process felt first class.' },
      { name: 'Sarah N.', meta: 'Interior detail • Ascot', quote: 'It felt like a real detailing business, not a generic trade page. The enquiry was easy, the communication was clear, and the car came back looking incredible.' },
      { name: 'Daniel F.', meta: 'Mobile detail booking • Chermside', quote: 'The service list and imagery made it easy to understand the difference between a basic clean and proper detailing. It helped us book with confidence.' },
    ],
    faqs: [
      { q: 'Can this page work for both mobile and studio detailers?', a: 'Yes. The structure works for either model, and you can adjust the wording slightly depending on whether customers come to you or you go to them.' },
      { q: 'What will improve conversions most?', a: 'Strong vehicle imagery, before-and-after proof, package explanations, and reviews that mention finish quality and professionalism all help enormously.' },
      { q: 'Is it suitable for premium ceramic or paint correction packages?', a: 'Yes. The tone is intentionally more premium and visual, which makes it a strong fit for higher-value detailing offers.' },
      { q: 'What should I customise first?', a: 'Update the imagery, package names, service options, and testimonials so the page reflects your exact detailing offer and market.' },
    ],
    formHeadline: 'Turn premium detailing interest into cleaner, better-quality enquiries.',
    formIntro: 'The form helps you capture the vehicle type, the service needed, and whether the lead wants interior work, correction, protection, or a presentation-focused detail.',
    formPoints: [
      { title: 'Useful for premium packages', text: 'Great when you need the page to support higher-value work and not feel cheap.' },
      { title: 'Strong for visual marketing', text: 'Ideal for photo-led ads, social content, and local search traffic backed by real vehicle imagery.' },
      { title: 'Easy to tailor by package or vehicle type', text: 'You can quickly customise the service list to match your actual detailing menu.' },
    ],
    formCardTitle: 'Request a detailing quote',
    formBadge: 'Premium vehicle form',
    serviceOptions: ['Interior detail', 'Paint correction', 'Ceramic protection', 'Pre-sale detail', 'Maintenance detail', 'Fleet or dealership enquiry'],
    formCta: 'SEND MY DETAILING ENQUIRY',
    formDisclaimer: 'Use the follow-up step to explain vehicle inspection requirements, package tiers, and whether pricing depends on vehicle size or paint condition.',
  },
  {
    slug: 'pressure-washing',
    label: 'Pressure Washing Quote',
    icon: '💦',
    secondaryIcon: '🏠',
    accent: '#0ea5e9',
    accentDark: '#0c4a6e',
    accentSoft: '#e0f2fe',
    glow: 'rgba(56,189,248,0.24)',
    badgeColor: '#bae6fd',
    logo: 'Fresh Flow Exterior Cleaning',
    logoTagline: 'Pressure washing, soft washing, and exterior surface cleaning',
    badge: 'Pressure washing • driveways • roofs • exteriors • soft wash services',
    headline: 'Pressure washing pages need to show visible transformation immediately.',
    subheadline: 'This version is built for driveway cleaning, house washing, roof and exterior soft washing, concrete and paving work, and the kind of surface-cleaning services that sell best when the visual outcome is obvious.',
    cta: 'REQUEST A WASHING QUOTE',
    responseLine: 'Strong for before-and-after marketing and local quote traffic.',
    heroVisualTagline: 'Exterior-clean result visual',
    visualHeadline: 'Use high-contrast before-and-after shots, surface cleaning imagery, or crew-on-site photos',
    heroChecks: [
      { title: 'Built for visual transformation selling', text: 'This page is designed to let exterior-cleaning businesses sell the visible difference their work creates.' },
      { title: 'Works for homes and commercial sites', text: 'The structure supports residential exteriors, driveways, roofs, and commercial cleaning work with equal clarity.' },
    ],
    highlights: [
      { title: 'Sell the visible clean-up result', text: 'Pressure washing buyers respond to obvious change, improved presentation, and care for surfaces, not gimmicky claims.' },
      { title: 'Support multiple surface types', text: 'Driveways, paths, exteriors, decks, fences, retaining walls, roofs, and commercial surfaces can all be positioned clearly.' },
      { title: 'Works well with local and seasonal campaigns', text: 'Ideal for pre-sale presentation, end-of-wet-season clean-ups, or regular property maintenance traffic.' },
    ],
    stats: [
      { value: 'Visible', label: 'Great for before-and-after proof and clean visual selling' },
      { value: 'Exterior', label: 'Useful for driveways, paths, walls, roofs, and facades' },
      { value: 'Local', label: 'Strong fit for suburb-targeted outdoor service campaigns' },
    ],
    sectionHeadline: 'Written for the surface-cleaning work customers actually book',
    sectionIntro: 'This is tailored for exterior cleaning businesses that win work through visible results, property presentation, and straightforward quoting.',
    services: [
      { icon: '🛣️', title: 'Driveways, paths, and concrete cleaning', text: 'Ideal for surface brightening, built-up grime, mould, oil marks, and improving first impressions from the street.' },
      { icon: '🏡', title: 'House washing and exterior soft washing', text: 'Great for walls, cladding, render, gutters, and exterior presentation work where care matters as much as the result.' },
      { icon: '🏢', title: 'Commercial and managed-site cleaning', text: 'Useful for shopfronts, common areas, body corporate work, and larger sites that need reliable exterior maintenance.' },
    ],
    differenceHeadline: 'Why this works for pressure washing businesses',
    differenceIntro: 'Exterior-cleaning buyers are drawn to clear transformation, safe methods, and confidence that surfaces will be handled properly. The page is built around that buying logic.',
    differentiators: [
      { title: 'Visual-first service messaging', text: 'The copy supports transformation, finish, and safe treatment of surfaces rather than generic contractor talk.' },
      { title: 'Flexible for high-pressure and soft-wash work', text: 'Useful whether the business handles tougher concrete cleaning or more delicate exterior and roof treatments.' },
      { title: 'Strong fit for property presentation offers', text: 'This template works especially well for pre-sale, seasonal tidy-up, and body corporate style campaigns.' },
    ],
    process: [
      { title: 'Show the transformation early', text: 'The hero and testimonial structure are designed to make the result feel immediate and obvious.' },
      { title: 'Clarify the exact surface or cleaning goal', text: 'This helps visitors know whether you are the right fit for their property and job type.' },
      { title: 'Capture site and access details', text: 'The form gathers enough context to quote properly and prepare the right equipment or method.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Before-and-after proof ready', text: 'This vertical gets much stronger with real transformation imagery and finished-surface shots.' },
      { icon: '🧼', title: 'Surface-safe positioning', text: 'Useful for communicating soft washing, appropriate methods, and care for different materials.' },
      { icon: '📍', title: 'Local property-service fit', text: 'Great for suburb traffic, pre-sale campaigns, and seasonal property maintenance leads.' },
    ],
    customerGroup: 'homeowners, property managers, and commercial site clients',
    testimonials: [
      { name: 'Kylie M.', meta: 'Driveway wash • Manly West', quote: 'The page made the result feel obvious before we even booked. The driveway came up dramatically better, and the whole job made the front of the house feel looked after again.' },
      { name: 'Adam J.', meta: 'Exterior house wash • Kelvin Grove', quote: 'It felt specific to exterior cleaning instead of generic trade copy. The quote process was easy and the finished result made the place look noticeably fresher.' },
      { name: 'Leah P.', meta: 'Commercial frontage clean • Spring Hill', quote: 'The messaging made it clear they handled managed sites and larger presentation jobs. The service was professional and the visual difference was exactly what we wanted.' },
    ],
    faqs: [
      { q: 'Can this page work for pressure washing and soft washing services?', a: 'Yes. The structure supports both approaches, and you can customise the wording depending on whether you focus more on tougher hard-surface work or softer exterior treatment.' },
      { q: 'What will improve conversions most?', a: 'Real before-and-after images, finished driveway and facade shots, suburb-based examples, and reviews that mention the visible result all help a lot.' },
      { q: 'Is this suitable for commercial exterior cleaning too?', a: 'Yes. The tone works well for commercial properties, managed sites, shopfronts, and common-area cleaning as well as residential jobs.' },
      { q: 'What should I customise first?', a: 'Update the service cards, imagery, service area, and testimonial examples so the page reflects the exact kinds of cleaning work you want to win.' },
    ],
    formHeadline: 'Capture exterior cleaning enquiries with a page that already shows the value.',
    formIntro: 'The form is built to gather the property type, the surface or area to be cleaned, and any access or timing details so your team can quote accurately.',
    formPoints: [
      { title: 'Great for visual service businesses', text: 'This template works best when paired with transformation photos and clear proof of results.' },
      { title: 'Useful for homes and commercial sites', text: 'You can support residential and managed property jobs without changing the structure much.' },
      { title: 'Ready to customise by service area', text: 'Swap in local coverage, image assets, and the surface categories you want to promote most.' },
    ],
    formCardTitle: 'Request a pressure washing quote',
    formBadge: 'Exterior-service form',
    serviceOptions: ['Driveway cleaning', 'House wash', 'Roof soft wash', 'Deck or fence clean', 'Commercial exterior wash', 'Other surface cleaning'],
    formCta: 'SEND MY WASHING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether pricing depends on square metres, contamination level, or site access and water availability.',
  },
  {
    slug: 'pest-control',
    label: 'Pest Control Quote',
    icon: '🐜',
    secondaryIcon: '🛡️',
    accent: '#059669',
    accentDark: '#064e3b',
    accentSoft: '#d1fae5',
    glow: 'rgba(74,222,128,0.22)',
    badgeColor: '#a7f3d0',
    logo: 'Shield Pest Control',
    logoTagline: 'Residential, commercial, and preventative pest treatments',
    badge: 'Pest control • termites • ants • spiders • rodents • prevention plans',
    headline: 'Pest control pages need to feel calm, trustworthy, and solution-focused.',
    subheadline: 'This version is built for residential and commercial pest services covering general treatments, termite work, inspections, rodent issues, recurring prevention plans, and the reassurance people want when there is a problem in their home or business.',
    cta: 'REQUEST A PEST QUOTE',
    responseLine: 'Strong for urgent concerns, annual plans, and local trust-based traffic.',
    heroVisualTagline: 'Protection-focused visual',
    visualHeadline: 'Use technician imagery, treatment visuals, or clean home and business settings',
    heroChecks: [
      { title: 'Built around reassurance and control', text: 'Pest control buyers want a business that feels calm, capable, and experienced, not one that sounds sensationalist.' },
      { title: 'Works for treatments and preventative plans', text: 'Support urgent issues and recurring maintenance or annual service plans within the same structure.' },
    ],
    highlights: [
      { title: 'Position the exact pest problems you solve', text: 'Ants, cockroaches, spiders, rodents, termites, and broader preventative treatments can all be framed clearly.' },
      { title: 'Sell reassurance, not hype', text: 'Customers want to know the problem will be handled professionally, safely, and without confusion.' },
      { title: 'Useful for residential and commercial clients', text: 'The structure suits homes, hospitality sites, managed properties, and workplaces with ongoing compliance needs.' },
    ],
    stats: [
      { value: 'Safe', label: 'Good for family, pet, and workplace reassurance messaging' },
      { value: 'Preventive', label: 'Strong for annual plans and repeat treatment schedules' },
      { value: 'Local', label: 'Useful for suburb and region-based pest demand campaigns' },
    ],
    sectionHeadline: 'Built for the pest issues customers actually want solved fast',
    sectionIntro: 'This is written for real pest-control businesses, with room for treatments, inspections, preventative services, and the trust signals that matter in this category.',
    services: [
      { icon: '🏠', title: 'General home pest treatments', text: 'Ideal for ants, spiders, cockroaches, silverfish, and the everyday pest concerns homeowners want resolved quickly.' },
      { icon: '🧱', title: 'Termite and inspection-related work', text: 'Useful for termite treatments, monitoring, pre-purchase inspections, and higher-trust structural pest concerns.' },
      { icon: '🏢', title: 'Commercial and ongoing prevention plans', text: 'Great for hospitality, offices, managed properties, and businesses that need regular service or compliance support.' },
    ],
    differenceHeadline: 'Why this works for pest control businesses',
    differenceIntro: 'People book pest services because they want the issue handled properly and discreetly. The page needs to project confidence, safety, and control without sounding alarmist.',
    differentiators: [
      { title: 'Reassurance-first tone', text: 'The messaging is structured to calm the customer and make the service feel controlled, professional, and easy to engage.' },
      { title: 'Good for urgent and ongoing services', text: 'This works whether the lead needs fast help now or wants a maintenance plan to prevent repeat issues.' },
      { title: 'Supports family and workplace trust', text: 'There is room to explain treatment approach, safety considerations, and what happens next in a clear way.' },
    ],
    process: [
      { title: 'Acknowledge the problem without overdoing it', text: 'The page speaks to real concerns without slipping into cheesy fear-based copy.' },
      { title: 'Clarify the service type quickly', text: 'Visitors can recognise whether you handle the exact pest issue or treatment they need.' },
      { title: 'Capture enough detail to respond properly', text: 'The form helps your team prioritise the lead and recommend the right next step.' },
    ],
    trustPoints: [
      { icon: '🧾', title: 'Treatment-plan ready', text: 'Useful for outlining what is covered, follow-up timing, and any ongoing protection plan options.' },
      { icon: '🏡', title: 'Family-home reassurance', text: 'Important for buyers who care about children, pets, and safe treatment practices.' },
      { icon: '📍', title: 'Local response fit', text: 'Strong for local service areas where trust and repeat prevention work drive growth.' },
    ],
    customerGroup: 'homeowners, tenants, businesses, and property managers',
    testimonials: [
      { name: 'Emily S.', meta: 'General pest treatment • The Gap', quote: 'The page made the business feel calm and professional, which mattered because we wanted help without the drama. The team explained everything clearly and handled the issue properly.' },
      { name: 'Tom W.', meta: 'Termite inspection • Kenmore', quote: 'We were looking for someone we could trust in a more serious situation. The site felt credible and the inspection process was exactly as professional as it sounded.' },
      { name: 'Nadia P.', meta: 'Commercial prevention plan • Newstead', quote: 'The enquiry flow made it easy to explain what we needed for an ongoing site service. The communication was sharp and the business felt well run from the start.' },
    ],
    faqs: [
      { q: 'Can this page work for both general pest treatments and termite services?', a: 'Yes. The layout supports both everyday pest concerns and more specialised termite or inspection-related work without feeling forced.' },
      { q: 'What will improve the page most?', a: 'Local reviews, treatment-process clarity, trust signals around safety, and clear service categories all help. Photos of technicians and branded vehicles can help too.' },
      { q: 'Is this suitable for commercial pest plans?', a: 'Yes. The structure works well for recurring service plans, compliance-focused work, and regular site treatments as well as residential jobs.' },
      { q: 'What should I customise first?', a: 'Update the pests you treat most often, local service area, treatment approach, and testimonials so the page reflects your real offer and market.' },
    ],
    formHeadline: 'Collect pest-control enquiries with clearer context and less back-and-forth.',
    formIntro: 'The form helps you capture the pest issue, property type, location, and urgency so your team can recommend the right treatment or inspection path.',
    formPoints: [
      { title: 'Useful for urgent and preventative work', text: 'Handle immediate issues and ongoing protection plans through one practical enquiry flow.' },
      { title: 'Supports home and commercial leads', text: 'The structure is flexible enough for families, landlords, offices, and managed properties.' },
      { title: 'Easy to localise', text: 'Add your treatment categories, local coverage, and proof points and the page becomes highly usable quickly.' },
    ],
    formCardTitle: 'Request a pest-control quote',
    formBadge: 'Protection-focused form',
    serviceOptions: ['General pest treatment', 'Termite inspection', 'Termite treatment', 'Rodent issue', 'Commercial service plan', 'Annual prevention service'],
    formCta: 'SEND MY PEST ENQUIRY',
    formDisclaimer: 'Use the follow-up sequence to explain treatment timing, preparation steps, and any pet or child safety guidance that applies.',
  },
  {
    slug: 'glazing',
    label: 'Glazing / Glass Repair Quote',
    icon: '🪟',
    secondaryIcon: '🔨',
    accent: '#0891b2',
    accentDark: '#083344',
    accentSoft: '#cffafe',
    glow: 'rgba(34,211,238,0.22)',
    badgeColor: '#a5f3fc',
    logo: 'Clearview Glass',
    logoTagline: 'Glass repair, replacements, glazing, and emergency make-safe work',
    badge: 'Glass repair • glazing • windows • shopfronts • mirrors • splashbacks',
    headline: 'Glass and glazing pages should feel precise, professional, and safe.',
    subheadline: 'This version is built for residential and commercial glazing businesses handling broken glass, replacements, mirrors, shower screens, shopfronts, splashbacks, and urgent make-safe jobs where trust and clarity matter immediately.',
    cta: 'REQUEST A GLASS QUOTE',
    responseLine: 'Useful for emergency jobs, measured replacements, and shopfront work.',
    heroVisualTagline: 'Glass repair visual',
    visualHeadline: 'Use clean install imagery, technicians on site, or finished glasswork photos',
    heroChecks: [
      { title: 'Built for precision and safety', text: 'The page positions the business as careful, professional, and suitable for both repair and measured replacement work.' },
      { title: 'Works for residential and commercial glazing', text: 'Useful for homes, offices, retail, and property managers with a broad mix of glass-related jobs.' },
    ],
    highlights: [
      { title: 'Show the kinds of glass work you handle', text: 'Broken window repairs, shopfronts, mirrors, shower screens, splashbacks, and replacement glazing all deserve clear positioning.' },
      { title: 'Support urgent and planned work', text: 'The structure works for emergency make-safe jobs as well as measured installations and custom glass replacement.' },
      { title: 'Good fit for commercial credibility', text: 'Retail and commercial glazing buyers need to know you can respond cleanly and professionally.' },
    ],
    stats: [
      { value: 'Repair', label: 'Strong for breakages, urgent replacements, and make-safe work' },
      { value: 'Measure', label: 'Useful for custom installs and quoted replacement jobs' },
      { value: 'Commercial', label: 'Good fit for retail fronts, offices, and managed sites' },
    ],
    sectionHeadline: 'Built for the glazing work customers actually need handled properly',
    sectionIntro: 'This page is written for real glass and glazing services, where professionalism, safety, and clarity matter just as much as speed.',
    services: [
      { icon: '🏠', title: 'Home glass repairs and replacements', text: 'Ideal for windows, doors, mirrors, shower screens, and household breakages that need a tidy, reliable solution.' },
      { icon: '🏬', title: 'Commercial glazing and shopfront work', text: 'Useful for retail fronts, office spaces, managed buildings, and businesses that need a professional response and finish.' },
      { icon: '📐', title: 'Custom glass and measured installs', text: 'Great for splashbacks, mirrors, cut-to-size replacements, and jobs where detail and fit matter.' },
    ],
    differenceHeadline: 'Why this works for glazing businesses',
    differenceIntro: 'Glazing buyers want a service that feels precise, trustworthy, and safe. The page needs to reflect careful work and clean execution instead of sounding like a generic trade landing page.',
    differentiators: [
      { title: 'Precision-first tone', text: 'The copy supports measured work, tidy installs, and professional handling of fragile or safety-related materials.' },
      { title: 'Useful for urgent and custom jobs', text: 'This structure works for emergency repairs as well as more considered quoting and replacement work.' },
      { title: 'Strong fit for commercial trust', text: 'Retail and business clients often care about responsiveness and presentation, which this template handles well.' },
    ],
    process: [
      { title: 'Signal safe, professional handling', text: 'The first impression is designed to make the business feel competent and trustworthy on site.' },
      { title: 'Clarify the glass or glazing need', text: 'The service sections help visitors see whether you handle the exact type of job they need.' },
      { title: 'Gather useful scope and access details', text: 'The form captures enough information to quote, measure, or prioritise emergency response properly.' },
    ],
    trustPoints: [
      { icon: '🛡️', title: 'Safety-aware positioning', text: 'Useful for make-safe work, breakage response, and careful on-site conduct messaging.' },
      { icon: '🏪', title: 'Commercial frontage fit', text: 'Strong for businesses that need clean, professional shopfront or office glazing support.' },
      { icon: '📍', title: 'Local repair confidence', text: 'Works well for suburb-level search traffic where the buyer wants a nearby, trustworthy glazing provider.' },
    ],
    customerGroup: 'homeowners, retailers, property managers, and commercial clients',
    testimonials: [
      { name: 'Lisa T.', meta: 'Broken window replacement • Nundah', quote: 'The page felt professional and specific to glass work, which gave us confidence straight away. The replacement was handled neatly and the whole process felt well organised.' },
      { name: 'Marcus D.', meta: 'Shopfront glass quote • Fortitude Valley', quote: 'We needed a glazing company that could respond quickly without feeling slapdash. The site made them feel credible and the service matched that impression.' },
      { name: 'Elena P.', meta: 'Shower screen replacement • Holland Park', quote: 'It was easy to explain what we needed and the page made the business feel precise and experienced. The final result was clean and exactly what we wanted.' },
    ],
    faqs: [
      { q: 'Can this page work for emergency breakages and measured replacement jobs?', a: 'Yes. It is built to support both urgent make-safe work and more considered quoting for custom or planned replacements.' },
      { q: 'What will strengthen the page most?', a: 'Use finished glasswork imagery, team photos, commercial project examples, and reviews that mention response time, neatness, and quality of the final install.' },
      { q: 'Is it suitable for commercial glazing too?', a: 'Yes. The tone and service structure work well for retail, office, and managed property glazing as well as residential jobs.' },
      { q: 'What should I customise first?', a: 'Update the service list, imagery, response messaging, and local area coverage so the page reflects your exact mix of repair, replacement, and install work.' },
    ],
    formHeadline: 'Capture glazing and glass-repair enquiries with clearer scope from the start.',
    formIntro: 'The form is designed to collect the job type, property type, location, and enough detail to quote or triage the work properly.',
    formPoints: [
      { title: 'Useful for repairs and measured installs', text: 'Handle urgent and planned jobs without changing the structure much.' },
      { title: 'Strong for residential and commercial traffic', text: 'The page works for homeowners and business clients with minimal tailoring.' },
      { title: 'Easy to localise and brand', text: 'Add project photos, local service areas, and your exact glazing categories to make it production-ready quickly.' },
    ],
    formCardTitle: 'Request a glass quote',
    formBadge: 'Repair-and-replace form',
    serviceOptions: ['Broken window repair', 'Glass replacement', 'Shopfront glazing', 'Shower screen', 'Mirror or splashback', 'Emergency make-safe'],
    formCta: 'SEND MY GLASS ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether photos help quoting, whether after-hours work is available, and what information helps with accurate replacement sizing.',
  },
  {
    slug: 'roofing',
    label: 'Roofing Service Quote',
    icon: '🏠',
    secondaryIcon: '🔨',
    accent: '#92400e',
    accentDark: '#451a03',
    accentSoft: '#fef3c7',
    glow: 'rgba(251,191,36,0.22)',
    badgeColor: '#fde68a',
    logo: 'Summit Roofing',
    logoTagline: 'Roof repairs, restoration, replacement, and maintenance',
    badge: 'Roofing • repairs • restorations • leaks • gutters • maintenance',
    headline: 'Roofing pages need to feel solid, local, and trustworthy from the first screen.',
    subheadline: 'This version is built for roof repairs, leak response, restorations, replacements, gutter work, inspections, and the kind of roofing enquiries that need visible proof and practical trust signals before a quote is requested.',
    cta: 'REQUEST A ROOFING QUOTE',
    responseLine: 'Strong for repair, restoration, and inspection-focused roofing traffic.',
    heroVisualTagline: 'Roofing visual',
    visualHeadline: 'Use roofline shots, crew-on-site imagery, or restoration before-and-after photos',
    heroChecks: [
      { title: 'Built for roofing-specific trust', text: 'The message is shaped around leak concerns, workmanship, safety, and visible project outcomes.' },
      { title: 'Works for repairs and larger project quotes', text: 'Use it for urgent roof issues, planned restorations, and higher-value replacement jobs alike.' },
    ],
    highlights: [
      { title: 'Position the roofing services customers search for', text: 'Leaks, repairs, restorations, replacements, gutters, and preventative maintenance can all be framed clearly.' },
      { title: 'Good fit for visible project proof', text: 'Roofing sells well with project imagery, completed works, and strong suburb-based examples.' },
      { title: 'Build confidence around access and workmanship', text: 'The copy gives room for trust signals that matter in high-risk, high-value exterior work.' },
    ],
    stats: [
      { value: 'Repair', label: 'Good for leak, storm, and urgent roof issues' },
      { value: 'Restore', label: 'Strong for repaint, reseal, and presentation upgrades' },
      { value: 'Replace', label: 'Useful for larger-scope roofing projects and quotes' },
    ],
    sectionHeadline: 'Built for the roofing jobs customers are actually ready to discuss',
    sectionIntro: 'This template is written for real roofing businesses, where visible trust, site professionalism, and clear scoping matter before anyone commits to an inspection or quote.',
    services: [
      { icon: '🌧️', title: 'Leak repairs and urgent roof issues', text: 'Ideal for storm damage, active leaks, damaged tiles or sheets, flashing problems, and the jobs customers want addressed quickly.' },
      { icon: '🧱', title: 'Roof restorations and maintenance work', text: 'Useful for cleaning, resealing, repainting, preventative upkeep, and helping older roofs present and perform better.' },
      { icon: '🏗️', title: 'Replacements, gutters, and larger roofing projects', text: 'Great for full replacements, major repair works, guttering, and jobs where buyers want a more serious quoting process.' },
    ],
    differenceHeadline: 'Why this works for roofing businesses',
    differenceIntro: 'Roofing buyers are often comparing trust, workmanship, and whether the contractor feels organised enough to handle bigger exterior work safely and properly.',
    differentiators: [
      { title: 'Roofing-specific trust tone', text: 'The page supports site safety, exterior workmanship, weather-related concerns, and practical outcomes without overdoing the pitch.' },
      { title: 'Good for repair and restoration demand', text: 'It handles both urgent problem-solving and more considered upgrade or restoration work well.' },
      { title: 'Strong fit for visual proof', text: 'Project shots, roofline imagery, and before-and-after restoration examples make this template substantially stronger.' },
    ],
    process: [
      { title: 'Establish confidence in the first scroll', text: 'The hero and support sections are designed to make the business feel safe, capable, and experienced.' },
      { title: 'Clarify whether it is a repair, restore, or replace job', text: 'This helps visitors know the business is the right fit for their roof issue or project.' },
      { title: 'Capture access and scope details', text: 'The form gathers enough information to decide whether an inspection, quote, or urgent follow-up is needed.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Project-photo ready', text: 'Roofing converts better with real before-and-after proof and completed site imagery.' },
      { icon: '🪪', title: 'Compliance and insurance fit', text: 'Useful for licences, insured work, warranty positioning, and roof-work confidence signals.' },
      { icon: '🏘️', title: 'Local roofing credibility', text: 'Strong for suburb-targeted campaigns where trust and reputation drive the lead.' },
    ],
    customerGroup: 'homeowners, strata contacts, and property managers',
    testimonials: [
      { name: 'Paul N.', meta: 'Roof leak repair • Carindale', quote: 'The page felt like a real roofing company and made it easy to trust them with a bigger issue. The response was clear, the inspection was straightforward, and the repair was handled professionally.' },
      { name: 'Jenna R.', meta: 'Roof restoration quote • Tarragindi', quote: 'We wanted a page that felt specific to roofing, not generic trade copy. This did exactly that, and the final restoration made the whole house look better.' },
      { name: 'Simon T.', meta: 'Gutter and roof maintenance • Ashgrove', quote: 'The quote flow was simple and the service categories matched the kind of work we needed. It felt credible and practical from the start.' },
    ],
    faqs: [
      { q: 'Can this page work for repairs and full restorations?', a: 'Yes. It is structured to support urgent roof issues, restoration work, and larger replacement-style quotes without confusing the visitor.' },
      { q: 'What should I add to make it stronger?', a: 'Real roof imagery, before-and-after restoration work, local project examples, and proof around insurance, warranties, or roof-specific expertise all help.' },
      { q: 'Is this suitable for guttering and associated roof work too?', a: 'Yes. The service sections give you room to position gutters, flashing, and related roofline work naturally.' },
      { q: 'What should I customise first?', a: 'Update the service list, photo block, trust points, and local area examples so the page reflects the exact roofing jobs you want most.' },
    ],
    formHeadline: 'Collect roofing enquiries with enough detail to quote or inspect properly.',
    formIntro: 'The form is designed to gather the property type, roof concern, and any timing or access details so your team can decide the right next step quickly.',
    formPoints: [
      { title: 'Useful for urgent and planned roofing work', text: 'Handle leak repairs, maintenance, and larger project enquiries through one structure.' },
      { title: 'Strong for trust-driven local marketing', text: 'Ideal for suburb campaigns, referrals, and Google traffic where credibility matters heavily.' },
      { title: 'Easy to tailor to your roofing niche', text: 'Swap in tile, metal, restoration, or gutter-specific language depending on the work you sell most.' },
    ],
    formCardTitle: 'Request a roofing quote',
    formBadge: 'Roofing-ready form',
    serviceOptions: ['Roof leak repair', 'Roof restoration', 'Roof replacement', 'Gutter work', 'Inspection and maintenance', 'Storm or urgent issue'],
    formCta: 'SEND MY ROOFING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether photos help first, whether a site inspection is required, and how urgent leak callouts are prioritised.',
  },
  {
    slug: 'removals',
    label: 'Removalist / Moving Quote',
    icon: '📦',
    secondaryIcon: '🚚',
    accent: '#2563eb',
    accentDark: '#1e3a8a',
    accentSoft: '#dbeafe',
    glow: 'rgba(96,165,250,0.22)',
    badgeColor: '#bfdbfe',
    logo: 'Blue Route Removals',
    logoTagline: 'Home, office, interstate, and packing support',
    badge: 'Removalists • house moves • office moves • packing • interstate • storage',
    headline: 'Moving pages need to feel organised, reassuring, and easy to book.',
    subheadline: 'This version is built for home moves, apartment relocations, office moves, packing services, interstate jobs, and the kind of moving enquiries where people want clarity, confidence, and less stress.',
    cta: 'REQUEST A MOVING QUOTE',
    responseLine: 'Strong for residential, office, and higher-stress relocation traffic.',
    heroVisualTagline: 'Moving-service visual',
    visualHeadline: 'Use truck, team, packing, or moving-day imagery that feels organised and professional',
    heroChecks: [
      { title: 'Built around reducing stress', text: 'Removalists sell peace of mind, planning, and careful handling more than anything else.' },
      { title: 'Works for small and larger relocations', text: 'Useful for apartments, family homes, office moves, and interstate or storage-related services.' },
    ],
    highlights: [
      { title: 'Support the moving services people actually need', text: 'House moves, packing help, office relocations, interstate jobs, storage coordination, and heavier-item transport can all be presented clearly.' },
      { title: 'Good fit for emotional buying situations', text: 'Moves are stressful, so the page is written to feel calming, organised, and easy to trust.' },
      { title: 'Encourage better move briefs', text: 'The quote flow helps customers explain property type, dates, access, and inventory complexity early.' },
    ],
    stats: [
      { value: 'Home', label: 'Useful for family moves, apartments, and downsizing jobs' },
      { value: 'Office', label: 'Strong for business relocations and site moves' },
      { value: 'Interstate', label: 'Great when you want to support longer-distance quotes too' },
    ],
    sectionHeadline: 'Written for the moving jobs customers are already stressed about',
    sectionIntro: 'This is built for removalist businesses that need the page to reduce anxiety, show organisation, and make the quote process feel manageable.',
    services: [
      { icon: '🏡', title: 'Home and apartment moves', text: 'Ideal for local residential moves, apartment access issues, family relocations, and buyers looking for a dependable moving team.' },
      { icon: '🧳', title: 'Packing, unpacking, and storage support', text: 'Useful for clients who want help beyond just lifting boxes, including packing materials, wrapping, and staged or stored moves.' },
      { icon: '🏢', title: 'Office, commercial, and longer-distance moves', text: 'Great for businesses, managed relocations, and interstate or multi-stage jobs that need more planning.' },
    ],
    differenceHeadline: 'Why this works for removalists',
    differenceIntro: 'Moving customers are not just buying labour. They are buying confidence that the move will be handled carefully, on time, and with less chaos. The page is designed around that.',
    differentiators: [
      { title: 'Stress-reducing tone', text: 'The messaging supports calm communication, planning, and careful handling instead of bargain-basement sales language.' },
      { title: 'Good for residential and business relocations', text: 'The structure is broad enough to support homes, offices, and more complicated moves without feeling cluttered.' },
      { title: 'Strong fit for quote quality', text: 'The form encourages customers to provide better moving details so your team can respond with more confidence.' },
    ],
    process: [
      { title: 'Make the service feel organised immediately', text: 'The first sections signal planning, care, and dependable execution rather than last-minute chaos.' },
      { title: 'Clarify the move type and complexity', text: 'Visitors can see whether you handle the kind of move they need before they enquire.' },
      { title: 'Capture move-specific details', text: 'The form helps collect moving date, locations, access needs, and service extras like packing or storage.' },
    ],
    trustPoints: [
      { icon: '📋', title: 'Planning-focused trust', text: 'Useful for checklists, process explanations, and moving-day confidence builders.' },
      { icon: '📦', title: 'Care-for-belongings positioning', text: 'Important for buyers who worry about damage, fragile items, and stressful logistics.' },
      { icon: '📍', title: 'Local and interstate flexibility', text: 'Good fit for businesses that handle both local suburbs and longer-distance routes.' },
    ],
    customerGroup: 'households, office managers, and relocating businesses',
    testimonials: [
      { name: 'Nicole J.', meta: 'House move • Camp Hill to Bulimba', quote: 'The page immediately felt organised and trustworthy, which mattered because moving is stressful enough already. The quote process was smooth and the move itself was handled professionally.' },
      { name: 'David P.', meta: 'Office relocation • Fortitude Valley', quote: 'We needed a mover who looked like they could handle a business move properly. The site gave that impression straight away, and the actual move was just as organised.' },
      { name: 'Harriet S.', meta: 'Packing and move package • New Farm', quote: 'It was clear they offered more than just a truck and two people. The page helped us understand the service properly and made booking feel much easier.' },
    ],
    faqs: [
      { q: 'Can this page work for home moves and office relocations?', a: 'Yes. It is designed to support both residential and commercial moves, and can be tailored further depending on which type of work you prioritise most.' },
      { q: 'What will make it stronger?', a: 'Real team photos, truck imagery, process explanations, suburb coverage, and reviews that mention care, punctuality, and communication all help significantly.' },
      { q: 'Is this suitable for interstate and storage-related jobs too?', a: 'Yes. The structure gives you room to position longer-distance moves, staged moves, and packing or storage support without feeling crowded.' },
      { q: 'What should I customise first?', a: 'Update the service list, truck or team imagery, quote form options, and local or route coverage so the page matches your actual moving offer.' },
    ],
    formHeadline: 'Capture moving enquiries with the details needed to quote properly.',
    formIntro: 'The form helps you gather the move type, locations, likely date, and any packing or access issues so your team can respond with a realistic quote and next step.',
    formPoints: [
      { title: 'Good for home and office moves', text: 'Support a wide range of relocation jobs without changing the structure much.' },
      { title: 'Useful for higher-quality quote requests', text: 'Better upfront detail means better quoting and fewer wasted callbacks.' },
      { title: 'Easy to tailor by service scope', text: 'Add packing, storage, piano moves, interstate routes, or whatever matters most to your business.' },
    ],
    formCardTitle: 'Request a moving quote',
    formBadge: 'Relocation-ready form',
    serviceOptions: ['Home move', 'Apartment move', 'Office relocation', 'Packing service', 'Interstate move', 'Storage-related move'],
    formCta: 'SEND MY MOVING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether you quote from inventory, property size, travel distance, or a combination of move-day factors.',
  },
  {
    slug: 'appliance-repair',
    label: 'Appliance Repair Quote',
    icon: '🧰',
    secondaryIcon: '🔌',
    accent: '#7c3aed',
    accentDark: '#4c1d95',
    accentSoft: '#ede9fe',
    glow: 'rgba(167,139,250,0.22)',
    badgeColor: '#ddd6fe',
    logo: 'Prime Appliance Service',
    logoTagline: 'Appliance diagnostics, repairs, installs, and maintenance',
    badge: 'Appliance repair • ovens • dishwashers • washers • fridges • diagnostics',
    headline: 'Appliance repair pages should feel practical, skilled, and straightforward.',
    subheadline: 'This version is built for technicians and repair businesses handling ovens, dishwashers, fridges, washers, dryers, and general appliance diagnostics where people want a clear path to help without the runaround.',
    cta: 'REQUEST AN APPLIANCE QUOTE',
    responseLine: 'Strong for household repairs, urgent breakdowns, and local diagnostics traffic.',
    heroVisualTagline: 'Repair-service visual',
    visualHeadline: 'Use technician imagery, in-home service visuals, or appliance repair shots',
    heroChecks: [
      { title: 'Built for practical household service work', text: 'The page is grounded in diagnosis, repair, and straightforward service rather than generic sales language.' },
      { title: 'Works for repair and install-related enquiries', text: 'Support breakdowns, fault diagnosis, replacements, and servicing through one structure.' },
    ],
    highlights: [
      { title: 'Position the appliance categories clearly', text: 'Ovens, dishwashers, cooktops, fridges, washing machines, dryers, and related service categories can all be presented cleanly.' },
      { title: 'Reduce friction for stressed households', text: 'When something breaks, people want fast clarity, not a confusing quote path. The page is built around that.' },
      { title: 'Encourage better fault descriptions', text: 'The form helps customers explain the appliance type and issue so your team can respond with more context.' },
    ],
    stats: [
      { value: 'Repair', label: 'Great for breakdowns and fault diagnosis enquiries' },
      { value: 'Home', label: 'Useful for household appliance issues and local service demand' },
      { value: 'Booked', label: 'Strong for scheduled visits and repeat service relationships' },
    ],
    sectionHeadline: 'Written for the appliance problems customers actually need fixed',
    sectionIntro: 'This template is designed for in-home appliance repair and related service businesses, with messaging that feels practical, capable, and easy to engage quickly.',
    services: [
      { icon: '🍽️', title: 'Kitchen appliance repairs', text: 'Ideal for ovens, cooktops, rangehoods, dishwashers, and the appliances people rely on every day in the kitchen.' },
      { icon: '🧺', title: 'Laundry appliance repairs', text: 'Useful for washing machines, dryers, and the household breakdowns that tend to create immediate stress and urgency.' },
      { icon: '🧪', title: 'Fault diagnosis and service support', text: 'Great for jobs where the issue is not yet fully understood and the customer needs expert help to identify the next step.' },
    ],
    differenceHeadline: 'Why this works for appliance repair businesses',
    differenceIntro: 'Appliance repair buyers want competence and convenience. They need to feel like they are contacting a business that knows the issue, values their time, and can help without making things harder.',
    differentiators: [
      { title: 'Practical repair-first tone', text: 'The language is designed to feel skilled and straightforward, which suits repair services much better than generic lead-gen copy.' },
      { title: 'Good for diagnosis-driven enquiries', text: 'It works well when the customer only knows the symptoms and needs help identifying the real issue.' },
      { title: 'Useful for repeat household service work', text: 'This page can support ongoing trust and repeat bookings as customers come back with future appliance issues.' },
    ],
    process: [
      { title: 'Make the service feel capable fast', text: 'The first screen helps the business feel like a practical repair specialist rather than a generic local service.' },
      { title: 'Clarify the appliance and likely issue', text: 'The service sections and form help visitors explain what has gone wrong before the callback.' },
      { title: 'Capture enough context to book intelligently', text: 'The form gives your team the information needed to prepare parts, time, and likely next steps.' },
    ],
    trustPoints: [
      { icon: '🏠', title: 'Household-service trust', text: 'Important for buyers who want someone competent, punctual, and professional in their home.' },
      { icon: '🔧', title: 'Diagnosis-ready positioning', text: 'Useful when much of the work starts with symptoms rather than a fully understood fault.' },
      { icon: '📍', title: 'Local repair demand fit', text: 'Strong for suburb search traffic and local breakdown-related service campaigns.' },
    ],
    customerGroup: 'households, landlords, and local property managers',
    testimonials: [
      { name: 'Georgia F.', meta: 'Dishwasher repair • Coopers Plains', quote: 'The page felt like a real repair business, not a generic local service site. It was easy to explain the issue and the technician turned up knowing exactly what to look for.' },
      { name: 'Mark R.', meta: 'Oven fault diagnosis • Ferny Hills', quote: 'We did not know if the oven could be fixed or not. The site made the service feel straightforward and the diagnosis process was exactly as clear as promised.' },
      { name: 'Leanne P.', meta: 'Washing machine repair • Paddington', quote: 'The enquiry process was simple, the communication was solid, and the repair saved us from replacing the machine. The page felt practical and trustworthy from the start.' },
    ],
    faqs: [
      { q: 'Can this page work for multiple appliance types?', a: 'Yes. It is built to support a range of common household appliance categories, and you can easily tailor the service list to the brands or machines you handle most.' },
      { q: 'What will improve conversions most?', a: 'Clear appliance categories, local reviews, technician imagery, and proof that you handle diagnosis as well as repairs all strengthen the page.' },
      { q: 'Is it suitable for installations too?', a: 'Yes, if installation or replacement support is part of your service mix. The structure is flexible enough to include that without losing the repair-first focus.' },
      { q: 'What should I customise first?', a: 'Update the appliance categories, service area, imagery, and testimonials so the page reflects the exact repair work you want to attract.' },
    ],
    formHeadline: 'Capture appliance repair enquiries with enough detail to diagnose the next step.',
    formIntro: 'The form helps you collect the appliance type, likely fault, location, and urgency so your team can respond with a more useful first call or booking option.',
    formPoints: [
      { title: 'Good for breakdown-driven traffic', text: 'Useful when the customer is actively trying to solve a household problem now.' },
      { title: 'Supports diagnosis and booked repair work', text: 'The structure works whether the issue is known or still needs troubleshooting.' },
      { title: 'Easy to tune by appliance category', text: 'Swap in the exact appliances and brands you service most to improve fit quickly.' },
    ],
    formCardTitle: 'Request an appliance repair quote',
    formBadge: 'Repair-ready form',
    serviceOptions: ['Oven or cooktop repair', 'Dishwasher repair', 'Fridge repair', 'Washing machine repair', 'Dryer repair', 'General appliance diagnosis'],
    formCta: 'SEND MY APPLIANCE ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain what model or brand details help, whether photos are useful, and whether callout or diagnosis fees apply before repair approval.',
  },
  {
    slug: 'flooring',
    label: 'Flooring Quote',
    icon: '🪵',
    secondaryIcon: '📐',
    accent: '#a16207',
    accentDark: '#422006',
    accentSoft: '#fef3c7',
    glow: 'rgba(251,191,36,0.22)',
    badgeColor: '#fde68a',
    logo: 'True Grain Flooring',
    logoTagline: 'Timber, hybrid, laminate, vinyl, and commercial flooring installs',
    badge: 'Flooring • timber • hybrid • vinyl • laminate • installs and upgrades',
    headline: 'Flooring pages should feel premium, precise, and finish-focused.',
    subheadline: 'This version is built for flooring businesses quoting timber, hybrid, laminate, vinyl, carpet replacement, subfloor prep, and commercial installations where finish quality and project confidence drive the sale.',
    cta: 'REQUEST A FLOORING QUOTE',
    responseLine: 'Strong for renovation traffic, fit-out work, and finish-led residential quotes.',
    heroVisualTagline: 'Floor finish visual',
    visualHeadline: 'Use finished floor imagery, install shots, or room transformation photos',
    heroChecks: [
      { title: 'Built for finish-led buying decisions', text: 'Flooring buyers respond to visual quality, confidence in the install, and clarity about what suits the space.' },
      { title: 'Works for homes and commercial spaces', text: 'Support residential upgrades, full-home projects, retail fit-outs, and office flooring work within one structure.' },
    ],
    highlights: [
      { title: 'Show the flooring categories clearly', text: 'Timber, hybrid, laminate, vinyl, carpet replacement, and commercial flooring options can all be framed cleanly.' },
      { title: 'Position the project outcome', text: 'Customers want a better-looking, more durable, more practical floor, not vague contractor language.' },
      { title: 'Good fit for renovation and fit-out traffic', text: 'The page works well when the buyer is already planning an upgrade and needs a business that feels capable and polished.' },
    ],
    stats: [
      { value: 'Design', label: 'Useful for style-conscious flooring and renovation buyers' },
      { value: 'Install', label: 'Strong for replacement, fit-out, and new-floor installs' },
      { value: 'Finish', label: 'Built to support quality-led and detail-led sales' },
    ],
    sectionHeadline: 'Written for the flooring projects customers are ready to improve',
    sectionIntro: 'This template is tailored for flooring businesses selling upgrades, replacements, and finish quality, with copy that feels more premium and more relevant than generic trade messaging.',
    services: [
      { icon: '🏡', title: 'Residential flooring upgrades', text: 'Ideal for homes needing timber, hybrid, laminate, vinyl, or carpet replacement with a better finish and cleaner install experience.' },
      { icon: '🏢', title: 'Commercial and fit-out flooring work', text: 'Useful for offices, retail, display spaces, and jobs where durability and presentation both matter.' },
      { icon: '🧱', title: 'Subfloor prep and replacement projects', text: 'Great for jobs that need more than a simple surface swap, including levelling, removal, and complete flooring refreshes.' },
    ],
    differenceHeadline: 'Why this works for flooring businesses',
    differenceIntro: 'Flooring is a visual, finish-driven service. The page needs to feel clean, measured, and premium enough that the customer trusts both the advice and the workmanship.',
    differentiators: [
      { title: 'Finish-focused tone', text: 'The messaging supports quality, product suitability, and workmanship rather than generic local-service fluff.' },
      { title: 'Good for higher-consideration quoting', text: 'This structure works well when the buyer is comparing materials, finish level, and whether the business feels professional enough to trust in their space.' },
      { title: 'Strong fit for portfolio-led selling', text: 'Real install photos, room scenes, and project shots make this template significantly stronger.' },
    ],
    process: [
      { title: 'Make the page feel premium immediately', text: 'The hero and support sections are designed to mirror the quality you want buyers to expect in the finished floor.' },
      { title: 'Clarify material and project type', text: 'Visitors can quickly see whether you handle the flooring style and project scope they need.' },
      { title: 'Capture the details that affect quoting', text: 'The form helps collect property type, room scope, flooring preference, and timing so your team can respond more accurately.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Portfolio-friendly layout', text: 'Flooring sells well with room visuals, close-up finish shots, and project examples.' },
      { icon: '📏', title: 'Measurement and scope fit', text: 'Useful for jobs where site measure, area size, and prep requirements affect the quote significantly.' },
      { icon: '🏠', title: 'Renovation-ready positioning', text: 'Strong for homeowners and fit-out clients already planning an upgrade.' },
    ],
    customerGroup: 'homeowners, renovators, and commercial fit-out clients',
    testimonials: [
      { name: 'Erin W.', meta: 'Hybrid flooring install • Chapel Hill', quote: 'The page felt more premium than most trade sites we looked at. It made the business feel design-aware and professional, and the finished floor completely changed the space.' },
      { name: 'Lewis P.', meta: 'Commercial flooring quote • Teneriffe', quote: 'We needed a flooring company that felt organised and credible for a larger fit-out. The site gave that impression straight away, and the quoting process was smooth.' },
      { name: 'Carla M.', meta: 'Timber floor replacement • Hawthorne', quote: 'The service list, visuals, and enquiry flow all felt relevant to what we were trying to achieve. It felt like a business that understood finish, not just labour.' },
    ],
    faqs: [
      { q: 'Can this page work for different flooring types?', a: 'Yes. It is built to support multiple flooring categories, and you can tailor the material language depending on whether you want to lead with timber, hybrid, vinyl, laminate, or commercial flooring.' },
      { q: 'What makes the page stronger?', a: 'Real project imagery, room photos, before-and-after installs, product examples, and reviews that mention finish quality all improve this template significantly.' },
      { q: 'Is this suitable for commercial flooring work too?', a: 'Yes. The structure supports offices, retail, and fit-out projects as well as residential upgrades.' },
      { q: 'What should I customise first?', a: 'Update the material categories, visuals, service area, and testimonials so the page reflects the kinds of flooring projects you want most.' },
    ],
    formHeadline: 'Capture flooring enquiries with enough detail to quote confidently.',
    formIntro: 'The form is built to collect property type, flooring preference, likely scope, and timing so your team can guide the customer toward the right next step.',
    formPoints: [
      { title: 'Good for upgrade and replacement jobs', text: 'Useful for both straightforward swaps and more involved full-floor refresh projects.' },
      { title: 'Supports finish-led and renovation traffic', text: 'The structure works well when buyers care about how the floor will look and perform long term.' },
      { title: 'Easy to brand and localise', text: 'Swap in your project images, material priorities, and local area coverage to make it launch-ready quickly.' },
    ],
    formCardTitle: 'Request a flooring quote',
    formBadge: 'Finish-ready form',
    serviceOptions: ['Timber flooring', 'Hybrid flooring', 'Vinyl or laminate', 'Commercial flooring', 'Subfloor prep', 'Full flooring replacement'],
    formCta: 'SEND MY FLOORING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether site measure, room count, or product selection affects pricing and next steps.',
  },
  {
    slug: 'tiling',
    label: 'Tiling Quote',
    icon: '🧱',
    secondaryIcon: '🛁',
    accent: '#0f766e',
    accentDark: '#134e4a',
    accentSoft: '#ccfbf1',
    glow: 'rgba(45,212,191,0.22)',
    badgeColor: '#99f6e4',
    logo: 'Level Edge Tiling',
    logoTagline: 'Bathrooms, kitchens, floors, splashbacks, and waterproofing support',
    badge: 'Tiling • bathrooms • splashbacks • floors • outdoor tiles • renovation work',
    headline: 'Tiling pages should feel clean, precise, and detail-led.',
    subheadline: 'This version is built for bathroom tiling, kitchen splashbacks, floor tiles, outdoor paving-style work, renovation projects, and the kind of jobs where lines, finish, and craftsmanship matter before the quote is even requested.',
    cta: 'REQUEST A TILING QUOTE',
    responseLine: 'Strong for renovation, bathroom, and finish-focused tiling traffic.',
    heroVisualTagline: 'Tile finish visual',
    visualHeadline: 'Use finished bathroom, splashback, or floor tile imagery with crisp detail',
    heroChecks: [
      { title: 'Built for precision and finish', text: 'Tiling buyers care about neat lines, clean execution, and whether the business feels detail-oriented.' },
      { title: 'Works for bathrooms, kitchens, and floor projects', text: 'The structure supports wet-area renovations, splashbacks, flooring, and outdoor tile work clearly.' },
    ],
    highlights: [
      { title: 'Position the key tiling job types', text: 'Bathrooms, splashbacks, floors, feature walls, outdoor areas, and renovation work can all be presented cleanly.' },
      { title: 'Sell quality and finish', text: 'The page is designed around craftsmanship and outcome rather than generic contractor promises.' },
      { title: 'Great fit for visual proof', text: 'This vertical becomes much stronger with close-up tile detail, finished rooms, and project imagery.' },
    ],
    stats: [
      { value: 'Bathroom', label: 'Great for wet-area and renovation-focused leads' },
      { value: 'Kitchen', label: 'Useful for splashbacks and visible finish upgrades' },
      { value: 'Floor', label: 'Strong for larger surface installs and replacement jobs' },
    ],
    sectionHeadline: 'Written for the tiling projects buyers care about getting right',
    sectionIntro: 'This template is tailored for tiling businesses where finish, layout, and craftsmanship drive confidence. It is built to feel cleaner and more specific than a generic trade page.',
    services: [
      { icon: '🛁', title: 'Bathroom and wet-area tiling', text: 'Ideal for walls, floors, shower zones, renovation work, and jobs where finish quality matters heavily.' },
      { icon: '🍽️', title: 'Kitchen splashbacks and feature surfaces', text: 'Useful for visible interior upgrades where style, alignment, and neat detail make the page convert better.' },
      { icon: '🏡', title: 'Floor, outdoor, and broader tile projects', text: 'Great for larger surface installs, outdoor tiling, entryways, and renovation projects that need a strong finish-first message.' },
    ],
    differenceHeadline: 'Why this works for tiling businesses',
    differenceIntro: 'Tiling buyers tend to care about clean lines, reliable workmanship, and whether the installer feels detail-focused enough to trust with highly visible surfaces.',
    differentiators: [
      { title: 'Detail-led tone', text: 'The messaging supports neat finish, layout quality, and craftsmanship rather than vague trade language.' },
      { title: 'Strong for renovation buyers', text: 'This structure works well when the customer is already comparing finishes, materials, and visual outcomes.' },
      { title: 'Excellent fit for project imagery', text: 'Before-and-after work, bathroom scenes, splashbacks, and floor close-ups all amplify the page dramatically.' },
    ],
    process: [
      { title: 'Make the page itself feel sharper', text: 'The visual treatment is intended to reflect the kind of precision buyers want from the finished job.' },
      { title: 'Clarify the exact tile project', text: 'The service cards help visitors understand whether you handle their room, surface, or renovation type.' },
      { title: 'Capture scope and finish details', text: 'The form helps your team gather room type, tile area, and timing so the next step is more productive.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Project-photo ready', text: 'This page gets stronger immediately once you add finished-room and close-up tile imagery.' },
      { icon: '📏', title: 'Precision-focused positioning', text: 'Useful for messaging around neat lines, careful prep, and the standards buyers care about most.' },
      { icon: '🏠', title: 'Renovation-friendly fit', text: 'Strong for bathrooms, kitchens, and visible home-improvement projects.' },
    ],
    customerGroup: 'homeowners, renovators, and fit-out clients',
    testimonials: [
      { name: 'Vanessa J.', meta: 'Bathroom tiling quote • Albion', quote: 'The page felt much more polished than most trade sites. It made the business seem careful and detail-oriented, and the finished bathroom looked excellent.' },
      { name: 'Chris L.', meta: 'Kitchen splashback install • Clayfield', quote: 'We wanted someone who clearly cared about finish. The site gave that impression straight away, and the work delivered exactly that.' },
      { name: 'Olive R.', meta: 'Floor tiling project • Ascot', quote: 'The enquiry flow was simple and the visuals felt relevant to the kind of work we were doing. It gave us confidence before the quote even came through.' },
    ],
    faqs: [
      { q: 'Can this page work for bathrooms, kitchens, and floor tiling?', a: 'Yes. It is structured to support multiple tiling categories, and you can quickly tune the service cards depending on which jobs you want to promote most heavily.' },
      { q: 'What will make it stronger?', a: 'Finished-room imagery, close-up tile detail, before-and-after shots, and testimonials that mention finish quality all improve this template significantly.' },
      { q: 'Is this suitable for renovation projects too?', a: 'Yes. The tone and structure are a strong fit for bathroom upgrades, kitchen projects, and other renovation-related tile work.' },
      { q: 'What should I customise first?', a: 'Update the tile categories, imagery, service area, and project examples so the page reflects the exact tiling jobs you want to win.' },
    ],
    formHeadline: 'Capture tiling enquiries with clearer detail about the project and finish.',
    formIntro: 'The form is built to gather room type, tile scope, surface details, and timing so your team can quote with more confidence and less back-and-forth.',
    formPoints: [
      { title: 'Useful for bathroom and kitchen upgrades', text: 'Great when the lead is already planning a visible renovation project.' },
      { title: 'Supports finish-driven buying decisions', text: 'The structure works especially well when appearance and detail are central to the sale.' },
      { title: 'Easy to tailor quickly', text: 'Swap in your project images, service list, and local coverage to make it production-ready fast.' },
    ],
    formCardTitle: 'Request a tiling quote',
    formBadge: 'Precision-ready form',
    serviceOptions: ['Bathroom tiling', 'Kitchen splashback', 'Floor tiling', 'Outdoor tiling', 'Feature wall tiling', 'Renovation tile work'],
    formCta: 'SEND MY TILING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether tile supply, waterproofing, prep work, or site measure affects the quoting process.',
  },
  {
    slug: 'fencing',
    label: 'Fencing Quote',
    icon: '🪵',
    secondaryIcon: '🚪',
    accent: '#7c2d12',
    accentDark: '#431407',
    accentSoft: '#fed7aa',
    glow: 'rgba(249,115,22,0.22)',
    badgeColor: '#fdba74',
    logo: 'Boundary Fencing Co.',
    logoTagline: 'Timber, Colorbond, pool, security, and boundary fencing',
    badge: 'Fencing • timber • Colorbond • pool fencing • gates • boundary upgrades',
    headline: 'Fencing pages should feel sturdy, practical, and easy to quote from.',
    subheadline: 'This version is built for boundary fences, Colorbond installs, timber fencing, gates, pool fencing, and property upgrades where durability, presentation, and straightforward service matter most.',
    cta: 'REQUEST A FENCING QUOTE',
    responseLine: 'Strong for replacements, new installs, and property-upgrade traffic.',
    heroVisualTagline: 'Boundary-upgrade visual',
    visualHeadline: 'Use finished fence imagery, gate installs, or crew-on-site project shots',
    heroChecks: [
      { title: 'Built for visible property improvement', text: 'The page helps fencing businesses sell both practical function and the way the finished boundary improves the property.' },
      { title: 'Works for residential and managed property jobs', text: 'Support homes, rental properties, body corporate, and broader site upgrades within one structure.' },
    ],
    highlights: [
      { title: 'Show the fence types clearly', text: 'Timber, Colorbond, pool fencing, gates, privacy fencing, and replacement work can all be positioned cleanly.' },
      { title: 'Useful for replacement and upgrade jobs', text: 'The structure fits old-fence replacement, new boundary installs, and presentation-focused property improvements.' },
      { title: 'Good fit for local and referral traffic', text: 'Fencing often wins through neighbourhood proof and visible project work, which this page supports well.' },
    ],
    stats: [
      { value: 'Boundary', label: 'Great for privacy, perimeter, and replacement work' },
      { value: 'Gate', label: 'Useful for access, entry, and finish upgrades' },
      { value: 'Pool', label: 'Strong for compliance and safety-focused fence enquiries' },
    ],
    sectionHeadline: 'Built for the fencing jobs property owners are ready to improve',
    sectionIntro: 'This template is written for real fencing businesses that need to position durability, clean installation, and visible property value without sounding generic.',
    services: [
      { icon: '🏠', title: 'Boundary fencing and replacements', text: 'Ideal for tired or damaged fences, privacy upgrades, neighbour-side replacements, and standard boundary installs.' },
      { icon: '🚪', title: 'Gates, access, and finish upgrades', text: 'Useful for entry points, practical access improvements, and fencing work where usability matters as much as appearance.' },
      { icon: '🏊', title: 'Pool and safety-compliant fencing', text: 'Great for jobs where compliance, safety, and a clean finished look all need to be communicated clearly.' },
    ],
    differenceHeadline: 'Why this works for fencing businesses',
    differenceIntro: 'Fencing buyers want to know the job will be solid, tidy, and worth the money. The page needs to communicate strength and reliability without becoming flat or generic.',
    differentiators: [
      { title: 'Solid, practical tone', text: 'The copy is grounded in workmanship, property improvement, and a clean final result rather than empty sales lines.' },
      { title: 'Good for visible property-value projects', text: 'This structure works well when the buyer is spending to improve security, privacy, compliance, or overall street appeal.' },
      { title: 'Strong fit for local proof', text: 'Neighbourhood jobs, street-facing work, and referral-driven projects make this template particularly effective.' },
    ],
    process: [
      { title: 'Show the fence outcome early', text: 'The page is designed to help visitors picture the finished result before they request a quote.' },
      { title: 'Clarify the type of fencing needed', text: 'The service cards make it easier for buyers to identify the right category and see that you handle it.' },
      { title: 'Capture property and access details', text: 'The form gathers the practical information that affects scope, measure, and quoting.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Project-photo friendly', text: 'This vertical performs better with real fence photos, gate installs, and before-and-after examples.' },
      { icon: '📏', title: 'Scope and boundary fit', text: 'Useful for jobs where dimensions, access, and neighbour-side considerations affect the work.' },
      { icon: '🏘️', title: 'Neighbourhood proof fit', text: 'Strong for local-area trust, visible street-facing projects, and suburb campaigns.' },
    ],
    customerGroup: 'homeowners, landlords, and property managers',
    testimonials: [
      { name: 'Dean C.', meta: 'Colorbond fence replacement • Birkdale', quote: 'The page made the business feel practical and experienced, which is exactly what we wanted. The quote process was easy and the new fence transformed the property.' },
      { name: 'Julia N.', meta: 'Pool fence quote • Everton Park', quote: 'It felt clear and specific to the kind of fencing job we needed. The final result looked sharp and the whole job was handled professionally.' },
      { name: 'Marcus E.', meta: 'Boundary and gate install • Ashgrove', quote: 'The site gave us confidence that they handled this type of work regularly. The communication was straightforward and the finished fence looked excellent.' },
    ],
    faqs: [
      { q: 'Can this page work for multiple fence types?', a: 'Yes. It is built to support timber, Colorbond, gates, pool fencing, and related boundary work without losing clarity.' },
      { q: 'What will make the page stronger?', a: 'Real project images, street-facing before-and-after work, local examples, and reviews that mention workmanship and finish all help a lot.' },
      { q: 'Is this suitable for pool fencing and compliance-related jobs?', a: 'Yes. The structure gives you room to support safety-focused and compliance-driven enquiries as well as standard fencing work.' },
      { q: 'What should I customise first?', a: 'Update the fence categories, visuals, service area, and testimonials so the page reflects the kind of fencing projects you most want to attract.' },
    ],
    formHeadline: 'Capture fencing enquiries with better information about scope and property needs.',
    formIntro: 'The form is built to gather the fence type, property details, and any gate or access requirements so your team can quote or site-measure more efficiently.',
    formPoints: [
      { title: 'Useful for replacement and new installs', text: 'A good fit whether the job is a simple boundary replacement or a broader property upgrade.' },
      { title: 'Supports local quote quality', text: 'Better upfront detail helps your team respond with clearer pricing and fewer wasted callbacks.' },
      { title: 'Easy to tailor by fence category', text: 'Swap in the exact fence types and project imagery your market responds to best.' },
    ],
    formCardTitle: 'Request a fencing quote',
    formBadge: 'Boundary-ready form',
    serviceOptions: ['Timber fencing', 'Colorbond fencing', 'Gate installation', 'Pool fencing', 'Fence replacement', 'Boundary upgrade'],
    formCta: 'SEND MY FENCING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether site measure, boundary conditions, or council and compliance factors affect the quoting process.',
  },
  {
    slug: 'pool-service',
    label: 'Pool Service Quote',
    icon: '🏊',
    secondaryIcon: '💧',
    accent: '#0284c7',
    accentDark: '#082f49',
    accentSoft: '#dbeafe',
    glow: 'rgba(56,189,248,0.22)',
    badgeColor: '#bae6fd',
    logo: 'Bluewater Pool Care',
    logoTagline: 'Pool cleaning, balancing, repairs, and ongoing maintenance',
    badge: 'Pool service • cleaning • balancing • equipment • maintenance • handover support',
    headline: 'Pool service pages should feel clean, reliable, and easy to trust on repeat.',
    subheadline: 'This version is built for pool cleaning, chemical balancing, equipment troubleshooting, green-pool recovery, regular maintenance plans, and the kind of recurring service work that depends on clear trust and easy booking.',
    cta: 'REQUEST A POOL QUOTE',
    responseLine: 'Strong for recurring maintenance, seasonal resets, and repair-related pool traffic.',
    heroVisualTagline: 'Pool-care visual',
    visualHeadline: 'Use sparkling pool imagery, equipment shots, or on-site maintenance visuals',
    heroChecks: [
      { title: 'Built for recurring service trust', text: 'Pool care businesses often win long-term customers, so the page is designed to feel dependable and easy to work with.' },
      { title: 'Works for cleaning and technical support', text: 'Support routine service, balancing, equipment issues, and green-pool recovery without making the offer confusing.' },
    ],
    highlights: [
      { title: 'Position the pool services clearly', text: 'Cleaning, balancing, inspections, equipment support, and routine plans can all be explained in a way customers actually understand.' },
      { title: 'Sell convenience and consistency', text: 'Pool owners want less hassle, cleaner water, and confidence the maintenance is being handled properly.' },
      { title: 'Good fit for repeat and seasonal business', text: 'The page works well for ongoing service clients, spring and summer demand, and one-off recovery work.' },
    ],
    stats: [
      { value: 'Clean', label: 'Great for presentation, water quality, and maintenance-led messaging' },
      { value: 'Balance', label: 'Useful for chemical and water-care trust positioning' },
      { value: 'Repeat', label: 'Strong for recurring local service relationships' },
    ],
    sectionHeadline: 'Built for the pool-service work owners actually want simplified',
    sectionIntro: 'This template is designed for real pool-care businesses that sell convenience, reliability, and a consistently better pool without generic contractor messaging.',
    services: [
      { icon: '🧼', title: 'Cleaning and regular pool maintenance', text: 'Ideal for recurring pool cleaning, checks, balancing, and keeping the water and surfaces in good condition week after week.' },
      { icon: '🧪', title: 'Water balancing and green-pool recovery', text: 'Useful for customers with water-quality problems, chemistry issues, or pools that need a proper reset after neglect or seasonal changes.' },
      { icon: '⚙️', title: 'Equipment support and system issues', text: 'Great for pumps, filters, chlorinators, and troubleshooting-related service work that still needs a practical quote path.' },
    ],
    differenceHeadline: 'Why this works for pool-service businesses',
    differenceIntro: 'Pool owners are usually buying convenience, consistency, and peace of mind. The page needs to feel clean, organised, and trustworthy enough that repeat service feels easy.',
    differentiators: [
      { title: 'Recurring-service friendly tone', text: 'The language supports ongoing maintenance and long-term customer relationships instead of one-and-done hard-sell copy.' },
      { title: 'Good for cleaning and equipment work', text: 'This structure supports both routine service and the more technical side of pool care without becoming messy.' },
      { title: 'Strong fit for local trust', text: 'Pool care often grows through neighbourhood trust and referrals, which this page is designed to support.' },
    ],
    process: [
      { title: 'Make the service feel dependable immediately', text: 'The page is designed to look clean and well-managed, which matches the kind of service buyers want.' },
      { title: 'Clarify whether the need is routine or problem-based', text: 'The service sections help visitors understand whether you handle maintenance, recovery, or equipment-related issues.' },
      { title: 'Capture the pool and service context', text: 'The form gathers enough detail to prepare the right visit, plan, or next-step conversation.' },
    ],
    trustPoints: [
      { icon: '📅', title: 'Recurring-plan fit', text: 'Useful for explaining regular visits, maintenance schedules, and customer retention offers.' },
      { icon: '💧', title: 'Water-quality trust', text: 'Important for customers who care about clean, safe, swimmable water and less hassle.' },
      { icon: '📍', title: 'Local-service strength', text: 'Strong for suburb campaigns and repeat local clients who want a dependable pool-care provider.' },
    ],
    customerGroup: 'homeowners, short-stay hosts, and property managers',
    testimonials: [
      { name: 'Belinda S.', meta: 'Regular pool service • Chandler', quote: 'The page made the business feel clean, professional, and easy to trust for ongoing maintenance. That turned out to be exactly the experience we had after booking.' },
      { name: 'Scott P.', meta: 'Green pool recovery • Holland Park', quote: 'We needed help fast and wanted someone who actually sounded like they knew pools, not a generic service company. The site did that well and the result was excellent.' },
      { name: 'Rachel T.', meta: 'Equipment and balancing support • Kenmore', quote: 'The enquiry process made it easy to explain the issue and the service felt organised from the start. It gave us confidence before the first visit even happened.' },
    ],
    faqs: [
      { q: 'Can this page work for regular pool service and one-off recovery jobs?', a: 'Yes. The structure supports recurring maintenance plans, balancing issues, green-pool resets, and equipment-related service work without losing clarity.' },
      { q: 'What will improve conversions most?', a: 'Clean pool imagery, technician photos, reviews that mention reliability, and clear service-plan language all help significantly.' },
      { q: 'Is it suitable for equipment troubleshooting too?', a: 'Yes. The service blocks make room for pumps, filters, chlorinators, and other pool-system issues as part of the broader offer.' },
      { q: 'What should I customise first?', a: 'Update the pool-service categories, imagery, plan structure, and service area so the page reflects the exact type of pool work you want to sell most often.' },
    ],
    formHeadline: 'Capture pool-service enquiries with the details needed to respond properly.',
    formIntro: 'The form is built to gather the pool issue or maintenance need, service area, and enough context to recommend the right visit, quote, or recurring plan.',
    formPoints: [
      { title: 'Good for repeat-service businesses', text: 'Ideal when your business grows through ongoing local pool-care relationships.' },
      { title: 'Supports routine and problem-based jobs', text: 'Handle weekly maintenance and urgent water or equipment issues through one practical flow.' },
      { title: 'Easy to tailor quickly', text: 'Swap in your plan language, service area, and pool imagery to make it production-ready fast.' },
    ],
    formCardTitle: 'Request a pool-service quote',
    formBadge: 'Recurring-service form',
    serviceOptions: ['Regular pool service', 'Green pool recovery', 'Water balancing', 'Equipment issue', 'One-off clean', 'Ongoing maintenance plan'],
    formCta: 'SEND MY POOL ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether pricing depends on pool size, current condition, or whether regular service is required after the first visit.',
  },
  {
    slug: 'locksmith',
    label: 'Locksmith Quote',
    icon: '🔐',
    secondaryIcon: '🗝️',
    accent: '#334155',
    accentDark: '#0f172a',
    accentSoft: '#e2e8f0',
    glow: 'rgba(148,163,184,0.22)',
    badgeColor: '#cbd5e1',
    logo: 'Rapid Lock & Key',
    logoTagline: 'Residential, commercial, automotive, and emergency locksmith services',
    badge: 'Locksmith • lockouts • rekeying • automotive • security upgrades • emergency help',
    headline: 'Locksmith pages need to feel secure, responsive, and immediately trustworthy.',
    subheadline: 'This version is built for lockouts, rekeying, lock repairs, automotive locksmith work, security upgrades, and the kind of urgent trust-based enquiries where the business has to feel reliable from the first screen.',
    cta: 'REQUEST A LOCKSMITH QUOTE',
    responseLine: 'Strong for urgent local response, rekeying, and security-upgrade traffic.',
    heroVisualTagline: 'Security-service visual',
    visualHeadline: 'Use technician, lock hardware, vehicle-entry, or on-site service imagery',
    heroChecks: [
      { title: 'Built for urgency and trust', text: 'Locksmith buyers often need help fast, so the page is designed to feel responsive and credible without sounding frantic.' },
      { title: 'Works for residential, commercial, and automotive jobs', text: 'Support lockouts, key work, repairs, and access upgrades without making the offer feel scattered.' },
    ],
    highlights: [
      { title: 'Position the locksmith services clearly', text: 'Emergency access, rekeying, repairs, lock changes, automotive entry, and broader security upgrades can all be presented cleanly.' },
      { title: 'Sell confidence and discretion', text: 'People want a locksmith who feels professional, careful, and trustworthy, not like a random ad response.' },
      { title: 'Good fit for urgent and planned work', text: 'The page works for immediate lockouts as well as more deliberate security and rekeying jobs.' },
    ],
    stats: [
      { value: 'Urgent', label: 'Great for time-sensitive lockout and entry issues' },
      { value: 'Secure', label: 'Useful for trust-driven residential and business work' },
      { value: 'Local', label: 'Strong fit for suburb and radius-based locksmith campaigns' },
    ],
    sectionHeadline: 'Written for the locksmith jobs customers actually need resolved properly',
    sectionIntro: 'This template is tailored for locksmith businesses where speed matters, but trust and professionalism matter just as much.',
    services: [
      { icon: '🏠', title: 'Residential lockouts and rekeying', text: 'Ideal for homes, rental changes, lost keys, lock replacements, and access issues where customers need fast but trustworthy help.' },
      { icon: '🚗', title: 'Automotive locksmith support', text: 'Useful for car lockouts, keys, access issues, and buyers who need the service to feel legitimate and capable.' },
      { icon: '🏢', title: 'Commercial security and access work', text: 'Great for businesses, offices, and managed properties that need rekeying, lock upgrades, or broader access support.' },
    ],
    differenceHeadline: 'Why this works for locksmith businesses',
    differenceIntro: 'Locksmith customers are often in a vulnerable or time-sensitive position. The page needs to communicate trust, speed, and competence without tipping into cheesy urgency.',
    differentiators: [
      { title: 'Trust-first security tone', text: 'The messaging is built around credibility, professionalism, and practical help, which suits locksmith work far better than loud sales language.' },
      { title: 'Good for emergency and planned jobs', text: 'This structure supports immediate response work and longer-cycle security upgrade enquiries equally well.' },
      { title: 'Strong for local response traffic', text: 'Locksmith demand is often highly local and urgent, which makes this template a strong fit for suburb and radius-based campaigns.' },
    ],
    process: [
      { title: 'Make the service feel trustworthy immediately', text: 'The first screen is designed to reduce hesitation and make the business feel safe to contact.' },
      { title: 'Clarify the lock or access issue', text: 'The service blocks help visitors identify the type of locksmith help they need quickly.' },
      { title: 'Capture urgency and location details', text: 'The form gathers the information needed to prioritise the right kind of follow-up or dispatch.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Identity and security fit', text: 'Useful for trust signals, licence messaging, and the reassurance customers need around access-related work.' },
      { icon: '🚪', title: 'Residential and business access support', text: 'The structure supports homes, offices, and mixed-use local clients naturally.' },
      { icon: '📍', title: 'Response-area strength', text: 'Strong for location-based campaigns where speed and local presence matter heavily.' },
    ],
    customerGroup: 'homeowners, drivers, business owners, and property managers',
    testimonials: [
      { name: 'Trent S.', meta: 'Home lockout • Wilston', quote: 'The page felt calm and professional, which mattered because we needed help quickly. The locksmith arrived when promised and handled everything exactly the way we hoped.' },
      { name: 'Mia L.', meta: 'Rekeying after move • Newmarket', quote: 'It felt like a proper local locksmith business, not a random callout ad. The quote and booking process were simple and the service was excellent.' },
      { name: 'James P.', meta: 'Commercial lock upgrade • Milton', quote: 'We wanted a locksmith who looked credible for business work. The site gave that impression straight away and the job was handled cleanly and professionally.' },
    ],
    faqs: [
      { q: 'Can this page work for urgent locksmith jobs and planned security work?', a: 'Yes. It is structured to support both time-sensitive lockout requests and more considered rekeying or security upgrade enquiries.' },
      { q: 'What will make it stronger?', a: 'Technician imagery, local reviews, trust signals around identification or licensing, and clear service coverage areas all help significantly.' },
      { q: 'Is it suitable for automotive locksmith work too?', a: 'Yes. The structure supports automotive access and key-related categories as part of the broader offer.' },
      { q: 'What should I customise first?', a: 'Update the service categories, local response area, trust signals, and testimonials so the page reflects your exact locksmith offer and coverage.' },
    ],
    formHeadline: 'Capture locksmith enquiries with the urgency and detail needed to respond properly.',
    formIntro: 'The form is built to gather the issue type, location, urgency, and enough detail to prioritise the right kind of callback or dispatch.',
    formPoints: [
      { title: 'Good for urgent local traffic', text: 'Useful when customers need help quickly and want confidence before they make contact.' },
      { title: 'Supports residential, commercial, and vehicle work', text: 'The structure can cover multiple locksmith categories without losing clarity.' },
      { title: 'Easy to tailor by response area', text: 'Swap in your actual service radius and lock categories to make the page highly practical fast.' },
    ],
    formCardTitle: 'Request a locksmith quote',
    formBadge: 'Response-ready form',
    serviceOptions: ['Home lockout', 'Rekeying', 'Lock repair or replacement', 'Automotive locksmith', 'Commercial lock service', 'Security upgrade'],
    formCta: 'SEND MY LOCKSMITH ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain identity checks, response windows, callout rules, and anything that helps the customer know what happens next.',
  },
  {
    slug: 'hvac',
    label: 'HVAC / Air Conditioning Quote',
    icon: '❄️',
    secondaryIcon: '🌡️',
    accent: '#2563eb',
    accentDark: '#1e3a8a',
    accentSoft: '#dbeafe',
    glow: 'rgba(96,165,250,0.22)',
    badgeColor: '#bfdbfe',
    logo: 'Climate Flow HVAC',
    logoTagline: 'Air conditioning, heating, ventilation, and service support',
    badge: 'HVAC • air conditioning • installs • servicing • repairs • climate control',
    headline: 'HVAC pages should feel technical, trustworthy, and easy to quote from.',
    subheadline: 'This version is built for air-conditioning installs, servicing, HVAC maintenance, repairs, ventilation work, and temperature-control projects where buyers want technical competence and clean local-service communication.',
    cta: 'REQUEST AN HVAC QUOTE',
    responseLine: 'Strong for installs, servicing, repairs, and seasonal climate-control demand.',
    heroVisualTagline: 'Climate-control visual',
    visualHeadline: 'Use unit installs, technician imagery, or clean interior comfort-focused photos',
    heroChecks: [
      { title: 'Built for technical trust', text: 'HVAC and air-conditioning buyers want a business that sounds capable, compliant, and easy to deal with.' },
      { title: 'Works for installs and service work', text: 'Support new systems, maintenance, repairs, and commercial climate-control work in one structure.' },
    ],
    highlights: [
      { title: 'Position the key HVAC services clearly', text: 'Installs, servicing, repairs, maintenance plans, split systems, ducted systems, and ventilation work can all be framed cleanly.' },
      { title: 'Sell comfort and reliability', text: 'Customers care about working systems, comfort, efficiency, and not being left without support in the wrong season.' },
      { title: 'Good fit for homes and commercial sites', text: 'The structure supports residential installs, office systems, and broader service contracts with minimal changes.' },
    ],
    stats: [
      { value: 'Install', label: 'Great for new systems and upgrade quotes' },
      { value: 'Service', label: 'Useful for maintenance and recurring care plans' },
      { value: 'Repair', label: 'Strong for seasonal breakdown and fault demand' },
    ],
    sectionHeadline: 'Written for the HVAC and air-con work buyers actively need help with',
    sectionIntro: 'This template is designed for climate-control businesses that need the page to feel technically credible, locally trustworthy, and practical enough to convert real service demand.',
    services: [
      { icon: '❄️', title: 'Air-conditioning installs and upgrades', text: 'Ideal for split systems, ducted setups, replacements, and buyers planning a more comfortable or more efficient setup.' },
      { icon: '🛠️', title: 'Servicing, maintenance, and repairs', text: 'Useful for breakdowns, cleaning, regular servicing, and the routine work that drives long-term HVAC relationships.' },
      { icon: '🏢', title: 'Commercial and ventilation support', text: 'Great for offices, managed sites, businesses, and larger jobs where reliability and technical confidence matter.' },
    ],
    differenceHeadline: 'Why this works for HVAC businesses',
    differenceIntro: 'HVAC buyers want a business that sounds knowledgeable, compliant, and easy to trust with a system that affects daily comfort, energy use, and business continuity.',
    differentiators: [
      { title: 'Technical but readable tone', text: 'The messaging supports system expertise and compliance without becoming jargon-heavy or confusing.' },
      { title: 'Good for installs and service relationships', text: 'This structure works whether the job is a fresh install, a repair, or a longer-term servicing relationship.' },
      { title: 'Strong fit for seasonal demand', text: 'Air-con and HVAC businesses often get bursts of demand, and this page is built to help those leads convert more cleanly.' },
    ],
    process: [
      { title: 'Make the business feel competent quickly', text: 'The opening sections are designed to give buyers confidence in the service before they request a quote.' },
      { title: 'Clarify the system or service need', text: 'The service cards help visitors identify whether they need install, servicing, repair, or a broader HVAC solution.' },
      { title: 'Capture practical job details', text: 'The form gathers the information needed to quote, triage, or recommend the right system or next step.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Compliance and capability fit', text: 'Useful for licences, certifications, and trust signals around technical system work.' },
      { icon: '🏠', title: 'Residential and commercial flexibility', text: 'Strong for mixed service models that support both homes and businesses.' },
      { icon: '📍', title: 'Local-service demand fit', text: 'Works well for local HVAC, air-conditioning, and servicing traffic where response and trust matter.' },
    ],
    customerGroup: 'homeowners, office managers, and commercial property clients',
    testimonials: [
      { name: 'Sonia R.', meta: 'Split-system install • Mansfield', quote: 'The page felt much more professional than most local service sites we saw. It made the business feel technical and trustworthy, and the install went exactly the same way.' },
      { name: 'Peter C.', meta: 'Air-con repair • Chermside West', quote: 'We needed a business that sounded like they actually understood the system and could respond quickly. The site gave us that confidence and the service delivered.' },
      { name: 'Lauren M.', meta: 'Commercial servicing enquiry • Newstead', quote: 'It felt like a proper HVAC provider, not generic trade copy. The enquiry process was simple and the follow-up was clear and professional.' },
    ],
    faqs: [
      { q: 'Can this page work for installs, servicing, and repairs?', a: 'Yes. It is designed to support the full mix of HVAC and air-conditioning work without making the offer feel confused or overly broad.' },
      { q: 'What will strengthen the page most?', a: 'Real install photos, technician imagery, service-category clarity, and reviews that mention professionalism, system knowledge, and reliability all help a lot.' },
      { q: 'Is it suitable for commercial HVAC work too?', a: 'Yes. The structure supports office, retail, and managed-site demand as well as residential climate-control jobs.' },
      { q: 'What should I customise first?', a: 'Update the service categories, local area, trust signals, and visuals so the page reflects the exact HVAC work you want most in your pipeline.' },
    ],
    formHeadline: 'Capture HVAC enquiries with enough context to quote or triage properly.',
    formIntro: 'The form is built to gather the system type, issue or project need, property context, and timing so your team can respond with a more useful first step.',
    formPoints: [
      { title: 'Good for new-system and repair demand', text: 'Support both planned installs and urgent service issues through one practical structure.' },
      { title: 'Useful for homes and businesses', text: 'The page works for residential buyers and commercial service clients with minimal change.' },
      { title: 'Easy to tailor by system type', text: 'Swap in your preferred service categories, imagery, and local area to sharpen relevance quickly.' },
    ],
    formCardTitle: 'Request an HVAC quote',
    formBadge: 'Climate-ready form',
    serviceOptions: ['Split-system install', 'Ducted system quote', 'Air-con repair', 'Routine servicing', 'Commercial HVAC', 'Ventilation support'],
    formCta: 'SEND MY HVAC ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether site visits are required, which system details help quoting, and how seasonal demand affects response times.',
  },
  {
    slug: 'concreting',
    label: 'Concreting Quote',
    icon: '🧱',
    secondaryIcon: '🚧',
    accent: '#6b7280',
    accentDark: '#1f2937',
    accentSoft: '#e5e7eb',
    glow: 'rgba(156,163,175,0.22)',
    badgeColor: '#d1d5db',
    logo: 'Solid Edge Concreting',
    logoTagline: 'Driveways, slabs, paths, exposed aggregate, and site prep',
    badge: 'Concreting • driveways • slabs • paths • exposed aggregate • site prep',
    headline: 'Concreting pages should feel solid, practical, and built for real-site quoting.',
    subheadline: 'This version is built for driveways, slabs, footpaths, patios, shed bases, exposed aggregate, and other concreting jobs where durability, finish, and project confidence matter before a quote is requested.',
    cta: 'REQUEST A CONCRETING QUOTE',
    responseLine: 'Strong for residential projects, access-heavy jobs, and visible property improvements.',
    heroVisualTagline: 'Concrete project visual',
    visualHeadline: 'Use driveway, slab, crew, or finished-surface imagery with clean project detail',
    heroChecks: [
      { title: 'Built for substantial property-improvement work', text: 'The page positions the business as capable of real site work, not just generic labour.' },
      { title: 'Works for practical and presentation-focused jobs', text: 'Support structural slabs, driveways, and finish-focused decorative concrete in one clear structure.' },
    ],
    highlights: [
      { title: 'Position the concrete jobs clearly', text: 'Driveways, house slabs, pathways, patios, crossover work, and exposed aggregate can all be framed cleanly.' },
      { title: 'Sell durability and finish', text: 'Concreting buyers want to know the job will last and look right, not just get poured quickly.' },
      { title: 'Good fit for bigger-ticket quotes', text: 'The page supports projects where buyers compare professionalism, finish quality, and trust before spending.' },
    ],
    stats: [
      { value: 'Driveway', label: 'Strong for street-facing and visible property-upgrade work' },
      { value: 'Slab', label: 'Useful for shed bases, pads, and more structural project demand' },
      { value: 'Finish', label: 'Great for decorative and presentation-led concrete projects' },
    ],
    sectionHeadline: 'Built for the concreting jobs customers want done properly the first time',
    sectionIntro: 'This template is tailored for concreting businesses that need to communicate capability, clean execution, and a quality finish without sounding generic or cheap.',
    services: [
      { icon: '🚗', title: 'Driveways, paths, and access areas', text: 'Ideal for driveways, crossovers, walkways, and other high-visibility concrete work where presentation matters.' },
      { icon: '🏗️', title: 'Slabs, pads, and structural base work', text: 'Useful for shed slabs, foundations, pads, and jobs where practical durability and preparation are essential.' },
      { icon: '✨', title: 'Exposed aggregate and finish-led projects', text: 'Great for decorative finishes and concreting work where buyers care heavily about the final look.' },
    ],
    differenceHeadline: 'Why this works for concreting businesses',
    differenceIntro: 'Concreting buyers usually want confidence around durability, finish, and whether the contractor feels capable enough to manage site access, prep, and a clean final result.',
    differentiators: [
      { title: 'Site-work credibility', text: 'The page supports messaging around excavation, prep, reinforcement, and the practical realities that serious buyers expect you to understand.' },
      { title: 'Strong for visible property upgrades', text: 'Driveways and decorative concrete sell visually, so the layout makes room for strong project proof.' },
      { title: 'Useful for larger quote value', text: 'The tone is built for higher-consideration projects where the buyer wants a business that feels organised and trustworthy.' },
    ],
    process: [
      { title: 'Make the project feel substantial', text: 'The first impression is designed to communicate real capability and dependable workmanship.' },
      { title: 'Clarify the type of concrete work needed', text: 'The service cards help buyers see whether you are the right fit for the job scope they have in mind.' },
      { title: 'Capture site and access details', text: 'The form collects enough project information to help your team quote or inspect more effectively.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Project-proof friendly', text: 'Concreting performs much better with finished driveway, slab, and surface imagery from real jobs.' },
      { icon: '📏', title: 'Scope and access fit', text: 'Useful where dimensions, access, and site prep meaningfully affect price and timing.' },
      { icon: '🏠', title: 'Property-value positioning', text: 'Good fit for homeowners and builders improving access, presentation, and structural use of outdoor areas.' },
    ],
    customerGroup: 'homeowners, builders, and property-improvement clients',
    testimonials: [
      { name: 'Kane R.', meta: 'Driveway replacement • Wakerley', quote: 'The page made the business feel substantial and experienced, which is exactly what we wanted for a bigger job. The driveway came up brilliantly and the process felt well managed.' },
      { name: 'Sophie T.', meta: 'Patio slab quote • Carina Heights', quote: 'It felt like a real concreting company from the first screen. The quote process was straightforward and the finished slab looks excellent.' },
      { name: 'Mick D.', meta: 'Exposed aggregate project • Gumdale', quote: 'We were comparing finish quality as much as price. The site gave us confidence that they cared about the end result, and the work delivered on that.' },
    ],
    faqs: [
      { q: 'Can this page work for both standard and decorative concreting?', a: 'Yes. It is built to support practical slab and access work as well as more finish-led exposed aggregate or decorative jobs.' },
      { q: 'What will strengthen it most?', a: 'Real project photos, before-and-after driveway or slab imagery, and local examples that show finish quality all make this template much stronger.' },
      { q: 'Is it suitable for builders and larger projects too?', a: 'Yes. The tone and structure can support builder, renovation, and more substantial property-upgrade jobs very well.' },
      { q: 'What should I customise first?', a: 'Update the concrete categories, project imagery, service area, and testimonials so the page reflects the exact jobs you want most in your pipeline.' },
    ],
    formHeadline: 'Capture concreting enquiries with the site and project detail needed to quote properly.',
    formIntro: 'The form is built to collect the job type, likely dimensions, site access, and timing so your team can respond with a more useful quote or next step.',
    formPoints: [
      { title: 'Good for residential and builder traffic', text: 'The structure works for homeowners as well as more trade-adjacent project enquiries.' },
      { title: 'Supports larger-ticket job confidence', text: 'Useful where the buyer wants a contractor who feels organised enough to trust with meaningful site work.' },
      { title: 'Easy to localise quickly', text: 'Swap in local project proof, service areas, and your best-fit concrete categories to sharpen conversions.' },
    ],
    formCardTitle: 'Request a concreting quote',
    formBadge: 'Site-ready form',
    serviceOptions: ['Driveway concreting', 'House slab or pad', 'Path or patio', 'Exposed aggregate', 'Shed slab', 'Other concrete project'],
    formCta: 'SEND MY CONCRETING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether site inspection, measurements, soil or prep conditions, or finish type affect pricing and scheduling.',
  },
  {
    slug: 'solar',
    label: 'Solar Installation Quote',
    icon: '☀️',
    secondaryIcon: '🔋',
    accent: '#d97706',
    accentDark: '#78350f',
    accentSoft: '#fef3c7',
    glow: 'rgba(251,191,36,0.22)',
    badgeColor: '#fde68a',
    logo: 'Bright Current Solar',
    logoTagline: 'Solar installs, batteries, upgrades, and energy-efficiency solutions',
    badge: 'Solar • battery storage • energy savings • installs • upgrades • commercial systems',
    headline: 'Solar pages should feel credible, modern, and financially sensible.',
    subheadline: 'This version is built for solar installs, battery solutions, energy upgrades, and commercial systems where buyers need trust, clarity, and confidence in the savings case before requesting a quote.',
    cta: 'REQUEST A SOLAR QUOTE',
    responseLine: 'Strong for residential installs, battery add-ons, and energy-upgrade traffic.',
    heroVisualTagline: 'Solar-system visual',
    visualHeadline: 'Use rooftop install imagery, battery visuals, or clean home and business energy shots',
    heroChecks: [
      { title: 'Built for value-driven decision making', text: 'Solar buyers care about outcomes, credibility, and whether the installer feels trustworthy enough for a bigger investment.' },
      { title: 'Works for homes and commercial systems', text: 'Support residential installs, battery upgrades, and business energy projects without making the page feel overloaded.' },
    ],
    highlights: [
      { title: 'Position the solar offers clearly', text: 'New systems, battery storage, upgrades, monitoring, and commercial projects can all be framed in clear, practical language.' },
      { title: 'Sell long-term value, not hype', text: 'Customers want a sensible path to savings and reliability, not exaggerated promises or vague green language.' },
      { title: 'Good fit for higher-consideration buying', text: 'The page is structured for quote requests where trust, proof, and understanding of the solution matter heavily.' },
    ],
    stats: [
      { value: 'Savings', label: 'Strong for ROI, bill reduction, and energy-efficiency messaging' },
      { value: 'Battery', label: 'Useful for storage, backup, and upgrade-focused demand' },
      { value: 'Commercial', label: 'Supports broader system and business energy projects well' },
    ],
    sectionHeadline: 'Built for the solar decisions buyers actually want help understanding',
    sectionIntro: 'This template is designed for solar businesses that need the page to feel credible, clear, and commercially sensible rather than vague or overhyped.',
    services: [
      { icon: '🏠', title: 'Residential solar installs and upgrades', text: 'Ideal for homes looking to reduce bills, add battery storage, or improve system performance with the right solution.' },
      { icon: '🔋', title: 'Battery and energy-management options', text: 'Useful for buyers interested in storage, smarter energy use, and more confidence around power use or backup.' },
      { icon: '🏢', title: 'Commercial solar and broader energy projects', text: 'Great for businesses, larger systems, and projects where technical trust and projected value matter heavily.' },
    ],
    differenceHeadline: 'Why this works for solar businesses',
    differenceIntro: 'Solar buyers are usually comparing trust, savings logic, system quality, and whether the installer feels like a serious long-term partner. The page is built around that reality.',
    differentiators: [
      { title: 'Credible energy-upgrade tone', text: 'The messaging is designed to feel practical and grounded, which suits solar much better than generic product-funnel language.' },
      { title: 'Good for larger quote values', text: 'This structure works well when the customer needs more confidence before making a higher-consideration purchase.' },
      { title: 'Strong fit for proof and explanation', text: 'There is room to position system types, savings logic, credentials, and real customer outcomes in a believable way.' },
    ],
    process: [
      { title: 'Establish technical and commercial trust quickly', text: 'The first impression is designed to make the business feel modern, capable, and safe to enquire with.' },
      { title: 'Clarify the kind of system or upgrade needed', text: 'The service blocks help visitors understand whether you support their home, battery, or commercial energy objective.' },
      { title: 'Capture enough project detail to quote sensibly', text: 'The form gathers property and energy-context information so your team can respond more intelligently.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Credential and installer trust', text: 'Useful for licences, accreditations, warranty positioning, and installer confidence signals.' },
      { icon: '📈', title: 'Savings and value positioning', text: 'Strong fit for energy-bill, ROI, and long-term value messaging that needs to feel believable.' },
      { icon: '📍', title: 'Local solar market fit', text: 'Works well for region-based service areas where trust and visibility matter in a competitive category.' },
    ],
    customerGroup: 'homeowners, business owners, and energy-upgrade buyers',
    testimonials: [
      { name: 'Natalie H.', meta: 'Residential solar install • Springfield', quote: 'The page felt professional and credible straight away, which mattered because this was a meaningful spend for us. The quote process was clear and the install experience matched the promise.' },
      { name: 'Ryan P.', meta: 'Battery upgrade enquiry • Wellington Point', quote: 'We were looking for someone who could explain the options without the usual hype. The site did that well and made the business feel trustworthy from the start.' },
      { name: 'Darren M.', meta: 'Commercial solar quote • Yatala', quote: 'It felt like a serious energy business rather than generic ad copy. The service categories and follow-up process gave us confidence to progress the conversation.' },
    ],
    faqs: [
      { q: 'Can this page work for solar installs and battery solutions?', a: 'Yes. It is structured to support both, and can be tailored depending on whether you lead with standard home systems, battery upgrades, or commercial projects.' },
      { q: 'What will strengthen the page most?', a: 'Real install imagery, project photos, simple value explanations, accreditations, and reviews that mention professionalism and clarity all help significantly.' },
      { q: 'Is it suitable for commercial solar too?', a: 'Yes. The tone and structure support higher-value business and larger-system conversations well.' },
      { q: 'What should I customise first?', a: 'Update the offer categories, visuals, service area, and proof points so the page reflects the exact solar work you most want to win.' },
    ],
    formHeadline: 'Capture solar enquiries with enough detail to guide the right next step.',
    formIntro: 'The form is built to gather the property type, likely system need, and enough project context for your team to respond with a more useful quote or recommendation.',
    formPoints: [
      { title: 'Good for higher-consideration enquiries', text: 'Useful where buyers need confidence before progressing to site assessment or detailed quote.' },
      { title: 'Supports residential and commercial demand', text: 'The structure works well across homes, businesses, and upgrade-focused energy projects.' },
      { title: 'Easy to tune quickly', text: 'Swap in your battery, panel, or system priorities and local proof to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a solar quote',
    formBadge: 'Energy-ready form',
    serviceOptions: ['Residential solar', 'Battery storage', 'Solar upgrade', 'Commercial solar', 'System inspection', 'Energy consultation'],
    formCta: 'SEND MY SOLAR ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain what energy-bill, roof, or site details help the quoting process and whether site inspection is the next step.',
  },
  {
    slug: 'tree-lopping',
    label: 'Tree Lopping / Arborist Quote',
    icon: '🌳',
    secondaryIcon: '🪚',
    accent: '#15803d',
    accentDark: '#14532d',
    accentSoft: '#dcfce7',
    glow: 'rgba(74,222,128,0.22)',
    badgeColor: '#bbf7d0',
    logo: 'Canopy Tree Care',
    logoTagline: 'Tree removal, pruning, arborist reporting, and site clearing',
    badge: 'Tree lopping • pruning • removals • arborist reports • stump grinding • clearing',
    headline: 'Tree service pages should feel safe, capable, and clearly professional.',
    subheadline: 'This version is built for tree removal, pruning, storm damage response, arborist inspections, stump work, and vegetation clearing where buyers want safety, experience, and site confidence before asking for a quote.',
    cta: 'REQUEST A TREE QUOTE',
    responseLine: 'Strong for safety-led enquiries, storm response, and larger outdoor site work.',
    heroVisualTagline: 'Tree-service visual',
    visualHeadline: 'Use crew, equipment, canopy, or clean post-removal site imagery',
    heroChecks: [
      { title: 'Built for safety and risk-aware buying', text: 'Tree work buyers want to know the business is experienced, insured, and careful with difficult or hazardous jobs.' },
      { title: 'Works for maintenance and bigger removals', text: 'Support pruning, canopy management, removals, clearing, and report-driven work in one strong structure.' },
    ],
    highlights: [
      { title: 'Position the tree services clearly', text: 'Pruning, removals, storm clean-up, arborist reporting, stump grinding, and vegetation management can all be presented in a way buyers understand.' },
      { title: 'Sell safety and capability', text: 'This is a category where workmanship, insurance, site management, and professionalism matter more than generic sales lines.' },
      { title: 'Good fit for higher-risk or council-related jobs', text: 'The page can support inspection-driven work and more complex jobs that need stronger trust signals.' },
    ],
    stats: [
      { value: 'Safe', label: 'Strong for risk-aware and property-sensitive tree work' },
      { value: 'Storm', label: 'Useful for urgent clean-up and damage-response demand' },
      { value: 'Arborist', label: 'Good for reporting, assessment, and managed-site jobs' },
    ],
    sectionHeadline: 'Built for the tree and vegetation jobs property owners take seriously',
    sectionIntro: 'This template is tailored for real tree-care and arborist businesses, where safety, equipment, insurance, and site confidence matter heavily in the buying decision.',
    services: [
      { icon: '🌲', title: 'Pruning, canopy work, and maintenance', text: 'Ideal for shaping, thinning, branch management, overhang issues, and general tree care where health and presentation both matter.' },
      { icon: '🪓', title: 'Tree removal and storm-response work', text: 'Useful for hazardous trees, damaged branches, removals, and urgent jobs that need a business that feels controlled and experienced.' },
      { icon: '📋', title: 'Arborist reporting and site-related support', text: 'Great for inspections, reports, council-related requirements, and more formal property or project needs.' },
    ],
    differenceHeadline: 'Why this works for tree-care businesses',
    differenceIntro: 'Tree work often feels high risk to the customer, so the page needs to project control, safety, and professionalism rather than generic contractor messaging.',
    differentiators: [
      { title: 'Safety-led tone', text: 'The messaging supports insured work, risk-aware planning, and careful site execution without becoming overdramatic.' },
      { title: 'Strong for bigger outdoor jobs', text: 'This structure works for larger removals, difficult access, and more serious property concerns where trust matters heavily.' },
      { title: 'Good fit for residential and managed-site work', text: 'The page can support homes, strata, schools, councils, and commercial sites with minimal changes.' },
    ],
    process: [
      { title: 'Establish control and professionalism first', text: 'The opening sections are designed to make the service feel safe and well managed.' },
      { title: 'Clarify the tree issue or site need', text: 'The service blocks help buyers understand whether you handle the exact type of tree work they need.' },
      { title: 'Capture access and urgency details', text: 'The form gathers enough context to quote or triage more effectively before the first visit.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Insurance and capability fit', text: 'Useful for highlighting insured work, equipment capability, and site-management trust signals.' },
      { icon: '📸', title: 'Project-proof friendly', text: 'Tree services benefit from real job photos, before-and-after work, and evidence of clean site outcomes.' },
      { icon: '🏘️', title: 'Property and managed-site fit', text: 'Strong for home, strata, and commercial-property leads where professionalism matters heavily.' },
    ],
    customerGroup: 'homeowners, strata contacts, and property managers',
    testimonials: [
      { name: 'Renee P.', meta: 'Tree removal • Holland Park West', quote: 'The page made the business feel safe and professional straight away, which mattered because it was a more serious job. The quote and execution both reflected that.' },
      { name: 'Blake T.', meta: 'Storm clean-up • Samford', quote: 'We needed urgent help but still wanted someone who felt organised and careful. The site struck that balance well and the service delivered.' },
      { name: 'Maria L.', meta: 'Arborist report • Indooroopilly', quote: 'It felt like a real arborist and tree-care business, not a generic trade page. The process was clear and the reporting side was handled professionally.' },
    ],
    faqs: [
      { q: 'Can this page work for pruning, removals, and arborist reporting?', a: 'Yes. It is designed to support the broader tree-care category, from general maintenance through to more serious removals and assessment-related work.' },
      { q: 'What will improve the page most?', a: 'Real crew and equipment imagery, before-and-after site photos, insurance or qualification trust points, and reviews that mention professionalism and safety all help significantly.' },
      { q: 'Is it suitable for storm-response work too?', a: 'Yes. The structure leaves room for urgent clean-up and hazardous-tree messaging without making the page feel chaotic.' },
      { q: 'What should I customise first?', a: 'Update the service list, proof imagery, service area, and trust points so the page reflects the exact kind of tree work you want to sell most often.' },
    ],
    formHeadline: 'Capture tree-service enquiries with enough site detail to respond properly.',
    formIntro: 'The form is built to gather the tree issue, property type, access situation, and urgency so your team can quote or prioritise the job more intelligently.',
    formPoints: [
      { title: 'Good for routine and higher-risk jobs', text: 'Useful for pruning, removals, and more serious site-related or storm-driven enquiries.' },
      { title: 'Supports trust-heavy buying decisions', text: 'The structure helps the business feel safer and more professional before contact is made.' },
      { title: 'Easy to localise quickly', text: 'Add your area coverage, project photos, and best-fit service categories to make the page highly usable fast.' },
    ],
    formCardTitle: 'Request a tree quote',
    formBadge: 'Site-safety form',
    serviceOptions: ['Tree pruning', 'Tree removal', 'Storm damage clean-up', 'Arborist report', 'Stump grinding', 'Vegetation clearing'],
    formCta: 'SEND MY TREE ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether photos help, whether site inspection is required, and how urgent or hazardous jobs are prioritised.',
  },
  {
    slug: 'bathroom-renovation',
    label: 'Bathroom Renovation Quote',
    icon: '🛁',
    secondaryIcon: '🚿',
    accent: '#0ea5e9',
    accentDark: '#0c4a6e',
    accentSoft: '#e0f2fe',
    glow: 'rgba(56,189,248,0.22)',
    badgeColor: '#bae6fd',
    logo: 'Luxe Bathroom Projects',
    logoTagline: 'Bathroom renovations, remodels, upgrades, and design-led rebuilds',
    badge: 'Bathrooms • renovations • remodelling • upgrades • waterproofing • fit-out',
    headline: 'Bathroom renovation pages should feel premium, organised, and design-aware.',
    subheadline: 'This version is built for bathroom remodels, full renovations, wet-area upgrades, accessibility-focused bathrooms, and higher-consideration renovation projects where finish, planning, and trust drive the quote request.',
    cta: 'REQUEST A BATHROOM QUOTE',
    responseLine: 'Strong for premium renovation traffic and design-led quote enquiries.',
    heroVisualTagline: 'Bathroom-finish visual',
    visualHeadline: 'Use completed bathroom imagery, material details, or renovation project photos',
    heroChecks: [
      { title: 'Built for premium renovation perception', text: 'Bathroom buyers are often making a meaningful spend and want a page that feels organised, polished, and capable.' },
      { title: 'Works for full remodels and upgrades', text: 'Support full-room renovations, wet-area updates, and more targeted bathroom improvements within one strong structure.' },
    ],
    highlights: [
      { title: 'Position the renovation types clearly', text: 'Full remodels, bathroom refreshes, accessibility upgrades, ensuite projects, and wet-area rebuilds can all be presented in a way buyers understand.' },
      { title: 'Sell the finished space', text: 'Bathroom buyers are investing in function, style, quality, and project confidence, not generic trade promises.' },
      { title: 'Good fit for high-value quote conversations', text: 'The page is designed for buyers comparing quality, experience, and whether the business feels capable of delivering a whole-room result.' },
    ],
    stats: [
      { value: 'Design', label: 'Strong for style-led and layout-led bathroom upgrades' },
      { value: 'Full-room', label: 'Useful for complete renovation and remodel projects' },
      { value: 'Premium', label: 'Good fit for higher-consideration bathroom buyers' },
    ],
    sectionHeadline: 'Built for bathroom projects customers want done beautifully and properly',
    sectionIntro: 'This template is tailored for renovation businesses that need to sell planning, finish quality, project confidence, and a premium end result rather than just trade labour.',
    services: [
      { icon: '🛁', title: 'Full bathroom renovations and rebuilds', text: 'Ideal for complete remodels where the customer needs confidence in design, demolition, rebuild, and final finish.' },
      { icon: '🚿', title: 'Upgrades, remodels, and wet-area improvements', text: 'Useful for showers, vanities, tiles, fittings, layout improvements, and more targeted bathroom updates.' },
      { icon: '♿', title: 'Accessibility and practical bathroom solutions', text: 'Great for accessible layouts, easier-use designs, and projects where function matters just as much as style.' },
    ],
    differenceHeadline: 'Why this works for bathroom renovation businesses',
    differenceIntro: 'Bathroom buyers want to know the project will be well managed, well finished, and worth the investment. The page needs to reflect premium project confidence rather than generic service language.',
    differentiators: [
      { title: 'Renovation-led tone', text: 'The messaging supports planning, finish quality, materials, and the confidence buyers need for a more significant home-improvement spend.' },
      { title: 'Strong for image-led selling', text: 'This structure becomes far more powerful once you add project imagery, material details, and before-and-after proof.' },
      { title: 'Good fit for full-service project conversations', text: 'It supports buyers who want more than a single trade and are looking for a business that can handle the project properly.' },
    ],
    process: [
      { title: 'Set a premium first impression', text: 'The page is designed to feel more like a renovation brand than a generic local-service listing.' },
      { title: 'Clarify the bathroom project type', text: 'The service sections help buyers identify whether you suit their scale, style, and practical needs.' },
      { title: 'Capture project scope early', text: 'The form helps gather enough room, style, and timing context to make the first conversation more useful.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Project-gallery ready', text: 'Bathroom renovation buyers respond strongly to finished-space images and material detail.' },
      { icon: '📐', title: 'Planning and layout fit', text: 'Useful for buyers who need confidence around design, flow, and how the room will come together.' },
      { icon: '🏠', title: 'Higher-value renovation trust', text: 'Strong for homeowners who need more reassurance before committing to a premium project.' },
    ],
    customerGroup: 'homeowners, renovators, and premium home-improvement buyers',
    testimonials: [
      { name: 'Tanya W.', meta: 'Full bathroom remodel • Paddington', quote: 'The page felt far more polished than most renovation sites we saw. It made the business feel organised and design-aware, and the finished bathroom completely justified that impression.' },
      { name: 'Chris H.', meta: 'Ensuite upgrade quote • New Farm', quote: 'We were comparing quality and project confidence as much as price. The page gave us that confidence and the renovation experience backed it up.' },
      { name: 'Mel S.', meta: 'Accessibility bathroom project • Chapel Hill', quote: 'It felt like a business that understood both design and practical use. The enquiry flow was clear and the final result was exactly what we needed.' },
    ],
    faqs: [
      { q: 'Can this page work for full bathroom renovations and smaller upgrades?', a: 'Yes. It is structured to support both, and can be tuned further depending on whether you focus more on full remodels, refreshes, or accessible bathroom work.' },
      { q: 'What will improve it most?', a: 'Finished-room imagery, before-and-after projects, design details, and reviews that mention process, communication, and end result all improve this template significantly.' },
      { q: 'Is it suitable for premium renovation clients?', a: 'Yes. The tone and visual treatment are intentionally more premium and project-led, which suits higher-value bathroom enquiries much better.' },
      { q: 'What should I customise first?', a: 'Update the visuals, bathroom categories, local project proof, and testimonials so the page reflects the exact renovation style and client type you want most.' },
    ],
    formHeadline: 'Capture bathroom renovation enquiries with clearer project detail from the start.',
    formIntro: 'The form is built to gather the type of bathroom project, the likely scale, style or function goals, and enough timing context to make your first conversation stronger.',
    formPoints: [
      { title: 'Good for premium project buyers', text: 'Useful when the customer is already thinking beyond a simple repair or single-trade job.' },
      { title: 'Supports design and practicality', text: 'The structure works for both style-led and function-led bathroom projects.' },
      { title: 'Easy to brand quickly', text: 'Swap in project imagery, service area, and your renovation style priorities to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a bathroom quote',
    formBadge: 'Renovation-ready form',
    serviceOptions: ['Full bathroom renovation', 'Bathroom refresh', 'Ensuite project', 'Accessibility upgrade', 'Wet-area remodel', 'Bathroom consultation'],
    formCta: 'SEND MY BATHROOM ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether a site consultation is the next step, what level of planning is included, and how finish selections affect quoting.',
  },
  {
    slug: 'kitchen-renovation',
    label: 'Kitchen Renovation Quote',
    icon: '🍽️',
    secondaryIcon: '🧑‍🍳',
    accent: '#ea580c',
    accentDark: '#7c2d12',
    accentSoft: '#ffedd5',
    glow: 'rgba(251,146,60,0.22)',
    badgeColor: '#fdba74',
    logo: 'Foundry Kitchen Projects',
    logoTagline: 'Kitchen renovations, cabinetry upgrades, and full remodel projects',
    badge: 'Kitchens • remodels • cabinetry • layouts • splashbacks • fit-outs',
    headline: 'Kitchen renovation pages should feel premium, functional, and highly considered.',
    subheadline: 'This version is built for full kitchen remodels, cabinetry upgrades, layout changes, splashback and benchtop projects, and renovation-led jobs where design, useability, and trust all shape the quote decision.',
    cta: 'REQUEST A KITCHEN QUOTE',
    responseLine: 'Strong for full remodels, cabinetry upgrades, and premium project enquiries.',
    heroVisualTagline: 'Kitchen-project visual',
    visualHeadline: 'Use finished kitchen imagery, cabinetry details, or real renovation project photos',
    heroChecks: [
      { title: 'Built for high-consideration renovation buyers', text: 'Kitchen projects are often significant investments, so the page is designed to feel premium and well planned.' },
      { title: 'Works for full remodels and targeted upgrades', text: 'Support whole-kitchen renovations, cabinetry and benchtop upgrades, or more focused layout improvements in one structure.' },
    ],
    highlights: [
      { title: 'Position the kitchen project types clearly', text: 'Full remodels, cabinetry, layout changes, storage upgrades, benchtops, splashbacks, and fit-out work can all be presented cleanly.' },
      { title: 'Sell function and finish together', text: 'Kitchen buyers care about workflow, storage, style, and final presentation, so the page is built to communicate both practicality and quality.' },
      { title: 'Good fit for premium project leads', text: 'This structure works when the buyer is comparing design sense, project capability, and whether the business feels right for a bigger spend.' },
    ],
    stats: [
      { value: 'Layout', label: 'Strong for kitchen-function and workflow improvements' },
      { value: 'Cabinetry', label: 'Useful for upgrades where finish and storage matter heavily' },
      { value: 'Premium', label: 'Good fit for high-value kitchen project buyers' },
    ],
    sectionHeadline: 'Built for kitchen projects customers want designed and delivered properly',
    sectionIntro: 'This template is tailored for kitchen renovation businesses that need to sell planning, finish quality, functionality, and the confidence required for a high-importance home project.',
    services: [
      { icon: '🍽️', title: 'Full kitchen remodels and layout changes', text: 'Ideal for projects where the whole kitchen is being rethought for better function, better aesthetics, or better use of space.' },
      { icon: '🗄️', title: 'Cabinetry, storage, and benchtop upgrades', text: 'Useful for targeted improvements that still need a premium finish and a business that feels design-aware.' },
      { icon: '✨', title: 'Feature upgrades and premium finishes', text: 'Great for splashbacks, statement surfaces, better lighting, and the finishing details that make the room feel elevated.' },
    ],
    differenceHeadline: 'Why this works for kitchen renovation businesses',
    differenceIntro: 'Kitchen buyers are often balancing design, practicality, and budget. The page needs to feel premium enough to trust with the space while still sounding organised and grounded.',
    differentiators: [
      { title: 'Design-and-function tone', text: 'The messaging supports layout flow, practical use, finish quality, and project confidence rather than generic renovation filler.' },
      { title: 'Strong fit for image-led selling', text: 'This structure becomes much stronger with finished kitchen imagery, cabinetry details, and before-and-after projects.' },
      { title: 'Useful for larger and more deliberate project conversations', text: 'The page supports buyers who need time, trust, and visual confidence before moving ahead.' },
    ],
    process: [
      { title: 'Set a premium impression immediately', text: 'The first screen is designed to feel more like a renovation brand than a generic trade landing page.' },
      { title: 'Clarify the type of kitchen project', text: 'The service sections help visitors recognise whether you handle the scale and style of kitchen they want.' },
      { title: 'Capture enough project context for a stronger first call', text: 'The form gathers scope, intention, and timing details to help your team respond more meaningfully.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Project-gallery ready', text: 'Kitchen renovation buyers respond strongly to finished spaces, cabinetry details, and design-led imagery.' },
      { icon: '📐', title: 'Layout and function fit', text: 'Useful for buyers who care about how the room will actually work day to day, not just how it looks.' },
      { icon: '🏠', title: 'High-value home-project trust', text: 'Strong for homeowners who need reassurance before committing to a bigger renovation spend.' },
    ],
    customerGroup: 'homeowners, renovators, and premium upgrade buyers',
    testimonials: [
      { name: 'Bec P.', meta: 'Full kitchen renovation • Ashgrove', quote: 'The page felt more premium and more organised than most renovation sites we looked at. It made the business feel like they could genuinely handle a bigger project well.' },
      { name: 'Liam W.', meta: 'Cabinetry and benchtop upgrade • Bardon', quote: 'We wanted a kitchen company that felt style-aware but still practical. The site gave that impression and the project came together exactly the same way.' },
      { name: 'Nicole T.', meta: 'Kitchen layout remodel • Hawthorne', quote: 'The service categories and visuals felt highly relevant to what we wanted to achieve. It made the enquiry process easier and gave us confidence before the first meeting.' },
    ],
    faqs: [
      { q: 'Can this page work for full kitchen renovations and targeted upgrades?', a: 'Yes. It is structured to support both full remodels and more focused cabinetry, benchtop, or layout-improvement work depending on your preferred project mix.' },
      { q: 'What will improve it most?', a: 'Finished kitchen photos, cabinetry and benchtop details, before-and-after examples, and reviews that mention communication and end result all strengthen this page considerably.' },
      { q: 'Is it suitable for premium kitchen buyers?', a: 'Yes. The tone and structure are intentionally more premium and renovation-led, which suits higher-value kitchen projects very well.' },
      { q: 'What should I customise first?', a: 'Update the visuals, service categories, local project proof, and brand tone so the page reflects the kitchen style and buyer you want most.' },
    ],
    formHeadline: 'Capture kitchen project enquiries with better scope and intent from the start.',
    formIntro: 'The form is built to gather the type of kitchen project, likely goals, scope, and timing so your team can respond with a stronger next-step conversation.',
    formPoints: [
      { title: 'Good for premium home projects', text: 'Useful when the buyer needs more confidence and clarity before moving into quoting and planning.' },
      { title: 'Supports design and practical useability', text: 'The structure works for style-led and function-led kitchen buyers alike.' },
      { title: 'Easy to tune quickly', text: 'Swap in project imagery, service area, and renovation priorities to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a kitchen quote',
    formBadge: 'Kitchen-project form',
    serviceOptions: ['Full kitchen renovation', 'Cabinetry upgrade', 'Benchtop and splashback project', 'Layout remodel', 'Kitchen refresh', 'Kitchen consultation'],
    formCta: 'SEND MY KITCHEN ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether consultation, measure-up, or design discussion is the next step and how product choices affect pricing.',
  },
  {
    slug: 'waterproofing',
    label: 'Waterproofing Quote',
    icon: '🛡️',
    secondaryIcon: '💧',
    accent: '#0f766e',
    accentDark: '#134e4a',
    accentSoft: '#ccfbf1',
    glow: 'rgba(45,212,191,0.22)',
    badgeColor: '#99f6e4',
    logo: 'SealRight Waterproofing',
    logoTagline: 'Waterproofing, membranes, wet areas, and leak-prevention systems',
    badge: 'Waterproofing • wet areas • membranes • leak prevention • balconies • remedial works',
    headline: 'Waterproofing pages should feel technical, dependable, and risk-aware.',
    subheadline: 'This version is built for wet-area waterproofing, balconies, remedial works, leak-prevention systems, membranes, and the kind of technical site work where compliance, durability, and trust matter before the quote is requested.',
    cta: 'REQUEST A WATERPROOFING QUOTE',
    responseLine: 'Strong for renovation, remedial, and compliance-sensitive project traffic.',
    heroVisualTagline: 'Waterproofing-system visual',
    visualHeadline: 'Use membrane application, wet-area builds, or clean site-detail imagery',
    heroChecks: [
      { title: 'Built for compliance and technical trust', text: 'Waterproofing buyers want a business that feels competent, process-driven, and aware of what failure actually costs.' },
      { title: 'Works for renovations and remedial jobs', text: 'Support fresh wet-area builds, balcony works, and more technical remedial waterproofing within one structure.' },
    ],
    highlights: [
      { title: 'Position the waterproofing categories clearly', text: 'Bathrooms, balconies, laundries, rooftops, remedial works, and broader wet-area systems can all be presented cleanly.' },
      { title: 'Sell confidence and protection', text: 'This is a category where buyers respond to technical trust, process, and long-term reliability far more than promotional copy.' },
      { title: 'Good fit for builder and renovation traffic', text: 'The page works well for homeowners, renovators, contractors, and clients who need a specialist, not a generalist.' },
    ],
    stats: [
      { value: 'Wet area', label: 'Strong for bathroom, laundry, and internal waterproofing demand' },
      { value: 'Balcony', label: 'Useful for exterior and remedial waterproofing enquiries' },
      { value: 'Compliant', label: 'Good for trust and specification-focused project work' },
    ],
    sectionHeadline: 'Built for the waterproofing work customers need done properly the first time',
    sectionIntro: 'This template is designed for specialist waterproofing businesses where technical credibility, process confidence, and compliance-sensitive messaging all matter heavily.',
    services: [
      { icon: '🛁', title: 'Bathroom and wet-area waterproofing', text: 'Ideal for bathrooms, laundries, ensuites, and internal wet areas where reliability and clean process matter before tiling or fit-out.' },
      { icon: '🏢', title: 'Balconies, remedial, and external works', text: 'Useful for balconies, podiums, external surfaces, and jobs where water ingress and failure risk make trust essential.' },
      { icon: '📋', title: 'Specification, compliance, and project support', text: 'Great for builder work, renovation support, and more formal waterproofing jobs where process and documentation matter.' },
    ],
    differenceHeadline: 'Why this works for waterproofing specialists',
    differenceIntro: 'Waterproofing buyers are often trying to avoid expensive future problems. The page needs to project method, competence, and technical reliability rather than generic trade promises.',
    differentiators: [
      { title: 'Technical-trust tone', text: 'The messaging supports systems, specification, and long-term protection without becoming unreadable or too jargon-heavy.' },
      { title: 'Good for builder and renovation relationships', text: 'This structure works well for homeowners but also supports trade-adjacent and project-based waterproofing enquiries.' },
      { title: 'Strong fit for remedial and higher-risk work', text: 'The page helps the business feel more specialist, which matters in a category where failure is expensive.' },
    ],
    process: [
      { title: 'Make the business feel methodical first', text: 'The first sections are designed to communicate process, competence, and professionalism immediately.' },
      { title: 'Clarify the area and type of waterproofing needed', text: 'The service blocks help buyers understand whether you handle their exact wet-area or remedial scenario.' },
      { title: 'Capture project context for accurate follow-up', text: 'The form collects enough detail to quote, inspect, or advise with more confidence.' },
    ],
    trustPoints: [
      { icon: '🪪', title: 'Compliance and specification fit', text: 'Useful for licences, standards, systems, and process trust signals that make specialist work feel legitimate.' },
      { icon: '🏗️', title: 'Renovation and builder support', text: 'Strong for projects where waterproofing sits within a larger build or remedial scope.' },
      { icon: '📍', title: 'Specialist local-service positioning', text: 'Works well in markets where buyers are actively searching for a dedicated waterproofing specialist, not a general contractor.' },
    ],
    customerGroup: 'homeowners, renovators, builders, and remedial project clients',
    testimonials: [
      { name: 'Angela D.', meta: 'Bathroom waterproofing quote • Coorparoo', quote: 'The page felt much more specialist than the average trade site, which gave us confidence quickly. The process was clear and the work felt properly handled from start to finish.' },
      { name: 'Steve N.', meta: 'Balcony remedial works • Kangaroo Point', quote: 'We needed a waterproofing company that felt technical and trustworthy. The site did that well and the project was managed exactly as professionally as it looked.' },
      { name: 'Megan H.', meta: 'Builder support enquiry • East Brisbane', quote: 'It felt like a specialist, not a generic contractor page. The quote and follow-up made it easy to move the job forward with confidence.' },
    ],
    faqs: [
      { q: 'Can this page work for wet-area and remedial waterproofing?', a: 'Yes. It is structured to support both, and can be tuned depending on whether you focus more on bathrooms, balconies, builder work, or larger remedial jobs.' },
      { q: 'What will strengthen it most?', a: 'Real project imagery, process clarity, system or specification trust points, and reviews that mention professionalism and technical confidence all help a lot.' },
      { q: 'Is it suitable for builder and renovation work too?', a: 'Yes. The structure is a strong fit for trade-adjacent and renovation-led waterproofing enquiries, not just direct-to-owner leads.' },
      { q: 'What should I customise first?', a: 'Update the waterproofing categories, visuals, trust points, and service area so the page reflects the exact specialist work you want to win most often.' },
    ],
    formHeadline: 'Capture waterproofing enquiries with clearer technical and site context from the start.',
    formIntro: 'The form is built to gather the area involved, project type, likely issue or stage, and enough detail to help your team quote or inspect more effectively.',
    formPoints: [
      { title: 'Good for specialist project work', text: 'Useful when the buyer wants a dedicated waterproofing provider rather than a broad contractor.' },
      { title: 'Supports compliance-sensitive jobs', text: 'The structure works well where process, standards, and confidence all matter in the sale.' },
      { title: 'Easy to tune by project type', text: 'Swap in your exact wet-area, balcony, remedial, or builder-focused priorities to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a waterproofing quote',
    formBadge: 'Specialist-service form',
    serviceOptions: ['Bathroom waterproofing', 'Balcony waterproofing', 'Laundry or wet area', 'Remedial waterproofing', 'Builder project support', 'Waterproofing inspection'],
    formCta: 'SEND MY WATERPROOFING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether inspection, substrate condition, or project stage affects quoting and what documentation or process comes next.',
  },
  {
    slug: 'garage-doors',
    label: 'Garage Door Quote',
    icon: '🚪',
    secondaryIcon: '⚙️',
    accent: '#475569',
    accentDark: '#1e293b',
    accentSoft: '#e2e8f0',
    glow: 'rgba(148,163,184,0.24)',
    badgeColor: '#cbd5e1',
    logo: 'Prime Access Garage Doors',
    logoTagline: 'Garage doors, motors, repairs, replacements, and access upgrades',
    badge: 'Garage doors • motors • repairs • replacements • remotes • access systems',
    headline: 'Garage door pages should feel secure, practical, and professionally specified.',
    subheadline: 'This version is built for garage door installs, motor upgrades, emergency repairs, replacements, remote access systems, and residential or commercial access work where reliability and trust matter before the enquiry is sent.',
    cta: 'REQUEST A GARAGE DOOR QUOTE',
    responseLine: 'Strong for repair traffic, replacement projects, and motor-upgrade enquiries.',
    heroVisualTagline: 'Garage-door visual',
    visualHeadline: 'Use clean installed-door imagery, motor system visuals, or technician-on-site photos',
    heroChecks: [
      { title: 'Built for security and convenience-led buying', text: 'Garage door customers want to know the system will work properly, feel secure, and be installed or repaired by a business that looks dependable.' },
      { title: 'Works for emergency fixes and planned upgrades', text: 'Support urgent repair jobs, new door replacements, and automation upgrades in one practical structure.' },
    ],
    highlights: [
      { title: 'Position the service types clearly', text: 'Repairs, new doors, motor replacements, remotes, access issues, and maintenance can all be framed in language buyers understand quickly.' },
      { title: 'Sell reliability, security, and ease of use', text: 'The page focuses on what matters in this category: dependable operation, smoother access, and fewer headaches.' },
      { title: 'Good fit for mixed-value enquiries', text: 'This structure works for smaller repair jobs as well as full door replacement or automation projects.' },
    ],
    stats: [
      { value: 'Repair', label: 'Strong for urgent fixes and malfunction-driven traffic' },
      { value: 'Upgrade', label: 'Useful for motor systems, remotes, and automation enquiries' },
      { value: 'Secure', label: 'Good fit for buyers comparing trust and system reliability' },
    ],
    sectionHeadline: 'Built for garage door and access jobs customers want solved properly',
    sectionIntro: 'This template is tailored for garage door businesses that need to communicate trust, practical know-how, and clean solutions rather than sounding like a generic handyman listing.',
    services: [
      { icon: '🛠️', title: 'Garage door repairs and fault diagnosis', text: 'Ideal for jammed doors, noisy systems, spring issues, track problems, and jobs where the customer wants a fast, competent solution.' },
      { icon: '🚗', title: 'New doors, replacements, and upgrades', text: 'Useful for households or properties replacing old doors, improving street appeal, or upgrading to a better-performing system.' },
      { icon: '📶', title: 'Motors, remotes, and access systems', text: 'Great for automation, motor replacement, remote access, and smoother daily-use functionality.' },
    ],
    differenceHeadline: 'Why this works for garage door businesses',
    differenceIntro: 'Garage door customers are often balancing urgency, security, and convenience. The page is designed to make the business feel organised, trustworthy, and technically capable without becoming overcomplicated.',
    differentiators: [
      { title: 'Practical, trust-heavy tone', text: 'The copy sounds like a serious access and repair business, not a generic trade ad trying to cover too many unrelated services.' },
      { title: 'Good for repair and replacement mix', text: 'The structure supports both fast-response service calls and more considered door replacement or upgrade projects.' },
      { title: 'Strong fit for local proof', text: 'Real install photos, before-and-after replacements, and review snippets make this category much stronger very quickly.' },
    ],
    process: [
      { title: 'Make the business feel dependable first', text: 'The first impression is designed to reassure buyers that the job will be handled efficiently and properly.' },
      { title: 'Clarify the system issue or upgrade goal', text: 'The service sections help visitors identify whether they need repair, replacement, or automation support.' },
      { title: 'Capture the right access details', text: 'The form collects enough information for your team to decide whether the job needs a quote, a call-out, or a product recommendation.' },
    ],
    trustPoints: [
      { icon: '🏠', title: 'Residential and property-ready', text: 'Strong fit for home garages, strata parking access, and smaller commercial access enquiries.' },
      { icon: '📸', title: 'Install-proof friendly', text: 'Real system and finished-door imagery improves trust fast in this category.' },
      { icon: '⚡', title: 'Urgency and convenience fit', text: 'Useful for customers trying to resolve security, access, or malfunction problems quickly.' },
    ],
    customerGroup: 'homeowners, property managers, and access-system buyers',
    testimonials: [
      { name: 'Adam F.', meta: 'Garage door replacement • North Lakes', quote: 'The page felt clear and professional straight away, which mattered because we wanted a business that looked dependable. The quote was easy, the install was clean, and the result looks much better than what we had.' },
      { name: 'Kylie T.', meta: 'Motor upgrade • Carindale', quote: 'We were mainly after a smoother, more reliable system. The page made it easy to understand the options and the finished setup has been excellent.' },
      { name: 'Paul R.', meta: 'Urgent door repair • Redcliffe', quote: 'It felt like a proper garage door company rather than a general maintenance page. That gave us confidence to call, and the repair was handled quickly.' },
    ],
    faqs: [
      { q: 'Can this page work for repairs and new garage doors?', a: 'Yes. It is structured to support urgent repair work, replacement projects, automation upgrades, and broader access-system enquiries.' },
      { q: 'What will strengthen it most?', a: 'Installed-door imagery, technician photos, clear service categories, and reviews that mention reliability and professionalism all improve this page quickly.' },
      { q: 'Is it suitable for commercial access jobs too?', a: 'Yes. The tone works well for residential and smaller commercial or strata-style access enquiries with only minor customisation.' },
      { q: 'What should I customise first?', a: 'Update the door types, motor/access offers, service area, and proof imagery so the page reflects the exact work you want most often.' },
    ],
    formHeadline: 'Capture garage door enquiries with enough system detail to respond properly.',
    formIntro: 'The form is built to gather the likely fault or project type, property context, and urgency so your team can quote, diagnose, or book the right next step more efficiently.',
    formPoints: [
      { title: 'Good for mixed repair and upgrade demand', text: 'Useful for day-to-day service calls as well as more deliberate replacement or automation jobs.' },
      { title: 'Supports security and convenience-led selling', text: 'The structure helps the business feel reliable without overselling or sounding generic.' },
      { title: 'Easy to localise quickly', text: 'Add your main service areas, preferred product categories, and job photos to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a garage door quote',
    formBadge: 'Access-system form',
    serviceOptions: ['Garage door repair', 'New garage door', 'Motor or opener upgrade', 'Remote/access issue', 'Maintenance service', 'Commercial access enquiry'],
    formCta: 'SEND MY GARAGE DOOR ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether photos help diagnose the issue, whether a call-out is required first, and what product details help with quoting.',
  },
  {
    slug: 'guttering',
    label: 'Guttering / Downpipe Quote',
    icon: '🌧️',
    secondaryIcon: '🏠',
    accent: '#0369a1',
    accentDark: '#0c4a6e',
    accentSoft: '#e0f2fe',
    glow: 'rgba(56,189,248,0.2)',
    badgeColor: '#bae6fd',
    logo: 'Flowline Guttering',
    logoTagline: 'Guttering, downpipes, fascia work, and stormwater protection',
    badge: 'Guttering • downpipes • fascia • stormwater • replacement • repairs',
    headline: 'Guttering pages should feel dependable, property-focused, and preventative.',
    subheadline: 'This version is built for gutter replacement, downpipe work, fascia repairs, overflow issues, leaf problems, and stormwater-related roofing edge work where buyers want a practical solution that protects the property long term.',
    cta: 'REQUEST A GUTTERING QUOTE',
    responseLine: 'Strong for repair calls, replacement projects, and preventative maintenance enquiries.',
    heroVisualTagline: 'Roofline visual',
    visualHeadline: 'Use clean roofline imagery, gutter replacement photos, or downpipe detail shots',
    heroChecks: [
      { title: 'Built for property-protection messaging', text: 'Guttering buyers are usually trying to prevent water damage, overflow, and future maintenance headaches.' },
      { title: 'Works for repairs and full replacement jobs', text: 'Support smaller issue-driven jobs and broader roofline upgrades in one straightforward structure.' },
    ],
    highlights: [
      { title: 'Position the roofline services clearly', text: 'Gutters, downpipes, fascia, overflow fixes, leaf management, and replacement work can all be framed in practical terms.' },
      { title: 'Sell prevention and reliability', text: 'This category works best when the page feels useful, well-informed, and focused on protecting the building.' },
      { title: 'Good fit for seasonal and storm-related demand', text: 'The structure supports buyers who are either reacting to visible issues or trying to prevent them before the next heavy weather period.' },
    ],
    stats: [
      { value: 'Protect', label: 'Strong for property-maintenance and water-damage prevention' },
      { value: 'Replace', label: 'Useful for full gutter and downpipe upgrade projects' },
      { value: 'Repair', label: 'Good fit for urgent overflow, leak, and storm-related issues' },
    ],
    sectionHeadline: 'Built for guttering and roofline work that protects the property properly',
    sectionIntro: 'This template is tailored for guttering businesses that need to sound credible and practical, with enough trust to support both urgent fixes and more substantial replacement work.',
    services: [
      { icon: '🔧', title: 'Gutter and downpipe repairs', text: 'Ideal for leaks, rusted sections, overflowing gutters, disconnections, and practical repairs that stop problems getting worse.' },
      { icon: '🏠', title: 'Replacement guttering and roofline upgrades', text: 'Useful for full gutter replacement, improved downpipe layouts, fascia support, and larger property-maintenance projects.' },
      { icon: '🍂', title: 'Overflow prevention and maintenance support', text: 'Great for leaf-related issues, preventative maintenance, and helping the customer avoid repeat overflow problems.' },
    ],
    differenceHeadline: 'Why this works for guttering businesses',
    differenceIntro: 'The best guttering pages feel reliable and solution-oriented. Customers want to know the property will be protected without having to decode vague sales language.',
    differentiators: [
      { title: 'Property-protection tone', text: 'The copy stays focused on water control, maintenance risk, and practical outcomes instead of generic contractor filler.' },
      { title: 'Good for mixed job values', text: 'This structure works for small fixes, ongoing maintenance work, and larger replacement projects alike.' },
      { title: 'Strong fit for visible proof', text: 'Before-and-after roofline images, replacement photos, and clean finished details make this category much stronger quickly.' },
    ],
    process: [
      { title: 'Frame the roofline issue clearly', text: 'The page helps the visitor feel understood whether they are dealing with leaks, overflow, rust, or broader replacement needs.' },
      { title: 'Show the type of solution you provide', text: 'The service blocks help clarify whether you handle reactive repairs, full replacement, or preventative work.' },
      { title: 'Capture enough property detail for quoting', text: 'The form gathers useful context around the building, issue, and urgency so your team can respond more effectively.' },
    ],
    trustPoints: [
      { icon: '🏘️', title: 'Residential and strata fit', text: 'Strong for homes, investment properties, and maintenance-focused property enquiries.' },
      { icon: '📸', title: 'Visible-finish friendly', text: 'Roofline imagery and completed replacement photos help reassure buyers quickly.' },
      { icon: '🌦️', title: 'Seasonal problem-fit', text: 'Useful where storms, leaf build-up, or repeated overflow problems drive demand.' },
    ],
    customerGroup: 'homeowners, landlords, and property managers',
    testimonials: [
      { name: 'Janelle K.', meta: 'Gutter replacement • Albany Creek', quote: 'The page made the business feel practical and trustworthy, which is exactly what we wanted. The quote was clear and the replacement work has already solved the overflow issues we kept having.' },
      { name: 'Marcus E.', meta: 'Downpipe repair • Camp Hill', quote: 'We wanted a specialist who felt focused on the problem rather than a general maintenance page. The site gave that impression and the job was handled efficiently.' },
      { name: 'Diane P.', meta: 'Roofline maintenance quote • Morningside', quote: 'It felt like a business that actually understood property maintenance. The enquiry process was straightforward and the recommendations were useful, not pushy.' },
    ],
    faqs: [
      { q: 'Can this page work for repairs and full gutter replacement?', a: 'Yes. It is structured to support issue-driven repair work, broader replacement jobs, and preventative roofline maintenance enquiries.' },
      { q: 'What will improve it most?', a: 'Real roofline photos, clean before-and-after examples, service-area proof, and reviews that mention reliability and problem-solving all help significantly.' },
      { q: 'Is it suitable for landlords or strata enquiries too?', a: 'Yes. The tone works well for direct homeowners as well as maintenance-minded property contacts with only minor changes.' },
      { q: 'What should I customise first?', a: 'Update the guttering categories, service area, imagery, and any roofline specialties so the page reflects the exact work you want to attract most.' },
    ],
    formHeadline: 'Capture guttering enquiries with enough property detail to quote or inspect properly.',
    formIntro: 'The form is built to gather the issue type, property context, and urgency so your team can decide whether the next step is a quote, inspection, or repair booking.',
    formPoints: [
      { title: 'Good for urgent and preventative demand', text: 'Useful for both visible roofline problems and more planned replacement or maintenance work.' },
      { title: 'Supports property-protection selling', text: 'The structure helps the page feel useful and practical instead of sales-heavy.' },
      { title: 'Easy to tune quickly', text: 'Add your area coverage, roofline specialties, and best proof images to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a guttering quote',
    formBadge: 'Roofline-service form',
    serviceOptions: ['Gutter repair', 'Full gutter replacement', 'Downpipe work', 'Overflow or leak issue', 'Fascia-related work', 'Maintenance inspection'],
    formCta: 'SEND MY GUTTERING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether roof height, access, or photos help with quoting and whether inspection is recommended before pricing.',
  },
  {
    slug: 'plastering',
    label: 'Plastering / Drywall Quote',
    icon: '🧱',
    secondaryIcon: '🎯',
    accent: '#a16207',
    accentDark: '#713f12',
    accentSoft: '#fef3c7',
    glow: 'rgba(250,204,21,0.18)',
    badgeColor: '#fde68a',
    logo: 'TrueLine Plastering',
    logoTagline: 'Plastering, drywall, patching, cornice work, and interior finishing',
    badge: 'Plastering • drywall • patching • repairs • cornice • interior finish',
    headline: 'Plastering pages should feel tidy, skilled, and finish-focused.',
    subheadline: 'This version is built for plastering, drywall installation, patching, cornice work, crack repairs, internal lining, and renovation finishing where the buyer cares about clean results and a smooth process more than anything flashy.',
    cta: 'REQUEST A PLASTERING QUOTE',
    responseLine: 'Strong for repair work, renovation finishing, and neat-detail interior enquiries.',
    heroVisualTagline: 'Interior-finish visual',
    visualHeadline: 'Use clean finished walls, patch-repair imagery, or interior fit-out detail shots',
    heroChecks: [
      { title: 'Built for finish-quality perception', text: 'Plastering buyers want the business to feel neat, competent, and able to leave the room looking right, not just technically complete.' },
      { title: 'Works for repairs and fit-out support', text: 'Support patching, installation, crack work, cornice jobs, and renovation finishing in one clean structure.' },
    ],
    highlights: [
      { title: 'Position the plastering work clearly', text: 'Wall and ceiling repairs, patching, new linings, cornice work, and fit-out finishing can all be framed in language buyers recognise.' },
      { title: 'Sell cleanliness and end result', text: 'This category works best when the page feels controlled, skilled, and focused on the finished surface.' },
      { title: 'Good fit for builders and homeowners', text: 'The structure can support repair traffic, renovation projects, and trade-adjacent fit-out work without losing clarity.' },
    ],
    stats: [
      { value: 'Patch', label: 'Strong for damage repair and localised surface fixes' },
      { value: 'Finish', label: 'Useful for interior work where neatness and detail matter' },
      { value: 'Fit-out', label: 'Good fit for renovation and project-support enquiries' },
    ],
    sectionHeadline: 'Built for plastering and interior finishing work customers want done cleanly',
    sectionIntro: 'This template is tailored for plastering businesses that need the page to feel precise, tidy, and finish-aware, which is what customers actually look for when the work will remain on show.',
    services: [
      { icon: '🪛', title: 'Wall and ceiling repairs', text: 'Ideal for holes, cracks, water-damage areas, patch jobs, and other repairs where a neat finished result matters heavily.' },
      { icon: '🏠', title: 'New plasterboard and lining work', text: 'Useful for room fit-outs, renovation support, ceiling work, and broader internal lining projects.' },
      { icon: '📐', title: 'Cornice, detail, and finishing work', text: 'Great for projects where edge detail, transitions, and visual neatness are a key part of the sale.' },
    ],
    differenceHeadline: 'Why this works for plastering businesses',
    differenceIntro: 'Plastering is a finish-sensitive service. The page needs to feel clean, capable, and easy to trust rather than loud or generic.',
    differentiators: [
      { title: 'Finish-led tone', text: 'The copy stays focused on neatness, surface quality, and professionalism, which suits this category far better than broad contractor wording.' },
      { title: 'Good for residential and trade support', text: 'The structure works for direct homeowner jobs as well as renovation and fit-out support enquiries.' },
      { title: 'Strong fit for visual proof', text: 'Before-and-after patch repair photos, smooth finished walls, and interior detail images improve this page quickly.' },
    ],
    process: [
      { title: 'Make the finish standard feel obvious', text: 'The first sections are designed to show that the business cares about the final look, not just getting the job off the list.' },
      { title: 'Clarify the type of plastering needed', text: 'The service blocks help buyers identify whether they need repair work, new linings, or more detailed finish support.' },
      { title: 'Capture the right room and surface details', text: 'The form gathers enough project context to decide whether the enquiry needs a quote, site visit, or fast repair response.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Before-and-after friendly', text: 'Visible surface repairs and finished interiors make strong proof in this category.' },
      { icon: '🏡', title: 'Home renovation fit', text: 'Strong for bedrooms, living spaces, ceilings, and owner-occupier projects where finish quality matters.' },
      { icon: '🧰', title: 'Builder-support capable', text: 'Useful when you also support renovation, fit-out, or trade-adjacent interior projects.' },
    ],
    customerGroup: 'homeowners, renovators, and fit-out project clients',
    testimonials: [
      { name: 'Lauren V.', meta: 'Ceiling repair • Ashmore', quote: 'The page felt neat and professional straight away, which suited the kind of finish-focused job we needed. The repair blended in beautifully and the whole process was straightforward.' },
      { name: 'Darren K.', meta: 'Plastering for renovation • Nundah', quote: 'We wanted someone who clearly cared about how the final room would look. The site gave that impression and the workmanship delivered on it.' },
      { name: 'Mia C.', meta: 'Wall patching and cornice work • Stafford', quote: 'It felt like a genuine plastering specialist rather than a generic renovation page. The quote was clear and the finish quality was excellent.' },
    ],
    faqs: [
      { q: 'Can this page work for both repairs and new plastering work?', a: 'Yes. It is structured to support patching and ceiling repairs as well as broader lining, fit-out, and finish-oriented projects.' },
      { q: 'What will strengthen it most?', a: 'Finished wall imagery, before-and-after repair photos, room-based examples, and reviews that mention neatness and professionalism all help a lot.' },
      { q: 'Is it suitable for renovation support too?', a: 'Yes. The tone and structure work well for direct homeowner jobs and trade-adjacent fit-out or renovation enquiries.' },
      { q: 'What should I customise first?', a: 'Update the repair and install categories, service area, proof imagery, and testimonials so the page reflects the exact work you want most often.' },
    ],
    formHeadline: 'Capture plastering enquiries with enough room and surface detail to quote properly.',
    formIntro: 'The form is built to gather the type of surface issue or project, room context, and urgency so your team can quote or assess the job more effectively.',
    formPoints: [
      { title: 'Good for repair and fit-out demand', text: 'Useful for direct patch jobs, renovation work, and interior finishing enquiries alike.' },
      { title: 'Supports finish-quality positioning', text: 'The structure helps the business feel tidy and detail-aware from the first screen.' },
      { title: 'Easy to localise quickly', text: 'Add your project examples, room types, and preferred work categories to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a plastering quote',
    formBadge: 'Interior-finish form',
    serviceOptions: ['Wall repair', 'Ceiling repair', 'New plasterboard / lining', 'Cornice or detail work', 'Renovation plastering', 'Surface assessment'],
    formCta: 'SEND MY PLASTERING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether photos help assess the work, whether site visit is needed, and what preparation affects quoting.',
  },
  {
    slug: 'rendering',
    label: 'Rendering Quote',
    icon: '🏘️',
    secondaryIcon: '🎨',
    accent: '#78716c',
    accentDark: '#44403c',
    accentSoft: '#f5f5f4',
    glow: 'rgba(168,162,158,0.22)',
    badgeColor: '#d6d3d1',
    logo: 'Stonecoat Rendering',
    logoTagline: 'Exterior rendering, texture coatings, repairs, and facade upgrades',
    badge: 'Rendering • texture coat • exterior finish • facade repairs • upgrades',
    headline: 'Rendering pages should feel finish-driven, structural, and visually credible.',
    subheadline: 'This version is built for cement rendering, acrylic render, texture coatings, facade upgrades, patch repairs, and exterior finish work where the customer is buying both appearance and confidence in the final result.',
    cta: 'REQUEST A RENDERING QUOTE',
    responseLine: 'Strong for facade upgrades, repair work, and finish-focused exterior enquiries.',
    heroVisualTagline: 'Facade-finish visual',
    visualHeadline: 'Use completed facades, texture detail, or exterior upgrade project imagery',
    heroChecks: [
      { title: 'Built for image-led exterior projects', text: 'Rendering buyers want the business to feel capable of improving presentation while still handling the technical side properly.' },
      { title: 'Works for repairs and full facade upgrades', text: 'Support surface repair jobs and larger curb-appeal projects in one strong structure.' },
    ],
    highlights: [
      { title: 'Position the rendering services clearly', text: 'Repairs, full-house rendering, texture finishes, feature walls, and facade refreshes can all be framed in a way buyers understand quickly.' },
      { title: 'Sell finish, presentation, and confidence', text: 'The page is designed to make the end result feel tangible, not vague or overpromised.' },
      { title: 'Good fit for residential and upgrade-led demand', text: 'This structure works well for homeowners improving appearance, value, and finish quality.' },
    ],
    stats: [
      { value: 'Facade', label: 'Strong for street-facing and visual property upgrades' },
      { value: 'Repair', label: 'Useful for cracking, patching, and finish restoration work' },
      { value: 'Texture', label: 'Good fit for style-led and presentation-led rendering jobs' },
    ],
    sectionHeadline: 'Built for rendering and facade work customers want to look right for years',
    sectionIntro: 'This template is tailored for rendering businesses that need to communicate finish quality, visual impact, and a clean professional process rather than generic builder language.',
    services: [
      { icon: '🏠', title: 'Full-house rendering and facade upgrades', text: 'Ideal for exterior transformations, curb-appeal improvements, and projects where the whole property presentation matters.' },
      { icon: '🧱', title: 'Repair and patch rendering work', text: 'Useful for cracks, damaged surfaces, and restoring a more consistent exterior finish.' },
      { icon: '✨', title: 'Texture coatings and feature finishes', text: 'Great for projects where buyers want a more deliberate or premium-looking finish rather than plain repair work.' },
    ],
    differenceHeadline: 'Why this works for rendering businesses',
    differenceIntro: 'Rendering is both visual and technical. The page needs to feel polished enough to sell the look while still sounding grounded and credible.',
    differentiators: [
      { title: 'Visual-upgrade tone', text: 'The copy supports curb appeal, finish quality, and surface transformation without sounding inflated or unrealistic.' },
      { title: 'Strong fit for before-and-after proof', text: 'This category improves quickly once you add finished facade images and real project comparisons.' },
      { title: 'Good for homeowner upgrade decisions', text: 'The structure works well when the buyer is comparing visual outcome, trust, and whether the business feels capable of delivering a clean finish.' },
    ],
    process: [
      { title: 'Make the finished result feel visible', text: 'The first sections are designed to help the customer imagine a better-looking facade immediately.' },
      { title: 'Clarify whether the need is repair or upgrade', text: 'The service sections help buyers recognise if they need restoration, rendering, or more style-led finish work.' },
      { title: 'Capture enough surface and property detail', text: 'The form gathers the basics needed to make quoting or inspection more useful.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Before-and-after ready', text: 'Rendering benefits heavily from visible transformation proof and completed exterior imagery.' },
      { icon: '🏡', title: 'Street-appeal fit', text: 'Strong for projects where the buyer is improving presentation, resale appeal, or exterior freshness.' },
      { icon: '📍', title: 'Local residential positioning', text: 'Works well for homeowner markets where trust and visible results drive conversions.' },
    ],
    customerGroup: 'homeowners and exterior upgrade clients',
    testimonials: [
      { name: 'Ethan M.', meta: 'Facade rendering • Rochedale', quote: 'The page made the business feel like they genuinely cared about finish quality. That mattered to us because the whole point was improving the look of the house, and the result came out beautifully.' },
      { name: 'Cassie N.', meta: 'Repair rendering quote • Aspley', quote: 'We were trying to fix cracked and tired-looking exterior areas without it feeling like a patch job. The site gave us confidence and the finished work looks seamless.' },
      { name: 'Victor L.', meta: 'Texture coating project • Tarragindi', quote: 'It felt more design-aware than most trade pages without becoming over the top. The quote process was clear and the final finish lifted the property straight away.' },
    ],
    faqs: [
      { q: 'Can this page work for both repair rendering and full facade upgrades?', a: 'Yes. It is structured to support patch repairs, full-house rendering, texture coatings, and finish-led exterior upgrade projects.' },
      { q: 'What will strengthen it most?', a: 'Completed facade photos, before-and-after transformations, finish detail shots, and reviews that mention visual improvement all help significantly.' },
      { q: 'Is it suitable for style-led rendering projects?', a: 'Yes. The structure works well for practical repairs and more presentation-focused finish jobs alike.' },
      { q: 'What should I customise first?', a: 'Update the finish types, project imagery, service area, and any specialty surface categories so the page reflects the exact rendering work you want most.' },
    ],
    formHeadline: 'Capture rendering enquiries with enough project detail to quote or inspect properly.',
    formIntro: 'The form is built to gather the type of surface work, property context, and likely project scope so your team can respond with a more useful next step.',
    formPoints: [
      { title: 'Good for upgrade and repair demand', text: 'Useful for homeowners chasing presentation improvements as well as more practical exterior fixes.' },
      { title: 'Supports visual selling without hype', text: 'The structure helps the business feel finish-aware and credible at the same time.' },
      { title: 'Easy to tune quickly', text: 'Add your best facade imagery, finish categories, and local examples to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a rendering quote',
    formBadge: 'Facade-finish form',
    serviceOptions: ['Full-house rendering', 'Render repair', 'Texture coating', 'Facade upgrade', 'Feature wall finish', 'Surface assessment'],
    formCta: 'SEND MY RENDERING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether surface condition, access, or photos affect quoting and whether inspection is recommended first.',
  },
  {
    slug: 'security-screens',
    label: 'Security Screens / Doors Quote',
    icon: '🛡️',
    secondaryIcon: '🚪',
    accent: '#111827',
    accentDark: '#030712',
    accentSoft: '#e5e7eb',
    glow: 'rgba(107,114,128,0.22)',
    badgeColor: '#d1d5db',
    logo: 'Fortline Screens',
    logoTagline: 'Security screens, security doors, flyscreens, and entry upgrades',
    badge: 'Security screens • security doors • flyscreens • entry upgrades • window protection',
    headline: 'Security screen pages should feel safe, modern, and clearly product-aware.',
    subheadline: 'This version is built for security screens, security doors, window protection, flyscreens, patio enclosures, and home entry upgrades where safety, usability, and presentation all shape the buying decision.',
    cta: 'REQUEST A SECURITY SCREEN QUOTE',
    responseLine: 'Strong for home-security upgrades, replacement work, and screen-door enquiries.',
    heroVisualTagline: 'Entry-upgrade visual',
    visualHeadline: 'Use installed security doors, modern screen systems, or clean entryway imagery',
    heroChecks: [
      { title: 'Built for safety and street-appeal buying', text: 'Customers want a screen or door solution that feels secure but still looks right on the home.' },
      { title: 'Works for practical and presentation-led upgrades', text: 'Support security, insect protection, airflow, and entry enhancement in one focused structure.' },
    ],
    highlights: [
      { title: 'Position the screen and door offers clearly', text: 'Security doors, window screens, flyscreens, patio solutions, and replacement jobs can all be presented in practical language.' },
      { title: 'Sell protection with everyday usability', text: 'The page focuses on comfort, airflow, access, and safety rather than generic alarm-style fear language.' },
      { title: 'Good fit for upgrade-led homeowners', text: 'This structure works well when the customer is improving the home while also solving a practical need.' },
    ],
    stats: [
      { value: 'Secure', label: 'Strong for buyers comparing protection and trust' },
      { value: 'Entry', label: 'Useful for front-door and patio upgrade demand' },
      { value: 'Modern', label: 'Good fit for style-aware home improvement buyers' },
    ],
    sectionHeadline: 'Built for screen and security-door upgrades customers want to trust',
    sectionIntro: 'This template is tailored for security screen businesses that need to feel modern, protective, and visually credible without drifting into overhyped fear-based messaging.',
    services: [
      { icon: '🚪', title: 'Security doors and entry upgrades', text: 'Ideal for front doors, side access, patio doors, and entry points where security and street appeal both matter.' },
      { icon: '🪟', title: 'Window screens and protection systems', text: 'Useful for window-based security upgrades, insect protection, and safer ventilation without losing presentation.' },
      { icon: '🏡', title: 'Flyscreens and lifestyle-focused solutions', text: 'Great for households looking to improve airflow, comfort, and daily usability while also upgrading the home.' },
    ],
    differenceHeadline: 'Why this works for security screen businesses',
    differenceIntro: 'Buyers in this category want to feel safer, but they also care about appearance, comfort, and whether the installer feels organised and reputable. The page is built around that balance.',
    differentiators: [
      { title: 'Protection-without-panic tone', text: 'The copy keeps the focus on practical security and quality product feel, not fear-based claims or exaggerated messaging.' },
      { title: 'Good for product-led visual selling', text: 'This structure becomes much stronger with installed-door photos, frame details, and entryway project proof.' },
      { title: 'Strong fit for residential upgrade traffic', text: 'The page works well when the buyer is improving comfort, presentation, and peace of mind at the same time.' },
    ],
    process: [
      { title: 'Set a safe, polished first impression', text: 'The first sections are designed to make the business feel both protective and design-aware.' },
      { title: 'Clarify the type of screen or entry need', text: 'The service blocks help buyers identify whether they need security doors, window screens, or broader home-access upgrades.' },
      { title: 'Capture enough property detail for quoting', text: 'The form collects the basics needed to quote, measure, or recommend the right next step.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Installed-product friendly', text: 'Real door, frame, and screen imagery helps this category convert much more convincingly.' },
      { icon: '🏠', title: 'Home-upgrade positioning', text: 'Strong for owner-occupier traffic where the customer wants the house to feel better, safer, and more polished.' },
      { icon: '🌬️', title: 'Comfort and airflow fit', text: 'Useful when buyers care about ventilation and lifestyle, not just security alone.' },
    ],
    customerGroup: 'homeowners and residential upgrade clients',
    testimonials: [
      { name: 'Naomi R.', meta: 'Security door upgrade • Wynnum', quote: 'The page felt modern and trustworthy, which helped because we wanted security without making the front of the house look harsh. The finished door looks excellent and works beautifully.' },
      { name: 'Troy C.', meta: 'Window screen quote • Mount Gravatt', quote: 'We liked that the page focused on practical improvement rather than fear-based sales copy. It made the business feel more credible straight away.' },
      { name: 'Kerry J.', meta: 'Patio screen project • Capalaba', quote: 'It felt like a proper specialist rather than a generic home-service page. The quote process was easy and the end result improved both comfort and peace of mind.' },
    ],
    faqs: [
      { q: 'Can this page work for security doors and flyscreens?', a: 'Yes. It is structured to support security doors, window screens, flyscreens, patio solutions, and broader entry-upgrade enquiries.' },
      { q: 'What will strengthen it most?', a: 'Installed-product photos, close-up finish details, local examples, and reviews that mention both quality and usability all improve this page quickly.' },
      { q: 'Is it suitable for premium residential buyers?', a: 'Yes. The tone and structure work well for homeowners who care about both security and how the finished product looks on the property.' },
      { q: 'What should I customise first?', a: 'Update the product categories, project imagery, service area, and proof points so the page reflects the exact screen and door solutions you want to sell most often.' },
    ],
    formHeadline: 'Capture security screen enquiries with enough property detail to quote properly.',
    formIntro: 'The form is built to gather the likely product need, property context, and any priority access points so your team can quote or arrange measure-up more effectively.',
    formPoints: [
      { title: 'Good for style-aware home upgrades', text: 'Useful when buyers want security and comfort without sacrificing the look of the home.' },
      { title: 'Supports product-led selling', text: 'The structure helps the business feel more specialist and considered from the first screen.' },
      { title: 'Easy to tune quickly', text: 'Add your main door and screen categories, installation photos, and local proof to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a security screen quote',
    formBadge: 'Home-upgrade form',
    serviceOptions: ['Security door', 'Window screens', 'Flyscreens', 'Patio or enclosure screen', 'Replacement or upgrade', 'Measure and quote'],
    formCta: 'SEND MY SCREEN ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether measurements, photos, or site visit are needed before final pricing and what product options are available.',
  },
  {
    slug: 'irrigation',
    label: 'Irrigation / Sprinkler Quote',
    icon: '💦',
    secondaryIcon: '🌿',
    accent: '#0f766e',
    accentDark: '#134e4a',
    accentSoft: '#ccfbf1',
    glow: 'rgba(45,212,191,0.2)',
    badgeColor: '#99f6e4',
    logo: 'GreenFlow Irrigation',
    logoTagline: 'Irrigation systems, sprinklers, drip lines, and water-smart installs',
    badge: 'Irrigation • sprinklers • drip systems • controllers • repairs • water efficiency',
    headline: 'Irrigation pages should feel practical, efficient, and built around real property outcomes.',
    subheadline: 'This version is built for irrigation installs, sprinkler upgrades, drip systems, controller automation, repairs, and water-efficiency projects where buyers want healthier lawns and gardens without waste or hassle.',
    cta: 'REQUEST AN IRRIGATION QUOTE',
    responseLine: 'Strong for residential systems, landscape upgrades, and repair-driven enquiries.',
    heroVisualTagline: 'Irrigation-system visual',
    visualHeadline: 'Use lawn irrigation, garden zones, controller systems, or clean property imagery',
    heroChecks: [
      { title: 'Built for practical property improvement', text: 'Irrigation buyers want a system that works reliably, saves effort, and fits the property rather than a vague landscaping pitch.' },
      { title: 'Works for new installs and system fixes', text: 'Support fresh irrigation layouts, controller upgrades, and troubleshooting or repair work in one structure.' },
    ],
    highlights: [
      { title: 'Position the irrigation services clearly', text: 'Sprinklers, drip lines, controller upgrades, zoning, repairs, and water-management improvements can all be framed in simple terms.' },
      { title: 'Sell convenience and efficiency', text: 'The page is built around healthier gardens, better watering coverage, and less wasted time or water.' },
      { title: 'Good fit for homeowners and landscape projects', text: 'This structure supports direct residential leads as well as upgrade work tied to broader outdoor improvements.' },
    ],
    stats: [
      { value: 'Sprinkler', label: 'Strong for lawn coverage and property-wide watering systems' },
      { value: 'Drip', label: 'Useful for gardens, beds, and efficient low-waste watering' },
      { value: 'Smart', label: 'Good fit for controller and automation upgrade enquiries' },
    ],
    sectionHeadline: 'Built for irrigation systems that make outdoor maintenance easier and more reliable',
    sectionIntro: 'This template is tailored for irrigation businesses that need to sound capable, practical, and solution-focused rather than like a generic gardening page.',
    services: [
      { icon: '🌱', title: 'Lawn and garden irrigation installs', text: 'Ideal for new homes, upgraded landscapes, and properties that need better watering coverage without constant manual effort.' },
      { icon: '🕹️', title: 'Controllers, zoning, and automation', text: 'Useful for smarter watering schedules, easier property management, and systems that feel easier to live with day to day.' },
      { icon: '🔧', title: 'Repairs, faults, and system optimisation', text: 'Great for leaks, low-pressure issues, broken sprinklers, and adjustments that improve performance and efficiency.' },
    ],
    differenceHeadline: 'Why this works for irrigation businesses',
    differenceIntro: 'Irrigation buyers are usually looking for a reliable outcome, not decorative marketing. The page is built to feel useful, well planned, and clearly tied to better property performance.',
    differentiators: [
      { title: 'Property-outcome tone', text: 'The copy focuses on healthier lawns, easier watering, and efficient system design rather than generic landscaping claims.' },
      { title: 'Good for installs and service work', text: 'This structure supports larger installation jobs as well as the smaller repair and adjustment work that often drives local demand.' },
      { title: 'Strong fit for visual proof', text: 'Zone maps, controller imagery, neat sprinkler layouts, and healthy garden photos improve this category quickly.' },
    ],
    process: [
      { title: 'Make the system outcome clear first', text: 'The opening sections are designed to help the customer picture easier, more consistent watering immediately.' },
      { title: 'Clarify whether they need install, upgrade, or repair', text: 'The service blocks help buyers recognise if you fit their property and system needs.' },
      { title: 'Capture enough site detail for quoting', text: 'The form gathers useful property and watering context so your team can suggest the right next step.' },
    ],
    trustPoints: [
      { icon: '🏡', title: 'Residential-property fit', text: 'Strong for homes, gardens, lawns, and outdoor spaces where convenience and presentation both matter.' },
      { icon: '💧', title: 'Efficiency positioning', text: 'Useful where buyers care about reducing water waste while improving coverage and plant health.' },
      { icon: '📸', title: 'System-proof friendly', text: 'Installed-zone photos, controller setups, and healthy-result imagery build trust fast.' },
    ],
    customerGroup: 'homeowners, landscapers, and property-maintenance clients',
    testimonials: [
      { name: 'Natalie S.', meta: 'Garden irrigation install • Bridgeman Downs', quote: 'The page made the business feel practical and organised, which is exactly what we wanted. The system works brilliantly and the whole garden is easier to manage now.' },
      { name: 'Dylan P.', meta: 'Sprinkler repair • Ormiston', quote: 'It felt like a proper irrigation specialist rather than a general garden service. The issue was fixed quickly and the setup is working better than it ever has.' },
      { name: 'Rosa M.', meta: 'Controller upgrade • Helensvale', quote: 'We wanted something smarter and simpler to use. The page made the options easy to understand and the final system has been excellent.' },
    ],
    faqs: [
      { q: 'Can this page work for new irrigation installs and repairs?', a: 'Yes. It is structured to support new systems, upgrades, controller work, repairs, and broader water-efficiency projects.' },
      { q: 'What will strengthen it most?', a: 'Installed-system photos, controller screenshots, healthy lawn or garden visuals, and reviews that mention reliability all improve this page quickly.' },
      { q: 'Is it suitable for landscaper referrals too?', a: 'Yes. The tone and structure also work well for trade-adjacent or landscape-linked irrigation enquiries.' },
      { q: 'What should I customise first?', a: 'Update the irrigation categories, service area, visuals, and proof points so the page reflects the systems and properties you most want to work on.' },
    ],
    formHeadline: 'Capture irrigation enquiries with enough property detail to quote or troubleshoot properly.',
    formIntro: 'The form is built to gather the property type, system need, and any watering issues so your team can quote, inspect, or recommend the right solution more effectively.',
    formPoints: [
      { title: 'Good for installs and maintenance demand', text: 'Useful for fresh systems, smarter upgrades, and issue-driven repair enquiries.' },
      { title: 'Supports practical benefit-led selling', text: 'The structure keeps the focus on convenience, plant health, and water efficiency.' },
      { title: 'Easy to tune quickly', text: 'Add your best garden imagery, system categories, and local proof to sharpen the page fast.' },
    ],
    formCardTitle: 'Request an irrigation quote',
    formBadge: 'Water-system form',
    serviceOptions: ['New irrigation system', 'Sprinkler repair', 'Drip irrigation', 'Controller upgrade', 'Zone adjustment', 'Property assessment'],
    formCta: 'SEND MY IRRIGATION ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether plans, photos, or a site visit are needed and what property details help with pricing.',
  },
  {
    slug: 'epoxy-flooring',
    label: 'Epoxy Flooring Quote',
    icon: '🧪',
    secondaryIcon: '🏭',
    accent: '#2563eb',
    accentDark: '#1e3a8a',
    accentSoft: '#dbeafe',
    glow: 'rgba(96,165,250,0.22)',
    badgeColor: '#bfdbfe',
    logo: 'SurfaceCore Epoxy',
    logoTagline: 'Epoxy flooring, garage coatings, commercial floors, and polished finishes',
    badge: 'Epoxy floors • garage coatings • commercial floors • flake systems • sealed concrete',
    headline: 'Epoxy flooring pages should feel durable, modern, and finish-led.',
    subheadline: 'This version is built for garage epoxy, commercial floor coatings, flake systems, sealed concrete, workshop flooring, and other surface-upgrade projects where customers want a floor that performs and looks sharp.',
    cta: 'REQUEST AN EPOXY FLOORING QUOTE',
    responseLine: 'Strong for garage transformations, commercial flooring, and premium surface-upgrade enquiries.',
    heroVisualTagline: 'Floor-finish visual',
    visualHeadline: 'Use finished garage floors, commercial coating imagery, or polished surface detail',
    heroChecks: [
      { title: 'Built for finish and durability buying', text: 'Epoxy buyers want the surface to look impressive while also standing up to real use, so the page is built around that dual value.' },
      { title: 'Works for residential and commercial demand', text: 'Support garages, workshops, showrooms, warehouses, and utility spaces without making the page feel scattered.' },
    ],
    highlights: [
      { title: 'Position the floor-coating services clearly', text: 'Garage floors, flake systems, commercial coatings, sealed concrete, and workshop surfaces can all be framed in practical language.' },
      { title: 'Sell performance with visual impact', text: 'This category converts best when the page makes the finish feel tangible rather than talking in generic contractor terms.' },
      { title: 'Good fit for higher-consideration upgrades', text: 'The structure supports buyers who are comparing surface quality, durability, and whether the finish justifies the spend.' },
    ],
    stats: [
      { value: 'Garage', label: 'Strong for residential floor transformations and visible upgrades' },
      { value: 'Commercial', label: 'Useful for workshops, showrooms, and business flooring needs' },
      { value: 'Finish', label: 'Good fit for buyers focused on surface quality and long-term durability' },
    ],
    sectionHeadline: 'Built for epoxy and coated-floor projects customers want to perform and look right',
    sectionIntro: 'This template is tailored for epoxy flooring businesses that need to sell both visual finish and technical confidence without becoming too product-heavy or abstract.',
    services: [
      { icon: '🚗', title: 'Garage and residential floor coatings', text: 'Ideal for garages, storage spaces, utility areas, and homeowners who want a cleaner, tougher, more polished floor.' },
      { icon: '🏢', title: 'Commercial and workshop flooring', text: 'Useful for businesses that need durable, easy-clean surfaces in practical, high-use spaces.' },
      { icon: '✨', title: 'Decorative and premium finish systems', text: 'Great for flake systems, presentation-led coatings, and spaces where the floor contributes to the overall look of the property.' },
    ],
    differenceHeadline: 'Why this works for epoxy flooring businesses',
    differenceIntro: 'Customers in this category respond strongly to finish quality, process confidence, and whether the installer feels like a specialist rather than a generic concrete contractor.',
    differentiators: [
      { title: 'Surface-specialist tone', text: 'The copy supports preparation, finish, and durability in a way that feels relevant to coated-floor buyers.' },
      { title: 'Strong fit for before-and-after proof', text: 'Garage and commercial floor transformations are highly visual, so this structure gets stronger quickly with good project imagery.' },
      { title: 'Good for mixed residential and commercial lead flow', text: 'The page supports domestic upgrades and more practical business flooring enquiries in one coherent layout.' },
    ],
    process: [
      { title: 'Make the upgraded floor feel visible immediately', text: 'The opening sections are designed to help the buyer picture a cleaner, sharper, harder-wearing space.' },
      { title: 'Clarify the surface and use case', text: 'The service blocks help visitors identify whether you suit their garage, commercial, or premium-finish project.' },
      { title: 'Capture enough floor and site detail', text: 'The form gathers the basics needed to quote, inspect, or recommend the right coating system.' },
    ],
    trustPoints: [
      { icon: '📸', title: 'Transformation-proof friendly', text: 'Before-and-after floor images and finish details make this category significantly stronger.' },
      { icon: '🏭', title: 'Practical-performance fit', text: 'Strong for buyers who care about cleanability, durability, and how the floor holds up in real use.' },
      { icon: '🏠', title: 'Residential-upgrade positioning', text: 'Useful for homeowners who want the space to look more premium and feel easier to maintain.' },
    ],
    customerGroup: 'homeowners, workshop owners, and commercial property clients',
    testimonials: [
      { name: 'Mark T.', meta: 'Garage epoxy floor • Mackenzie', quote: 'The page made the business feel much more specialist than the average flooring site. The finished garage looks incredible and the whole process felt well handled.' },
      { name: 'Priya D.', meta: 'Commercial coating quote • Slacks Creek', quote: 'We needed a floor that would look good and hold up well. The site gave us confidence in both and the result has been excellent.' },
      { name: 'Daniel K.', meta: 'Flake finish project • Carseldine', quote: 'It felt like a proper epoxy flooring company, not generic trade copy. The visuals and quote flow were clear, and the final finish is exactly what we wanted.' },
    ],
    faqs: [
      { q: 'Can this page work for garage floors and commercial coatings?', a: 'Yes. It is structured to support residential garage upgrades, workshop surfaces, commercial flooring, and decorative finish systems.' },
      { q: 'What will strengthen it most?', a: 'Before-and-after floor transformations, surface-prep proof, finish close-ups, and reviews that mention durability and professionalism all help a lot.' },
      { q: 'Is it suitable for premium finishes too?', a: 'Yes. The structure works well for functional surfaces and more presentation-led flake or decorative systems alike.' },
      { q: 'What should I customise first?', a: 'Update the floor-system categories, imagery, service area, and proof points so the page reflects the exact coating work you want most often.' },
    ],
    formHeadline: 'Capture epoxy flooring enquiries with enough surface detail to quote properly.',
    formIntro: 'The form is built to gather the space type, current floor condition, and likely use case so your team can quote or advise on the right system more effectively.',
    formPoints: [
      { title: 'Good for residential and commercial jobs', text: 'Useful for garages, workshops, business spaces, and premium surface-upgrade projects alike.' },
      { title: 'Supports finish-led selling', text: 'The structure makes room for visual proof and clear positioning around durability and appearance.' },
      { title: 'Easy to tune quickly', text: 'Add your best floor imagery, system categories, and local examples to sharpen the page fast.' },
    ],
    formCardTitle: 'Request an epoxy flooring quote',
    formBadge: 'Surface-upgrade form',
    serviceOptions: ['Garage epoxy floor', 'Commercial floor coating', 'Workshop floor', 'Flake system', 'Concrete sealing', 'Surface assessment'],
    formCta: 'SEND MY FLOORING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether floor prep, moisture, area size, or photos affect pricing and whether inspection is the next step.',
  },
  {
    slug: 'shutters-blinds',
    label: 'Shutters / Blinds Quote',
    icon: '🪟',
    secondaryIcon: '☀️',
    accent: '#7c3aed',
    accentDark: '#4c1d95',
    accentSoft: '#ede9fe',
    glow: 'rgba(167,139,250,0.22)',
    badgeColor: '#ddd6fe',
    logo: 'Clearline Shutters',
    logoTagline: 'Plantation shutters, blinds, awnings, and window furnishing installs',
    badge: 'Shutters • blinds • awnings • window furnishings • privacy • light control',
    headline: 'Shutters and blinds pages should feel stylish, practical, and home-upgrade ready.',
    subheadline: 'This version is built for plantation shutters, roller blinds, outdoor awnings, privacy solutions, and window furnishing upgrades where customers care about presentation, light control, and a cleaner finished home.',
    cta: 'REQUEST A SHUTTERS QUOTE',
    responseLine: 'Strong for style-led home upgrades and window-covering enquiries.',
    heroVisualTagline: 'Window-furnishing visual',
    visualHeadline: 'Use finished interiors, shutter details, or clean window-treatment imagery',
    heroChecks: [
      { title: 'Built for style and usability buying', text: 'Customers in this category care about how the product looks in the room as much as what it does day to day.' },
      { title: 'Works for interior and exterior upgrades', text: 'Support plantation shutters, blinds, awnings, and broader privacy or shade solutions in one focused structure.' },
    ],
    highlights: [
      { title: 'Position the window-covering services clearly', text: 'Shutters, roller blinds, outdoor blinds, awnings, privacy upgrades, and room-by-room installs can all be framed cleanly.' },
      { title: 'Sell light control, privacy, and finish', text: 'The page focuses on making the home feel more comfortable, polished, and better controlled rather than sounding like generic retail copy.' },
      { title: 'Good fit for premium residential buyers', text: 'This structure works well when the customer is comparing style, quality, and whether the business feels reputable enough to invite into the home.' },
    ],
    stats: [
      { value: 'Privacy', label: 'Strong for room comfort and day-to-day usability improvements' },
      { value: 'Style', label: 'Useful for buyers led by presentation and home finish' },
      { value: 'Shade', label: 'Good fit for outdoor blinds and awning enquiries' },
    ],
    sectionHeadline: 'Built for shutter and blind upgrades customers want to look right and work well',
    sectionIntro: 'This template is tailored for window furnishing businesses that need to feel design-aware, practical, and trustworthy without reading like a generic product catalogue.',
    services: [
      { icon: '🏠', title: 'Plantation shutters and interior blinds', text: 'Ideal for homes upgrading privacy, light control, and room presentation with a cleaner, more finished look.' },
      { icon: '☀️', title: 'Outdoor blinds, awnings, and shade solutions', text: 'Useful for patios, outdoor living areas, and spaces where sun control and comfort matter heavily.' },
      { icon: '📐', title: 'Measure, supply, and install service', text: 'Great for buyers who want a straightforward quote and an installer who feels experienced and detail-aware.' },
    ],
    differenceHeadline: 'Why this works for shutters and blinds businesses',
    differenceIntro: 'Customers here are often choosing based on taste, trust, and how easy the experience feels. The page is built to feel polished, product-aware, and credible from the first screen.',
    differentiators: [
      { title: 'Home-upgrade tone', text: 'The copy positions the offer as a meaningful home improvement, not a commodity window product.' },
      { title: 'Strong fit for lifestyle and visual selling', text: 'This structure becomes far more persuasive once you add room imagery, installed products, and finish details.' },
      { title: 'Good for consultation-led enquiries', text: 'The form and layout help the business feel easy to engage with for measure-and-quote style buying.' },
    ],
    process: [
      { title: 'Set a polished first impression', text: 'The page is designed to feel more like a considered home brand than a generic local-service listing.' },
      { title: 'Clarify the room or product need', text: 'The service sections help visitors identify whether they need shutters, interior blinds, or outdoor shade solutions.' },
      { title: 'Capture enough project detail for quoting', text: 'The form gathers the basics needed for measure-up, product recommendation, or next-step consultation.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Room-visual friendly', text: 'Installed room imagery and product detail photos help this category convert much better.' },
      { icon: '🏡', title: 'Home-finish positioning', text: 'Strong for owner-occupier projects where style and overall feel matter heavily.' },
      { icon: '📏', title: 'Measure-and-install fit', text: 'Useful where the customer wants a provider who seems accurate, organised, and easy to work with.' },
    ],
    customerGroup: 'homeowners and residential upgrade clients',
    testimonials: [
      { name: 'Elise W.', meta: 'Plantation shutters • Bulimba', quote: 'The page felt much more polished than most window-covering sites we looked at. It made the business feel trustworthy and the finished shutters look excellent in the house.' },
      { name: 'Greg H.', meta: 'Outdoor blinds quote • Manly West', quote: 'We wanted something practical that still looked good. The site balanced both really well and the final install has transformed the outdoor area.' },
      { name: 'Monica T.', meta: 'Roller blind upgrade • Clayfield', quote: 'It felt more like a serious home-upgrade brand than a generic retailer. The quote flow was clear and the result lifted the rooms straight away.' },
    ],
    faqs: [
      { q: 'Can this page work for shutters, blinds, and awnings?', a: 'Yes. It is structured to support interior shutters, blinds, outdoor shade products, and broader privacy or window-upgrade enquiries.' },
      { q: 'What will strengthen it most?', a: 'Installed room imagery, close-up finish details, before-and-after spaces, and reviews that mention both look and usability all help significantly.' },
      { q: 'Is it suitable for premium residential buyers?', a: 'Yes. The tone and structure are intentionally style-aware and consultation-friendly, which suits higher-quality home-upgrade traffic well.' },
      { q: 'What should I customise first?', a: 'Update the product categories, room imagery, service area, and proof points so the page reflects the exact window furnishing offers you most want to sell.' },
    ],
    formHeadline: 'Capture shutters and blinds enquiries with enough home detail to quote properly.',
    formIntro: 'The form is built to gather the likely product type, room or outdoor area, and basic scope so your team can quote or arrange measure-up more effectively.',
    formPoints: [
      { title: 'Good for consultation-led residential sales', text: 'Useful when buyers want guidance on the right product as well as a price.' },
      { title: 'Supports style and practical-use positioning', text: 'The structure helps the page sell comfort, privacy, and finish quality together.' },
      { title: 'Easy to tune quickly', text: 'Add your best room imagery, product categories, and local proof to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a shutters quote',
    formBadge: 'Window-upgrade form',
    serviceOptions: ['Plantation shutters', 'Roller blinds', 'Outdoor blinds', 'Awnings', 'Privacy upgrade', 'Measure and quote'],
    formCta: 'SEND MY SHUTTERS ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether rough measurements or photos help, what consultation includes, and how product choices affect pricing.',
  },
  {
    slug: 'concrete-cutting',
    label: 'Concrete Cutting / Coring Quote',
    icon: '🪚',
    secondaryIcon: '🧱',
    accent: '#52525b',
    accentDark: '#27272a',
    accentSoft: '#f4f4f5',
    glow: 'rgba(161,161,170,0.22)',
    badgeColor: '#d4d4d8',
    logo: 'Precision Core & Cut',
    logoTagline: 'Concrete cutting, coring, sawing, demolition support, and access work',
    badge: 'Concrete cutting • core drilling • wall sawing • slab sawing • demolition support',
    headline: 'Concrete cutting pages should feel capable, technical, and job-site ready.',
    subheadline: 'This version is built for slab sawing, wall sawing, core drilling, concrete cutting, demolition support, and access work where the buyer wants precision, equipment confidence, and a crew that feels safe to bring onto site.',
    cta: 'REQUEST A CONCRETE CUTTING QUOTE',
    responseLine: 'Strong for builder traffic, site work, and technical-cutting enquiries.',
    heroVisualTagline: 'Concrete-cutting visual',
    visualHeadline: 'Use crew-on-site imagery, coring detail, or clean technical job photography',
    heroChecks: [
      { title: 'Built for technical and site-led buying', text: 'Concrete cutting customers want to know the business can execute accurately, safely, and without unnecessary disruption.' },
      { title: 'Works for builders, plumbers, and direct clients', text: 'Support trade-adjacent cutting work, renovation projects, and access-related jobs within one grounded structure.' },
    ],
    highlights: [
      { title: 'Position the cutting services clearly', text: 'Core drilling, slab cutting, wall sawing, trench cuts, penetrations, and demolition support can all be framed in a way site buyers understand quickly.' },
      { title: 'Sell precision and clean execution', text: 'The page focuses on technical confidence, reliable scheduling, and controlled site work rather than broad contractor claims.' },
      { title: 'Good fit for serious job-site leads', text: 'This structure works when the buyer wants a specialist operator rather than a general construction service.' },
    ],
    stats: [
      { value: 'Core', label: 'Strong for penetration, service-access, and drilling enquiries' },
      { value: 'Saw', label: 'Useful for slab, wall, and demolition-support cutting work' },
      { value: 'Site', label: 'Good fit for trade and builder-led project demand' },
    ],
    sectionHeadline: 'Built for concrete cutting jobs where precision and site confidence matter',
    sectionIntro: 'This template is tailored for concrete cutting specialists that need the page to feel technical, safe, and clearly execution-focused rather than broad and generic.',
    services: [
      { icon: '🕳️', title: 'Core drilling and service penetrations', text: 'Ideal for plumbing, electrical, HVAC, and access jobs where holes and penetrations need to be cut accurately and cleanly.' },
      { icon: '📏', title: 'Slab, wall, and trench cutting', text: 'Useful for renovations, modifications, demolition support, and projects that need precise concrete removal or opening creation.' },
      { icon: '🏗️', title: 'Builder and site-support work', text: 'Great for commercial sites, renovation teams, and contractors needing a specialist cutting partner who can work neatly within project timelines.' },
    ],
    differenceHeadline: 'Why this works for concrete cutting businesses',
    differenceIntro: 'This category depends on trust in precision and safe execution. The page is built to make the business feel like a capable specialist rather than a general construction catch-all.',
    differentiators: [
      { title: 'Technical-specialist tone', text: 'The copy supports coring, sawing, and job-site execution in a way that sounds relevant to buyers who know what they are looking for.' },
      { title: 'Good for builder and trade referral traffic', text: 'The structure works well for direct clients but is especially strong for contractors and project managers seeking a reliable specialist.' },
      { title: 'Strong fit for site and equipment proof', text: 'On-site imagery, clean cuts, and examples of technical work make this category more believable very quickly.' },
    ],
    process: [
      { title: 'Establish site competence immediately', text: 'The first impression is designed to show controlled, experienced, specialist cutting capability.' },
      { title: 'Clarify the type of cut or access needed', text: 'The service blocks help buyers identify whether they need coring, sawing, or broader site support.' },
      { title: 'Capture enough technical detail for quoting', text: 'The form gathers the basics needed to understand the site, material, and type of concrete work involved.' },
    ],
    trustPoints: [
      { icon: '🏗️', title: 'Job-site credibility', text: 'Strong for builders, contractors, and site-led projects where professionalism matters heavily.' },
      { icon: '📸', title: 'Technical-work proof', text: 'Real on-site photos and cut-detail imagery help this category convert more credibly.' },
      { icon: '🧰', title: 'Specialist-trade positioning', text: 'Useful where the buyer is actively looking for a dedicated cutting and coring service rather than a general contractor.' },
    ],
    customerGroup: 'builders, trades, contractors, and project-based clients',
    testimonials: [
      { name: 'Anthony G.', meta: 'Core drilling job • Murarrie', quote: 'The page felt like a proper specialist operation, which mattered because we needed accurate work on a live site. The team delivered exactly that.' },
      { name: 'Jess L.', meta: 'Slab cutting quote • Tingalpa', quote: 'We were comparing capability more than anything else. The site made the business look organised and technically sound, and the job was handled cleanly.' },
      { name: 'Matt P.', meta: 'Builder support cutting works • Eight Mile Plains', quote: 'It felt relevant to the kind of site work we needed, not generic construction copy. The process was efficient and the cutting was spot on.' },
    ],
    faqs: [
      { q: 'Can this page work for core drilling and slab cutting?', a: 'Yes. It is structured to support coring, slab and wall sawing, access cuts, demolition support, and trade-adjacent technical cutting work.' },
      { q: 'What will strengthen it most?', a: 'Real site imagery, equipment photos, cut-detail shots, and reviews that mention professionalism and accuracy all help significantly.' },
      { q: 'Is it suitable for builder and commercial work too?', a: 'Yes. The tone and structure are especially well suited to builder, trade, and project-based clients.' },
      { q: 'What should I customise first?', a: 'Update the cutting categories, site-proof imagery, service area, and trust points so the page reflects the exact technical work you want to attract.' },
    ],
    formHeadline: 'Capture concrete cutting enquiries with enough site detail to quote properly.',
    formIntro: 'The form is built to gather the cut type, project context, site access, and urgency so your team can quote or plan the next step more effectively.',
    formPoints: [
      { title: 'Good for specialist technical enquiries', text: 'Useful when the buyer already knows they need cutting, coring, or a dedicated access solution.' },
      { title: 'Supports trade and site-led selling', text: 'The structure helps the page feel credible to builders, contractors, and practical project clients.' },
      { title: 'Easy to tune quickly', text: 'Add site imagery, work categories, and project examples to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a concrete cutting quote',
    formBadge: 'Technical-site form',
    serviceOptions: ['Core drilling', 'Slab cutting', 'Wall sawing', 'Penetration / access cut', 'Demolition support', 'Site assessment'],
    formCta: 'SEND MY CUTTING ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain what site details, plans, or photos help with quoting and whether inspection or scheduling constraints need to be discussed first.',
  },
  {
    slug: 'shopfitting',
    label: 'Shopfitting / Fit-Out Quote',
    icon: '🏬',
    secondaryIcon: '📐',
    accent: '#7c2d12',
    accentDark: '#431407',
    accentSoft: '#ffedd5',
    glow: 'rgba(251,146,60,0.22)',
    badgeColor: '#fed7aa',
    logo: 'Frame & Form Shopfit',
    logoTagline: 'Retail fit-outs, commercial interiors, joinery, and branded spaces',
    badge: 'Shopfitting • retail fit-out • commercial interiors • joinery • display spaces',
    headline: 'Shopfitting pages should feel commercial, capable, and finish-aware.',
    subheadline: 'This version is built for retail fit-outs, commercial interiors, hospitality upgrades, display joinery, and branded space projects where the buyer needs a team that feels organised, design-aware, and able to deliver on time.',
    cta: 'REQUEST A SHOPFITTING QUOTE',
    responseLine: 'Strong for retail, hospitality, and commercial interior project enquiries.',
    heroVisualTagline: 'Commercial-fitout visual',
    visualHeadline: 'Use finished retail spaces, joinery details, or commercial interior project imagery',
    heroChecks: [
      { title: 'Built for commercial project confidence', text: 'Shopfitting buyers care about quality, timeline confidence, and whether the team feels capable of delivering a polished public-facing space.' },
      { title: 'Works for fit-outs, upgrades, and branded environments', text: 'Support new-store fit-outs, refits, hospitality interiors, and feature joinery work in one strong structure.' },
    ],
    highlights: [
      { title: 'Position the fit-out services clearly', text: 'Retail interiors, counters, display joinery, commercial upgrades, branded spaces, and refit work can all be framed in buyer-friendly language.' },
      { title: 'Sell finish and execution together', text: 'The page focuses on delivered outcome, commercial presentation, and project confidence rather than generic building copy.' },
      { title: 'Good fit for higher-value project leads', text: 'This structure supports buyers comparing experience, finish quality, and whether the business seems safe to trust with a public-facing space.' },
    ],
    stats: [
      { value: 'Retail', label: 'Strong for store, showroom, and customer-facing interior projects' },
      { value: 'Joinery', label: 'Useful for counters, displays, and detail-led commercial finishes' },
      { value: 'Fit-out', label: 'Good fit for larger project and refurbishment enquiries' },
    ],
    sectionHeadline: 'Built for commercial spaces that need to look right and function properly',
    sectionIntro: 'This template is tailored for shopfitting and commercial interior businesses that need to project project-control, finish quality, and commercial credibility from the first screen.',
    services: [
      { icon: '🛍️', title: 'Retail fit-outs and branded customer spaces', text: 'Ideal for stores, showrooms, and customer-facing businesses where layout, finish, and brand presentation all matter heavily.' },
      { icon: '🍽️', title: 'Hospitality and commercial interior upgrades', text: 'Useful for cafes, salons, offices, and service businesses improving the way the space looks and works.' },
      { icon: '🪵', title: 'Joinery, counters, and display features', text: 'Great for projects where custom fixtures, service counters, shelving, and finish detail are a major part of the outcome.' },
    ],
    differenceHeadline: 'Why this works for shopfitting businesses',
    differenceIntro: 'Commercial fit-out buyers want confidence in finish, coordination, and delivery. The page is built to feel commercially serious without drifting into bland corporate filler.',
    differentiators: [
      { title: 'Commercial-project tone', text: 'The copy sounds like a fit-out and joinery partner that understands public-facing business spaces, not a general trade directory listing.' },
      { title: 'Strong fit for image-led portfolio selling', text: 'This structure becomes much stronger once you add finished interiors, branded spaces, and detail-led project photography.' },
      { title: 'Good for larger and more considered enquiries', text: 'The layout supports buyers who need planning confidence and evidence of quality before progressing.' },
    ],
    process: [
      { title: 'Set a commercially credible first impression', text: 'The first sections are designed to make the business feel organised, capable, and polished enough for serious interior work.' },
      { title: 'Clarify the type of space or project', text: 'The service blocks help buyers identify whether you suit retail, hospitality, office, or feature-joinery work.' },
      { title: 'Capture enough scope for meaningful follow-up', text: 'The form gathers the basics needed to understand the project scale, space type, and likely fit-out needs.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Portfolio-ready structure', text: 'Finished space imagery and project details make this category dramatically stronger.' },
      { icon: '🏬', title: 'Commercial credibility', text: 'Strong for buyers who need reassurance around presentation, timeline, and professional execution.' },
      { icon: '📐', title: 'Design-and-function fit', text: 'Useful when the project needs to look right for customers while still working operationally for staff.' },
    ],
    customerGroup: 'business owners, project managers, and commercial interior clients',
    testimonials: [
      { name: 'Simone V.', meta: 'Retail fit-out quote • Fortitude Valley', quote: 'The page felt far more commercial and polished than most local fit-out sites we reviewed. It made the business feel capable of handling a space that customers would see every day.' },
      { name: 'Aaron D.', meta: 'Cafe refit project • Newstead', quote: 'We were looking for a team that felt organised and finish-aware, not just a builder. The site gave us that confidence and the project delivered on it.' },
      { name: 'Kelly M.', meta: 'Joinery and display build • West End', quote: 'It felt like a real shopfitting company with an eye for presentation. The quote process was clear and the final space came together beautifully.' },
    ],
    faqs: [
      { q: 'Can this page work for retail and hospitality fit-outs?', a: 'Yes. It is structured to support stores, hospitality venues, offices, refits, joinery work, and other commercial interior projects.' },
      { q: 'What will strengthen it most?', a: 'Finished-space imagery, branded environment photos, joinery detail shots, and reviews that mention professionalism and delivery all improve this page significantly.' },
      { q: 'Is it suitable for larger commercial projects?', a: 'Yes. The tone and structure are well suited to more considered commercial enquiries where presentation and project confidence matter heavily.' },
      { q: 'What should I customise first?', a: 'Update the fit-out categories, portfolio imagery, service area, and testimonials so the page reflects the commercial projects you most want to win.' },
    ],
    formHeadline: 'Capture shopfitting enquiries with enough project detail to guide the next step properly.',
    formIntro: 'The form is built to gather the type of space, likely fit-out scope, and project timing so your team can quote or qualify the job more effectively.',
    formPoints: [
      { title: 'Good for higher-value commercial leads', text: 'Useful when the buyer needs more confidence before moving into meetings, quoting, or scope discussions.' },
      { title: 'Supports portfolio-led commercial selling', text: 'The structure makes room for project imagery, finish detail, and commercial trust signals.' },
      { title: 'Easy to tune quickly', text: 'Add your best completed spaces, joinery categories, and target sectors to sharpen the page fast.' },
    ],
    formCardTitle: 'Request a shopfitting quote',
    formBadge: 'Commercial-fitout form',
    serviceOptions: ['Retail fit-out', 'Hospitality fit-out', 'Commercial interior upgrade', 'Joinery and counters', 'Display feature build', 'Project consultation'],
    formCta: 'SEND MY FIT-OUT ENQUIRY',
    formDisclaimer: 'Use the follow-up to explain whether plans, site visit, or a project brief are needed and what timeline details help with quoting.',
  },
  {
    slug: 'carpentry',
    label: 'Carpentry / Renovation Quote',
    icon: '🪚',
    secondaryIcon: '📐',
    accent: '#7c2d12',
    accentDark: '#431407',
    accentSoft: '#fed7aa',
    glow: 'rgba(249,115,22,0.24)',
    badgeColor: '#fdba74',
    logo: 'Oak & Beam Carpentry',
    logoTagline: 'Custom carpentry, timber repairs, and renovation work',
    badge: 'Carpentry • timber repairs • custom builds • renovation detail work',
    headline: 'Carpentry and renovation work need a page that feels crafted, not generic.',
    subheadline: 'This version is designed for custom carpentry, timber repairs, decks, fit-outs, trim work, and renovation enquiries where quality, finish, and professionalism matter more than hype.',
    cta: 'REQUEST A CARPENTRY QUOTE',
    responseLine: 'Built for higher-consideration quoting and project enquiries.',
    heroVisualTagline: 'Craftsmanship visual',
    visualHeadline: 'Use finished detail shots, timber work, or clean site photography',
    heroChecks: [
      { title: 'Better fit for higher-value work', text: 'The structure supports considered enquiries where buyers want to assess workmanship and professionalism.' },
      { title: 'Useful for renovation and custom projects', text: 'Works well when the client needs reassurance around detail, finish, and planning.' },
    ],
    highlights: [
      { title: 'Emphasise finish and craftsmanship', text: 'Good carpentry pages should feel measured, premium, and detail-oriented from the first section.' },
      { title: 'Clarify the work you take on', text: 'Decking, skirting, architraves, cabinetry installs, framing repairs, feature timber work, and renovation support can each be presented cleanly.' },
      { title: 'Encourage better-quality briefs', text: 'The form captures scope, project type, and site details so you can qualify the enquiry more effectively.' },
    ],
    stats: [
      { value: 'Custom', label: 'Works for tailored jobs where cookie-cutter language fails' },
      { value: 'Finish', label: 'Ideal for businesses selling quality detail and craftsmanship' },
      { value: 'Quote-ready', label: 'Useful for renovation and project enquiry traffic' },
    ],
    sectionHeadline: 'Built for carpentry and renovation jobs where quality matters',
    sectionIntro: 'Carpentry buyers are often comparing workmanship, finish level, and professionalism. These sections help your business feel premium without drifting into generic luxury cliches.',
    services: [
      { icon: '🪵', title: 'Timber repairs and replacement work', text: 'Position repairs, rot replacement, deck boards, external trim, and practical restoration jobs in a way that feels credible.' },
      { icon: '🏗️', title: 'Custom carpentry and fit-out details', text: 'Perfect for feature walls, shelving, cabinetry installs, skirting, architraves, and detail work that requires a clean finish.' },
      { icon: '🧱', title: 'Renovation support and project work', text: 'Speak to homeowners planning upgrades, room refreshes, or larger projects that need a capable carpentry partner.' },
    ],
    differenceHeadline: 'Why this works for carpentry and renovation services',
    differenceIntro: 'This page is calmer, more detailed, and more quality-led than a generic trade template because that is what buyers expect when the work is visible and lasting.',
    differentiators: [
      { title: 'Premium but believable tone', text: 'The copy communicates craftsmanship and professionalism without sounding inflated or fake.' },
      { title: 'Better qualification for complex jobs', text: 'The form and supporting sections make it easier to attract serious project enquiries rather than vague tyre-kicker leads.' },
      { title: 'Room for portfolio-led selling', text: 'This layout gets even stronger once you add project photos, finish details, and examples of completed work.' },
    ],
    process: [
      { title: 'Lead with visible quality', text: 'Make it obvious that your business cares about fit, finish, and long-term workmanship.' },
      { title: 'Explain the kinds of projects you suit best', text: 'This helps filter enquiry quality and reduces mismatched leads.' },
      { title: 'Collect useful project details', text: 'Better briefs make quoting smoother and help you decide which jobs are worth pursuing.' },
    ],
    trustPoints: [
      { icon: '🖼️', title: 'Portfolio-friendly layout', text: 'Strong fit for businesses with project imagery, before-and-after work, and material detail shots.' },
      { icon: '📏', title: 'Scope and finish clarity', text: 'Useful when your work varies in size and you need to frame quality and process carefully.' },
      { icon: '🏠', title: 'Home renovation credibility', text: 'Helps position the business for owner-occupier projects, visible upgrades, and higher-trust work.' },
    ],
    customerGroup: 'homeowners and renovation clients',
    testimonials: [
      { name: 'Leonie B.', meta: 'Deck and stair repair • Cleveland', quote: 'The page felt like it belonged to a proper carpentry business. The quote process was clear, the workmanship was excellent, and the finished job lifted the whole back area.' },
      { name: 'George M.', meta: 'Custom shelving and trim • Chapel Hill', quote: 'We wanted someone who cared about the finish, not just the install. The copy and visuals made that obvious, and the final result looked even better than we expected.' },
      { name: 'Priya K.', meta: 'Renovation carpentry support • Bulimba', quote: 'It is rare to land on a service page that actually sounds like the type of builder or carpenter you want to work with. This one felt calm, detailed, and professional, and the project ran exactly that way.' },
    ],
    faqs: [
      { q: 'Can this template work for both small repairs and larger renovation jobs?', a: 'Yes. It is flexible enough for timber repairs and detail work, while still being strong for custom carpentry and higher-value renovation enquiries.' },
      { q: 'What will make this page feel truly premium?', a: 'Use project photography, close-up detail shots, short captions explaining the job, and proof of clean finished work. Carpentry sells visually, so imagery matters a lot here.' },
      { q: 'Is this better than a generic trade service page?', a: 'For carpentry, definitely. Buyers tend to pay more attention to finish, design fit, and workmanship, so the tone and structure need to reflect that.' },
      { q: 'Can I use this for decking, fit-outs, and timber feature work?', a: 'Yes. The copy is intentionally broad enough to cover multiple carpentry offers while still sounding grounded in the trade.' },
    ],
    formHeadline: 'Capture serious carpentry enquiries with a page that feels considered.',
    formIntro: 'Use the form to collect project scope, location, and the kind of work required so your team can prioritise good-fit jobs and respond with confidence.',
    formPoints: [
      { title: 'Better fit for premium quoting', text: 'Useful when the job is more considered than a simple service call and the buyer wants to assess quality first.' },
      { title: 'Strong for renovations and custom work', text: 'Supports jobs that require more explanation, more scope, and more trust.' },
      { title: 'Ready for portfolio upgrades', text: 'Once you add real project photos, the page becomes a serious sales asset.' },
    ],
    formCardTitle: 'Request a carpentry quote',
    formBadge: 'Project-ready form',
    serviceOptions: ['Timber repair', 'Decking or stairs', 'Custom shelving or cabinetry install', 'Trim, skirting, or architraves', 'Renovation carpentry', 'Other project enquiry'],
    formCta: 'SEND MY CARPENTRY ENQUIRY',
    formDisclaimer: 'Use your thank-you step or follow-up email to outline the next stage, such as a site visit, measure-up, or request for reference photos.',
  },
];

const SERVICE_SECTION_BLOCKS = SERVICE_PAGE_THEMES.flatMap((theme) => [
  { id: `${theme.slug}-hero`, label: `${theme.icon} ${theme.label} Hero`, category: '🏠 Service Funnels', html: () => buildServiceHeroSection(theme) },
  { id: `${theme.slug}-services`, label: `${theme.icon} ${theme.label} Services`, category: '🏠 Service Funnels', html: () => buildServiceOffersSection(theme) },
  { id: `${theme.slug}-difference`, label: `${theme.icon} ${theme.label} Trust`, category: '🏠 Service Funnels', html: () => buildServiceDifferenceSection(theme) },
  { id: `${theme.slug}-proof`, label: `${theme.icon} ${theme.label} Proof`, category: '🏠 Service Funnels', html: () => buildServiceProofSection(theme) },
  { id: `${theme.slug}-testimonials`, label: `${theme.icon} ${theme.label} Testimonials`, category: '🏠 Service Funnels', html: () => buildServiceTestimonialsSection(theme) },
  { id: `${theme.slug}-faq`, label: `${theme.icon} ${theme.label} FAQ`, category: '🏠 Service Funnels', html: () => buildServiceFaqSection(theme) },
  { id: `${theme.slug}-quote`, label: `${theme.icon} ${theme.label} Quote Form`, category: '🏠 Service Funnels', html: () => buildServiceQuoteFormSection(theme) },
]);

const SERVICE_FUNNEL_TYPES = SERVICE_PAGE_THEMES.flatMap((theme) => [
  {
    id: `${theme.slug}-quote-long`,
    label: theme.label,
    icon: theme.icon,
    description: getServiceVariantDescription(theme, 'long'),
    variant: 'Long Form',
    examples: [theme.services[0].title, theme.services[1].title, theme.services[2].title],
    accent: theme.accent,
    pages: [
      {
        title: 'Quote Page',
        sectionIds: getServiceLongFormSectionIds(theme),
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: `${theme.slug}-quote-short`,
    label: theme.label,
    icon: theme.icon,
    description: getServiceVariantDescription(theme, 'short'),
    variant: 'Short Form',
    examples: ['Google Business traffic', 'Referrals', 'Returning visitors'],
    accent: theme.accent,
    pages: [
      {
        title: 'Quote Page',
        sectionIds: getServiceShortFormSectionIds(theme),
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
]);

// ─────────────────────────────────────────────
// GRAPESJS BLOCK DEFINITIONS
// ─────────────────────────────────────────────

export const SECTION_BLOCKS = [
  { id: 'ann-bar',      label: '📢 Announcement Bar',   category: '🎯 Headers',      html: sectionAnnouncementBar },
  { id: 'hero-dark',    label: '🚀 Hero (Dark)',         category: '🎯 Headers',      html: sectionHero },
  { id: 'hero-light',   label: '🌟 Hero (Light)',        category: '🎯 Headers',      html: sectionHeroLight },
  { id: 'hero-video',   label: '🎥 Video Hero',          category: '🎯 Headers',      html: sectionVideoHero },
  { id: 'benefits',     label: '✅ Benefits Grid',        category: '📝 Content',      html: sectionBenefitsGrid },
  { id: 'story-copy',   label: '📖 Story / Long Copy',   category: '📝 Content',      html: sectionStoryCopy },
  { id: 'ingredients',  label: '🔬 Ingredients / Features', category: '📝 Content',   html: sectionIngredients },
  { id: 'product',      label: '📦 Product Showcase',    category: '📝 Content',      html: sectionProductShowcase },
  { id: 'spacer',       label: '↕️ Spacer',               category: '🔧 Layout',       html: sectionSpacer },
  { id: 'image',        label: '🖼️ Image',                category: '🔧 Layout',       html: () => `<div style="display:flex;justify-content:center;align-items:center;width:100%;"><img src="https://placehold.co/400x200" alt="Image" style="display:block;max-width:100%;height:auto;margin:0 auto;" /></div>` },
  { id: '2col-text',    label: '📝 2-Column Text',         category: '🔧 Layout',       html: sectionTwoColumnText },
  { id: '3col-text',    label: '📝 3-Column Text',         category: '🔧 Layout',       html: sectionThreeColumnText },
  { id: 'divider',      label: '— Divider',               category: '🔧 Layout',       html: sectionDivider },
  { id: 'footer',       label: '🔻 Footer',               category: '🔧 Layout',       html: sectionPageFooter },
  { id: 'social-proof', label: '📺 Media / As Seen On',  category: '📢 Social Proof', html: sectionSocialProofBar },
  { id: 'testimonials', label: '⭐ Testimonials (3-col)', category: '📢 Social Proof', html: sectionTestimonials },
  { id: 'trust-badges', label: '🔒 Trust Badges',        category: '📢 Social Proof', html: sectionTrustBadges },
  { id: 'bonuses',      label: '🎁 Free Bonuses',         category: '💰 Conversion',   html: sectionBonuses },
  { id: 'pricing',      label: '💳 Pricing Table',        category: '💰 Conversion',   html: sectionPricing },
  { id: 'countdown',    label: '⏳ Countdown Urgency',    category: '💰 Conversion',   html: sectionCountdown },
  { id: 'cta',          label: '🟢 Call To Action',       category: '💰 Conversion',   html: sectionCTA },
  { id: 'lead-form',    label: '📋 Lead Capture Form',    category: '💰 Conversion',   html: sectionLeadCaptureForm },
  { id: 'guarantee',    label: '🛡️ Guarantee Badge',      category: '🔒 Trust',        html: sectionGuarantee },
  { id: 'faq',          label: '❓ FAQ Accordion',         category: '🔒 Trust',        html: sectionFAQ },
  { id: 'thankyou',     label: '🎉 Thank You Page',       category: '🔒 Trust',        html: sectionThankYou },
  ...SERVICE_SECTION_BLOCKS,
];

// ─────────────────────────────────────────────
// FUNNEL TYPE DEFINITIONS
// ─────────────────────────────────────────────

export const FUNNEL_TYPES = [
  {
    id: 'lead-magnet',
    label: 'Lead Magnet Funnel',
    icon: '🎁',
    description: 'Capture emails with a free offer. Best for list building.',
    variant: 'Core Funnel',
    accent: '#2d6cdf',
    pages: [
      {
        title: 'Opt-In Page',
        sectionIds: ['ann-bar', 'lead-form', 'trust-badges', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'sales-funnel',
    label: 'Sales Funnel',
    icon: '💰',
    description: 'Full sales page with social proof, pricing and guarantee.',
    variant: 'Core Funnel',
    accent: '#ef465d',
    pages: [
      {
        title: 'Sales Page',
        sectionIds: ['ann-bar', 'hero-dark', 'social-proof', 'benefits', 'story-copy', 'ingredients', 'testimonials', 'bonuses', 'pricing', 'guarantee', 'faq', 'cta', 'trust-badges', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'vsl-funnel',
    label: 'VSL Funnel',
    icon: '🎥',
    description: 'Video Sales Letter page — let the video do the selling.',
    variant: 'Core Funnel',
    accent: '#9333ea',
    pages: [
      {
        title: 'VSL Page',
        sectionIds: ['ann-bar', 'hero-video', 'social-proof', 'testimonials', 'pricing', 'guarantee', 'faq', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'webinar-funnel',
    label: 'Webinar Funnel',
    icon: '📡',
    description: 'Registration and confirmation pages for a live webinar.',
    variant: 'Core Funnel',
    accent: '#f59e0b',
    pages: [
      {
        title: 'Registration Page',
        sectionIds: ['hero-light', 'benefits', 'testimonials', 'lead-form', 'trust-badges', 'footer'],
      },
      {
        title: 'Confirmation Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'product-launch',
    label: 'Product Launch',
    icon: '🚀',
    description: 'Waitlist → launch sequence with full sales page.',
    variant: 'Core Funnel',
    accent: '#22c55e',
    pages: [
      {
        title: 'Waitlist / Coming Soon',
        sectionIds: ['hero-light', 'benefits', 'countdown', 'lead-form', 'footer'],
      },
      {
        title: 'Launch Sales Page',
        sectionIds: ['ann-bar', 'hero-dark', 'social-proof', 'benefits', 'product', 'bonuses', 'pricing', 'guarantee', 'faq', 'cta', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'bridge-page',
    label: 'Bridge / Pre-Sell Page',
    icon: '🌉',
    description: 'Warm up cold traffic before sending to an affiliate offer.',
    variant: 'Core Funnel',
    accent: '#0ea5e9',
    pages: [
      {
        title: 'Bridge Page',
        sectionIds: ['hero-dark', 'story-copy', 'testimonials', 'cta', 'trust-badges', 'footer'],
      },
    ],
  },
  {
    id: 'affiliate-review-long',
    label: 'Affiliate Review Page',
    icon: '🧲',
    description: 'Long-form affiliate bridge page with bonus positioning, proof, and repeated click-through moments.',
    variant: 'Long Form',
    examples: ['Affiliate products', 'Software reviews', 'Course promos'],
    accent: '#f59e0b',
    pages: [
      {
        title: 'Affiliate Review Page',
        sectionIds: ['ann-bar', 'hero-dark', 'social-proof', 'benefits', 'story-copy', 'product', 'testimonials', 'bonuses', 'faq', 'cta', 'trust-badges', 'footer'],
      },
    ],
  },
  {
    id: 'affiliate-review-short',
    label: 'Affiliate Review Page',
    icon: '🧲',
    description: 'Shorter affiliate bridge page for warmer traffic that only needs a sharp recommendation and CTA path.',
    variant: 'Short Form',
    examples: ['Email promos', 'Retargeting', 'Warm list traffic'],
    accent: '#f59e0b',
    pages: [
      {
        title: 'Affiliate Review Page',
        sectionIds: ['hero-dark', 'benefits', 'testimonials', 'cta', 'footer'],
      },
    ],
  },
  {
    id: 'book-offer-long',
    label: 'Book Launch Page',
    icon: '📚',
    description: 'Long-form page for books, workbooks, and author bundles with more story, proof, and order framing.',
    variant: 'Long Form',
    examples: ['Book sales', 'Author launches', 'Workbook bundles'],
    accent: '#8b5cf6',
    pages: [
      {
        title: 'Book Sales Page',
        sectionIds: ['ann-bar', 'hero-dark', 'benefits', 'story-copy', 'product', 'testimonials', 'bonuses', 'pricing', 'faq', 'cta', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'book-offer-short',
    label: 'Book Launch Page',
    icon: '📚',
    description: 'Shorter author page for warmer readers who mostly need the pitch, the cover, and an order path.',
    variant: 'Short Form',
    examples: ['Preorders', 'Email list launch', 'Social traffic'],
    accent: '#8b5cf6',
    pages: [
      {
        title: 'Book Sales Page',
        sectionIds: ['hero-light', 'product', 'testimonials', 'pricing', 'cta', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  ...SERVICE_FUNNEL_TYPES,
  {
    id: 'consultant-application-long',
    label: 'Consultant / Service Application',
    icon: '🧠',
    description: 'Long-form service-time page for consultants, agencies, and strategists selling premium expertise.',
    variant: 'Long Form',
    examples: ['Consultants', 'Agencies', 'Coaches', 'Strategists'],
    accent: '#16a34a',
    pages: [
      {
        title: 'Application Page',
        sectionIds: ['hero-dark', 'story-copy', 'benefits', 'testimonials', 'faq', 'lead-form', 'trust-badges', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'consultant-application-short',
    label: 'Consultant / Service Application',
    icon: '🧠',
    description: 'Shorter application page for warm referrals and visitors who already understand the service offer.',
    variant: 'Short Form',
    examples: ['Warm referrals', 'Partner traffic', 'Returning visitors'],
    accent: '#16a34a',
    pages: [
      {
        title: 'Application Page',
        sectionIds: ['hero-dark', 'benefits', 'lead-form', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'course-enrollment-long',
    label: 'Course Enrollment Page',
    icon: '🎓',
    description: 'Long-form course or membership page with more curriculum detail, proof, bonuses, and enrollment support.',
    variant: 'Long Form',
    examples: ['Courses', 'Memberships', 'Workshops', 'Training'],
    accent: '#7c3aed',
    pages: [
      {
        title: 'Enrollment Page',
        sectionIds: ['ann-bar', 'hero-dark', 'benefits', 'story-copy', 'product', 'testimonials', 'bonuses', 'pricing', 'faq', 'cta', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
  {
    id: 'course-enrollment-short',
    label: 'Course Enrollment Page',
    icon: '🎓',
    description: 'Shorter course/workshop page for warm audiences that need a crisp offer summary and a clear enrollment CTA.',
    variant: 'Short Form',
    examples: ['Launch list', 'Warm email traffic', 'Retargeting'],
    accent: '#7c3aed',
    pages: [
      {
        title: 'Enrollment Page',
        sectionIds: ['hero-dark', 'benefits', 'testimonials', 'pricing', 'cta', 'footer'],
      },
      {
        title: 'Thank You Page',
        sectionIds: ['thankyou'],
      },
    ],
  },
];

// ─────────────────────────────────────────────
// HELPER: build full page HTML from section IDs
// ─────────────────────────────────────────────
const sectionMap = Object.fromEntries(SECTION_BLOCKS.map(b => [b.id, b.html]));

function enforceReadableTypography(html) {
  return `${html || ''}`
    .replace(/font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px/gi, (_match, value) => {
      const nextValue = Math.max(16, Number(value) || 0);
      return `font-size:${nextValue}px`;
    })
    .replace(/font-weight\s*:\s*([0-9]+)/gi, (_match, value) => {
      const nextValue = Math.min(600, Number(value) || 0);
      return `font-weight:${nextValue}`;
    });
}

export function assemblePage(sectionIds) {
  return enforceReadableTypography(
    sectionIds.map(id => sectionMap[id] ? sectionMap[id]() : '').join('\n')
  );
}
