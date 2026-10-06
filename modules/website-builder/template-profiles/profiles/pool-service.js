import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-pool-service',
  siteName: 'Bluewater Pool Care',
  navCtaLabel: 'Book Pool Service',
  heroEyebrow: 'POOL SERVICE',
  heroTitle: 'Pool service websites should feel clean, premium, and visually tied to water quality and outdoor presentation',
  heroSubtitle: 'Built for pool cleaning, water balancing, maintenance plans, equipment checks, and residential pool care enquiries.',
  imagePool: 'poolService',
  homeStats: [{ value: 'Crystal', label: 'water presentation' }, { value: 'Routine', label: 'service plans' }, { value: 'Healthy', label: 'equipment checks' }],
  serviceItems: [{ title: 'Routine cleaning and balancing', text: 'Position recurring visits and regular care plans clearly.' }, { title: 'Pool recovery and one-off service', text: 'Support clients who need help restoring a neglected or seasonal pool quickly.' }, { title: 'Equipment checks and maintenance', text: 'Explain pumps, filters, and operational support without overcomplicating the message.' }],
  featureItems: [{ title: 'Visual-first selling', text: 'Pool businesses convert well when the site makes cleanliness and presentation feel obvious.' }, { title: 'Recurring service framing', text: 'Make ongoing maintenance plans feel easy and desirable, not vague.' }, { title: 'Premium property fit', text: 'The site should feel cleaner and more polished than a generic local-service page.' }],
  aboutTitle: 'A pool care about page should sell reliability, presentation, and recurring maintenance confidence',
  aboutText: 'Bluewater Pool Care is positioned as a premium-feeling pool maintenance business that helps homeowners protect presentation, water quality, and ongoing enjoyment of the space. The structure supports both recurring service and one-off recovery jobs.',
  aboutBullets: ['Routine maintenance', 'Equipment oversight', 'Presentation-led service'],
  teamMembers: [{ name: 'Elliot Frost', role: 'Pool Technician', bio: 'Handles water quality, servicing, and property-specific pool care.' }, { name: 'Ruby Lane', role: 'Client Coordinator', bio: 'Supports booking flow, maintenance plans, and customer communication.' }],
  faqItems: [{ q: 'Do you offer recurring pool service plans?', a: 'Use this section to explain weekly, fortnightly, or seasonal maintenance options.' }, { q: 'Can you help recover a pool that has been neglected?', a: 'Clarify one-off clean-ups and recovery visits here.' }],
  contactFaqItems: [{ q: 'What details help you quote a pool service?', a: 'Ask for pool size, equipment type, frequency, and any current water issues.' }, { q: 'Do you maintain equipment as well as water quality?', a: 'Use this section to explain scope around filters, pumps, and system checks.' }],
  testimonials: [{ quote: 'The site now looks as polished as the pool service itself.', name: 'Brooke Vale', role: 'Homeowner' }, { quote: 'It finally supports recurring maintenance sales properly, not just one-off enquiries.', name: 'Elliot Frost', role: 'Owner' }],
  ctaTitle: 'Need a more premium pool service website?',
  ctaSubtitle: 'Use this starter to sell maintenance plans, recovery work, and cleaner outdoor presentation properly.',
});
