import Head from "next/head";
import {
  ArrowRight,
  Blocks,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  Compass,
  Cpu,
  Globe2,
  Handshake,
  Layers3,
  Mail,
  Megaphone,
  MousePointer2,
  Network,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

const BLUE = "#1688ff";
const CYAN = "#68d8ff";

const modules = [
  ["CRM", Users],
  ["Funnels", MousePointer2],
  ["Email", Mail],
  ["Automation", Workflow],
  ["Calendar", CalendarDays],
  ["Website Builder", Globe2],
  ["Landing Pages", Layers3],
  ["Marketplace", ShoppingBag],
  ["Communities", Network],
  ["AI", Bot],
  ["Construction Platform", Building2],
  ["Digital Products", Sparkles],
  ["Physical Products", BriefcaseBusiness],
  ["Courses", Compass],
];

const competitors = [
  ["HubSpot", "Enterprise CRM", "Premium", "No", "Partial", "Limited"],
  ["GoHighLevel", "Agency CRM", "Mid", "Yes", "Partial", "Limited"],
  ["Monday", "Work OS", "Mid", "No", "No", "Limited"],
  ["ClickUp", "Productivity", "Low-mid", "No", "No", "No"],
  ["Buildertrend", "Construction", "Premium", "No", "No", "Yes"],
  ["Jobber", "Field services", "Mid", "No", "No", "Yes"],
  ["ServiceM8", "Trade ops", "Mid", "No", "No", "Yes"],
  ["Gr8 Result", "All-in-one growth OS", "Flexible", "Yes", "Yes", "Yes"],
];

const customers = [
  ["Builders", Building2],
  ["Trades", BriefcaseBusiness],
  ["Professional Services", ShieldCheck],
  ["Marketing Agencies", Megaphone],
  ["Consultants", Compass],
  ["Health", Sparkles],
  ["Small Business", ShoppingBag],
  ["Franchise Groups", Network],
];

const launch = [
  ["Beta", "Validate workflows with early operators"],
  ["Pre-launch", "Build anticipation and waitlist demand"],
  ["Founding Members", "Convert the first committed cohort"],
  ["Launch", "Turn attention into adoption"],
  ["Scale", "Compound acquisition, content and partnerships"],
];

const questions = [
  "Recommended launch strategy",
  "Recommended investment",
  "Expected KPIs",
  "Expected CAC",
  "Expected MRR",
  "Recommended channels",
  "Launch timeline",
  "Reporting cadence",
  "Team structure",
  "Relevant SaaS experience",
  "Case studies",
];

const success = ["Waiting List", "Subscribers", "MRR", "CAC", "ROAS", "Brand Awareness", "Customer Growth"];

const opportunityTools = [
  ["CRM", "8%", "18%"],
  ["Email", "29%", "7%"],
  ["Funnels", "62%", "9%"],
  ["Calendar", "84%", "23%"],
  ["Website", "10%", "68%"],
  ["Courses", "34%", "84%"],
  ["Products", "68%", "82%"],
  ["Reporting", "86%", "63%"],
];

export default function AgencyPitchDeck() {
  return (
    <>
      <Head>
        <title>Gr8 Result Digital Solutions | Founding Growth Partner</title>
        <meta name="description" content="Invitation to Become Our Founding Growth Partner" />
      </Head>
      <main style={styles.deck}>
        <Slide number="01" label="Invitation" hero>
          <div className="agency-cover-grid" style={styles.coverGrid}>
            <div style={styles.coverCopy}>
              <BrandMark large />
              <div style={styles.kicker}>Invitation to Become Our Founding Growth Partner</div>
              <h1 className="agency-cover-title" style={styles.coverTitle}>Building Australia's Next All-In-One Business Platform</h1>
              <p style={styles.coverLine}>Gr8 Result Digital Solutions</p>
            </div>
            <div style={styles.heroMockWrap}>
              <SaasMockup />
            </div>
          </div>
        </Slide>

        <Slide number="02" label="The Opportunity">
          <SplitTitle
            eyebrow="The Opportunity"
            title="Businesses are overwhelmed by software."
            body="Subscriptions, logins, data silos and disconnected workflows are multiplying faster than teams can manage them."
          />
          <div className="agency-opportunity" style={styles.convergence}>
            {opportunityTools.map(([item, left, top], index) => (
              <div key={item} style={{ ...styles.floatingChip, left, top, animationDelay: `${index * 0.18}s` }}>{item}</div>
            ))}
            <div style={styles.convergenceCore}>
              <Blocks size={58} />
              <strong>One connected platform</strong>
            </div>
          </div>
        </Slide>

        <Slide number="03" label="The Vision" image="public/assets/digital-global-strategy-marketing-gr8result.jpg">
          <div style={styles.statementSlide}>
            <span style={styles.kicker}>The Vision</span>
            <h2 className="agency-statement" style={styles.statement}>
              We're not building another CRM.
              <br />
              <span>We're building the operating system for growing businesses.</span>
            </h2>
          </div>
        </Slide>

        <Slide number="04" label="Our Story">
          <div className="agency-story-layout" style={styles.storyLayout}>
            <div>
              <span style={styles.kicker}>Founder Driven</span>
              <h2 className="agency-big-title" style={styles.bigTitle}>Built from the frustration every growing business eventually feels.</h2>
            </div>
            <div style={styles.storyCard}>
              <p>
                Gr8 Result exists because business owners should not need a patchwork of expensive tools to market, sell,
                communicate, schedule, deliver and grow.
              </p>
              <p>
                The vision is simple: give ambitious businesses a single platform that feels powerful, connected and practical
                from day one.
              </p>
            </div>
          </div>
        </Slide>

        <Slide number="05" label="The Platform">
          <div style={styles.centerHeader}>
            <span style={styles.kicker}>The Platform</span>
            <h2 className="agency-big-title" style={styles.bigTitle}>A connected growth ecosystem.</h2>
          </div>
          <div className="agency-module-orbit" style={styles.moduleOrbit}>
            <div className="agency-module-core" style={styles.moduleCore}>
              <Cpu size={46} />
              <strong>Gr8 Result</strong>
              <span>Business Growth OS</span>
            </div>
            {modules.map(([label, Icon], index) => (
              <div className="agency-module-pill" key={label} style={{ ...styles.modulePill, gridArea: `m${index + 1}` }}>
                <Icon size={22} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Slide>

        <Slide number="06" label="Market Opportunity">
          <div className="agency-market-grid" style={styles.marketGrid}>
            <Metric value="SME" label="Small and medium businesses want fewer tools, not more dashboards." />
            <Metric value="SaaS" label="Integrated platforms are becoming the default operating layer for teams." />
            <Metric value="AI" label="Automation is raising expectations for connected customer workflows." />
          </div>
          <div style={styles.chartPanel}>
            {[44, 58, 71, 86, 100].map((height) => <span key={height} style={{ ...styles.chartBar, height: `${height}%` }} />)}
          </div>
        </Slide>

        <Slide number="07" label="Why Now">
          <div style={styles.nowLayout}>
            <h2 className="agency-big-title" style={styles.bigTitle}>The era of stitched-together software is ending.</h2>
            {["Tool fatigue", "Data fragmentation", "AI expectations", "Subscription consolidation"].map((item) => (
              <div key={item} style={styles.reasonCard}>
                <ArrowRight size={22} />
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </Slide>

        <Slide number="08" label="Competitive Landscape">
          <div style={styles.tableIntro}>
            <span style={styles.kicker}>Competitive Landscape</span>
            <h2 className="agency-big-title" style={styles.bigTitle}>Specialists are strong. Connected ecosystems win.</h2>
          </div>
          <div className="agency-table" style={styles.comparisonTable}>
            <div style={styles.tableHeader}>Platform</div>
            <div style={styles.tableHeader}>Core</div>
            <div style={styles.tableHeader}>Pricing</div>
            <div style={styles.tableHeader}>Agency</div>
            <div style={styles.tableHeader}>Commerce</div>
            <div style={styles.tableHeader}>Vertical Ops</div>
            {competitors.map((row) => row.map((cell, index) => (
              <div key={`${row[0]}-${index}`} style={row[0] === "Gr8 Result" ? styles.tableCellHighlight : styles.tableCell}>
                {cell}
              </div>
            )))}
          </div>
        </Slide>

        <Slide number="09" label="Why We're Different">
          <div className="agency-difference-grid" style={styles.differenceGrid}>
            {[
              ["One platform, many business models", Blocks],
              ["Marketing and operations together", Workflow],
              ["SaaS plus vertical workflows", Layers3],
              ["Built for agencies and clients", Handshake],
              ["AI-ready architecture", Bot],
              ["Founder access and fast feedback loops", Rocket],
            ].map(([title, Icon]) => (
              <div key={title} style={styles.differenceCard}>
                <Icon size={34} />
                <strong>{title}</strong>
              </div>
            ))}
          </div>
        </Slide>

        <Slide number="10" label="Our Customers">
          <div style={styles.centerHeader}>
            <span style={styles.kicker}>Our Customers</span>
            <h2 className="agency-big-title" style={styles.bigTitle}>Built for ambitious operators who want growth without software chaos.</h2>
          </div>
          <div className="agency-customer-grid" style={styles.customerGrid}>
            {customers.map(([label, Icon]) => (
              <div key={label} style={styles.customerCard}>
                <Icon size={30} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Slide>

        <Slide number="11" label="Our Launch">
          <div style={styles.timelineSlide}>
            <span style={styles.kicker}>Our Launch</span>
            <h2 className="agency-big-title" style={styles.bigTitle}>From controlled validation to market momentum.</h2>
            <div className="agency-timeline" style={styles.timeline}>
              {launch.map(([title, text], index) => (
                <div key={title} style={styles.timelineItem}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        <Slide number="12" label="Founding Growth Partner" hero>
          <div style={styles.partnerHero}>
            <span style={styles.kicker}>Founding Growth Partner</span>
            <h2 className="agency-partner-title" style={styles.partnerTitle}>We are inviting one exceptional agency inside the build.</h2>
            <div className="agency-partner-grid" style={styles.partnerGrid}>
              {["Use the platform", "Influence development", "Shape the roadmap", "Direct developer access", "Founding Partner status", "Future reseller opportunities", "Case studies", "Long-term relationship"].map((item) => (
                <div key={item} style={styles.partnerPoint}><Check size={20} />{item}</div>
              ))}
            </div>
          </div>
        </Slide>

        <Slide number="13" label="Your Challenge">
          <div style={styles.challenge}>
            <span style={styles.kicker}>Your Challenge</span>
            <h2 className="agency-big-title" style={styles.challengeTitle}>If Gr8 Result was your company, how would you launch it?</h2>
            <div className="agency-challenge-grid" style={styles.challengeGrid}>
              {["How would you position it?", "What would your first 90 days look like?", "How much investment would you recommend?", "Which assumptions would you challenge?"].map((item) => (
                <div key={item} style={styles.challengeCard}>{item}</div>
              ))}
            </div>
          </div>
        </Slide>

        <Slide number="14" label="Questions">
          <div className="agency-questions-layout" style={styles.questionsLayout}>
            <div>
              <span style={styles.kicker}>Questions We'd Like You To Answer</span>
              <h2 className="agency-big-title" style={styles.bigTitle}>Bring the strategy you would bet your reputation on.</h2>
            </div>
            <div className="agency-question-grid" style={styles.questionGrid}>
              {questions.map((item) => <div key={item} style={styles.questionCard}>{item}</div>)}
            </div>
          </div>
        </Slide>

        <Slide number="15" label="Success">
          <div style={styles.successSlide}>
            <span style={styles.kicker}>What Success Looks Like</span>
            <h2 className="agency-big-title" style={styles.bigTitle}>Clear traction. Measurable momentum. A category story the market remembers.</h2>
            <div className="agency-success-grid" style={styles.successGrid}>
              {success.map((item) => <Metric key={item} value={item} label="Tracked, reported and improved every cycle." compact />)}
            </div>
          </div>
        </Slide>

        <Slide number="16" label="Closing">
          <div style={styles.closingStatement}>
            <h2 className="agency-closing-title" style={styles.closingTitle}>
              We're not looking for another supplier.
              <br />
              <span>We're looking for a partner who wants to help build Australia's next major SaaS success story.</span>
            </h2>
          </div>
        </Slide>

        <Slide number="17" label="Founder">
          <div style={styles.finalPage}>
            <BrandMark large />
            <h2 className="agency-final-title" style={styles.finalTitle}>Let's Build Something Extraordinary Together</h2>
            <div style={styles.founder}>
              <strong>Grant Rohde</strong>
              <span>Founder</span>
              <span>Gr8 Result Digital Solutions</span>
            </div>
          </div>
        </Slide>
      </main>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #050a14;
        }

        @keyframes drift {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }

          50% {
            transform: translate3d(0, -10px, 0);
          }
        }

        @media (max-width: 1120px) {
          .agency-slide-content {
            justify-content: flex-start !important;
          }

          .agency-cover-grid,
          .agency-split-title,
          .agency-story-layout,
          .agency-questions-layout {
            grid-template-columns: 1fr !important;
          }

          .agency-market-grid,
          .agency-difference-grid,
          .agency-customer-grid,
          .agency-success-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .agency-timeline,
          .agency-partner-grid,
          .agency-challenge-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .agency-module-orbit {
            grid-template-areas: none !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .agency-module-core,
          .agency-module-pill {
            grid-area: auto !important;
          }

          .agency-table {
            overflow-x: auto !important;
            grid-template-columns: 170px 230px repeat(4, 120px) !important;
          }
        }

        @media (max-width: 680px) {
          .agency-slide {
            min-height: auto !important;
            padding: 26px 18px 42px !important;
          }

          .agency-slide-content {
            padding-top: 54px !important;
          }

          .agency-market-grid,
          .agency-difference-grid,
          .agency-customer-grid,
          .agency-success-grid,
          .agency-timeline,
          .agency-partner-grid,
          .agency-challenge-grid,
          .agency-question-grid,
          .agency-module-orbit {
            grid-template-columns: 1fr !important;
          }

          .agency-cover-title,
          .agency-big-title,
          .agency-statement,
          .agency-partner-title,
          .agency-closing-title,
          .agency-final-title {
            font-size: clamp(38px, 12vw, 62px) !important;
          }

          .agency-mock-grid {
            grid-template-columns: 1fr !important;
          }

          .agency-mock-sidebar {
            display: none !important;
          }

          .agency-opportunity {
            min-height: 560px !important;
          }
        }
      `}</style>
    </>
  );
}

AgencyPitchDeck.disableLayout = true;

function Slide({ children, number, label, hero = false, image = "" }) {
  const backgroundImage = image ? `linear-gradient(115deg, rgba(5,10,20,0.92), rgba(5,10,20,0.46)), url('/${image.replace(/^public\//, "")}')` : undefined;
  return (
    <section className="agency-slide" style={{ ...styles.slide, ...(hero ? styles.heroSlide : {}), ...(backgroundImage ? { backgroundImage, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
      <div style={styles.noise} />
      <div style={styles.slideChrome}>
        <span>{number}</span>
        <span>{label}</span>
      </div>
      <div className="agency-slide-content" style={styles.slideContent}>{children}</div>
    </section>
  );
}

function BrandMark({ large = false }) {
  return (
    <div style={{ ...styles.brand, ...(large ? styles.brandLarge : {}) }}>
      <img src="/logo/gr8result-logo.png" alt="Gr8 Result Digital Solutions" width={56} height={56} style={styles.logo} />
      <span>Gr8 Result Digital Solutions</span>
    </div>
  );
}

function SplitTitle({ eyebrow, title, body }) {
  return (
    <div className="agency-split-title" style={styles.splitTitle}>
      <div>
        <span style={styles.kicker}>{eyebrow}</span>
        <h2 style={styles.bigTitle}>{title}</h2>
      </div>
      <p>{body}</p>
    </div>
  );
}

function Metric({ value, label, compact = false }) {
  return (
    <div style={{ ...styles.metric, ...(compact ? styles.metricCompact : {}) }}>
      <strong style={compact ? styles.metricStrongCompact : styles.metricStrong}>{value}</strong>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

function SaasMockup() {
  return (
    <div style={styles.mockup}>
      <div style={styles.mockTop}>
        <span style={{ ...styles.mockTopDot, background: "#ff5f57" }} />
        <span style={{ ...styles.mockTopDot, background: "#febc2e" }} />
        <span style={{ ...styles.mockTopDot, background: "#28c840" }} />
      </div>
      <div className="agency-mock-grid" style={styles.mockGrid}>
        <div className="agency-mock-sidebar" style={styles.mockSidebar}>
          {["Overview", "Pipeline", "Campaigns", "Automation", "Revenue"].map((item, index) => (
            <span key={item} style={index === 0 ? styles.mockSidebarItemActive : styles.mockSidebarItem}>{item}</span>
          ))}
        </div>
        <div style={styles.mockMain}>
          <div style={styles.mockHeroLine} />
          <div style={styles.mockCards}>
            <div style={styles.mockCard}><strong>Pipeline</strong><span>42%</span></div>
            <div style={styles.mockCard}><strong>MRR</strong><span>Live</span></div>
            <div style={styles.mockCard}><strong>Launch</strong><span>90d</span></div>
          </div>
          <div style={styles.mockChart}>
            {[34, 62, 48, 78, 92, 66, 104].map((height) => <span key={height} style={{ ...styles.mockChartBar, height }} />)}
          </div>
          <div style={styles.mockInsight}>
            <span />
            <strong>AI campaign forecast synced with CRM, funnel and revenue data.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  deck: {
    minHeight: "100vh",
    background: "#050a14",
    color: "#f8fafc",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    scrollSnapType: "y mandatory",
    overflowX: "hidden",
  },
  slide: {
    position: "relative",
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "34px clamp(22px, 5vw, 72px)",
    display: "flex",
    alignItems: "stretch",
    scrollSnapAlign: "start",
    background:
      "radial-gradient(circle at 18% 8%, rgba(22,136,255,0.24), transparent 30%), radial-gradient(circle at 92% 20%, rgba(104,216,255,0.15), transparent 30%), linear-gradient(135deg, #050a14 0%, #08111f 48%, #02040a 100%)",
    overflow: "hidden",
  },
  heroSlide: {
    background:
      "radial-gradient(circle at 72% 18%, rgba(22,136,255,0.35), transparent 30%), radial-gradient(circle at 10% 90%, rgba(104,216,255,0.18), transparent 28%), linear-gradient(145deg, #040711 0%, #07111f 55%, #02040a 100%)",
  },
  noise: {
    position: "absolute",
    inset: 0,
    opacity: 0.09,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
    backgroundSize: "58px 58px",
    pointerEvents: "none",
  },
  slideChrome: {
    position: "absolute",
    top: 24,
    left: "clamp(22px, 5vw, 72px)",
    right: "clamp(22px, 5vw, 72px)",
    display: "flex",
    justifyContent: "space-between",
    color: "rgba(226,232,240,0.54)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  slideContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 1440,
    margin: "0 auto",
    paddingTop: 56,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  brand: { display: "inline-flex", alignItems: "center", gap: 12, color: "#ffffff", fontWeight: 900 },
  brandLarge: { gap: 16, fontSize: 20 },
  logo: { width: 56, height: 56, objectFit: "contain", filter: "drop-shadow(0 18px 28px rgba(22,136,255,0.28))" },
  kicker: { color: CYAN, fontSize: 13, fontWeight: 950, letterSpacing: "0.18em", textTransform: "uppercase" },
  coverGrid: { display: "grid", gridTemplateColumns: "0.92fr 1.08fr", gap: 56, alignItems: "center" },
  coverCopy: { display: "grid", gap: 24 },
  coverTitle: { margin: 0, fontSize: "clamp(58px, 7.6vw, 116px)", lineHeight: 0.9, letterSpacing: 0, maxWidth: 920 },
  coverLine: { margin: 0, color: "rgba(226,232,240,0.72)", fontSize: 24, fontWeight: 750 },
  heroMockWrap: { perspective: 1400 },
  mockup: {
    border: "1px solid rgba(148,163,184,0.28)",
    borderRadius: 28,
    background: "linear-gradient(145deg, rgba(15,23,42,0.86), rgba(2,6,23,0.76))",
    boxShadow: "0 44px 120px rgba(0,0,0,0.48), 0 0 90px rgba(22,136,255,0.22)",
    overflow: "hidden",
    transform: "rotateY(-10deg) rotateX(4deg)",
  },
  mockTop: { height: 54, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderBottom: "1px solid rgba(148,163,184,0.18)" },
  mockTopDot: { width: 12, height: 12, borderRadius: 999, boxShadow: "0 0 24px rgba(255,255,255,0.16)" },
  mockGrid: { display: "grid", gridTemplateColumns: "210px 1fr", minHeight: 500 },
  mockSidebar: { padding: 22, borderRight: "1px solid rgba(148,163,184,0.14)", display: "grid", gap: 14, alignContent: "start" },
  mockSidebarItem: { color: "rgba(226,232,240,0.58)", fontWeight: 760, fontSize: 14 },
  mockSidebarItemActive: { color: "#ffffff", fontWeight: 900, fontSize: 14, padding: "10px 12px", borderRadius: 12, background: "rgba(22,136,255,0.2)" },
  mockMain: { padding: 28, display: "grid", gap: 22 },
  mockHeroLine: { height: 96, borderRadius: 22, background: `linear-gradient(135deg, ${BLUE}, ${CYAN})` },
  mockCards: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  mockCard: { minHeight: 104, borderRadius: 20, padding: 18, display: "grid", alignContent: "space-between", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(148,163,184,0.18)" },
  mockChart: { minHeight: 180, borderRadius: 22, background: "rgba(255,255,255,0.045)", display: "flex", alignItems: "end", gap: 12, padding: 22 },
  mockInsight: { display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 18, background: "rgba(104,216,255,0.1)", color: "#dff7ff", border: "1px solid rgba(104,216,255,0.22)" },
  splitTitle: { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 44, alignItems: "end" },
  bigTitle: { margin: "12px 0 0", fontSize: "clamp(42px, 5.8vw, 86px)", lineHeight: 0.98, letterSpacing: 0 },
  convergence: { marginTop: 54, minHeight: 450, position: "relative", display: "grid", placeItems: "center" },
  floatingChip: {
    position: "absolute",
    display: "inline-flex",
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(15,23,42,0.68)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.24)",
    margin: 12,
    fontWeight: 900,
    animation: "drift 4.8s ease-in-out infinite",
  },
  convergenceCore: { width: 270, height: 270, borderRadius: 999, display: "grid", placeItems: "center", textAlign: "center", background: `linear-gradient(145deg, ${BLUE}, #0b2b58)`, boxShadow: "0 34px 100px rgba(22,136,255,0.34)" },
  statementSlide: { maxWidth: 1120 },
  statement: { margin: "18px 0 0", fontSize: "clamp(54px, 7vw, 104px)", lineHeight: 0.98 },
  storyLayout: { display: "grid", gridTemplateColumns: "1fr 0.78fr", gap: 48, alignItems: "center" },
  storyCard: { border: "1px solid rgba(148,163,184,0.24)", borderRadius: 30, padding: 36, background: "rgba(255,255,255,0.07)", backdropFilter: "blur(18px)", color: "#dbeafe", fontSize: 24, lineHeight: 1.42 },
  centerHeader: { display: "grid", gap: 10, textAlign: "center", maxWidth: 1040, margin: "0 auto 34px" },
  moduleOrbit: {
    display: "grid",
    gridTemplateAreas: '"m1 m2 m3 m4" "m5 core core m6" "m7 core core m8" "m9 m10 m11 m12" "m13 m13 m14 m14"',
    gap: 14,
    alignItems: "stretch",
  },
  moduleCore: { gridArea: "core", minHeight: 210, borderRadius: 34, display: "grid", placeItems: "center", textAlign: "center", background: `linear-gradient(145deg, ${BLUE}, #0f2f5c)`, boxShadow: "0 30px 90px rgba(22,136,255,0.35)" },
  modulePill: { border: "1px solid rgba(148,163,184,0.23)", borderRadius: 20, padding: 18, display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.06)" },
  marketGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
  metric: { minHeight: 230, borderRadius: 30, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.06)", padding: 28, display: "grid", alignContent: "end", gap: 14 },
  metricCompact: { minHeight: 150 },
  metricStrong: { display: "block", fontSize: "clamp(54px, 7vw, 96px)", lineHeight: 0.86, color: "#ffffff" },
  metricStrongCompact: { display: "block", fontSize: "clamp(30px, 4vw, 48px)", lineHeight: 0.95, color: "#ffffff" },
  metricLabel: { color: "#bdd7f3", fontSize: 18, lineHeight: 1.35 },
  chartPanel: { marginTop: 28, height: 280, borderRadius: 30, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "end", gap: 18, padding: 24 },
  chartBar: { flex: 1, minWidth: 38, borderRadius: "18px 18px 4px 4px", background: `linear-gradient(180deg, ${CYAN}, ${BLUE})`, boxShadow: "0 18px 42px rgba(22,136,255,0.3)" },
  nowLayout: { display: "grid", gridTemplateColumns: "1.2fr repeat(2, 0.75fr)", gap: 18, alignItems: "stretch" },
  reasonCard: { minHeight: 180, borderRadius: 26, padding: 24, display: "grid", alignContent: "space-between", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(148,163,184,0.2)" },
  tableIntro: { display: "grid", gap: 10, marginBottom: 26 },
  comparisonTable: { display: "grid", gridTemplateColumns: "1.2fr 1.5fr repeat(4, 0.8fr)", border: "1px solid rgba(148,163,184,0.22)", borderRadius: 24, overflow: "hidden", background: "rgba(255,255,255,0.045)" },
  tableHeader: { padding: "14px 16px", background: "rgba(22,136,255,0.16)", color: CYAN, fontWeight: 950, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" },
  tableCell: { padding: "13px 16px", borderTop: "1px solid rgba(148,163,184,0.14)", color: "#dbeafe" },
  tableCellHighlight: { padding: "13px 16px", borderTop: "1px solid rgba(104,216,255,0.28)", background: "rgba(22,136,255,0.18)", color: "#ffffff", fontWeight: 900 },
  differenceGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 },
  differenceCard: { minHeight: 210, padding: 26, borderRadius: 28, display: "grid", alignContent: "space-between", color: "#fff", background: "linear-gradient(145deg, rgba(22,136,255,0.22), rgba(255,255,255,0.055))", border: "1px solid rgba(148,163,184,0.22)" },
  customerGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  customerCard: { minHeight: 140, borderRadius: 24, padding: 20, display: "grid", placeItems: "center", gap: 12, textAlign: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.2)" },
  timelineSlide: { display: "grid", gap: 34 },
  timeline: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 },
  timelineItem: { minHeight: 260, borderRadius: 26, padding: 22, display: "grid", alignContent: "space-between", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.2)" },
  partnerHero: { borderRadius: 38, padding: "clamp(34px, 6vw, 74px)", background: "linear-gradient(145deg, rgba(22,136,255,0.3), rgba(255,255,255,0.06))", border: "1px solid rgba(104,216,255,0.32)", boxShadow: "0 44px 120px rgba(22,136,255,0.2)" },
  partnerTitle: { margin: "14px 0 34px", fontSize: "clamp(50px, 6.8vw, 102px)", lineHeight: 0.92 },
  partnerGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 },
  partnerPoint: { display: "flex", gap: 10, alignItems: "center", padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", fontWeight: 800 },
  challenge: { display: "grid", gap: 30 },
  challengeTitle: { margin: 0, fontSize: "clamp(48px, 7vw, 104px)", lineHeight: 0.94, letterSpacing: 0 },
  challengeGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  challengeCard: { minHeight: 160, borderRadius: 24, padding: 22, display: "flex", alignItems: "flex-end", color: "#ffffff", fontSize: 23, lineHeight: 1.15, fontWeight: 900, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(148,163,184,0.2)" },
  questionsLayout: { display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 34, alignItems: "center" },
  questionGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  questionCard: { minHeight: 54, display: "flex", alignItems: "center", borderRadius: 16, padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(148,163,184,0.18)", color: "#e2e8f0", fontWeight: 800 },
  successSlide: { display: "grid", gap: 32 },
  successGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  closingStatement: { maxWidth: 1250 },
  closingTitle: { margin: 0, fontSize: "clamp(52px, 7.2vw, 112px)", lineHeight: 0.95, letterSpacing: 0 },
  finalPage: { display: "grid", placeItems: "center", textAlign: "center", gap: 28 },
  finalTitle: { margin: 0, maxWidth: 920, fontSize: "clamp(52px, 7vw, 106px)", lineHeight: 0.94, letterSpacing: 0 },
  founder: { display: "grid", gap: 8, color: "#cbd5e1", fontSize: 24 },
  mockChartBar: { flex: 1, minWidth: 18, borderRadius: "12px 12px 3px 3px", background: `linear-gradient(180deg, ${CYAN}, ${BLUE})` },
};
