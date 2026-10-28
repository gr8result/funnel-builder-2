// What the side panel lets the builder edit for each section type.
// kind: text | textarea | button | image | list | strings | toggle | url

export const SECTION_FIELDS = {
  hero: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' },
    { path: 'headline', label: 'Headline', kind: 'textarea' },
    { path: 'subheadline', label: 'Supporting text', kind: 'textarea' },
    { path: 'primaryCta', label: 'Main button', kind: 'button' },
    { path: 'secondaryCta', label: 'Second button (optional)', kind: 'button' },
    { path: 'image', label: 'Hero image', kind: 'image' },
    { path: 'showForm', label: 'Show enquiry form in hero', kind: 'toggle' },
    { path: 'image.caption', label: 'Optional public image caption', kind: 'text' },
    { path: 'highlights', label: 'Highlights', kind: 'strings', max: 4 },
  ],
  trust: [{ path: 'items', label: 'Credentials', kind: 'list', item: [{ key: 'label', label: 'Credential', kind: 'text' }], blank: { label: '' } }],
  benefits: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' },
    { path: 'problemHeading', label: 'Problem column heading', kind: 'text' }, { path: 'solutionHeading', label: 'Solution column heading', kind: 'text' },
    { path: 'image', label: 'Story image', kind: 'image' }, { path: 'image.caption', label: 'Optional public image caption', kind: 'text' }, { path: 'imageHeading', label: 'Image heading', kind: 'text' },
    { path: 'items', label: 'Benefits', kind: 'list', item: [{ key: 'problem', label: 'Customer problem (comparison)', kind: 'text' }, { key: 'title', label: 'Title', kind: 'text' }, { key: 'body', label: 'Description', kind: 'textarea' }], blank: { problem: '', title: 'New benefit', body: 'Describe it in a sentence.' } },
  ],
  services: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' },
    { path: 'items', label: 'Products & services', kind: 'list', item: [{ key: 'title', label: 'Title', kind: 'text' }, { key: 'body', label: 'Description', kind: 'textarea' }, { key: 'icon', label: 'Icon: plan, calculator, document, layers, project', kind: 'text' }, { key: 'image', label: 'Image', kind: 'image' }, { key: 'image.caption', label: 'Optional public image caption', kind: 'text' }], blank: { title: 'New service', body: 'Describe it in a sentence.', image: { src: '', alt: '' } } },
  ],
  process: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' },
    { path: 'steps', label: 'Steps', kind: 'list', item: [{ key: 'title', label: 'Step', kind: 'text' }, { key: 'body', label: 'Description', kind: 'textarea' }, { key: 'icon', label: 'Icon: plan, calculator, document, layers, project', kind: 'text' }], blank: { title: 'New step', body: 'What happens at this stage.' } },
  ],
  gallery: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' },
    { path: 'images', label: 'Images', kind: 'list', item: [{ key: '', label: 'Image', kind: 'image' }], blank: { src: '', alt: '' } },
  ],
  video: [{ path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' }, { path: 'url', label: 'YouTube, Vimeo or MP4 link', kind: 'url' }],
  testimonials: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' },
    { path: 'items', label: 'Testimonials (real clients only)', kind: 'list', item: [{ key: 'quote', label: 'Quote', kind: 'textarea' }, { key: 'name', label: 'Name', kind: 'text' }, { key: 'detail', label: 'Suburb or project', kind: 'text' }], blank: { quote: '', name: '', detail: '' } },
  ],
  about: [{ path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' }, { path: 'body', label: 'Text', kind: 'textarea' }, { path: 'image', label: 'Image', kind: 'image' }, { path: 'image.caption', label: 'Optional public image caption', kind: 'text' }],
  offer: [{ path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'textarea' }, { path: 'body', label: 'Text', kind: 'textarea' }, { path: 'cta', label: 'Button', kind: 'button' }, { path: 'finePrint', label: 'Terms (optional)', kind: 'textarea' }],
  faq: [
    { path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' },
    { path: 'items', label: 'Questions', kind: 'list', item: [{ key: 'q', label: 'Question', kind: 'text' }, { key: 'a', label: 'Answer', kind: 'textarea' }], blank: { q: 'New question?', a: 'The answer.' } },
  ],
  enquiry: [{ path: 'eyebrow', label: 'Small heading', kind: 'text' }, { path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' }, { path: 'sidePoints', label: 'Reassurance points', kind: 'strings', max: 5 }, { path: 'image', label: 'Conversion section image', kind: 'image' }, { path: 'image.caption', label: 'Optional public image caption', kind: 'text' }],
  contact: [{ path: 'heading', label: 'Heading', kind: 'text' }, { path: 'intro', label: 'Introduction', kind: 'textarea' }, { path: 'hours', label: 'Opening hours', kind: 'text' }, { path: 'showPhone', label: 'Show phone', kind: 'toggle' }, { path: 'showEmail', label: 'Show email', kind: 'toggle' }, { path: 'showAddress', label: 'Show address / area', kind: 'toggle' }],
  footer: [{ path: 'tagline', label: 'Tagline', kind: 'text' }, { path: 'legal', label: 'Legal note', kind: 'textarea' }],
};

export const VARIANTS = {
  hero: [['split', 'Text + image'], ['statement', 'Large statement'], ['cinematic-dark', 'Full-bleed / dark overlay'], ['cinematic-light', 'Full-bleed / light overlay'], ['product', 'Product / industry visual']],
  benefits: [['default', 'Benefit cards'], ['comparison', 'Pain points / solutions']],
  services: [['default', 'Service cards'], ['showcase', 'Compact image showcase']],
  process: [['default', 'Numbered steps'], ['connected', 'Connected icon workflow']],
  about: [['default', 'Text + image'], ['image-banner', 'Immersive image banner']],
};
