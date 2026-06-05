import {
  buildColumns2,
  buildParallax,
  getVisualSystem,
  section,
} from "./core";
import {
  buildServiceFirmBlueprint,
} from "./serviceFirm";
export function insertTradeShowcase(blueprint, profile, options = {}) {
  const homeSections = blueprint?.pages?.[0]?.sections;
  if (!Array.isArray(homeSections)) return blueprint;

  const marqueeIndex = homeSections.findIndex((section) => section?.type === 'marquee-strip');
  const insertAt = typeof options.insertIndex === 'number'
    ? options.insertIndex
    : marqueeIndex >= 0
      ? marqueeIndex + 1
      : 2;

  homeSections.splice(insertAt, 0,
    buildParallax({
      title: options.parallaxTitle,
      subtitle: options.parallaxSubtitle,
      buttonLabel: options.parallaxButtonLabel || (profile.navCtaLabel || 'Contact'),
      buttonHref: options.parallaxButtonHref || (profile.navCtaHref || '/contact'),
      imageUrl: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || '',
      floatingImage: profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || '',
      backgroundColor: options.parallaxBackgroundColor,
      buttonColor: options.parallaxButtonColor,
      buttonTextColor: options.parallaxButtonTextColor,
      minHeight: options.parallaxMinHeight || '68vh',
      contentWidth: options.parallaxContentWidth || 560,
      floatingWidth: options.floatingWidth || 280,
      floatingHeight: options.floatingHeight || 220,
    }, getVisualSystem(profile.templateSlug)),
    section('image-stack', {
      title: options.stackTitle,
      minHeight: options.stackMinHeight || '760px',
      images: [
        { id: `${profile.templateSlug}-stack-1`, kind: 'image', src: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || '', x: 36, y: 36, width: 360, height: 250, rotation: -4, radius: 24, zIndex: 1 },
        { id: `${profile.templateSlug}-stack-copy`, kind: 'text', content: options.stackCopy, x: 430, y: 42, width: 500, height: 210, rotation: 0, radius: 24, zIndex: 3, fontSize: options.stackFontSize || 28, fontWeight: '700', textAlign: 'left', verticalAlign: 'center', textColor: options.stackTextColor || '#0f172a', background: options.stackTextBackground || 'rgba(255,255,255,0.94)' },
        { id: `${profile.templateSlug}-stack-2`, kind: 'image', src: profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || '', x: 120, y: 332, width: 300, height: 220, rotation: -3, radius: 24, zIndex: 2 },
        { id: `${profile.templateSlug}-stack-3`, kind: 'image', src: profile.proofPage?.gallery?.images?.[0]?.src || profile.home?.gallery?.images?.[2]?.src || '', x: 560, y: 312, width: 340, height: 240, rotation: 5, radius: 24, zIndex: 1 },
      ],
    }),
    buildColumns2({
      ratio: options.columnsRatio || '50-50',
      leftTitle: options.columnsLeftTitle,
      leftContent: options.columnsLeftContent,
      rightTitle: options.columnsRightTitle,
      rightContent: options.columnsRightContent,
      leftImage: options.columnsLeftImage ? (profile.home?.gallery?.images?.[2]?.src || profile.about?.imageUrl || '') : '',
      rightImage: profile.about?.imageUrl || profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || '',
      cardBackgroundColor: options.columnsCardBackground || '#f8fafc',
    })
  );

  return blueprint;
}

export function buildPlumbingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Plumbing websites should feel urgent, capable, and visibly practical, not like abstract agency templates.',
    parallaxSubtitle: 'Use large imagery, motion, and service-specific proof to show leaks, hot water, drains, and maintenance work with more visual confidence.',
    parallaxBackgroundColor: '#0b3b5b',
    parallaxButtonColor: '#38bdf8',
    parallaxButtonTextColor: '#082f49',
    stackTitle: 'Plumbing proof canvas',
    stackCopy: 'Show vans, technicians, bathrooms, hot water, and completed repair work so the page feels grounded in the trade.',
    columnsLeftTitle: 'What plumbing buyers want to see fast',
    columnsLeftContent: 'Emergency readiness, clean communication, local coverage, visible workmanship, and a clear quote path.',
    columnsRightTitle: 'What this layout is selling visually',
    columnsRightContent: 'Urgent repairs, planned maintenance, hot water replacements, and the kind of practical trust markers that matter before a call-out.',
    columnsCardBackground: '#e0f2fe',
  });
}

export function buildElectricalBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Electrical websites need sharper contrast, more technical confidence, and more motion than generic local-service pages.',
    parallaxSubtitle: 'The goal here is clean competence: switchboards, lighting, compliance, fault-finding, and polished visuals that feel engineered.',
    parallaxBackgroundColor: '#111827',
    parallaxButtonColor: '#fbbf24',
    parallaxButtonTextColor: '#1f2937',
    stackTitle: 'Electrical systems canvas',
    stackCopy: 'Use layered product, panel, wiring, and onsite imagery to make the brand feel licensed, organised, and technically credible.',
    columnsLeftTitle: 'What electrical visitors are scanning for',
    columnsLeftContent: 'Licensing cues, safety language, upgrade categories, fast response, and signs that the business actually understands the scope.',
    columnsRightTitle: 'How this template differs from plumbing',
    columnsRightContent: 'It leans cleaner, more structured, and more technical, with darker contrast, stronger light accents, and less domestic warmth.',
    columnsCardBackground: '#fef3c7',
  });
}

export function buildHvacBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'HVAC and air conditioning pages should sell comfort, airflow, system performance, and service response through richer visual pacing.',
    parallaxSubtitle: 'Use a cooler palette, equipment imagery, and motion-led sections so the site feels like climate control, not another contractor brochure.',
    parallaxBackgroundColor: '#075985',
    parallaxButtonColor: '#67e8f9',
    parallaxButtonTextColor: '#083344',
    stackTitle: 'Climate-control visual stack',
    stackCopy: 'Layer indoor comfort, equipment, technicians, and property scenes so installs and service plans feel tangible.',
    columnsLeftTitle: 'What HVAC buyers need clarified',
    columnsLeftContent: 'System type, service model, emergency support, maintenance plans, and whether the business works across homes and commercial sites.',
    columnsRightTitle: 'Why the page should feel different',
    columnsRightContent: 'This version uses cleaner product-style rhythm and cooler tones to frame reliability, airflow, and ongoing maintenance rather than one-off repair only.',
    columnsCardBackground: '#e0f7ff',
  });
}

export function buildRoofingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Roofing templates need high-drama proof, elevation, and project weight, because buyers are thinking about risk and visible outcomes.',
    parallaxSubtitle: 'Use bigger imagery, warmer tones, and layered project visuals to frame inspections, re-roofs, repairs, and storm response as serious work.',
    parallaxBackgroundColor: '#4a2410',
    parallaxButtonColor: '#fb923c',
    parallaxButtonTextColor: '#431407',
    stackTitle: 'Roofing project showcase',
    stackCopy: 'Make the page feel like projects, access, height, and visible workmanship, not a soft lifestyle brochure.',
    columnsLeftTitle: 'What this layout needs to communicate',
    columnsLeftContent: 'Inspection process, visible proof, project scope, storm readiness, and enough authority for larger roofing jobs.',
    columnsRightTitle: 'Why roofing should feel heavier',
    columnsRightContent: 'The visuals should suggest project scale and risk management, which is very different from the faster, service-call feel of plumbing or electrical.',
    columnsCardBackground: '#ffedd5',
  });
}

export function buildCleaningBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Cleaning sites convert better when they feel polished, airy, and visually cared for, with far more imagery than a text-first local-service page.',
    parallaxSubtitle: 'Use lighter surfaces, domestic scenes, checklists, and before-and-after atmosphere so visitors can feel presentation and trust.',
    parallaxBackgroundColor: '#dffaf7',
    parallaxButtonColor: '#14b8a6',
    parallaxButtonTextColor: '#ecfeff',
    stackTitle: 'Cleaning brand moodboard',
    stackCopy: 'Layer property scenes, polished surfaces, team imagery, and soft editorial spacing so recurring cleaning feels premium and calm.',
    stackTextColor: '#134e4a',
    stackTextBackground: 'rgba(255,255,255,0.95)',
    columnsLeftTitle: 'Why cleaning needs more images',
    columnsLeftContent: 'People are buying trust, presentation, care, and consistency. Imagery does more work here than generic claims ever will.',
    columnsRightTitle: 'How this differs from trade pages',
    columnsRightContent: 'This version is lighter, calmer, and more editorial. It is designed to feel neat and reassuring instead of urgent or industrial.',
    columnsCardBackground: '#ecfdf5',
  });
}

export function buildLandscapingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Landscaping pages should feel lush, outdoor, and transformation-led, with layered photography doing a lot of the selling work.',
    parallaxSubtitle: 'Use larger garden and property imagery so the site sells atmosphere, curb appeal, and project outcomes before the quote request.',
    parallaxBackgroundColor: '#1f4d2b',
    parallaxButtonColor: '#84cc16',
    parallaxButtonTextColor: '#1a2e05',
    stackTitle: 'Outdoor transformation board',
    stackCopy: 'Build a more visual site around lawns, gardens, hardscape edges, and the overall feel of a finished outdoor space.',
    columnsLeftTitle: 'What outdoor-service buyers respond to',
    columnsLeftContent: 'Before-and-after style proof, maintenance credibility, seasonal value, and clear project types they can picture on their own property.',
    columnsRightTitle: 'Why this should not look like electrical',
    columnsRightContent: 'The page should feel organic, greener, and more spatial, with softer rhythm and broader property photography rather than technical contrast.',
    columnsCardBackground: '#ecfccb',
  });
}

export function buildPestControlBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Pest control pages need reassurance, inspection credibility, and a stronger sense of property protection than generic trade layouts.',
    parallaxSubtitle: 'Use structured imagery and darker contrast to make treatment plans, inspections, and ongoing protection feel methodical and professional.',
    parallaxBackgroundColor: '#1f2937',
    parallaxButtonColor: '#22c55e',
    parallaxButtonTextColor: '#052e16',
    stackTitle: 'Inspection and protection stack',
    stackCopy: 'Show home environments, technicians, inspection moments, and controlled treatment visuals so the site feels calm and competent.',
    columnsLeftTitle: 'What pest visitors need from the page',
    columnsLeftContent: 'A sense of fast help, inspection structure, treatment clarity, and confidence that the business is practical rather than alarmist.',
    columnsRightTitle: 'Why this layout needs control',
    columnsRightContent: 'Unlike cleaning or landscaping, the tone here should feel measured and protective, with stronger structure and less decorative softness.',
    columnsCardBackground: '#dcfce7',
  });
}

export function buildEcommerceBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'An online store should feel merchandised and editorial, with product atmosphere and collection movement built into the homepage.',
    parallaxSubtitle: 'Use richer image stacks, wider galleries, and a more fashion-forward rhythm so the storefront feels shoppable rather than brochure-like.',
    parallaxButtonLabel: 'Shop now',
    parallaxButtonHref: '/services',
    parallaxBackgroundColor: '#18181b',
    parallaxButtonColor: '#f97316',
    parallaxButtonTextColor: '#fff7ed',
    stackTitle: 'Collection spotlight canvas',
    stackCopy: 'Build visual momentum with lifestyle imagery, collection framing, product curation, and stronger editorial composition.',
    stackTextColor: '#18181b',
    columnsLeftTitle: 'What the homepage must do',
    columnsLeftContent: 'Move visitors into collections quickly, reinforce product trust, and make merchandising feel intentional from the first scroll.',
    columnsRightTitle: 'Why ecommerce must diverge hard from trades',
    columnsRightContent: 'This version is less about quote friction and more about browsing flow, brand atmosphere, and product discovery. It should look like a store.',
    columnsCardBackground: '#ffedd5',
  });
}

export function buildSolarBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Solar pages should feel cleaner, brighter, and more future-facing than a generic contractor website.',
    parallaxSubtitle: 'Use rooftop, panel, and energy visuals to make the install process and long-term value feel concrete before the quote.',
    parallaxBackgroundColor: '#1e293b',
    parallaxButtonColor: '#facc15',
    parallaxButtonTextColor: '#422006',
    stackTitle: 'Solar system visual board',
    stackCopy: 'Layer rooftops, panels, home scenes, and energy conversations so the site feels like a real solar provider with visible outcomes.',
    columnsLeftTitle: 'What solar buyers need clarified',
    columnsLeftContent: 'System fit, savings, battery options, install process, and whether the provider feels trustworthy enough to invite onsite.',
    columnsRightTitle: 'Why the page should feel optimistic',
    columnsRightContent: 'This version should feel brighter and more future-facing than standard trade pages because the category is part infrastructure and part lifestyle upgrade.',
    columnsCardBackground: '#fef9c3',
  });
}

export function buildPoolServiceBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Pool service sites should feel calm, premium, and presentation-led, with much stronger water and outdoor imagery than a normal service site.',
    parallaxSubtitle: 'Use polished outdoor visuals, water color, and recurring-service cues so the brand feels premium and well maintained.',
    parallaxBackgroundColor: '#dff9ff',
    parallaxButtonColor: '#06b6d4',
    parallaxButtonTextColor: '#ecfeff',
    stackTitle: 'Pool presentation stack',
    stackCopy: 'Use layered pool and outdoor imagery to make cleanliness, care, and recurring maintenance feel desirable before the enquiry.',
    stackTextColor: '#155e75',
    columnsLeftTitle: 'What this category sells visually',
    columnsLeftContent: 'Clean water, premium property presentation, recurring maintenance confidence, and the feeling that the space will stay ready to use.',
    columnsRightTitle: 'Why it should not look like plumbing',
    columnsRightContent: 'This version is softer and more aspirational, with more emphasis on presentation and outdoor lifestyle rather than urgency and repairs.',
    columnsCardBackground: '#cffafe',
  });
}

export function buildAutoRepairBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  return insertTradeShowcase(blueprint, profile, {
    parallaxTitle: 'Auto repair templates need workshop grit, vehicle imagery, and repair confidence instead of the cleaner rhythm used for home-service brands.',
    parallaxSubtitle: 'Use workshop visuals, car scenes, and stronger contrast so servicing and diagnostics feel practical and trustworthy.',
    parallaxBackgroundColor: '#1f2937',
    parallaxButtonColor: '#f97316',
    parallaxButtonTextColor: '#fff7ed',
    stackTitle: 'Workshop proof stack',
    stackCopy: 'Layer vehicles, workshop scenes, and practical service visuals so the page feels grounded in real repair work.',
    columnsLeftTitle: 'What vehicle owners need to trust',
    columnsLeftContent: 'That the workshop is competent, communicative, fairly run, and able to deal with both routine servicing and more stressful repair jobs.',
    columnsRightTitle: 'Why this layout needs more grit',
    columnsRightContent: 'The visuals here should feel more mechanical and practical, with workshop atmosphere and repair cues replacing domestic or lifestyle softness.',
    columnsCardBackground: '#ffedd5',
  });
}

export function buildMortgageBrokerBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const homeSections = blueprint?.pages?.[0]?.sections;
  if (!Array.isArray(homeSections)) return blueprint;

  const system = getVisualSystem(profile.templateSlug);
  const heroIndex = homeSections.findIndex((section) => section?.type === 'hero');
  if (heroIndex >= 0) {
    homeSections[heroIndex] = {
      ...homeSections[heroIndex],
      props: {
        ...homeSections[heroIndex].props,
        headline: profile.home?.hero?.title || 'Mortgage advice that makes borrowers feel clear and ready to act',
        subheadline: profile.home?.hero?.subtitle || 'Built for first-home buyers, refinancers, and investors who need calmer guidance, lender clarity, and a stronger reason to book a finance strategy call.',
        contentWidth: 700,
        headlineFontSize: 52,
        subheadlineFontSize: 17,
        contentX: 31,
        contentY: 50,
      },
    };
  }

  const showcaseIndex = homeSections.findIndex((section) => section?.type === 'image-stack');
  if (showcaseIndex >= 0) {
    homeSections.splice(showcaseIndex, 1);
  }

  const firstColumnsIndex = homeSections.findIndex((section) => section?.type === 'columns-2');
  if (firstColumnsIndex >= 0) {
    homeSections[firstColumnsIndex] = buildColumns2({
      ratio: '50-50',
      leftTitle: 'Borrowers need a path, not a wall of finance jargon',
      leftContent: 'First-home buyers, refinancers, and investors usually arrive unsure about timing, lender fit, borrowing power, and what paperwork matters most. This section should make the process feel staged, calm, and easier to begin.\n\nUse it to explain what happens in the first strategy call, what to prepare, and how the broker narrows down the right lending path.',
      rightTitle: 'What a stronger broker homepage should do',
      rightContent: 'Show the main borrowing scenarios clearly.\n\nPosition the broker as a guide, not just a lead form.\n\nUse property imagery, lender context, and visible next steps so visitors feel more prepared before they enquire.',
      leftImage: profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || '',
      rightImage: profile.about?.imageUrl || profile.home?.gallery?.images?.[2]?.src || '',
      cardBackgroundColor: '#eff6ff',
    });
  }

  const marqueeIndex = homeSections.findIndex((section) => section?.type === 'marquee-strip');
  const insertAt = marqueeIndex >= 0 ? marqueeIndex + 1 : 2;
  homeSections.splice(insertAt, 0, buildParallax({
    title: 'A broker homepage should feel calm, lender-savvy, and property-aware before the service cards even begin.',
    subtitle: 'Use cleaner property imagery, borrower guidance, and motion-led pacing so the visitor feels guided rather than sold to.',
    buttonLabel: profile.navCtaLabel || 'Book finance call',
    buttonHref: profile.navCtaHref || '/contact',
    imageUrl: profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || '',
    floatingImage: profile.about?.imageUrl || profile.home?.gallery?.images?.[2]?.src || '',
    backgroundColor: '#eff6ff',
    buttonColor: '#1d4ed8',
    buttonTextColor: '#eff6ff',
    headlineColor: '#0f172a',
    textColor: '#1e3a8a',
    minHeight: '66vh',
    contentWidth: 540,
    floatingWidth: 300,
    floatingHeight: 220,
  }, system));

  return blueprint;
}

