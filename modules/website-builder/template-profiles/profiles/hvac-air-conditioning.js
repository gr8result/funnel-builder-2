import { createTradeWebsiteProfile } from '../create-trade-website-profile.js';

export default createTradeWebsiteProfile({
  templateSlug: 'website-hvac-air-conditioning',
  siteName: 'ClimateFlow Air',
  navCtaLabel: 'Book HVAC Service',
  heroEyebrow: 'HVAC AND AIR',
  heroTitle: 'HVAC and air conditioning sites need comfort, reliability, and service clarity built into the structure',
  heroSubtitle: 'Designed for split systems, ducted air, ventilation, maintenance plans, breakdowns, and climate-control upgrades.',
  imagePool: 'hvac',
  homeStats: [{ value: 'Fast', label: 'service response' }, { value: 'Seasonal', label: 'maintenance demand' }, { value: 'Comfort', label: 'and system performance' }],
  serviceItems: [{ title: 'Breakdowns and urgent repairs', text: 'Make it easy for customers with failed systems to know when and how to contact you.' }, { title: 'Installations and replacements', text: 'Position new systems, upgrades, and fit-for-purpose recommendations clearly.' }, { title: 'Servicing and maintenance', text: 'Sell recurring care plans and preventative servicing without burying them.' }],
  featureItems: [{ title: 'Comfort-led copy', text: 'The page should focus on reliability, temperature control, and reduced disruption.' }, { title: 'System guidance', text: 'Help customers understand what system type or service path they likely need.' }, { title: 'Commercial and residential fit', text: 'The site should flex across homes, offices, and managed properties.' }],
  aboutTitle: 'A climate services about page should explain the standards and service model behind the installs',
  aboutText: 'ClimateFlow Air is positioned as a dependable HVAC and air conditioning team that blends technical competence with cleaner communication and a more organised service experience. The page plan gives room to explain systems, maintenance, and the way the team works.',
  aboutBullets: ['Installation and servicing', 'Residential and commercial systems', 'Maintenance plans'],
  teamMembers: [{ name: 'Ethan Ross', role: 'Lead Technician', bio: 'Leads diagnostics, installs, and system recommendations.' }, { name: 'Paige Liu', role: 'Service Manager', bio: 'Coordinates jobs, maintenance scheduling, and customer support.' }],
  faqItems: [{ q: 'Do you service my system type?', a: 'Use this section to explain split systems, ducted air, ventilation, and brand coverage.' }, { q: 'Can you help with preventative servicing?', a: 'Position routine maintenance as part of the long-term service model, not just emergency repairs.' }],
  contactFaqItems: [{ q: 'Do you service homes and commercial spaces?', a: 'State where the team works and which system types are supported.' }, { q: 'What should I include in a service request?', a: 'Ask for system type, issue symptoms, property type, and urgency.' }],
  testimonials: [{ quote: 'It now feels like a proper HVAC company instead of a generic service site.', name: 'Olivia Hart', role: 'Facilities Manager' }, { quote: 'The page explains repairs, installs, and servicing in a much clearer way.', name: 'Jack Turner', role: 'Homeowner' }],
  ctaTitle: 'Need a climate-control site with more structure?',
  ctaSubtitle: 'Use this starter to position repairs, installs, servicing, and maintenance plans properly.',
});
