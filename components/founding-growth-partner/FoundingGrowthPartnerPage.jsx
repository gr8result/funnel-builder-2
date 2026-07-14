import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Layers3,
  Mail,
  MousePointer2,
  Network,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import styles from "./FoundingGrowthPartnerPage.module.css";
import {
  agencyResponseItems,
  brand,
  differenceCards,
  evaluationCriteria,
  foundingPartnerBasePath,
  getAgencyProfile,
  launchPhases,
  platformGroups,
  productShowcase,
  successMetrics,
} from "../../lib/founding-growth-partner/content";

const toolCategories = ["CRM", "Email marketing", "Websites", "Funnels", "Booking calendars", "Social media", "Automations", "Reporting", "Courses", "Products", "Construction operations"];
const launchFlow = ["Campaign", "Landing Page", "Lead Capture", "CRM", "Email Nurture", "Strategy Booking", "Trial", "Subscription", "Reporting"];
const challengeQuestions = ["What would you do first?", "What would you change?", "Which audience would you prioritise?", "Which channels would you test?", "What investment would you recommend?", "How would you allocate it?", "What would your first 30, 60 and 90 days look like?", "Which KPIs would define progress?", "What assumptions should we challenge?", "What should we avoid?"];

function trackEvent(name, payload = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer?.push?.({ event: name, ...payload });
  window.gtag?.("event", name, payload);
}

function scrollToId(id) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Shell({ children, agency }) {
  return (
    <div className={styles.page}>
      <Head>
        <title>Founding Growth Partner | Gr8 Result Digital Solutions</title>
        <meta name="description" content="An invitation for an exceptional SaaS growth agency to help launch, shape and scale Gr8 Result Digital Solutions." />
        <meta property="og:title" content="Founding Growth Partner | Gr8 Result Digital Solutions" />
        <meta property="og:description" content="An invitation for an exceptional SaaS growth agency to help launch, shape and scale Gr8 Result Digital Solutions." />
        <meta property="og:image" content="/logo/gr8result-logo.png" />
        <link rel="canonical" href={brand.canonical} />
        {agency ? <meta name="robots" content="noindex,follow" /> : null}
      </Head>
      <header className={styles.topbar}>
        <a href="#top" className={styles.brandMark} aria-label="Gr8 Result Digital Solutions">
          <Image src={brand.logo} alt="Gr8 Result Digital Solutions logo" width={158} height={50} priority />
        </a>
        <nav className={styles.nav} aria-label="Founding partner sections">
          <a href="#ecosystem">Platform</a>
          <a href="#opportunity">Opportunity</a>
          <a href="#form">Agency Interest</a>
        </nav>
        <button className={styles.navButton} onClick={() => scrollToId("form")}>Submit Interest</button>
      </header>
      {children}
    </div>
  );
}

function Hero({ agencySlug, agency }) {
  const guideUrl = `/api/founding-growth-partner/guide${agencySlug ? `?agencySlug=${encodeURIComponent(agencySlug)}` : ""}`;
  return (
    <section id="top" className={`${styles.section} ${styles.hero}`}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>GR8 RESULT DIGITAL SOLUTIONS</p>
        {agency?.welcomeLine ? <p className={styles.personalLine}>{agency.welcomeLine}</p> : null}
        <h1>Building Australia&apos;s Next All-In-One Business Platform</h1>
        <p className={styles.heroSub}>Invitation to Become Our Founding Growth Partner</p>
        <p className={styles.heroIntro}>We are seeking one exceptional SaaS growth agency to help shape our go-to-market strategy, build pre-launch momentum and create a long-term subscription growth engine.</p>
        <div className={styles.ctaRow}>
          <button onClick={() => { trackEvent("founding_partner_hero_cta_clicked"); scrollToId("opportunity"); }} className={styles.primaryButton}>Explore the Opportunity <ArrowRight size={18} /></button>
          <a onClick={() => trackEvent("founding_partner_pdf_downloaded")} className={styles.secondaryButton} href={guideUrl} download="gr8-result-founding-growth-partner-guide.pdf"><Download size={18} /> Download Partnership Guide</a>
          <button onClick={() => { trackEvent("founding_partner_strategy_clicked"); scrollToId("form"); }} className={styles.textButton}>Arrange a Strategy Conversation <CalendarDays size={17} /></button>
        </div>
      </div>
      <ProductInterfaceMockup />
      <button aria-label="Scroll to software problem" className={styles.scrollCue} onClick={() => scrollToId("problem")}><ArrowDown size={20} /></button>
    </section>
  );
}

function ProductInterfaceMockup() {
  return (
    <div className={styles.productStage} aria-label="Gr8 Result platform interface preview">
      <div className={styles.browserFrame}>
        <div className={styles.browserChrome}><span /><span /><span /><strong>gr8result.solutions</strong></div>
        <div className={styles.interfaceGrid}>
          <div className={styles.pipelinePanel}>
            <div className={styles.panelHeader}><Target size={18} /> Launch Pipeline</div>
            {["Agency shortlist", "Strategy conversations", "Beta enquiries", "Trial readiness"].map((item, i) => (
              <div className={styles.pipelineItem} key={item}><span>{item}</span><b>{["Live", "Next", "Build", "Test"][i]}</b></div>
            ))}
          </div>
          <div className={styles.chartPanel}>
            <div className={styles.panelHeader}><BarChart3 size={18} /> Growth Signals</div>
            <div className={styles.bars}>{[58, 82, 46, 72, 63, 90].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
          </div>
          <div className={styles.modulePanel}>
            {["CRM", "Funnels", "Email", "Social", "Builder Ops", "Analytics"].map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </div>
      <div className={styles.floatingCard}><Sparkles size={18} /> AI-assisted campaign planning</div>
    </div>
  );
}

function SoftwareProblemSection() {
  return (
    <section id="problem" className={styles.section}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>THE SOFTWARE PROBLEM</p>
        <h2>Growing businesses are buried under disconnected software.</h2>
        <p>Businesses should not need to manage a patchwork of subscriptions, logins, integrations and duplicated customer data just to operate and grow.</p>
      </div>
      <div className={styles.consolidationMap}>
        <div className={styles.toolCloud}>{toolCategories.map((tool) => <span key={tool}>{tool}</span>)}</div>
        <div className={styles.platformCore}><Network size={30} /><strong>ONE CONNECTED GR8 RESULT PLATFORM</strong></div>
      </div>
    </section>
  );
}

function VisionSection() {
  return (
    <section className={`${styles.section} ${styles.statementSection}`}>
      <p>We are not building another CRM.</p>
      <h2>We are building the operating system for growing businesses.</h2>
      <span>Gr8 Result combines marketing, sales, customer management, content, digital commerce and industry-specific operations inside one connected environment.</span>
    </section>
  );
}

function PlatformEcosystem() {
  return (
    <section id="ecosystem" className={styles.section}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>THE PLATFORM ECOSYSTEM</p>
        <h2>Five connected layers, one operating environment.</h2>
      </div>
      <div className={styles.ecosystemGrid}>
        {platformGroups.map((group) => (
          <article key={group.title} className={styles.ecosystemCard}>
            <h3>{group.title}</h3>
            <div>{group.modules.map((module) => <span key={module}>{module}</span>)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DifferenceSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>WHY GR8 RESULT IS DIFFERENT</p>
        <h2>Built as a connected business platform, not a pile of features.</h2>
      </div>
      <div className={styles.featureGrid}>
        {differenceCards.map(([title, body]) => <article className={styles.featureCard} key={title}><Layers3 size={22} /><h3>{title}</h3><p>{body}</p></article>)}
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section className={styles.section}>
      <div className={styles.split}>
        <div>
          <p className={styles.eyebrow}>WHO THE PLATFORM SERVES</p>
          <h2>Initial market focus: Australian builders, construction businesses and service-based SMEs.</h2>
        </div>
        <div className={styles.audienceColumns}>
          <article><h3>Primary launch focus</h3>{["Residential builders", "Construction businesses", "Trades", "Small and medium-sized service businesses"].map((x) => <span key={x}>{x}</span>)}</article>
          <article><h3>Secondary future markets</h3>{["Marketing agencies", "Consultants", "Professional services", "Coaches and educators", "Franchise groups", "Other growing businesses"].map((x) => <span key={x}>{x}</span>)}</article>
        </div>
      </div>
    </section>
  );
}

function ProductShowcase() {
  const [active, setActive] = useState(0);
  const item = productShowcase[active] || productShowcase[0];
  return (
    <section className={styles.section}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>THE PRODUCT IN ACTION</p>
        <h2>Real platform visuals, framed as launch-ready workflows.</h2>
      </div>
      <div className={styles.showcase}>
        <div className={styles.showcaseTabs} role="tablist" aria-label="Product screenshots">
          {productShowcase.map((tab, index) => <button role="tab" aria-selected={active === index} key={tab.title} onClick={() => setActive(index)}>{tab.title}</button>)}
        </div>
        <figure className={styles.screenshotFrame}>
          <Image src={item.image} alt={`${item.title} screenshot`} width={1100} height={720} loading={active === 0 ? "eager" : "lazy"} />
          <figcaption>{item.outcome}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function WhyNow() {
  const items = ["Businesses are looking to reduce software overload.", "Subscription costs continue to accumulate across separate tools.", "Customers expect connected, automated experiences.", "AI is changing how businesses create, communicate and operate.", "Construction businesses remain underserved by fragmented systems.", "Gr8 Result is approaching launch readiness and needs an expert growth partner."];
  return <section className={styles.section}><div className={styles.sectionIntro}><p className={styles.eyebrow}>WHY NOW</p><h2>The market is ready for fewer disconnected systems and more connected operations.</h2></div><div className={styles.reasonGrid}>{items.map((item) => <article key={item}><Check size={18} />{item}</article>)}</div></section>;
}

function FoundingPartnerOpportunity() {
  const selected = ["lead go-to-market strategy", "develop positioning and messaging", "build pre-launch demand", "create campaigns and creative assets", "plan and manage paid acquisition", "develop nurture and conversion systems", "help establish measurable subscription growth", "use Gr8 Result wherever it is production-ready", "provide structured product feedback", "identify missing marketing workflows", "work directly with the founder and development process", "help shape future agency functionality"];
  const benefits = ["early access to the platform", "direct influence over the roadmap", "priority feature consideration", "founding partner recognition", "joint case study opportunities", "potential future referral or reseller opportunities", "potential long-term commercial relationship"];
  return (
    <section id="opportunity" className={`${styles.section} ${styles.opportunity}`}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>THE FOUNDING GROWTH PARTNER OPPORTUNITY</p>
        <h2>More than an agency relationship.</h2>
        <p>We want one exceptional team to help launch Gr8 Result, use the platform in real campaigns and directly influence what it becomes.</p>
      </div>
      <div className={styles.twoLists}>
        <article><h3>The selected partner will</h3>{selected.map((x) => <span key={x}><ChevronRight size={15} />{x}</span>)}</article>
        <article><h3>Potential strategic benefits</h3>{benefits.map((x) => <span key={x}><ChevronRight size={15} />{x}, subject to agreement</span>)}</article>
      </div>
    </section>
  );
}

function PlatformMarketingWorkflow() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionIntro}><p className={styles.eyebrow}>USE OUR PLATFORM TO MARKET OUR PLATFORM</p><h2>The launch should become a real-world case study of the platform itself.</h2><p>The agency may initially retain specialist external tools where Gr8 Result is not yet production-ready. The objective is genuine operational testing, not forcing unsuitable workflows.</p></div>
      <div className={styles.flow}>{launchFlow.map((step, index) => <div className={styles.flowStep} key={step}><span>{step}</span>{index < launchFlow.length - 1 ? <ArrowRight size={17} /> : null}</div>)}</div>
    </section>
  );
}

function LaunchTimeline() {
  return <section className={styles.section}><div className={styles.sectionIntro}><p className={styles.eyebrow}>THE LAUNCH JOURNEY</p><h2>Approximately 90 days to initial launch readiness, subject to final product testing.</h2></div><div className={styles.timeline}>{launchPhases.map(([phase, title, body]) => <article key={phase}><b>{phase}</b><h3>{title}</h3><p>{body}</p></article>)}</div></section>;
}

function AgencyChallenge() {
  return <section className={`${styles.section} ${styles.challenge}`}><h2>If Gr8 Result were your company, how would you launch it?</h2><div className={styles.challengeGrid}>{challengeQuestions.map((q) => <span key={q}>{q}</span>)}</div></section>;
}

function AgencyResponseRequirements() {
  return <section className={styles.section}><div className={styles.sectionIntro}><p className={styles.eyebrow}>WHAT WE WANT IN THE AGENCY RESPONSE</p><h2>Recommend the strategy, investment and validation plan.</h2><p>Please provide target ranges, assumptions, leading indicators, test budgets and how forecasts will be validated. We are not asking agencies to guarantee MRR, CAC or ROAS.</p></div><div className={styles.checkGrid}>{agencyResponseItems.map((item) => <span key={item}><Check size={16} />{item}</span>)}</div></section>;
}

function EvaluationFramework() {
  return <section className={styles.section}><div className={styles.sectionIntro}><p className={styles.eyebrow}>HOW WE WILL EVALUATE THE PARTNER</p><h2>A practical framework for long-term fit.</h2></div><div className={styles.criteriaGrid}>{evaluationCriteria.map((item) => <article key={item}>{item}</article>)}</div></section>;
}

function SuccessMetrics() {
  return <section className={styles.section}><div className={styles.metricsDashboard}><div><p className={styles.eyebrow}>WHAT SUCCESS LOOKS LIKE</p><h2>Targets should be established after reviewing the product, pricing, audience and available launch resources.</h2></div><div className={styles.metricGrid}>{successMetrics.map((metric) => <span key={metric}>{metric}</span>)}</div></div></section>;
}

function AgencyInterestForm({ agencySlug, agency }) {
  const [form, setForm] = useState({ agencyName: agency?.agencyName || "", contactName: "", position: "", email: "", phone: "", website: "", country: "Australia", saasExperience: "", message: "", preferredTiming: "", consent: false, company: "" });
  const [state, setState] = useState({ status: "idle", message: "" });
  const [started, setStarted] = useState(false);
  const required = ["agencyName", "contactName", "email", "country", "message", "preferredTiming"];
  const errors = useMemo(() => {
    const next = {};
    required.forEach((key) => { if (!String(form[key] || "").trim()) next[key] = "Required"; });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid work email";
    if (!form.consent) next.consent = "Consent is required";
    return next;
  }, [form]);
  function update(key, value) {
    if (!started) { setStarted(true); trackEvent("founding_partner_form_started"); }
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    if (Object.keys(errors).length) {
      setState({ status: "error", message: "Please complete the required fields before submitting." });
      return;
    }
    setState({ status: "submitting", message: "Submitting your interest..." });
    try {
      const response = await fetch("/api/founding-growth-partner/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, agencySlug }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Submission failed");
      trackEvent("founding_partner_form_submitted");
      setState({ status: "success", message: "Thank you. Your partnership interest has been received." });
    } catch (error) {
      setState({ status: "error", message: error.message || "Could not submit right now." });
    }
  }
  return (
    <section id="form" className={styles.section}>
      <div className={styles.formShell}>
        <div>
          <p className={styles.eyebrow}>SUBMIT AGENCY INTEREST</p>
          <h2>Tell us who should be in the strategy conversation.</h2>
          <p>Submissions are validated, rate-limited and stored in the project database for follow-up.</p>
        </div>
        <form className={styles.form} onSubmit={submit} noValidate>
          <input className={styles.honeypot} autoComplete="off" tabIndex="-1" value={form.company} onChange={(e) => update("company", e.target.value)} aria-hidden="true" />
          {[
            ["agencyName", "Agency name", "text"],
            ["contactName", "Contact name", "text"],
            ["position", "Position", "text"],
            ["email", "Work email", "email"],
            ["phone", "Phone", "tel"],
            ["website", "Website", "url"],
            ["country", "Country", "text"],
            ["preferredTiming", "Preferred meeting timing", "text"],
          ].map(([key, label, type]) => <label key={key}>{label}<input type={type} value={form[key]} onChange={(e) => update(key, e.target.value)} aria-invalid={Boolean(errors[key])} />{errors[key] ? <small>{errors[key]}</small> : null}</label>)}
          <label className={styles.full}>SaaS experience<textarea rows="3" value={form.saasExperience} onChange={(e) => update("saasExperience", e.target.value)} /></label>
          <label className={styles.full}>Brief message<textarea rows="4" value={form.message} onChange={(e) => update("message", e.target.value)} aria-invalid={Boolean(errors.message)} />{errors.message ? <small>{errors.message}</small> : null}</label>
          <label className={styles.consent}><input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /> I consent to Gr8 Result Digital Solutions contacting me about this partnership opportunity.</label>
          {errors.consent ? <small className={styles.formError}>{errors.consent}</small> : null}
          <button className={styles.primaryButton} disabled={state.status === "submitting"} type="submit"><Send size={18} /> Submit Partnership Interest</button>
          {state.message ? <p className={state.status === "success" ? styles.success : styles.formError}>{state.message}</p> : null}
        </form>
      </div>
    </section>
  );
}

function FinalCTA({ agencySlug }) {
  const guideUrl = `/api/founding-growth-partner/guide${agencySlug ? `?agencySlug=${encodeURIComponent(agencySlug)}` : ""}`;
  return (
    <section className={`${styles.section} ${styles.finalCta}`}>
      <Image src={brand.logo} alt="Gr8 Result Digital Solutions logo" width={172} height={54} />
      <h2>We are not looking for another supplier.</h2>
      <p>We are looking for a partner who wants to help build Australia&apos;s next major SaaS success story.</p>
      <div className={styles.signature}><strong>Grant Rohde</strong><span>Founder</span><span>Gr8 Result Digital Solutions</span></div>
      <div className={styles.ctaRow}>
        <button className={styles.primaryButton} onClick={() => scrollToId("form")}><CalendarDays size={18} /> Arrange a Strategy Conversation</button>
        <a className={styles.secondaryButton} href={guideUrl} download="gr8-result-founding-growth-partner-guide.pdf"><Download size={18} /> Download Partnership Guide</a>
        <button className={styles.textButton} onClick={() => scrollToId("form")}><Mail size={17} /> Submit Agency Interest</button>
      </div>
    </section>
  );
}

export default function FoundingGrowthPartnerPage({ agencySlug = "" }) {
  const agency = getAgencyProfile(agencySlug);
  useEffect(() => {
    if (agency) trackEvent("founding_partner_personalised_page_viewed", { agency_slug: agencySlug });
    const target = document.getElementById("ecosystem");
    if (!target || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        trackEvent("founding_partner_platform_section_viewed");
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [agency, agencySlug]);

  return (
    <Shell agency={agency}>
      <Hero agencySlug={agencySlug} agency={agency} />
      <SoftwareProblemSection />
      <VisionSection />
      <PlatformEcosystem />
      <DifferenceSection />
      <AudienceSection />
      <ProductShowcase />
      <WhyNow />
      <FoundingPartnerOpportunity />
      <PlatformMarketingWorkflow />
      <LaunchTimeline />
      <AgencyChallenge />
      <AgencyResponseRequirements />
      <EvaluationFramework />
      <SuccessMetrics />
      <AgencyInterestForm agencySlug={agencySlug} agency={agency} />
      <FinalCTA agencySlug={agencySlug} />
      <a className={styles.backToTop} href={foundingPartnerBasePath} aria-label="Back to main invitation"><MousePointer2 size={16} /> Main invitation</a>
    </Shell>
  );
}
