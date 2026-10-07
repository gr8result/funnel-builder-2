import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-electrician-company',
  siteName: 'Northwire Electrical',
  navCtaLabel: 'Request Electrical Quote',
  heroEyebrow: 'ELECTRICAL',
  heroTitle: 'An electrician site needs to sell safety, reliability, and clean quoting from the first screen',
  heroSubtitle: 'Designed for switchboard upgrades, fault finding, lighting installs, test and tag, and residential or commercial electrical work.',
  imagePool: 'electrician',
  homeStats: [{ value: 'Certified', label: 'electrical work' }, { value: 'Same day', label: 'fault response' }, { value: 'Clear', label: 'scope and pricing' }],
  serviceItems: [{ title: 'Fault finding and repairs', text: 'Use plain language for outages, faults, tripping circuits, and urgent electrical issues.' }, { title: 'Switchboards and upgrades', text: 'Position safety upgrades, rewiring, and compliance work clearly.' }, { title: 'Lighting and installations', text: 'Sell the cleaner install and fit-off work that builds recurring demand.' }],
  featureItems: [{ title: 'Safety-first positioning', text: 'The page should make compliance, testing, and safe workmanship feel obvious.' }, { title: 'Residential and commercial fit', text: 'Help both homeowners and businesses see themselves in the offer.' }, { title: 'Professional presentation', text: 'Electrical work benefits from a site that feels precise, modern, and trustworthy.' }],
  aboutTitle: 'The electrical about page should reinforce competence and confidence, not just years in business',
  aboutText: 'Northwire Electrical is framed as a modern electrical company with the right mix of technical credibility, job clarity, and polished communication. The structure is designed to help visitors trust the team with both urgent and planned work.',
  aboutBullets: ['Licensed electricians', 'Residential and commercial', 'Safety-led service'],
  teamMembers: [{ name: 'Owen Parker', role: 'Lead Electrician', bio: 'Handles upgrades, fault diagnosis, and project delivery.' }, { name: 'Sophie Tran', role: 'Operations Coordinator', bio: 'Manages bookings, project updates, and customer follow-through.' }],
  faqItems: [{ q: 'Do you handle urgent electrical faults?', a: 'Use this section to explain response windows and what qualifies as urgent work.' }, { q: 'Can you quote upgrades before site attendance?', a: 'Clarify what can be estimated from photos or plans versus onsite inspection.' }],
  contactFaqItems: [{ q: 'Do you work on both homes and businesses?', a: 'Use this section to set scope around residential, commercial, or strata work.' }, { q: 'Can you help with switchboard or compliance issues?', a: 'Reassure buyers that testing, upgrades, and safety work are core parts of the offer.' }],
  testimonials: [{ quote: 'The site now looks as professional as the business actually is.', name: 'Grace Miller', role: 'Business Owner' }, { quote: 'It explains the work in a way that makes it easy to trust and enquire.', name: 'Nathan Cole', role: 'Homeowner' }],
  ctaTitle: 'Need a stronger electrical website foundation?',
  ctaSubtitle: 'Use this starter to position safety, upgrades, installs, and quote confidence clearly.',
});
