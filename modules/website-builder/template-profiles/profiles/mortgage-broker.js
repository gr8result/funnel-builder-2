import { FINANCE_LIBRARY_SEED_IMAGES, SHARED_LIBRARY_EXPANSION_IMAGES } from '../seed-library-images.js';

export default {
  templateSlug: 'website-mortgage-broker',
  siteName: 'Harbour Finance Partners',
  navCtaLabel: 'Book Finance Call',
  navCtaHref: '/contact',
  librarySeedImages: FINANCE_LIBRARY_SEED_IMAGES,
  harvestLibrarySeedImages: SHARED_LIBRARY_EXPANSION_IMAGES,
  home: {
    objective: 'Turn borrowers into qualified finance consultations with stronger trust, process clarity, and lender-positioning.',
    hero: {
      eyebrow: 'MORTGAGE BROKER',
      title: 'Mortgage advice that makes borrowers feel clear and ready to act',
      subtitle: 'Built for first-home buyers, refinancers, and investors who need calmer guidance, lender clarity, and a stronger reason to book a finance strategy call.',
      primaryLabel: 'Book finance call',
      primaryHref: '/contact',
      secondaryLabel: 'See loan pathways',
      secondaryHref: '/services',
      imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
    },
    stats: {
      title: 'What the homepage should communicate immediately',
      items: [
        { value: 'Clear', label: 'loan pathways' },
        { value: 'Trusted', label: 'broker guidance' },
        { value: 'Faster', label: 'application readiness' },
      ],
    },
    services: {
      title: 'Finance journeys buyers actually need help with',
      subtitle: 'Separate the main borrower scenarios so visitors can self-identify fast.',
      items: [
        { title: 'First-home buyers', text: 'Support early-stage borrowers who need education, borrowing clarity, and step-by-step guidance.' },
        { title: 'Refinancing and debt restructure', text: 'Position savings, strategic refinance decisions, and lender reassessment clearly.' },
        { title: 'Investor and portfolio lending', text: 'Sell the more strategic side of finance support for buyers thinking beyond one property.' },
      ],
    },
    features: {
      title: 'Why a mortgage site needs a different structure',
      subtitle: 'The visitor is buying trust, clarity, and guidance as much as access to lenders.',
      items: [
        { title: 'Decision support', text: 'Use the site to reduce overwhelm and explain what happens next in plain English.' },
        { title: 'Credibility and fit', text: 'The broker should feel calm, informed, and commercially helpful from the first page.' },
        { title: 'Application readiness', text: 'Prompt visitors toward better enquiry quality by framing the prep and documentation process early.' },
      ],
    },
    gallery: {
      title: 'Property and finance context',
      images: [
        { src: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80', alt: 'Home buying discussion' },
        { src: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80', alt: 'Property finance planning' },
        { src: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1200&q=80', alt: 'Finance paperwork' },
      ],
    },
    testimonials: {
      title: 'Borrower response',
      items: [
        { quote: 'It now feels like a real broker advisory site instead of a generic finance landing page.', name: 'Mia Stewart', role: 'First-home buyer' },
        { quote: 'The site finally explains the pathway clearly enough that good borrowers come in better prepared.', name: 'Daniel Park', role: 'Broker Principal' },
      ],
    },
    cta: {
      title: 'Need a broker site that feels more credible and useful?',
      subtitle: 'Use this starter to structure trust, loan pathways, and consultation quality properly.',
      buttonLabel: 'Book finance call',
      buttonHref: '/contact',
    },
  },
  about: {
    pageTitle: 'About',
    objective: 'Use the about page to explain the broker approach, advice style, and how clients are guided through the finance process.',
    title: 'A mortgage broker about page should reduce uncertainty and make the advisory process feel human',
    text: 'Harbour Finance Partners is positioned as a broker-led advisory business that helps borrowers move from confusion to confident action. The structure is designed to support trust, explain lender navigation, and make the consultation feel worth booking.',
    bullets: ['Borrower-first advice', 'Clear lender pathway framing', 'Application-ready process'],
    imageUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80',
    team: {
      title: 'Who the borrower will speak with',
      members: [
        { name: 'Alicia Hart', role: 'Mortgage Broker', bio: 'Leads borrower strategy, lender matching, and finance structuring.' },
        { name: 'Sam Nguyen', role: 'Client Manager', bio: 'Coordinates application flow, document collection, and client communication.' },
      ],
    },
    stats: {
      title: 'What the page should reinforce',
      items: [
        { value: 'Calm', label: 'advice process' },
        { value: 'Clear', label: 'next steps' },
        { value: 'Prepared', label: 'borrower enquiries' },
      ],
    },
  },
  servicesPage: {
    pageTitle: 'Loan Pathways',
    slug: 'services',
    objective: 'Use the services page to separate borrower scenarios and make the broker offer easier to navigate.',
    hero: {
      eyebrow: 'LOAN PATHWAYS',
      title: 'Different borrower journeys need different advice, and the site should make that obvious',
      subtitle: 'Break the offer into clear borrowing scenarios so visitors do not have to guess whether the broker is the right fit.',
      primaryLabel: 'Book finance call',
      primaryHref: '/contact',
      secondaryLabel: 'Meet the team',
      secondaryHref: '/about',
    },
    services: {
      title: 'Where clients usually need help',
      subtitle: 'Use plain borrower categories rather than vague finance jargon.',
      items: [
        { title: 'Buying your first property', text: 'Clarify borrowing power, deposit position, lender fit, and what to prepare.' },
        { title: 'Refinancing your current loan', text: 'Support clients reviewing rates, structure, and cash-flow implications.' },
        { title: 'Investment and portfolio growth', text: 'Frame strategic lending support for clients thinking beyond a single home loan.' },
      ],
    },
    features: {
      title: 'What makes the page more useful',
      subtitle: 'The borrower should leave with less confusion and more confidence about the next step.',
      items: [
        { title: 'Scenario clarity', text: 'Group the main borrower use-cases clearly so clients know where they fit.' },
        { title: 'Expectations and prep', text: 'Explain documentation, timelines, and what the broker needs to advise properly.' },
        { title: 'Decision momentum', text: 'Guide the visitor toward a consult while the pathway feels fresh and understandable.' },
      ],
    },
    faq: {
      title: 'Questions borrowers ask before booking',
      items: [
        { q: 'Do I need to know exactly what loan I want?', a: 'Use this section to reassure borrowers that the consult is there to clarify the right path, not assume they already know the answer.' },
        { q: 'What should I prepare before speaking with you?', a: 'Prompt for income, liabilities, deposit position, property goals, and timing so the enquiry starts with context.' },
      ],
    },
  },
  proofPage: {
    pageTitle: 'Success Stories',
    slug: 'results',
    objective: 'Use this page to reinforce trust, client wins, and the value of clear broker guidance.',
    gallery: {
      title: 'Finance and property visuals',
      images: [
        { src: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80', alt: 'Property buyers' },
        { src: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1200&q=80', alt: 'Finance consultation' },
        { src: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80', alt: 'Home finance planning' },
      ],
    },
    testimonials: {
      title: 'Client stories',
      items: [
        { quote: 'The site now sounds like a broker who actually guides people, not just a loan lead form.', name: 'Tiana Bell', role: 'Home buyer' },
        { quote: 'It sets better expectations before the first call, which improves the quality of the conversations.', name: 'Alicia Hart', role: 'Broker' },
      ],
    },
    cta: {
      title: 'Want a stronger broker presence?',
      subtitle: 'Use the results page to move borrowers into a strategy call while trust is high.',
      buttonLabel: 'Book finance call',
      buttonHref: '/contact',
    },
  },
  contactPage: {
    pageTitle: 'Contact',
    objective: 'Capture loan enquiries with enough financial context to make the first conversation more useful.',
    hero: {
      eyebrow: 'START HERE',
      title: 'Use the contact page like a finance triage page, not just a basic contact form',
      subtitle: 'Ask about borrowing stage, timeline, property type, and finance goals so the broker can step into the call with context.',
      primaryLabel: 'Book finance call',
      primaryHref: '#contact',
      secondaryLabel: 'See loan pathways',
      secondaryHref: '/services',
    },
    contact: {
      title: 'Tell us about your finance goals',
      subtitle: 'Prompt for the information that helps the broker understand the borrower scenario quickly.',
    },
    faq: {
      title: 'Before you enquire',
      items: [
        { q: 'Do I need a property picked already?', a: 'Use this section to explain how early-stage buyers can still benefit from a planning conversation.' },
        { q: 'Can you help with refinancing too?', a: 'Clarify that refinance and restructuring scenarios are part of the advisory pathway.' },
      ],
    },
  },
};
