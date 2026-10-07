import { TRADE_TEMPLATE_IMAGE_POOLS, EXTRA_TRADE_TEMPLATE_IMAGE_POOLS } from './trade-image-pools.js';

function toGalleryImage(src = '') {
  return String(src || '').replace('w=1600', 'w=1200');
}

function buildTradeGalleryImages(images = [], startIndex = 1, siteName = 'Website', label = 'gallery') {
  const pool = images.slice(startIndex).concat(images);
  return pool.slice(0, 6).map((src, index) => ({
    src: toGalleryImage(src),
    alt: `${siteName} ${label} image ${index + 1}`,
  }));
}

export function createTradeWebsiteProfile({
  templateSlug,
  siteName,
  navCtaLabel = 'Request Quote',
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  imagePool,
  homeStats,
  serviceItems,
  featureItems,
  aboutTitle,
  aboutText,
  aboutBullets,
  teamMembers,
  faqItems,
  contactFaqItems,
  testimonials,
  ctaTitle,
  ctaSubtitle,
  servicePageTitle = 'Services',
  proofPageTitle = 'Projects',
  contactPageTitle = 'Contact',
}) {
  const images = [
    ...(TRADE_TEMPLATE_IMAGE_POOLS[imagePool] || []),
    ...(EXTRA_TRADE_TEMPLATE_IMAGE_POOLS[imagePool] || []),
  ];
  const homeGalleryImages = buildTradeGalleryImages(images, 1, siteName, 'home');
  const proofGalleryImages = buildTradeGalleryImages(images, 2, siteName, 'proof');

  return {
    templateSlug,
    siteName,
    navCtaLabel,
    navCtaHref: '/contact',
    librarySeedImages: images,
    home: {
      objective: `Turn ${siteName} visitors into qualified quote requests and booked jobs.`,
      hero: {
        eyebrow: heroEyebrow,
        title: heroTitle,
        subtitle: heroSubtitle,
        primaryLabel: navCtaLabel,
        primaryHref: '/contact',
        secondaryLabel: 'View services',
        secondaryHref: '/services',
        imageUrl: images[0] || '',
      },
      stats: { title: 'What this site should communicate immediately', items: homeStats },
      services: {
        title: 'Core services people already search for',
        subtitle: 'Use plain-language service names tied to real jobs and clear outcomes.',
        items: serviceItems,
      },
      features: {
        title: 'Why this layout fits the industry',
        subtitle: 'The page plan is written to remove friction, build local trust, and get the enquiry moving.',
        items: featureItems,
      },
      gallery: {
        title: 'Visual proof and finished work',
        images: homeGalleryImages,
      },
      testimonials: {
        title: 'What customers want to hear before they enquire',
        items: testimonials,
      },
      cta: {
        title: ctaTitle,
        subtitle: ctaSubtitle,
        buttonLabel: navCtaLabel,
        buttonHref: '/contact',
      },
    },
    about: {
      pageTitle: 'About',
      objective: 'Use the about page to build trust, explain standards, and humanise the team behind the work.',
      title: aboutTitle,
      text: aboutText,
      bullets: aboutBullets,
      imageUrl: images[1] || images[0] || '',
      team: {
        title: 'Who the customer is trusting',
        members: teamMembers,
      },
      stats: {
        title: 'Trust markers',
        items: homeStats,
      },
    },
    servicesPage: {
      pageTitle: servicePageTitle,
      objective: 'Show the work categories clearly enough that visitors can identify the right service path fast.',
      hero: {
        eyebrow: 'SERVICES',
        title: `A ${servicePageTitle.toLowerCase()} page structured for real-world enquiries`,
        subtitle: 'Break the work into understandable categories, explain what is included, and reduce uncertainty before the form.',
        primaryLabel: navCtaLabel,
        primaryHref: '/contact',
        secondaryLabel: 'About the team',
        secondaryHref: '/about',
      },
      services: {
        title: 'Service categories',
        subtitle: 'Visitors should be able to self-select fast without guessing what to ask for.',
        items: serviceItems,
      },
      features: {
        title: 'What helps the page convert',
        subtitle: 'This section should reduce risk, set expectations, and make the company feel organised.',
        items: featureItems,
      },
      faq: {
        title: 'Questions people ask before booking',
        items: faqItems,
      },
    },
    proofPage: {
      pageTitle: proofPageTitle,
      slug: 'projects',
      objective: 'Use proof to show workmanship, outcomes, and the kind of jobs the business is known for.',
      gallery: {
        title: 'Recent work and proof assets',
        images: proofGalleryImages,
      },
      testimonials: {
        title: 'What strong reviews should reinforce',
        items: testimonials,
      },
      cta: {
        title: ctaTitle,
        subtitle: ctaSubtitle,
        buttonLabel: navCtaLabel,
        buttonHref: '/contact',
      },
    },
    contactPage: {
      pageTitle: contactPageTitle,
      objective: 'Capture the job details needed for quoting, triage, and fast follow-up.',
      hero: {
        eyebrow: 'ENQUIRE',
        title: 'Use the contact page like a real booking and quote page',
        subtitle: 'Ask enough about the scope, timing, property type, and urgency that the callback starts with context.',
        primaryLabel: navCtaLabel,
        primaryHref: '#contact',
        secondaryLabel: 'See services',
        secondaryHref: '/services',
      },
      contact: {
        title: `${navCtaLabel} from ${siteName}`,
        subtitle: 'Prompt for the information that helps the team quote or triage properly on the first response.',
      },
      faq: {
        title: 'Before you enquire',
        items: contactFaqItems,
      },
    },
  };
}
