import {
  attachTeamMemberImages,
  buildColumns2,
  buildCta,
  buildFaq,
  buildFeatureList,
  buildGallery,
  buildHero,
  buildMarqueeStrip,
  buildParallax,
  buildStats,
  buildTestimonials,
  buildTrustBadges,
  findPage,
  getProfileImage,
  getVisualSystem,
  insertAfterSectionType,
  insertBeforeFooter,
  section,
  updateContactFormFields,
} from "./core";
import { buildServiceFirmBlueprint } from "./serviceFirm";

export function buildGenericPremiumBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const aboutPage = findPage(blueprint, profile.about?.slug || "about");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "A production-quality starter should feel intentionally art-directed from the first scroll",
      subtitle: "This section adds pacing, visual authority, and a sense of premium depth before the proof and offer sections begin.",
      buttonLabel: "See capabilities",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "68vh",
      contentWidth: 600,
    }, system),
    section("image-stack", {
      title: "Brand Storyboard",
      minHeight: "66vh",
      images: [
        { id: "generic-stack-image-1", kind: "image", src: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || ""), x: 14, y: 12, width: 320, height: 220, rotation: -5, radius: 22, zIndex: 1 },
        { id: "generic-stack-text", kind: "text", content: profile.home?.hero?.subtitle || "Position the business with more polish, more hierarchy, and more believable depth.", x: 44, y: 34, width: 420, height: 160, rotation: 0, radius: 18, zIndex: 2, fontSize: 28, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.92)" },
        { id: "generic-stack-image-2", kind: "image", src: getProfileImage(imageProfile, 3, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""), x: 68, y: 58, width: 280, height: 210, rotation: 6, radius: 22, zIndex: 3 },
      ],
    }),
  ]);

  insertBeforeFooter(aboutPage, buildColumns2({
    ratio: "50-50",
    leftTitle: "How this site should read",
    leftContent: "Confident, commercially clear, and well-structured enough to feel like an already-established business rather than a starter kit.",
    rightTitle: "What to customise first",
    rightContent: "Replace the proof, sharpen the positioning, and update the offer hierarchy before you touch visual polish. Better structure compounds faster than surface tweaks.",
    rightImage: getProfileImage(imageProfile, 4, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
    cardBackgroundColor: "#f8fafc",
  }));

  return blueprint;
}

export function buildMedicalBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildTrustBadges(["Qualified practitioners", "Patient-first care", "Clear next steps", "Easy appointment flow"]),
    buildParallax({
      title: "Patients decide quickly whether a clinic feels safe, clear, and professionally run",
      subtitle: "This section slows the pace down and reinforces calm trust before service explanations and booking prompts appear.",
      buttonLabel: "View services",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "64vh",
      backgroundColor: "#dff4ff",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
      headlineColor: system.hero.headlineColor,
      textColor: system.hero.textColor,
    }, system),
    buildColumns2({
      ratio: "50-50",
      leftTitle: "What new patients need to know first",
      leftContent: "Who the clinic helps, what happens at the first appointment, and how care is explained in plain language.",
      rightTitle: "What creates confidence",
      rightContent: "Qualified practitioners, clear communication, easier booking, and a site that removes uncertainty before the visit.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || profile.about?.imageUrl || ""),
      cardBackgroundColor: "#f0f9ff",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildColumns2({
    ratio: "40-60",
    leftTitle: "Appointment pathway",
    leftContent: "Initial consultation, diagnosis or treatment planning, follow-up support, and clearer expectations around care.",
    rightTitle: "Use this page to reduce uncertainty",
    rightContent: "Patients should finish this page understanding which appointment to book, what to bring, and what kind of support the clinic provides.",
    cardBackgroundColor: "#f0f9ff",
  }));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jamie Smith" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "jamie@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "appointmentType", label: "Appointment Type", type: "text", required: false, placeholder: "Initial consultation, follow-up, treatment" },
    { name: "availability", label: "Preferred Availability", type: "text", required: false, placeholder: "Morning, afternoons, specific dates" },
    { name: "notes", label: "Anything We Should Know", type: "textarea", required: false, placeholder: "Symptoms, referral details, or questions" },
  ]);

  return blueprint;
}

export function buildLawBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const aboutPage = findPage(blueprint, profile.about?.slug || "about");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  if (homePage && Array.isArray(homePage.sections)) {
    homePage.sections = [
      homePage.sections[0],
      buildHero({
        ...(profile.home?.hero || {}),
        imageUrl: profile.home?.hero?.imageUrl || getProfileImage(imageProfile, 0, ""),
        floatingImage: "",
      }, {
        heroVariant: "split",
        minHeight: "94vh",
        backgroundColor: "#182131",
        buttonColor: system.hero.buttonColor,
        buttonTextColor: system.hero.buttonTextColor,
      }, system),
      buildMarqueeStrip([
        profile.home?.hero?.eyebrow || "Legal",
        "Family Law",
        "Commercial Advice",
        "Employment Matters",
        "Property Transactions",
        "Request Consultation",
      ], {
        backgroundColor: "#111827",
        textColor: "#f8fafc",
        accentColor: system.hero.buttonColor,
        speed: 22,
      }),
      buildTrustBadges(["Principal-led advice", "Confidential matters", "Clear legal pathway", "Consultation-first approach"]),
      buildStats(profile.home?.stats || {}),
      buildColumns2({
        ratio: "58-42",
        leftTitle: "What a prospect needs to understand quickly",
        leftContent: "Who the firm acts for, how matters are handled, what the first consultation looks like, and whether the team communicates with clarity instead of theatre.",
        rightTitle: "Why this homepage should feel different",
        rightContent: "A strong legal website should feel measured, senior, and easy to navigate. It should lower perceived risk before it asks for the enquiry.",
        rightImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
        cardBackgroundColor: "#f8fafc",
      }),
      buildFeatureList(profile.home?.services || {}, {
        featureVariant: "editorial-cards",
        layout: "columns",
        fallbackImage: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || ""),
        fallbackImages: [
          getProfileImage(imageProfile, 2, profile.home?.gallery?.images?.[0]?.src || ""),
          getProfileImage(imageProfile, 3, profile.home?.gallery?.images?.[1]?.src || ""),
          getProfileImage(imageProfile, 4, profile.home?.gallery?.images?.[2]?.src || ""),
        ],
      }),
      buildColumns2({
        ratio: "45-55",
        leftTitle: "What clients are really judging",
        leftContent: "Whether the firm feels calm under pressure, whether the advice sounds practical, and whether contacting the team will lead to a clear next step rather than a vague process.",
        rightTitle: "What this starter already gives you",
        rightContent: (profile.home?.features?.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
        leftImage: getProfileImage(imageProfile, 3, profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
        cardBackgroundColor: "#f8fafc",
      }),
      profile.home?.gallery ? buildGallery(profile.home.gallery, system.galleryVariant || "balanced-grid") : null,
      profile.home?.testimonials ? buildTestimonials(profile.home.testimonials, "cards") : null,
      profile.home?.faq ? buildFaq(profile.home.faq) : null,
      buildCta(profile.home?.cta || {}, system.ctaStyle || "split-banner"),
      homePage.sections[homePage.sections.length - 1],
    ].filter(Boolean);
  }

  insertBeforeFooter(aboutPage, buildTrustBadges(["Principal-led matters", "Clear communication", "Measured strategy", "Confidential handling"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Alex Morgan" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "alex@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "matterType", label: "Matter Type", type: "text", required: false, placeholder: "Commercial, employment, private client" },
    { name: "urgency", label: "Urgency", type: "text", required: false, placeholder: "General advice, urgent, time-sensitive" },
    { name: "summary", label: "Brief Summary", type: "textarea", required: false, placeholder: "Share enough context for the firm to triage the enquiry" },
  ]);

  return blueprint;
}

export function buildRealEstateBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const resultsPage = findPage(blueprint, profile.proofPage?.slug || "results");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "The strongest property sites sell the agent brand, the campaign engine, and the local market story all at once",
      subtitle: "This gives the homepage some premium movement before it transitions into listings, proof, and appraisal CTAs.",
      buttonLabel: "View listings",
      buttonHref: "/results",
      imageUrl: getProfileImage(imageProfile, 0, profile.proofPage?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.proofPage?.gallery?.images?.[1]?.src || profile.about?.imageUrl || ""),
      minHeight: "70vh",
      backgroundColor: "#183b56",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    section("image-stack", {
      title: "Campaign Showcase",
      minHeight: "78vh",
      images: [
        { id: "property-1", kind: "image", src: getProfileImage(imageProfile, 2, profile.proofPage?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""), x: 36, y: 42, width: 430, height: 300, rotation: -5, radius: 22, zIndex: 1 },
        { id: "property-text", kind: "text", content: "Use this section to frame prestige, market activity, and listing quality instead of relying on a generic brochure layout.", x: 420, y: 86, width: 500, height: 240, radius: 22, zIndex: 2, fontSize: 38, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.95)" },
        { id: "property-2", kind: "image", src: getProfileImage(imageProfile, 3, profile.proofPage?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || ""), x: 760, y: 332, width: 360, height: 260, rotation: 6, radius: 22, zIndex: 3 },
      ],
    }),
  ]);

  insertBeforeFooter(resultsPage, buildColumns2({
    ratio: "50-50",
    leftTitle: "How to use this page well",
    leftContent: "Mix sold listings, campaign snapshots, suburb commentary, and appraisal prompts so the page supports both proof and prospecting.",
    rightTitle: "What vendors notice",
    rightContent: "Activity, polish, negotiation confidence, and visible local knowledge. The page should feel like a live market operator, not a static brand brochure.",
    cardBackgroundColor: "#eff6ff",
  }));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jordan Parker" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "jordan@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "propertyType", label: "Property Type", type: "text", required: false, placeholder: "House, apartment, townhouse" },
    { name: "suburb", label: "Suburb", type: "text", required: false, placeholder: "Suburb or local area" },
    { name: "goal", label: "What Do You Need Help With?", type: "textarea", required: false, placeholder: "Appraisal, selling advice, buyer support, or project marketing" },
  ]);

  return blueprint;
}

export function buildSalonSpaBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Beauty and wellness sites need atmosphere, softness, and trust before the booking prompt lands",
      subtitle: "This gives the starter more sensory pacing so it feels like a premium studio brand, not a card grid with a logo.",
      buttonLabel: "View treatments",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || ""),
      minHeight: "72vh",
      backgroundColor: "#fff4f0",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    buildColumns2({
      ratio: "40-60",
      leftTitle: "What the studio should communicate",
      leftContent: "Premium care, calming detail, and a treatment experience that feels personal from the first click.",
      rightTitle: "What should convert the visitor",
      rightContent: "Clear treatment groupings, visual atmosphere, trust-building reviews, and a booking page that captures enough detail to respond well.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || ""),
      cardBackgroundColor: "#fff7f7",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildTrustBadges(["Qualified team", "Premium client care", "Tailored treatment plans", "Booking-friendly flow"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Taylor West" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "taylor@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "treatmentInterest", label: "Treatment Interest", type: "text", required: false, placeholder: "Skin, brows, beauty, packages" },
    { name: "preferredDate", label: "Preferred Date or Time", type: "text", required: false, placeholder: "Best day or time" },
    { name: "notes", label: "Anything We Should Know", type: "textarea", required: false, placeholder: "Skin concerns, event date, or treatment goals" },
  ]);

  return blueprint;
}

export function buildFitnessBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Fitness brands need motion, intensity, and a real sense of culture, not just generic motivational copy",
      subtitle: "This section helps the site feel like a live training environment with momentum and identity.",
      buttonLabel: "View programs",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "70vh",
      backgroundColor: "#151c2f",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    buildColumns2({
      ratio: "50-50",
      leftTitle: "What drives conversion here",
      leftContent: "A clear training promise, visible coaching quality, community proof, and an easy first step like a trial or intro consult.",
      rightTitle: "What the site should feel like",
      rightContent: "Confident, energetic, disciplined, and outcome-focused without turning into clichÃ© hype.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.hero?.imageUrl || profile.about?.imageUrl || ""),
      cardBackgroundColor: "#fef2f2",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildTrustBadges(["Coaching-led", "Beginner friendly", "Visible progress", "Strong member culture"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jordan Blake" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "jordan@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "goal", label: "Primary Goal", type: "text", required: false, placeholder: "Strength, fat loss, energy, confidence" },
    { name: "experience", label: "Training Experience", type: "text", required: false, placeholder: "Beginner, returning, experienced" },
    { name: "availability", label: "Preferred Times", type: "textarea", required: false, placeholder: "Best days, times, or program preference" },
  ]);

  return blueprint;
}

export function buildHomeRenovationBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const resultsPage = findPage(blueprint, profile.proofPage?.slug || "results");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Builder and renovation sites need to show process, detail, and trust long before the quote form appears",
      subtitle: "This adds production-quality pacing and makes the project gallery feel earned rather than tacked on.",
      buttonLabel: "View projects",
      buttonHref: "/results",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.home?.gallery?.images?.[1]?.src || profile.about?.imageUrl || ""),
      minHeight: "68vh",
      backgroundColor: "#262626",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
    }, system),
    buildColumns2({
      ratio: "50-50",
      leftTitle: "What homeowners want to know fast",
      leftContent: "Can you handle the scope, communicate clearly, manage trades well, and deliver a finish that feels worth the spend?",
      rightTitle: "What the site should demonstrate",
      rightContent: "Project quality, process clarity, realistic trust markers, and imagery that makes the workmanship feel tangible.",
      rightImage: getProfileImage(imageProfile, 2, profile.home?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || ""),
      cardBackgroundColor: "#fafaf9",
    }),
  ]);

  insertBeforeFooter(resultsPage, buildTrustBadges(["Clear quoting", "Project-managed delivery", "Craft-led detail", "Reliable communication"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Casey Morgan" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "casey@example.com" },
    { name: "phone", label: "Phone", type: "text", required: false, placeholder: "+61 ..." },
    { name: "projectType", label: "Project Type", type: "text", required: false, placeholder: "Kitchen, bathroom, extension, renovation" },
    { name: "location", label: "Project Location", type: "text", required: false, placeholder: "Suburb or area" },
    { name: "timeline", label: "Stage and Timeline", type: "textarea", required: false, placeholder: "Concept, quoting, plans ready, preferred start" },
  ]);

  return blueprint;
}

export function buildAccountingBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  const imageProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(profile.templateSlug);
  const homePage = findPage(blueprint, "home");
  const servicesPage = findPage(blueprint, profile.servicesPage?.slug || "services");
  const contactPage = findPage(blueprint, profile.contactPage?.slug || "contact");

  insertAfterSectionType(homePage, "hero", [
    buildParallax({
      title: "Finance and advisory sites need calm confidence and operational clarity, not generic corporate filler",
      subtitle: "This section helps the firm feel precise, commercially useful, and trustworthy before the service detail begins.",
      buttonLabel: "View services",
      buttonHref: "/services",
      imageUrl: getProfileImage(imageProfile, 0, profile.home?.hero?.imageUrl || ""),
      floatingImage: getProfileImage(imageProfile, 1, profile.about?.imageUrl || profile.home?.hero?.imageUrl || ""),
      minHeight: "64vh",
      backgroundColor: "#f1f5f9",
      buttonColor: system.hero.buttonColor,
      buttonTextColor: system.hero.buttonTextColor,
      headlineColor: system.hero.headlineColor,
      textColor: system.hero.textColor,
    }, system),
    buildColumns2({
      ratio: "45-55",
      leftTitle: "What business owners want",
      leftContent: "Accurate numbers, clean communication, fewer surprises, and support that helps them make better decisions.",
      rightTitle: "What this site should reinforce",
      rightContent: "Reliability, responsiveness, software familiarity, and enough advisory depth to position the firm above commodity compliance work.",
      cardBackgroundColor: "#f8fafc",
    }),
  ]);

  insertBeforeFooter(servicesPage, buildTrustBadges(["Accurate reporting", "Responsive support", "Advisory mindset", "Cloud-software friendly"]));

  updateContactFormFields(contactPage, [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Morgan Lee" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "morgan@example.com" },
    { name: "businessName", label: "Business Name", type: "text", required: false, placeholder: "Business name" },
    { name: "software", label: "Current Software", type: "text", required: false, placeholder: "Xero, MYOB, QBO, spreadsheets" },
    { name: "supportNeeded", label: "Support Needed", type: "text", required: false, placeholder: "Bookkeeping, tax, payroll, advisory" },
    { name: "notes", label: "Current Challenges", type: "textarea", required: false, placeholder: "Share the finance, reporting, or compliance issues you want solved" },
  ]);

  return blueprint;
}
