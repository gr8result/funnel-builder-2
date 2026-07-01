import {
  TEMPLATE_VISUAL_SYSTEMS,
  buildContact,
  buildColumns2,
  buildCta,
  buildDecorativeDivider,
  buildFaq,
  buildFeatureList,
  buildFooter,
  buildGallery,
  buildHero,
  buildMarqueeStrip,
  buildNav,
  buildPage,
  buildParallax,
  buildPricing,
  buildPrivacyPolicyPage,
  buildShowcaseStack,
  buildStats,
  buildTermsPage,
  buildTestimonials,
  buildText,
  buildTrustBadges,
  collectDistinctImagePool,
  getIndustryContactFields,
  getIndustryTrustBadges,
  getProfileImage,
  getVisualSystem,
  insertAfterSectionType,
  insertBeforeFooter,
  pickImageWindow,
  section,
  updateContactFormFields,
  withHeroMedia,
} from "./core";
export function buildServiceFirmBlueprint(profile) {
  const hydratedProfile = attachTeamMemberImages(profile);
  const system = getVisualSystem(hydratedProfile.templateSlug || "default");
  const imagePool = buildProfileImagePool(hydratedProfile);
  const distinctImagePool = collectDistinctImagePool(hydratedProfile, [
    hydratedProfile.home?.hero?.imageUrl,
    hydratedProfile.about?.imageUrl,
    hydratedProfile.servicesPage?.hero?.imageUrl,
    hydratedProfile.contactPage?.hero?.imageUrl,
    ...(hydratedProfile.home?.gallery?.images || []).map((image) => image?.src),
    ...(hydratedProfile.proofPage?.gallery?.images || []).map((image) => image?.src),
  ]);
  const pages = [
    { slug: "home", title: "Home" },
    { slug: hydratedProfile.about?.slug || "about", title: hydratedProfile.about?.pageTitle || "About" },
    { slug: hydratedProfile.servicesPage?.slug || "services", title: hydratedProfile.servicesPage?.pageTitle || "Services" },
    ...(hydratedProfile.proofPage ? [{ slug: hydratedProfile.proofPage.slug || "results", title: hydratedProfile.proofPage.pageTitle || "Results" }] : []),
    { slug: hydratedProfile.contactPage?.slug || "contact", title: hydratedProfile.contactPage?.pageTitle || "Contact" },
    { slug: "privacy", title: "Privacy Policy" },
    { slug: "terms", title: "Terms of Service" },
  ];
  const nav = buildNav(hydratedProfile, pages, system);
  const footer = buildFooter(hydratedProfile, pages, system);
  const home = hydratedProfile.home || {};
  const about = hydratedProfile.about || {};
  const services = hydratedProfile.servicesPage || {};
  const proof = hydratedProfile.proofPage || null;
  const contact = hydratedProfile.contactPage || {};
  const homeFeatureImages = pickImageWindow(distinctImagePool, 2, 3);
  const serviceFeatureImages = pickImageWindow(distinctImagePool, 5, 3);
  const aboutGalleryImages = pickImageWindow(distinctImagePool, 1, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} about image ${index + 1}` }));
  const servicesGalleryImages = pickImageWindow(distinctImagePool, 7, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} services image ${index + 1}` }));
  const proofGalleryImages = pickImageWindow(distinctImagePool, 13, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} proof image ${index + 1}` }));
  const contactGalleryImages = pickImageWindow(distinctImagePool, 19, 6).map((src, index) => ({ src, alt: `${hydratedProfile.siteName} contact image ${index + 1}` }));

  return {
    version: 1,
    site: {
      logoText: hydratedProfile.siteName,
      nav: pages
        .filter((page) => !["privacy", "terms"].includes(page.slug))
        .map((page) => ({ label: page.title, href: page.slug === "home" ? "/" : `/${page.slug}` })),
    },
    pages: [
      buildPage("home", "Home", home.objective || "Present the offer clearly.", [
        nav,
        buildHero(withHeroMedia(home.hero || {}, hydratedProfile, 0, 1), { minHeight: "94vh", buttonColor: system.hero.buttonColor }, system),
        buildMarqueeStrip([
          home.hero?.eyebrow || hydratedProfile.siteName,
          ...(home.services?.items || []).map((item) => item?.title),
          hydratedProfile.navCtaLabel || "Contact",
        ], {
          backgroundColor: system.nav.backgroundColor || "#081120",
          textColor: system.nav.textColor || "#f8fafc",
          accentColor: system.hero.buttonColor || "#7dd3fc",
          speed: 22,
        }),
        buildTrustBadges(getIndustryTrustBadges(hydratedProfile)),
        buildDecorativeDivider(system, "dots"),
        buildStats(home.stats || {}),
        buildShowcaseStack({
          idPrefix: `${hydratedProfile.templateSlug}-home`,
          title: `${hydratedProfile.siteName} storyboard`,
          copy: home.objective || home.hero?.subtitle || "Make the offer feel real before the visitor reaches the detail sections.",
          images: [
            home.gallery?.images?.[0]?.src || home.hero?.imageUrl || imagePool[0] || "",
            home.gallery?.images?.[1]?.src || about.imageUrl || imagePool[1] || "",
            home.gallery?.images?.[2]?.src || proof?.gallery?.images?.[0]?.src || imagePool[2] || "",
          ],
        }),
        buildColumns2({
          ratio: "60-40",
          leftTitle: home.services?.title || "What this site helps you do",
          leftContent: home.services?.subtitle || "Use this space to explain the commercial problem the site solves.",
          rightTitle: "Why it works",
          rightContent: (home.features?.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
          rightImage: getProfileImage(hydratedProfile, 1, home.hero?.imageUrl || about.imageUrl || ""),
          cardBackgroundColor: "#f8fafc",
        }),
        buildDecorativeDivider(system, "line"),
        buildFeatureList(home.services || {}, { featureVariant: "editorial-cards", layout: "columns", fallbackImage: getProfileImage(hydratedProfile, 2, home.hero?.imageUrl || ""), fallbackImages: homeFeatureImages }),
        buildDecorativeDivider(system, "dashes"),
        buildFeatureList(home.features || {}, { featureVariant: "glass-cards", layout: "columns", fallbackImage: getProfileImage(hydratedProfile, 3, about.imageUrl || imagePool[0] || ""), fallbackImages: homeFeatureImages.slice().reverse() }),
        home.gallery ? buildGallery(home.gallery, system.galleryVariant || "balanced-grid") : null,
        home.testimonials ? buildTestimonials(home.testimonials, system.testimonialVariant || "wall") : null,
        home.pricing ? buildPricing(home.pricing, system.pricingVariant || "premium") : null,
        home.faq ? buildFaq(home.faq) : null,
        buildCta(home.cta || {}, system.ctaStyle || "split-banner"),
        footer,
      ]),
      buildPage(about.slug || "about", about.pageTitle || "About", about.objective || "Build trust.", [
        nav,
        buildHero(withHeroMedia({
          title: about.title || `About ${profile.siteName}`,
          subtitle: about.text || "Add your origin story and positioning here.",
          primaryLabel: "See services",
          primaryHref: `/${services.slug || "services"}`,
          imageUrl: about.imageUrl || home.hero?.imageUrl || "",
        }, hydratedProfile, 1, 2), { heroVariant: system.hero.heroVariant === "editorial" ? "editorial" : "split", buttonColor: system.hero.buttonColor, buttonTextColor: system.hero.buttonTextColor }, system),
        buildParallax({
          title: `The ${hydratedProfile.siteName} story should feel visual and substantial, not hidden behind one plain text block.`,
          subtitle: about.objective || "Use atmosphere, imagery, and founder or team context to make the business feel more real before the enquiry.",
          buttonLabel: "See services",
          buttonHref: `/${services.slug || "services"}`,
          imageUrl: aboutGalleryImages[0]?.src || about.imageUrl || home.hero?.imageUrl || "",
          floatingImage: aboutGalleryImages[1]?.src || proofGalleryImages[0]?.src || "",
          backgroundColor: system.hero.backgroundColor,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          minHeight: "62vh",
          contentWidth: 560,
        }, system),
        buildColumns2({
          ratio: "40-60",
          leftTitle: "Core strengths",
          leftContent: (about.bullets || []).join("\n\n"),
          rightTitle: "What clients should understand",
          rightContent: about.text || "Explain why this business exists and how it works.",
          leftImage: getProfileImage(hydratedProfile, 4, about.imageUrl || imagePool[0] || ""),
          cardBackgroundColor: "#f8fafc",
        }),
        aboutGalleryImages.length ? buildGallery({ title: `${about.pageTitle || "About"} visuals`, images: aboutGalleryImages }, system.galleryVariant || "balanced-grid") : null,
        buildDecorativeDivider(system, "dots"),
        about.stats ? buildStats(about.stats) : null,
        about.team ? section("team", { title: about.team.title || "Team", teamVariant: "studio-cards", members: about.team.members || [] }) : null,
        about.testimonials ? buildTestimonials(about.testimonials, "cards") : null,
        buildCta({ title: `Ready to work with ${hydratedProfile.siteName}?`, subtitle: "Use the contact page to turn interest into a real enquiry.", buttonLabel: hydratedProfile.navCtaLabel || "Contact", buttonHref: hydratedProfile.navCtaHref || "/contact" }, system.ctaStyle || "split-banner"),
        footer,
      ]),
      buildPage(services.slug || "services", services.pageTitle || "Services", services.objective || "Explain the offer.", [
        nav,
        buildHero({
          ...(services.hero || home.hero || {}),
          imageUrl: services.hero?.imageUrl || servicesGalleryImages[0]?.src || getProfileImage(hydratedProfile, 7, home.hero?.imageUrl || ""),
          floatingImage: "",
        }, {
          heroVariant: "spotlight",
          minHeight: "88vh",
          headlineAlignment: "center",
          verticalAlign: "center",
          contentWidth: 880,
          contentHeight: 320,
          contentY: 56,
          headlineFontSize: 64,
          subheadlineFontSize: 24,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          contentBackground: "linear-gradient(180deg, rgba(7,17,29,0.16), rgba(7,17,29,0.56))",
          backgroundPosition: "center center",
          textAnimation: "blur-in",
          subheadlineAnimation: "fade-up",
        }, system),
        buildMarqueeStrip([
          hydratedProfile.siteName,
          ...(services.services?.items || []).map((item) => item?.title),
          services.features?.title || "Premium website delivery",
          hydratedProfile.navCtaLabel || "Start Project",
        ], {
          backgroundColor: system.nav.backgroundColor || "#081120",
          textColor: system.nav.textColor || "#f8fafc",
          accentColor: system.hero.buttonColor || "#7dd3fc",
          speed: 20,
        }),
        buildParallax({
          title: `${services.pageTitle || "Services"} should feel like a visual offer deck, not a dry list of service cards.`,
          subtitle: services.objective || "Use imagery, proof, and motion to make each service path feel more tangible before the visitor reaches the quote step.",
          buttonLabel: hydratedProfile.navCtaLabel || "Contact",
          buttonHref: hydratedProfile.navCtaHref || "/contact",
          imageUrl: servicesGalleryImages[1]?.src || services.hero?.imageUrl || home.hero?.imageUrl || "",
          floatingImage: "",
          backgroundColor: system.hero.backgroundColor,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          minHeight: "70vh",
          alignment: "center",
          contentX: 50,
          contentY: 54,
          contentWidth: 760,
          contentHeight: 240,
        }, system),
        buildShowcaseStack({
          idPrefix: `${hydratedProfile.templateSlug}-services`,
          title: `${services.pageTitle || "Services"} storyboard`,
          copy: services.objective || "Turn the offer page into a richer visual sales deck with real service atmosphere.",
          images: [
            servicesGalleryImages[2]?.src || services.hero?.imageUrl || home.hero?.imageUrl || "",
            servicesGalleryImages[3]?.src || servicesGalleryImages[4]?.src || about.imageUrl || "",
            servicesGalleryImages[5]?.src || imagePool[2] || "",
          ],
          backgroundColor: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        }),
        buildDecorativeDivider(system, "line"),
        buildFeatureList(services.services || home.services || {}, { featureVariant: "cards", layout: "columns", fallbackImage: getProfileImage(hydratedProfile, 5, home.hero?.imageUrl || imagePool[0] || ""), fallbackImages: serviceFeatureImages }),
        services.features ? buildColumns2({
          ratio: "50-50",
          leftTitle: services.features.title || "How delivery works",
          leftContent: services.features.subtitle || "Explain the process.",
          rightTitle: "Execution rhythm",
          rightContent: (services.features.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
          rightImage: getProfileImage(hydratedProfile, 6, home.hero?.imageUrl || about.imageUrl || ""),
          cardBackgroundColor: "#f8fafc",
        }) : null,
        servicesGalleryImages.length ? buildGallery({ title: `${services.pageTitle || "Services"} visuals`, images: servicesGalleryImages, columns: 3 }, system.galleryVariant || "balanced-grid") : null,
        buildDecorativeDivider(system, "dots"),
        services.pricing ? buildPricing(services.pricing, system.pricingVariant || "premium") : null,
        services.faq ? buildFaq(services.faq) : null,
        buildCta({ title: services.cta?.title || "Want to discuss the right package?", subtitle: services.cta?.subtitle || "Push prospects into a call or quote request.", buttonLabel: hydratedProfile.navCtaLabel || "Book consult", buttonHref: hydratedProfile.navCtaHref || "/contact" }, system.ctaStyle || "split-banner"),
        footer,
      ]),
      ...(proof
        ? [
            buildPage(proof.slug || "results", proof.pageTitle || "Results", proof.objective || "Show proof.", [
              nav,
              buildHero(withHeroMedia(proof.hero || {
                title: proof.pageTitle || "Results",
                subtitle: proof.objective || "Use proof to support the buying decision.",
                primaryLabel: hydratedProfile.navCtaLabel || "Contact",
                primaryHref: hydratedProfile.navCtaHref || "/contact",
              }, hydratedProfile, 3, 4), { heroVariant: system.hero.heroVariant, buttonColor: system.hero.buttonColor, buttonTextColor: system.hero.buttonTextColor }, system),
              section("image-stack", {
                title: `${proof.pageTitle || "Results"} storyboard`,
                minHeight: "68vh",
                images: [
                  { id: `${hydratedProfile.templateSlug}-proof-a`, kind: "image", src: proofGalleryImages[0]?.src || getProfileImage(hydratedProfile, 3, home.hero?.imageUrl || ""), x: 14, y: 18, width: 320, height: 240, rotation: -6, radius: 22, zIndex: 1 },
                  { id: `${hydratedProfile.templateSlug}-proof-copy`, kind: "text", content: proof.objective || "Use this page to make the work, outcomes, and customer proof feel visible and concrete.", x: 47, y: 24, width: 390, height: 170, rotation: 0, radius: 22, zIndex: 2, fontSize: 30, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.92)" },
                  { id: `${hydratedProfile.templateSlug}-proof-b`, kind: "image", src: proofGalleryImages[1]?.src || getProfileImage(hydratedProfile, 6, about.imageUrl || ""), x: 66, y: 58, width: 290, height: 220, rotation: 8, radius: 22, zIndex: 3 },
                  { id: `${hydratedProfile.templateSlug}-proof-c`, kind: "image", src: proofGalleryImages[2]?.src || getProfileImage(hydratedProfile, 10, imagePool[1] || ""), x: 34, y: 64, width: 250, height: 180, rotation: -9, radius: 18, zIndex: 2 },
                ],
              }),
              proof.stats ? buildStats(proof.stats) : null,
              buildColumns2({
                ratio: "50-50",
                leftTitle: "What the proof should communicate",
                leftContent: proof.objective || "Use this page to make the work and outcomes feel real.",
                rightTitle: proof.testimonials?.title || "What customers should believe",
                rightContent: (proof.testimonials?.items || []).map((item) => `${item.name}: ${item.quote}`).join("\n\n") || "Add real outcomes, customer language, and visible proof.",
                rightImage: proofGalleryImages[1]?.src || getProfileImage(hydratedProfile, 6, about.imageUrl || ""),
                cardBackgroundColor: "#f8fafc",
              }),
              proof.gallery ? buildGallery({ ...proof.gallery, images: [...(proof.gallery.images || []), ...proofGalleryImages].slice(0, 5) }, system.galleryVariant || "editorial-strip") : (proofGalleryImages.length ? buildGallery({ title: `${proof.pageTitle || "Results"} gallery`, images: proofGalleryImages }, system.galleryVariant || "editorial-strip") : null),
              proof.testimonials ? buildTestimonials(proof.testimonials, "spotlight") : null,
              buildCta(proof.cta || { title: "Like what you see?", subtitle: "Move the reader into a call while proof is fresh.", buttonLabel: hydratedProfile.navCtaLabel || "Contact", buttonHref: hydratedProfile.navCtaHref || "/contact" }, system.ctaStyle || "spotlight-pill"),
              footer,
            ]),
          ]
        : []),
      buildPage(contact.slug || "contact", contact.pageTitle || "Contact", contact.objective || "Capture enquiries.", [
        nav,
        buildHero(withHeroMedia(contact.hero || home.hero || {}, hydratedProfile, 4, 5), { heroVariant: system.hero.heroVariant, buttonColor: system.hero.buttonColor, buttonTextColor: system.hero.buttonTextColor }, system),
        buildParallax({
          title: `The ${contact.pageTitle || "contact"} page should still feel designed, image-led, and premium while collecting the enquiry.`,
          subtitle: contact.objective || "Use one more visual section here so the page does not collapse into plain form and FAQ blocks.",
          buttonLabel: hydratedProfile.navCtaLabel || "Contact",
          buttonHref: "#contact",
          imageUrl: contactGalleryImages[0]?.src || contact.hero?.imageUrl || home.hero?.imageUrl || "",
          floatingImage: contactGalleryImages[1]?.src || about.imageUrl || "",
          backgroundColor: system.hero.backgroundColor,
          buttonColor: system.hero.buttonColor,
          buttonTextColor: system.hero.buttonTextColor,
          minHeight: "58vh",
        }, system),
        buildColumns2({
          ratio: "40-60",
          leftTitle: contact.faq?.title || "What happens next",
          leftContent: (contact.faq?.items || []).map((item) => `${item.q}: ${item.a}`).join("\n\n") || contact.objective || "Explain what happens after the form is submitted.",
          rightTitle: contact.contact?.title || "Start the conversation",
          rightContent: contact.contact?.subtitle || "Use the form to capture qualified detail before the call.",
          rightImage: getProfileImage(hydratedProfile, 7, contact.hero?.imageUrl || home.hero?.imageUrl || ""),
          cardBackgroundColor: "#f8fafc",
        }),
        buildShowcaseStack({
          idPrefix: `${hydratedProfile.templateSlug}-contact`,
          title: `${contact.pageTitle || "Contact"} storyboard`,
          copy: contact.contact?.subtitle || contact.objective || "Keep the enquiry page visually alive instead of collapsing into a single form block.",
          images: [
            contactGalleryImages[0]?.src || contact.hero?.imageUrl || home.hero?.imageUrl || "",
            contactGalleryImages[1]?.src || about.imageUrl || imagePool[1] || "",
            contactGalleryImages[2]?.src || contactGalleryImages[3]?.src || imagePool[2] || "",
          ],
          minHeight: "64vh",
        }),
        contactGalleryImages.length ? buildGallery({ title: `${contact.pageTitle || "Contact"} visuals`, images: contactGalleryImages }, system.galleryVariant || "balanced-grid") : null,
        buildContact({ ...(contact.contact || {}), mediaImage: contact.contact?.mediaImage || contactGalleryImages[2]?.src || contactGalleryImages[0]?.src || "" }, getIndustryContactFields(hydratedProfile)),
        contact.faq ? buildFaq(contact.faq) : null,
        footer,
      ]),
      buildPrivacyPolicyPage(hydratedProfile, system, nav, footer),
      buildTermsPage(hydratedProfile, system, nav, footer),
    ],
  };
}

export function buildSaasBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(3, 0,
    buildParallax({
      title: "Your ops layer should look and feel like a real product, not a feature dump",
      subtitle: "A good SaaS starter needs a motion-led section that sells speed, clarity, and control before the pricing table appears.",
      buttonLabel: "See Platform",
      buttonHref: "/services",
      imageUrl: profile.home?.hero?.imageUrl || "",
      minHeight: "66vh",
      contentX: 24,
      floatingImage: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "",
      floatingWidth: 320,
      floatingHeight: 220,
    }, getVisualSystem(profile.templateSlug)),
    buildColumns2({
      ratio: "60-40",
      leftTitle: "What the platform replaces",
      leftContent: "Multiple disconnected tools, manual follow-up, poor visibility, and fragmented reporting.",
      rightTitle: "What the buyer wants",
      rightContent: "One workspace, clearer accountability, faster onboarding, and better commercial visibility.",
      rightImage: profile.home?.hero?.imageUrl || "",
      cardBackgroundColor: "#eef6ff",
    }),
    section("cta-button", {
      eyebrow: "PRODUCT DEMO",
      title: "Show the product without dumping every feature into one wall of text",
      description: "Use this section to push trial users or demo bookings once the core product story is clear.",
      text: "Book a Demo",
      link: profile.navCtaHref || "/contact",
      style: "split-banner",
    })
  );
  return blueprint;
}

export function buildRestaurantBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "Sell the room before you sell the booking",
    subtitle: "The best restaurant starters create appetite through mood, not just a list of menu items.",
    buttonLabel: "Reserve a Table",
    buttonHref: "/contact",
    imageUrl: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "",
    floatingImage: profile.home?.gallery?.images?.[1]?.src || "",
    backgroundColor: "#2f1707",
    buttonColor: "#fb923c",
    buttonTextColor: "#431407",
    minHeight: "70vh",
  }, getVisualSystem(profile.templateSlug)), buildColumns2({
    ratio: "50-50",
    leftTitle: "The venue feeling",
    leftContent: "Use this space to sell the mood, pace, and occasion before the booking happens.",
    rightTitle: "What guests come for",
    rightContent: (profile.home?.services?.items || []).map((item) => `${item.title}: ${item.text}`).join("\n\n"),
    leftImage: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "",
    rightImage: profile.home?.gallery?.images?.[1]?.src || "",
    cardBackgroundColor: "#fff7ed",
  }));
  return blueprint;
}

export function buildPortfolioBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections = blueprint.pages[0].sections.filter((sectionEntry) => sectionEntry.type !== "pricing-table");
  blueprint.pages[0].sections.splice(2, 0,
    buildParallax({
      title: "Use movement and atmosphere to make the portfolio feel curated, not templated",
      subtitle: "A premium creative site needs visual pacing between headline, work, and enquiry.",
      buttonLabel: "View Selected Work",
      buttonHref: "/portfolio",
      imageUrl: profile.home?.gallery?.images?.[2]?.src || profile.home?.hero?.imageUrl || "",
      floatingImage: profile.home?.gallery?.images?.[0]?.src || "",
      backgroundColor: "#1f1a42",
      buttonColor: "#c4b5fd",
      buttonTextColor: "#1e1b4b",
      minHeight: "72vh",
      contentWidth: 560,
    }, getVisualSystem(profile.templateSlug)),
    section("image-stack", {
      title: "Studio Visual Canvas",
      minHeight: "68vh",
      images: [
        { id: "creative-1", kind: "image", src: profile.home?.gallery?.images?.[0]?.src || profile.home?.hero?.imageUrl || "", x: 18, y: 18, width: 320, height: 220, rotation: -7, radius: 22, zIndex: 1 },
        { id: "creative-copy", kind: "text", content: profile.home?.hero?.title || "Curated work that feels like a point of view.", x: 58, y: 28, width: 420, height: 160, rotation: 0, radius: 18, zIndex: 2, fontSize: 34, fontWeight: "700", textAlign: "left", verticalAlign: "center", textColor: "#0f172a", background: "rgba(255,255,255,0.92)" },
        { id: "creative-2", kind: "image", src: profile.home?.gallery?.images?.[1]?.src || profile.home?.hero?.imageUrl || "", x: 72, y: 62, width: 280, height: 220, rotation: 6, radius: 22, zIndex: 3 },
      ],
    }),
    buildColumns2({
      ratio: "40-60",
      leftTitle: "Creative perspective",
      leftContent: profile.about?.text || "Explain the studio voice and how the work is shaped.",
      rightTitle: "Selected work lens",
      rightContent: (profile.proofPage?.stats?.items || []).map((item) => `${item.label}: ${item.value}`).join("\n\n") || "Use this page to frame outcomes and creative direction.",
      leftImage: profile.about?.imageUrl || "",
      cardBackgroundColor: "#f5f3ff",
    })
  );
  return blueprint;
}

export function buildAgencyBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "This is where a strong agency site should feel expensive, fast, and commercially switched on",
    subtitle: "Use parallax and motion to sell the pace of execution before the capability sections begin.",
    buttonLabel: "See Results",
    buttonHref: "/results",
    imageUrl: profile.home?.hero?.imageUrl || "",
    floatingImage: profile.proofPage?.gallery?.images?.[0]?.src || "",
    minHeight: "68vh",
  }, getVisualSystem(profile.templateSlug)));
  return blueprint;
}

export function buildCoachBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "A premium coaching site should feel like an invitation into a worldview, not a generic service card grid",
    subtitle: "This section gives the personal brand some drama and pacing before the offer stack begins.",
    buttonLabel: "Read the Story",
    buttonHref: "/about",
    imageUrl: profile.home?.hero?.imageUrl || "",
    backgroundColor: "#3b1f0f",
    buttonColor: "#f59e0b",
    buttonTextColor: "#2b1707",
    minHeight: "70vh",
    contentWidth: 540,
  }, getVisualSystem(profile.templateSlug)));
  return blueprint;
}

export function buildLocalServiceBlueprint(profile) {
  const blueprint = buildServiceFirmBlueprint(profile);
  blueprint.pages[0].sections.splice(2, 0, buildParallax({
    title: "Local services need urgency, trust, and visible professionalism above the fold",
    subtitle: "A good starter here should feel dependable and ready to take the call, not like a generic brochure.",
    buttonLabel: "Request Service",
    buttonHref: "/contact",
    imageUrl: profile.home?.hero?.imageUrl || "",
    backgroundColor: "#0b3b33",
    buttonColor: "#14b8a6",
    buttonTextColor: "#042f2e",
    minHeight: "64vh",
  }, getVisualSystem(profile.templateSlug)));
  return blueprint;
}

