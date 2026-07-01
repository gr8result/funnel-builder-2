import Head from "next/head";
import Link from "next/link";
import FeaturesNav from "../../components/features/FeaturesNav";

const HERO_IMAGE = "/assets/data-driven-marketing-performance-gr8result.jpg";

const funnelTypes = [
  {
    title: "Lead Capture Funnels",
    body: "Turn ad clicks, search traffic and social visitors into qualified leads with focused opt-in pages and smart follow-up.",
    accent: "#22d3ee",
  },
  {
    title: "Sales Funnels",
    body: "Sell offers with persuasive pages, frictionless checkout steps, order confirmations and a clear path to purchase.",
    accent: "#fb7185",
  },
  {
    title: "Booking Funnels",
    body: "Guide prospects from landing page to appointment request, consultation booking or service enquiry without losing momentum.",
    accent: "#a78bfa",
  },
  {
    title: "Webinar Funnels",
    body: "Capture registrations, deliver reminders and send people to the right replay, offer or next-step page.",
    accent: "#facc15",
  },
  {
    title: "Product Launch Funnels",
    body: "Build launch pages, waitlists, countdown offers and post-launch follow-up paths for new products and campaigns.",
    accent: "#34d399",
  },
  {
    title: "Application Funnels",
    body: "Collect applications for services, programs, finance, memberships or high-ticket offers with structured lead capture.",
    accent: "#60a5fa",
  },
];

const builderFeatures = [
  "Drag-and-drop page builder",
  "Multi-step funnel flows",
  "Opt-in forms",
  "Checkout pages",
  "Thank-you pages",
  "Upsells and downsells",
  "Custom domains",
  "Mobile responsive pages",
];

const analytics = [
  { label: "Views", value: "18,420", color: "#22d3ee" },
  { label: "Leads", value: "2,146", color: "#a78bfa" },
  { label: "Sales", value: "$41.8k", color: "#34d399" },
  { label: "Conversion", value: "11.7%", color: "#fb7185" },
];

function FunnelFlowVisual() {
  const steps = [
    { label: "Landing Page", metric: "18.4k views", color: "#22d3ee" },
    { label: "Lead Capture", metric: "2,146 leads", color: "#a78bfa" },
    { label: "Offer Page", metric: "612 clicks", color: "#fb7185" },
    { label: "Checkout", metric: "$41.8k sales", color: "#34d399" },
  ];

  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="visual-top">
        <span>Live funnel</span>
        <strong>Campaign dashboard</strong>
      </div>
      <div className="flow-lines">
        {steps.map((step, index) => (
          <div className="flow-step" key={step.label} style={{ "--step-color": step.color }}>
            <div className="step-node">{index + 1}</div>
            <div>
              <strong>{step.label}</strong>
              <span>{step.metric}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="visual-panel">
        <div>
          <span>Drop-off alert</span>
          <strong>Checkout step needs attention</strong>
        </div>
        <div className="mini-chart">
          <i style={{ height: "92%" }} />
          <i style={{ height: "68%" }} />
          <i style={{ height: "52%" }} />
          <i style={{ height: "41%" }} />
        </div>
      </div>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body }) {
  return (
    <div className="section-intro">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export default function FunnelsFeaturePage() {
  return (
    <>
      <Head>
        <title>Funnels - Gr8 Result | Build High-Converting Funnels</title>
        <meta
          name="description"
          content="Build high-converting funnels with landing pages, lead capture, follow-up, checkout pages, bookings and conversion analytics in Gr8 Result."
        />
      </Head>

      <style>{`
        *{box-sizing:border-box}
        body{margin:0;background:#050814;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        a{text-decoration:none}
        .funnels-page{overflow:hidden;background:#050814}
        .hero{position:relative;min-height:calc(100vh - 60px);display:flex;align-items:center;padding:88px 32px 72px;background-image:linear-gradient(90deg,rgba(5,8,20,.94) 0%,rgba(5,8,20,.82) 43%,rgba(5,8,20,.48) 100%),url(${HERO_IMAGE});background-size:cover;background-position:center;isolation:isolate}
        .hero:after{content:"";position:absolute;inset:auto 0 0;height:180px;background:linear-gradient(180deg,rgba(5,8,20,0),#050814);z-index:-1}
        .hero-inner{width:min(1180px,100%);margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:56px;align-items:center}
        .eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.32);color:#67e8f9;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:24px}
        h1{margin:0;color:#fff;font-size:clamp(44px,6vw,78px);line-height:.96;font-weight:950;letter-spacing:0;max-width:860px}
        .hero-copy{margin:26px 0 0;max-width:720px;color:#cbd5e1;font-size:clamp(18px,2vw,22px);line-height:1.6}
        .hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:36px}
        .btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:15px 24px;border-radius:12px;font-weight:850;font-size:16px;transition:transform .18s ease,box-shadow .18s ease}
        .btn:hover{transform:translateY(-2px)}
        .btn-primary{background:linear-gradient(135deg,#22d3ee,#6366f1 54%,#fb7185);color:#fff;box-shadow:0 20px 50px rgba(99,102,241,.34)}
        .btn-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.24);color:#fff;backdrop-filter:blur(14px)}
        .hero-visual{position:relative;border:1px solid rgba(255,255,255,.18);background:linear-gradient(145deg,rgba(15,23,42,.84),rgba(17,24,39,.62));box-shadow:0 30px 100px rgba(0,0,0,.46);border-radius:24px;padding:22px;backdrop-filter:blur(18px);overflow:hidden}
        .hero-visual:before{content:"";position:absolute;inset:-80px -80px auto auto;width:220px;height:220px;background:radial-gradient(circle,rgba(34,211,238,.32),transparent 65%);pointer-events:none}
        .visual-top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}
        .visual-top span{font-size:12px;color:#93c5fd;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
        .visual-top strong{font-size:15px;color:#fff}
        .flow-lines{display:grid;gap:13px}
        .flow-step{display:flex;align-items:center;gap:14px;padding:15px;border-radius:16px;background:rgba(15,23,42,.82);border:1px solid color-mix(in srgb,var(--step-color) 42%,transparent);box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}
        .step-node{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,var(--step-color),#6366f1);color:#020617;font-weight:950}
        .flow-step strong{display:block;color:#fff;font-size:16px;margin-bottom:4px}
        .flow-step span{display:block;color:#94a3b8;font-size:13px}
        .visual-panel{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:18px;padding:16px;border-radius:18px;background:rgba(251,113,133,.12);border:1px solid rgba(251,113,133,.28)}
        .visual-panel span{display:block;color:#fecdd3;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
        .visual-panel strong{display:block;color:#fff;font-size:15px}
        .mini-chart{display:flex;align-items:end;gap:6px;height:58px;width:82px}
        .mini-chart i{display:block;flex:1;border-radius:999px;background:linear-gradient(180deg,#fb7185,#22d3ee)}
        .section{padding:92px 32px}
        .section.alt{background:linear-gradient(180deg,#07101f,#050814)}
        .container{width:min(1180px,100%);margin:0 auto}
        .section-intro{max-width:760px;margin:0 auto 42px;text-align:center}
        .section-intro span{display:inline-block;color:#67e8f9;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px}
        .section-intro h2{margin:0;color:#fff;font-size:clamp(30px,4vw,52px);line-height:1.05;font-weight:950;letter-spacing:0}
        .section-intro p{margin:18px auto 0;color:#94a3b8;font-size:18px;line-height:1.65;max-width:650px}
        .card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
        .build-card{position:relative;min-height:215px;padding:24px;border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(30,41,59,.62));border:1px solid rgba(148,163,184,.18);overflow:hidden}
        .build-card:before{content:"";position:absolute;inset:0 0 auto;height:4px;background:var(--accent)}
        .build-card h3{margin:0 0 12px;color:#fff;font-size:22px;line-height:1.15}
        .build-card p{margin:0;color:#aebbd0;font-size:15px;line-height:1.65}
        .feature-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        .feature-pill{min-height:116px;padding:18px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);display:flex;align-items:flex-end;color:#f8fafc;font-size:16px;font-weight:850;line-height:1.25}
        .split{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,460px);gap:54px;align-items:center}
        .split h2{margin:0;color:#fff;font-size:clamp(32px,4vw,54px);line-height:1.05;font-weight:950;letter-spacing:0}
        .split p{color:#aebbd0;font-size:18px;line-height:1.75;margin:18px 0 0}
        .bullet-list{display:grid;gap:12px;margin-top:26px}
        .bullet{display:flex;gap:12px;align-items:flex-start;color:#dbeafe;font-size:16px;line-height:1.5}
        .bullet:before{content:"";width:10px;height:10px;border-radius:999px;background:linear-gradient(135deg,#22d3ee,#fb7185);margin-top:7px;flex:0 0 auto}
        .capture-visual,.sell-visual,.analytics-visual,.advantage-panel{border-radius:24px;background:linear-gradient(145deg,rgba(15,23,42,.94),rgba(9,14,28,.8));border:1px solid rgba(148,163,184,.18);box-shadow:0 28px 70px rgba(0,0,0,.34);padding:24px}
        .form-preview{display:grid;gap:12px}
        .field{height:48px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
        .popup-card{margin-top:16px;padding:18px;border-radius:18px;background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(99,102,241,.2));border:1px solid rgba(34,211,238,.28)}
        .popup-card strong{display:block;font-size:18px;margin-bottom:6px}
        .popup-card span{color:#bae6fd;font-size:14px}
        .checkout-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 0;border-bottom:1px solid rgba(255,255,255,.1)}
        .checkout-row:last-child{border-bottom:0}
        .checkout-row span{color:#94a3b8}
        .checkout-row strong{color:#fff}
        .pay-button{margin-top:18px;height:52px;border-radius:14px;background:linear-gradient(135deg,#34d399,#22d3ee);display:grid;place-items:center;color:#022c22;font-weight:950}
        .analytics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
        .metric{padding:18px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
        .metric span{display:block;color:#94a3b8;font-size:13px;margin-bottom:7px}
        .metric strong{display:block;font-size:28px;color:var(--metric-color)}
        .dropoff{display:grid;gap:12px}
        .dropoff-row{display:grid;grid-template-columns:135px 1fr 56px;gap:12px;align-items:center;color:#cbd5e1;font-size:14px}
        .bar{height:12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
        .bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#22d3ee,#6366f1,#fb7185)}
        .advantage-panel{display:grid;grid-template-columns:1fr;gap:13px}
        .connection{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px 16px;border-radius:15px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
        .connection strong{color:#fff}
        .connection span{color:#67e8f9;font-weight:900}
        .final-cta{padding:86px 32px 104px;text-align:center;background:linear-gradient(135deg,#07101f,#111827 46%,#17132c)}
        .final-cta h2{margin:0 auto;color:#fff;font-size:clamp(34px,5vw,62px);line-height:1.02;max-width:820px;font-weight:950;letter-spacing:0}
        .final-cta p{margin:18px auto 30px;color:#cbd5e1;font-size:18px;line-height:1.65;max-width:620px}
        @media(max-width:980px){
          .hero{min-height:auto;padding-top:70px}
          .hero-inner,.split{grid-template-columns:1fr}
          .hero-visual{max-width:560px}
          .card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
          .feature-list,.analytics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media(max-width:640px){
          .hero,.section,.final-cta{padding-left:20px;padding-right:20px}
          .hero-actions{display:grid}
          .btn{width:100%}
          .card-grid,.feature-list,.analytics-grid{grid-template-columns:1fr}
          .dropoff-row{grid-template-columns:105px 1fr 48px}
        }
      `}</style>

      <FeaturesNav cta="Open Funnels" ctaHref="/funnels" />

      <main className="funnels-page">
        <section className="hero">
          <div className="hero-inner">
            <div>
              <span className="eyebrow">Gr8 Result Funnels</span>
              <h1>Build High-Converting Funnels That Turn Clicks Into Customers</h1>
              <p className="hero-copy">
                Create landing pages, capture leads, automate follow-ups, take payments, book appointments and track every conversion from one powerful funnel builder.
              </p>
              <div className="hero-actions">
                <Link href="/modules/funnels/new" className="btn btn-primary">Start Building Funnels</Link>
                <Link href="/support" className="btn btn-secondary">Book a Free Demo</Link>
              </div>
            </div>
            <FunnelFlowVisual />
          </div>
        </section>

        <section className="section">
          <div className="container">
            <SectionIntro
              eyebrow="What you can build"
              title="Launch the exact funnel your campaign needs"
              body="Every funnel has a job: capture the lead, sell the offer, book the appointment or qualify the customer. Gr8 Result gives you the building blocks to make that path clear."
            />
            <div className="card-grid">
              {funnelTypes.map((item) => (
                <article className="build-card" key={item.title} style={{ "--accent": item.accent }}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt">
          <div className="container">
            <SectionIntro
              eyebrow="Funnel builder features"
              title="Design each step, connect the flow and publish fast"
              body="Build the page, choose the next step and keep the visitor moving toward the conversion."
            />
            <div className="feature-list">
              {builderFeatures.map((feature) => (
                <div className="feature-pill" key={feature}>{feature}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container split">
            <div>
              <span className="eyebrow">Capture leads automatically</span>
              <h2>Turn interest into a contact record instantly</h2>
              <p>
                Add forms, popups and lead magnet offers to your funnel pages so visitors can raise their hand the moment they are ready. New leads can be captured into your CRM, routed to the right list, and followed up without manual admin.
              </p>
              <div className="bullet-list">
                <div className="bullet">Use opt-in forms and popups for guides, offers, consultations and enquiries.</div>
                <div className="bullet">Send lead notifications so your team knows when a hot prospect enters the funnel.</div>
                <div className="bullet">Trigger follow-up emails or SMS messages based on the funnel step they completed.</div>
              </div>
            </div>
            <div className="capture-visual" aria-hidden="true">
              <div className="form-preview">
                <div className="field" />
                <div className="field" />
                <div className="field" />
              </div>
              <div className="popup-card">
                <strong>Lead magnet captured</strong>
                <span>New lead added to CRM and follow-up queue.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section alt">
          <div className="container split">
            <div className="sell-visual" aria-hidden="true">
              <div className="checkout-row"><span>Product</span><strong>Growth Sprint</strong></div>
              <div className="checkout-row"><span>Digital download</span><strong>Included</strong></div>
              <div className="checkout-row"><span>Order bump</span><strong>$49</strong></div>
              <div className="checkout-row"><span>Total</span><strong>$348</strong></div>
              <div className="pay-button">Secure checkout ready</div>
            </div>
            <div>
              <span className="eyebrow">Sell from your funnel</span>
              <h2>Move from pitch to payment without sending buyers elsewhere</h2>
              <p>
                Create checkout pages for products, services, courses and digital downloads directly inside your funnel. After purchase, send customers to confirmation pages, thank-you pages and the next offer in the journey.
              </p>
              <div className="bullet-list">
                <div className="bullet">Sell products, services, courses, memberships or downloadable files.</div>
                <div className="bullet">Use checkout pages, upsells and downsells to increase average order value.</div>
                <div className="bullet">Send clear order confirmations so customers know exactly what happens next.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <SectionIntro
              eyebrow="Funnel analytics"
              title="See what converts and where people drop off"
              body="Track the numbers that matter for each funnel: page views, leads, sales, conversion rate and the step where visitors are leaving."
            />
            <div className="analytics-visual">
              <div className="analytics-grid">
                {analytics.map((metric) => (
                  <div className="metric" key={metric.label} style={{ "--metric-color": metric.color }}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>
              <div className="dropoff">
                <div className="dropoff-row"><span>Landing</span><div className="bar"><i style={{ width: "100%" }} /></div><strong>100%</strong></div>
                <div className="dropoff-row"><span>Opt-in</span><div className="bar"><i style={{ width: "62%" }} /></div><strong>62%</strong></div>
                <div className="dropoff-row"><span>Offer</span><div className="bar"><i style={{ width: "34%" }} /></div><strong>34%</strong></div>
                <div className="dropoff-row"><span>Checkout</span><div className="bar"><i style={{ width: "18%" }} /></div><strong>18%</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section alt">
          <div className="container split">
            <div>
              <span className="eyebrow">Gr8 Result advantage</span>
              <h2>Your funnel is connected to the tools that close the sale</h2>
              <p>
                Funnels in Gr8 Result connect directly with CRM, Email, SMS, Calendar Bookings and Payments. That means leads, appointments, follow-ups and sales can move through one connected funnel workflow without juggling disconnected tools.
              </p>
            </div>
            <div className="advantage-panel" aria-hidden="true">
              {["CRM lead records", "Email follow-up", "SMS reminders", "Calendar bookings", "Payment collection"].map((item) => (
                <div className="connection" key={item}>
                  <strong>{item}</strong>
                  <span>Connected</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta">
          <h2>Build the funnel your next campaign deserves</h2>
          <p>Start with a focused funnel flow, capture every lead, sell from the page and measure what is working from the first click to the final conversion.</p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <Link href="/modules/funnels/new" className="btn btn-primary">Start Building Funnels</Link>
            <Link href="/support" className="btn btn-secondary">Book a Free Demo</Link>
          </div>
        </section>
      </main>
    </>
  );
}
