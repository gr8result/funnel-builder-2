import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-plumbing-company',
  siteName: 'Harbour Plumbing Co.',
  navCtaLabel: 'Request Plumbing Quote',
  heroEyebrow: 'PLUMBING',
  heroTitle: 'A plumbing website should be built for urgent jobs, trust, and fast quote requests',
  heroSubtitle: 'Structured for blocked drains, hot water, maintenance, and residential or commercial plumbing work where buyers often need to decide quickly.',
  imagePool: 'plumbing',
  homeStats: [{ value: '24/7', label: 'emergency option' }, { value: 'Licensed', label: 'and insured' }, { value: 'Fast', label: 'quote turnaround' }],
  serviceItems: [{ title: 'Blocked drains and leak repairs', text: 'Lead with urgent plumbing issues people already search for when they need help now.' }, { title: 'Hot water systems', text: 'Position replacements, repairs, and ongoing maintenance clearly.' }, { title: 'General plumbing and fit-offs', text: 'Cover maintenance, renovations, and planned plumbing work without sounding vague.' }],
  featureItems: [{ title: 'Quote clarity', text: 'Customers need to understand call-outs, diagnostic work, and what happens next.' }, { title: 'Safety and licensing', text: 'Use licences, gas compliance, and workmanship signals to reduce hesitation.' }, { title: 'Arrival confidence', text: 'Make the business feel organised, punctual, and easy to deal with.' }],
  aboutTitle: 'A plumbing about page should make the business feel safe, competent, and local',
  aboutText: 'Harbour Plumbing Co. is positioned for homeowners, landlords, and property managers who need fast plumbing help without the usual uncertainty. The page structure is written to build trust around workmanship, communication, and clear service scope.',
  aboutBullets: ['Licensed technicians', 'Residential and commercial work', 'Clear communication'],
  teamMembers: [{ name: 'Liam Carter', role: 'Owner Plumber', bio: 'Leads quoting, diagnostics, and complex plumbing jobs.' }, { name: 'Mia Jones', role: 'Service Coordinator', bio: 'Handles scheduling, updates, and customer communication.' }],
  faqItems: [{ q: 'Do you handle urgent plumbing work?', a: 'Use this section to explain emergency availability and how quickly the team can respond.' }, { q: 'What information do you need to quote?', a: 'Set expectations around photos, symptoms, address details, and access requirements.' }],
  contactFaqItems: [{ q: 'Can I send photos of the issue?', a: 'This is the right place to explain image uploads or what helps the team triage quickly.' }, { q: 'Do you service my suburb?', a: 'List service areas and any after-hours coverage here.' }],
  testimonials: [{ quote: 'They made the whole thing feel calm and organised even though it was urgent.', name: 'Emma White', role: 'Homeowner' }, { quote: 'The page feels like a real plumbing company, not a generic tradie placeholder.', name: 'Ben Harris', role: 'Property Manager' }],
  ctaTitle: 'Need a plumber people can trust quickly?',
  ctaSubtitle: 'Use this starter to sell urgency, credibility, and quote confidence properly.',
});
