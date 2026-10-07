import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-auto-repair',
  siteName: 'Northside Auto Works',
  navCtaLabel: 'Book Vehicle Service',
  heroEyebrow: 'AUTO REPAIR',
  heroTitle: 'Auto repair sites should feel practical, capable, and obviously tied to vehicles, diagnostics, and workshop trust',
  heroSubtitle: 'Built for servicing, diagnostics, mechanical repairs, inspections, and workshop enquiries where credibility matters before the booking.',
  imagePool: 'autoRepair',
  homeStats: [{ value: 'Workshop', label: 'credibility' }, { value: 'Faster', label: 'service bookings' }, { value: 'Clear', label: 'repair pathway' }],
  serviceItems: [{ title: 'Vehicle servicing and maintenance', text: 'Position routine servicing, logbook work, and everyday workshop needs clearly.' }, { title: 'Diagnostics and mechanical repairs', text: 'Support customers dealing with faults, noises, warnings, and more urgent issues.' }, { title: 'Inspections and workshop advice', text: 'Use the site to frame trust, transparency, and practical repair guidance.' }],
  featureItems: [{ title: 'Workshop trust signals', text: 'Vehicle owners want to know the shop feels competent, fair, and organised.' }, { title: 'Repair-path clarity', text: 'The site should reduce uncertainty around diagnostics, servicing, and next steps.' }, { title: 'Visual proof', text: 'Cars, workshop imagery, and practical service cues matter far more here than generic business visuals.' }],
  aboutTitle: 'An auto repair about page should make the workshop feel capable, honest, and easy to book with',
  aboutText: 'Northside Auto Works is positioned as a workshop-led repair business that blends technical competence with clearer communication and a better service experience. The structure is designed to build trust around diagnostics, maintenance, and ongoing car care.',
  aboutBullets: ['Routine servicing', 'Diagnostics and repairs', 'Workshop trust and communication'],
  teamMembers: [{ name: 'Jake Morton', role: 'Head Mechanic', bio: 'Leads workshop diagnostics, repairs, and service quality.' }, { name: 'Mila Hart', role: 'Service Advisor', bio: 'Coordinates bookings, repair updates, and customer communication.' }],
  faqItems: [{ q: 'Do you handle diagnostics as well as regular servicing?', a: 'Use this section to explain how the workshop supports both routine maintenance and more complex fault work.' }, { q: 'Can I book in before I know exactly what is wrong?', a: 'Clarify how vehicle owners can describe symptoms and still move into the booking process.' }],
  contactFaqItems: [{ q: 'What details should I include with my vehicle enquiry?', a: 'Ask for make, model, issue, warning signs, and whether the vehicle is safe to drive.' }, { q: 'Do you handle ongoing maintenance too?', a: 'Use this section to position regular servicing and repeat workshop relationships.' }],
  testimonials: [{ quote: 'The site now feels like a real workshop, not a vague service business.', name: 'Liam Cross', role: 'Vehicle Owner' }, { quote: 'It explains servicing and diagnostics in a way that builds confidence before the booking.', name: 'Olive Dean', role: 'Workshop Manager' }],
  ctaTitle: 'Need a workshop site with more credibility?',
  ctaSubtitle: 'Use this starter to position servicing, diagnostics, and repair trust more clearly.',
});
