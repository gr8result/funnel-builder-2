import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-pest-control',
  siteName: 'Shield Pest Solutions',
  navCtaLabel: 'Book Inspection',
  heroEyebrow: 'PEST CONTROL',
  heroTitle: 'Pest control websites need urgency, reassurance, and service clarity without sounding alarmist',
  heroSubtitle: 'Designed for termite inspections, rodent treatment, general pest work, preventative plans, and residential or commercial pest management.',
  imagePool: 'pestControl',
  homeStats: [{ value: 'Fast', label: 'inspection response' }, { value: 'Preventative', label: 'treatment plans' }, { value: 'Protected', label: 'homes and businesses' }],
  serviceItems: [{ title: 'General pest treatments', text: 'Make common household and workplace pest jobs easy to identify and book.' }, { title: 'Termite inspections and management', text: 'Separate higher-trust termite work so it feels specific and credible.' }, { title: 'Preventative service plans', text: 'Position repeat work and ongoing property protection clearly.' }],
  featureItems: [{ title: 'Urgency without panic', text: 'The site should feel responsive and reassuring, not exaggerated or gimmicky.' }, { title: 'Inspection-led trust', text: 'Use inspections, reports, and treatment plans to make the service feel professional.' }, { title: 'Residential and commercial confidence', text: 'Support both home and business enquiries with clearer service framing.' }],
  aboutTitle: 'A pest control about page should make the business feel methodical, reliable, and safe to trust',
  aboutText: 'Shield Pest Solutions is framed as a pest management company that combines responsive service with a more professional inspection and treatment process. The page plan is written to reassure homeowners and business clients alike.',
  aboutBullets: ['Inspection-led service', 'Residential and commercial', 'Ongoing protection plans'],
  teamMembers: [{ name: 'Caleb Stone', role: 'Lead Technician', bio: 'Handles inspections, treatment plans, and reporting.' }, { name: 'Rina Patel', role: 'Client Support', bio: 'Coordinates bookings, reminders, and follow-up communication.' }],
  faqItems: [{ q: 'Do you only treat active infestations?', a: 'Use this section to explain preventative plans and inspection-based work.' }, { q: 'Can you help with termites?', a: 'Clarify whether inspections, monitoring, and treatment are part of the core offer.' }],
  contactFaqItems: [{ q: 'What should I include in a pest enquiry?', a: 'Ask about pest type, property type, issue timing, and any visible signs.' }, { q: 'Do you work with homes and businesses?', a: 'Use this section to define scope across residential and commercial sites.' }],
  testimonials: [{ quote: 'The site now feels much more credible and much less generic.', name: 'Sarah Lin', role: 'Homeowner' }, { quote: 'It explains the difference between an inspection, a treatment, and a plan clearly.', name: 'Corey Miles', role: 'Business Owner' }],
  ctaTitle: 'Need a pest control site that feels more professional?',
  ctaSubtitle: 'Use this starter to structure inspections, treatments, and ongoing protection properly.',
});
