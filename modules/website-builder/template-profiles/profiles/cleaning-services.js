import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-cleaning-services',
  siteName: 'BrightNest Cleaning',
  navCtaLabel: 'Book Cleaning Quote',
  heroEyebrow: 'CLEANING',
  heroTitle: 'Cleaning businesses need a site built around trust, booking ease, and clear service types',
  heroSubtitle: 'Designed for regular domestic cleans, end-of-lease, office cleaning, deep cleans, and recurring service enquiries.',
  imagePool: 'cleaning',
  homeStats: [{ value: 'Recurring', label: 'service potential' }, { value: 'Flexible', label: 'booking options' }, { value: 'Trusted', label: 'in-home service' }],
  serviceItems: [{ title: 'Regular home cleaning', text: 'Position recurring domestic services for weekly, fortnightly, or monthly bookings.' }, { title: 'Deep cleaning and move-related work', text: 'Sell the one-off jobs people often book with urgency or deadlines.' }, { title: 'Office and commercial cleaning', text: 'Support business clients with a separate but clear service path.' }],
  featureItems: [{ title: 'Trust-first messaging', text: 'Cleaning sites need to reduce uncertainty around people entering the property.' }, { title: 'Booking simplicity', text: 'Make frequency, scope, and next steps feel easy to understand.' }, { title: 'Service clarity', text: 'Different clean types should feel distinct so buyers can self-select fast.' }],
  aboutTitle: 'A cleaning about page should reinforce trust, care, and consistency',
  aboutText: 'BrightNest Cleaning is positioned for homes and workplaces that want a cleaning team that feels dependable, organised, and respectful of the space. The page structure supports recurring bookings and higher-trust in-home service decisions.',
  aboutBullets: ['Domestic and commercial cleaning', 'Repeat booking focus', 'Trusted team presentation'],
  teamMembers: [{ name: 'Tara Mills', role: 'Founder', bio: 'Oversees service quality, cleaner standards, and customer experience.' }, { name: 'Leah Park', role: 'Operations Lead', bio: 'Coordinates bookings, schedules, and ongoing client support.' }],
  faqItems: [{ q: 'Do I need to be home during the clean?', a: 'Use this section to reduce uncertainty around access and scheduling.' }, { q: 'Can I request regular ongoing service?', a: 'Clarify recurring bookings, service frequency, and preferred notice periods.' }],
  contactFaqItems: [{ q: 'What details help you quote faster?', a: 'Ask about property size, clean type, frequency, and any special requirements.' }, { q: 'Do you bring products and equipment?', a: 'Explain what is included and any customer responsibilities.' }],
  testimonials: [{ quote: 'It finally feels like a real cleaning company with proper booking confidence.', name: 'Hannah Price', role: 'Homeowner' }, { quote: 'The service types are much clearer now, which makes enquiry easier.', name: 'Jake Lim', role: 'Office Manager' }],
  ctaTitle: 'Need a cleaning site that books more confidently?',
  ctaSubtitle: 'Use this starter to structure recurring cleans, one-off jobs, and cleaner trust signals properly.',
});
