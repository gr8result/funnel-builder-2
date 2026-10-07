import { ECOMMERCE_LIBRARY_SEED_IMAGES, SHARED_LIBRARY_EXPANSION_IMAGES } from '../seed-library-images.js';

export default {
  templateSlug: 'website-ecommerce-store',
  siteName: 'Northlane Supply',
  navCtaLabel: 'Shop Now',
  navCtaHref: '/services',
  librarySeedImages: ECOMMERCE_LIBRARY_SEED_IMAGES,
  harvestLibrarySeedImages: SHARED_LIBRARY_EXPANSION_IMAGES,
  home: {
    objective: 'Sell products, reinforce the brand, and move traffic into collection pages and checkout journeys.',
    hero: {
      eyebrow: 'ONLINE STORE',
      title: 'An ecommerce site needs merchandising, trust, and category clarity, not a generic brochure layout',
      subtitle: 'Built for boutique retail, lifestyle brands, homewares, fashion labels, and product businesses that need a stronger online storefront.',
      primaryLabel: 'Shop now',
      primaryHref: '/services',
      secondaryLabel: 'About the brand',
      secondaryHref: '/about',
      imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80',
    },
    stats: {
      title: 'What a better ecommerce homepage should communicate',
      items: [
        { value: 'Clear', label: 'category pathways' },
        { value: 'Trusted', label: 'shipping and returns' },
        { value: 'Curated', label: 'brand presentation' },
      ],
    },
    services: {
      title: 'What the store should surface quickly',
      subtitle: 'Think in collections, product use-cases, and seasonal merchandising.',
      items: [
        { title: 'Featured collections', text: 'Guide visitors into the most commercially important categories first.' },
        { title: 'Best sellers', text: 'Show the products that already create confidence and fast decisions.' },
        { title: 'Bundles and offers', text: 'Use merchandising blocks to raise order value without clutter.' },
      ],
    },
    features: {
      title: 'Why ecommerce structure needs to be different',
      subtitle: 'Store buyers need product confidence, fulfilment clarity, and simple collection paths.',
      items: [
        { title: 'Merchandising first', text: 'The homepage should move visitors into product discovery, not only tell a brand story.' },
        { title: 'Trust and fulfilment', text: 'Shipping, returns, payment, and delivery expectations need to feel obvious early.' },
        { title: 'Repeat shopping flow', text: 'Collections, offers, and product education should support both first-time and returning customers.' },
      ],
    },
    gallery: {
      title: 'Product and brand presentation',
      images: [
        { src: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80', alt: 'Retail display' },
        { src: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80', alt: 'Product merchandising' },
        { src: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80', alt: 'Online retail brand' },
      ],
    },
    testimonials: {
      title: 'Customer confidence signals',
      items: [
        { quote: 'It feels like a real brand storefront now, not just a few products dropped into a page.', name: 'Georgia May', role: 'Store Owner' },
        { quote: 'The homepage actually helps people browse instead of making them hunt for products.', name: 'Alex Hart', role: 'Retail Manager' },
      ],
    },
    cta: {
      title: 'Need a stronger online store foundation?',
      subtitle: 'This starter is built around collections, product trust, and a cleaner path to purchase.',
      buttonLabel: 'Shop now',
      buttonHref: '/services',
    },
  },
  about: {
    pageTitle: 'About',
    objective: 'Use the about page to strengthen the brand, product philosophy, and buying confidence.',
    title: 'A store about page should deepen the brand, not interrupt the shopping flow',
    text: 'Northlane Supply is positioned as a modern product brand with a clear point of view, a tighter offer mix, and a shopping experience designed to feel intentional. This page gives space to explain the brand story, product standards, and why customers come back.',
    bullets: ['Brand point of view', 'Product standards', 'Customer experience'],
    imageUrl: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1600&q=80',
    team: {
      title: 'People behind the brand',
      members: [
        { name: 'Nina Cole', role: 'Founder', bio: 'Shapes product direction, merchandising, and the brand story.' },
        { name: 'Mason Lee', role: 'Operations Lead', bio: 'Owns fulfilment, stock flow, and customer experience.' },
      ],
    },
    stats: {
      title: 'What the page should reinforce',
      items: [
        { value: 'Curated', label: 'product range' },
        { value: 'Fast', label: 'fulfilment process' },
        { value: 'Trusted', label: 'customer support' },
      ],
    },
  },
  servicesPage: {
    pageTitle: 'Shop',
    slug: 'services',
    objective: 'Use the shop page to surface collections, featured ranges, and product pathways.',
    hero: {
      eyebrow: 'COLLECTIONS',
      title: 'The store page should feel like navigation into buying, not another generic services page',
      subtitle: 'Organise by collection, category, or product use-case so visitors can find the right products fast.',
      primaryLabel: 'Browse collection',
      primaryHref: '#contact',
      secondaryLabel: 'About the brand',
      secondaryHref: '/about',
    },
    services: {
      title: 'Collection paths',
      subtitle: 'Replace with the product groups you want customers shopping first.',
      items: [
        { title: 'New arrivals', text: 'Use this block for seasonal launches and the latest stock.' },
        { title: 'Best sellers', text: 'Lead with products that already convert and build confidence.' },
        { title: 'Bundles and gifting', text: 'Create higher-value baskets with grouped offers and curated packs.' },
      ],
    },
    features: {
      title: 'What helps product pages convert',
      subtitle: 'Product detail pages should be supported by the right brand and merchandising structure.',
      items: [
        { title: 'Category clarity', text: 'Make collections, variants, and navigation feel easy to understand.' },
        { title: 'Buying confidence', text: 'Shipping, returns, reviews, and payment methods should be visible early.' },
        { title: 'Average order value', text: 'Use bundles, related products, and featured ranges strategically.' },
      ],
    },
    faq: {
      title: 'Questions shoppers ask',
      items: [
        { q: 'How fast is shipping?', a: 'Use this section to explain dispatch times, delivery windows, and order tracking.' },
        { q: 'What if the product is not right?', a: 'Clarify returns, exchanges, and any product-specific conditions.' },
      ],
    },
  },
  proofPage: {
    pageTitle: 'Featured',
    slug: 'featured',
    objective: 'Use this page to highlight bestselling products, branded collections, and customer proof.',
    gallery: {
      title: 'Featured presentation',
      images: [
        { src: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80', alt: 'Storefront products' },
        { src: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80', alt: 'Retail shopping experience' },
        { src: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80', alt: 'Boutique merchandising' },
      ],
    },
    testimonials: {
      title: 'Buyer response',
      items: [
        { quote: 'The site now feels merchandised properly and makes the products look worth buying.', name: 'Clara James', role: 'Brand Owner' },
        { quote: 'It finally supports repeat buying instead of acting like a brochure.', name: 'Eli Ward', role: 'Ecommerce Manager' },
      ],
    },
    cta: {
      title: 'Ready to tighten the storefront?',
      subtitle: 'Use the featured page to highlight bestsellers, launches, and stronger brand proof.',
      buttonLabel: 'Shop now',
      buttonHref: '/services',
    },
  },
  contactPage: {
    pageTitle: 'Support',
    objective: 'Use the support page for order help, wholesale questions, and pre-purchase enquiries.',
    hero: {
      eyebrow: 'SUPPORT',
      title: 'A store still needs a real support page for order questions and customer confidence',
      subtitle: 'Use this page for delivery, returns, wholesale, and customer support requests instead of leaving buyers uncertain.',
      primaryLabel: 'Contact support',
      primaryHref: '#contact',
      secondaryLabel: 'Browse shop',
      secondaryHref: '/services',
    },
    contact: {
      title: 'Need help with an order or product?',
      subtitle: 'Prompt for order number, product name, issue type, and preferred resolution so support can move faster.',
    },
    faq: {
      title: 'Before you contact us',
      items: [
        { q: 'Can I track my order?', a: 'Use this area to explain dispatch notifications and tracking updates.' },
        { q: 'Do you offer wholesale or trade?', a: 'Clarify whether you support wholesale, stockists, or bulk orders.' },
      ],
    },
  },
};
