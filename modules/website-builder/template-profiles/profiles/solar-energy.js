import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-solar-energy',
  siteName: 'BrightGrid Solar',
  navCtaLabel: 'Book Solar Quote',
  heroEyebrow: 'SOLAR',
  heroTitle: 'Solar websites should feel future-facing, high-trust, and visually tied to roofs, systems, and savings',
  heroSubtitle: 'Built for rooftop solar, battery systems, commercial installs, and homeowners comparing providers before committing to a quote.',
  imagePool: 'solar',
  homeStats: [{ value: 'Lower', label: 'energy bills' }, { value: 'Battery', label: 'upgrade options' }, { value: 'Trusted', label: 'installation process' }],
  serviceItems: [{ title: 'Residential solar installs', text: 'Frame rooftop systems clearly for homeowners comparing quotes and providers.' }, { title: 'Battery and energy upgrades', text: 'Support clients evaluating storage, future-proofing, and smarter energy use.' }, { title: 'Commercial solar solutions', text: 'Position larger installs and more strategic energy conversations cleanly.' }],
  featureItems: [{ title: 'Savings and system clarity', text: 'Visitors need help understanding value, equipment, and the install process quickly.' }, { title: 'High-trust presentation', text: 'This category benefits from a more future-facing and competent visual direction.' }, { title: 'Project-led proof', text: 'Use rooftops, systems, and visible install outcomes to make the offer tangible.' }],
  aboutTitle: 'A solar about page should make the business feel technically credible and easy to trust',
  aboutText: 'BrightGrid Solar is positioned as a cleaner, more modern solar provider that balances technical know-how with straightforward advice and a better install experience. The structure gives room to explain systems, savings, and project delivery.',
  aboutBullets: ['Residential and commercial installs', 'Battery-ready advice', 'Clear install process'],
  teamMembers: [{ name: 'Mason Reid', role: 'Solar Consultant', bio: 'Guides customers through system fit, quoting, and energy savings conversations.' }, { name: 'Ava Kim', role: 'Project Coordinator', bio: 'Coordinates site checks, install scheduling, and customer updates.' }],
  faqItems: [{ q: 'Can you help with batteries as well as panels?', a: 'Use this section to explain how storage upgrades fit into the offer.' }, { q: 'Do you work on homes and commercial sites?', a: 'Clarify where the team installs and how project scope differs by site type.' }],
  contactFaqItems: [{ q: 'What details help with a solar quote?', a: 'Ask for roof type, energy usage, property type, and whether a battery is being considered.' }, { q: 'Can I speak to someone before I am ready to install?', a: 'Reassure early-stage buyers that a planning conversation is part of the process.' }],
  testimonials: [{ quote: 'The site finally feels like a real solar company instead of a generic trades page.', name: 'Jordan Bell', role: 'Homeowner' }, { quote: 'It gives the install process and the savings conversation proper weight.', name: 'Naomi Scott', role: 'Business Owner' }],
  ctaTitle: 'Need a stronger solar website?',
  ctaSubtitle: 'Use this starter to position installs, batteries, and energy advice with better proof and more confidence.',
});
