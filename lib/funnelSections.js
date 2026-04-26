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
  return `<section id="optin" style="${F}background:linear-gradient(135deg,#071a3d 0%,#123d8f 48%,#2d6cdf 100%);padding:96px 24px;overflow:hidden;position:relative;">
  <div style="position:absolute;left:-120px;bottom:-140px;width:320px;height:320px;background:radial-gradient(circle,rgba(96,165,250,0.32) 0%,transparent 70%);"></div>
  <div style="position:absolute;right:-110px;top:80px;width:280px;height:280px;background:radial-gradient(circle,rgba(34,197,94,0.2) 0%,transparent 72%);"></div>
  <div style="max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:44px;align-items:center;position:relative;z-index:1;">
    <div>
      <p style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.16);border-radius:999px;padding:10px 18px;color:#fcd34d;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 18px;">🎁 FREE INSTANT ACCESS</p>
      <h2 style="color:#fff;font-size:58px;font-weight:900;margin:0 0 18px;line-height:1.05;max-width:620px;">Get Your Free [Lead Magnet Name] Now</h2>
      <p style="color:rgba(255,255,255,0.86);font-size:21px;margin:0 0 28px;line-height:1.65;max-width:620px;">Create your free 14-day account and take a proper look around the platform before you decide to continue.</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 28px;">
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:10px 14px;color:#dbeafe;font-size:15px;font-weight:700;">14-day free trial</span>
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:10px 14px;color:#dbeafe;font-size:15px;font-weight:700;">Digital platform access</span>
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:10px 14px;color:#dbeafe;font-size:15px;font-weight:700;">Australian business</span>
      </div>
      <div style="position:relative;min-height:390px;max-width:560px;">
        <div style="position:absolute;inset:30px 0 0 32px;background:linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.16);border-radius:28px;backdrop-filter:blur(10px);padding:22px 22px 26px;box-shadow:0 26px 80px rgba(2,6,23,0.38);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
            <div>
              <p style="color:#dbeafe;font-size:14px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin:0 0 6px;">Preview</p>
              <p style="color:#fff;font-size:24px;font-weight:800;line-height:1.2;margin:0;">A cleaner look at the offer</p>
            </div>
            <div style="width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#22c55e,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 14px 34px rgba(14,165,233,0.28);">📈</div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:16px;align-items:stretch;">
            <div style="background:rgba(255,255,255,0.9);border-radius:22px;padding:18px;min-height:210px;box-shadow:0 10px 28px rgba(15,23,42,0.14);">
              <div style="display:flex;gap:8px;margin-bottom:14px;">
                <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:block;"></span>
                <span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:block;"></span>
                <span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:block;"></span>
              </div>
              <div style="display:grid;gap:12px;">
                <div style="height:18px;border-radius:999px;background:linear-gradient(90deg,#0f2247,#2d6cdf);"></div>
                <div style="height:12px;border-radius:999px;background:#cbd5e1;width:78%;"></div>
                <div style="height:12px;border-radius:999px;background:#e2e8f0;width:62%;"></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px;">
                  <div style="height:88px;border-radius:16px;background:linear-gradient(180deg,#dbeafe,#eff6ff);"></div>
                  <div style="height:88px;border-radius:16px;background:linear-gradient(180deg,#dcfce7,#f0fdf4);"></div>
                  <div style="height:88px;border-radius:16px;background:linear-gradient(180deg,#fde68a,#fef3c7);"></div>
                </div>
              </div>
            </div>
            <div style="display:grid;gap:12px;">
              <div style="background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:16px;min-height:112px;box-shadow:0 10px 28px rgba(15,23,42,0.2);">
                <p style="color:#93c5fd;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.1px;margin:0 0 10px;">Inside</p>
                <p style="color:#fff;font-size:18px;font-weight:800;line-height:1.35;margin:0 0 8px;">Funnels, CRM, email, and automation in one place.</p>
                <p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:0;">The visual panel is there to make the platform feel like a real product, not a vague promise.</p>
              </div>
              <div style="background:rgba(255,255,255,0.9);border-radius:20px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,0.14);">
                <p style="color:#0f172a;font-size:16px;font-weight:800;line-height:1.35;margin:0 0 6px;">See the platform first</p>
                <p style="color:#475569;font-size:14px;line-height:1.5;margin:0;">Use generic product-style visuals so the page looks designed, not empty.</p>
              </div>
            </div>
          </div>
        </div>
        <div style="position:absolute;left:0;bottom:0;background:#fff;border-radius:20px;padding:16px 18px;box-shadow:0 18px 44px rgba(2,6,23,0.24);max-width:230px;">
          <p style="color:#0f172a;font-size:15px;font-weight:800;line-height:1.35;margin:0 0 6px;">Make the next step obvious</p>
          <p style="color:#475569;font-size:14px;line-height:1.55;margin:0;">Use visuals and clear benefits so the page feels intentional, not generic.</p>
        </div>
      </div>
    </div>
    <div>
      <div style="background:rgba(7,18,40,0.34);border:1px solid rgba(255,255,255,0.16);border-radius:28px;padding:28px;backdrop-filter:blur(12px);box-shadow:0 26px 80px rgba(2,6,23,0.34);">
        <p style="color:#dbeafe;font-size:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 10px;">Start here</p>
        <h3 style="color:#fff;font-size:34px;font-weight:900;line-height:1.15;margin:0 0 12px;">Create your free 14-day account</h3>
        <p style="color:rgba(255,255,255,0.76);font-size:18px;line-height:1.65;margin:0 0 24px;">Sign up now and start exploring the platform straight away.</p>
        <form method="post" action="/api/forms/submit" style="display:grid;gap:16px;text-align:left;">
          <input type="hidden" name="funnel_id" value="" />
          <input type="hidden" name="list_id" value="" />
          <input type="hidden" name="success_url" value="?ok=1" />
          <input name="name" placeholder="Your First Name" style="padding:20px 22px;border-radius:16px;border:2px solid rgba(255,255,255,0.16);background:rgba(7,18,40,0.52);color:#fff;font-size:18px;outline:none;width:100%;box-sizing:border-box;" />
          <input name="email" type="email" required placeholder="Your Best Email Address" style="padding:20px 22px;border-radius:16px;border:2px solid rgba(255,255,255,0.16);background:rgba(7,18,40,0.52);color:#fff;font-size:18px;outline:none;width:100%;box-sizing:border-box;" />
          <button type="submit" style="padding:22px;border-radius:16px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:22px;font-weight:900;cursor:pointer;box-shadow:0 12px 36px rgba(34,197,94,0.35);letter-spacing:0.3px;">START MY FREE 14-DAY TRIAL →</button>
        </form>
        <div style="display:grid;gap:12px;margin-top:18px;">
          <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 16px;">
            <span style="font-size:20px;line-height:1;">💻</span>
            <div><p style="color:#fff;font-size:16px;font-weight:700;line-height:1.35;margin:0 0 4px;">Platform access</p><p style="color:#cbd5e1;font-size:14px;line-height:1.5;margin:0;">Create an account and start exploring immediately inside the app.</p></div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 16px;">
            <span style="font-size:20px;line-height:1;">🕒</span>
            <div><p style="color:#fff;font-size:16px;font-weight:700;line-height:1.35;margin:0 0 4px;">No download claim</p><p style="color:#cbd5e1;font-size:14px;line-height:1.5;margin:0;">This page is for signing up to a trial account, not promising a file delivery.</p></div>
          </div>
        </div>
        <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:18px 0 0;">Your details are used to create your trial and send account-related follow-up for this platform.</p>
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
    accent: '#0ea5e9',
    pages: [
      {
        title: 'Bridge Page',
        sectionIds: ['hero-dark', 'story-copy', 'testimonials', 'cta', 'trust-badges', 'footer'],
      },
    ],
  },
];

// ─────────────────────────────────────────────
// HELPER: build full page HTML from section IDs
// ─────────────────────────────────────────────
const sectionMap = Object.fromEntries(SECTION_BLOCKS.map(b => [b.id, b.html]));

export function assemblePage(sectionIds) {
  return sectionIds.map(id => sectionMap[id] ? sectionMap[id]() : '').join('\n');
}
