import { SERVICE_PAGE_THEMES } from './data/themes/index.js';
import { buildServiceHeroSection, buildServiceOffersSection, buildServiceDifferenceSection, buildServiceProofSection, buildServiceTestimonialsSection, buildServiceFaqSection, buildServiceQuoteFormSection } from './sections/service.js';
import { getServiceVariantDescription, getServiceLongFormSectionIds, getServiceShortFormSectionIds } from './templates/serviceVariants.js';
import { sectionAnnouncementBar, sectionHero, sectionHeroLight, sectionVideoHero, sectionBenefitsGrid, sectionStoryCopy, sectionIngredients, sectionProductShowcase, sectionSpacer, sectionTwoColumnText, sectionThreeColumnText, sectionDivider, sectionPageFooter, sectionSocialProofBar, sectionTestimonials, sectionTrustBadges, sectionBonuses, sectionPricing, sectionCountdown, sectionCTA, sectionLeadCaptureForm, sectionGuarantee, sectionFAQ, sectionThankYou } from './sections/generic.js';


export const SERVICE_SECTION_BLOCKS = SERVICE_PAGE_THEMES.flatMap((theme) => [
  { id: `${theme.slug}-hero`, label: `${theme.icon} ${theme.label} Hero`, category: '🏠 Service Funnels', html: () => buildServiceHeroSection(theme) },
  { id: `${theme.slug}-services`, label: `${theme.icon} ${theme.label} Services`, category: '🏠 Service Funnels', html: () => buildServiceOffersSection(theme) },
  { id: `${theme.slug}-difference`, label: `${theme.icon} ${theme.label} Trust`, category: '🏠 Service Funnels', html: () => buildServiceDifferenceSection(theme) },
  { id: `${theme.slug}-proof`, label: `${theme.icon} ${theme.label} Proof`, category: '🏠 Service Funnels', html: () => buildServiceProofSection(theme) },
  { id: `${theme.slug}-testimonials`, label: `${theme.icon} ${theme.label} Testimonials`, category: '🏠 Service Funnels', html: () => buildServiceTestimonialsSection(theme) },
  { id: `${theme.slug}-faq`, label: `${theme.icon} ${theme.label} FAQ`, category: '🏠 Service Funnels', html: () => buildServiceFaqSection(theme) },
  { id: `${theme.slug}-quote`, label: `${theme.icon} ${theme.label} Quote Form`, category: '🏠 Service Funnels', html: () => buildServiceQuoteFormSection(theme) },
]);


export const SERVICE_FUNNEL_TYPES = SERVICE_PAGE_THEMES.flatMap((theme) => [
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
