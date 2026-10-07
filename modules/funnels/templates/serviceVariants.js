export function getServiceArchetype(theme) {
  if (theme?.archetype) return theme.archetype;

  if (['plumbing', 'electrician', 'locksmith', 'hvac', 'appliance-repair', 'garage-doors'].includes(theme.slug)) {
    return 'emergency-response';
  }

  if (['cleaning', 'lawn-care', 'pest-control', 'pool-service', 'irrigation', 'guttering'].includes(theme.slug)) {
    return 'maintenance-plan';
  }

  if (['painting', 'car-detailing', 'pressure-washing', 'flooring', 'tiling', 'epoxy-flooring', 'rendering', 'shutters-blinds'].includes(theme.slug)) {
    return 'premium-visual';
  }

  return 'project-led';
}


export function getServiceLongFormSectionIds(theme) {
  const archetype = getServiceArchetype(theme);

  switch (archetype) {
    case 'emergency-response':
      return [`${theme.slug}-hero`, `${theme.slug}-difference`, `${theme.slug}-services`, `${theme.slug}-faq`, `${theme.slug}-quote`, 'footer'];
    case 'maintenance-plan':
      return [`${theme.slug}-hero`, `${theme.slug}-services`, `${theme.slug}-testimonials`, `${theme.slug}-faq`, `${theme.slug}-quote`, 'footer'];
    case 'premium-visual':
      return [`${theme.slug}-hero`, `${theme.slug}-proof`, `${theme.slug}-services`, `${theme.slug}-testimonials`, `${theme.slug}-quote`, 'footer'];
    default:
      return [`${theme.slug}-hero`, `${theme.slug}-services`, `${theme.slug}-difference`, `${theme.slug}-proof`, `${theme.slug}-quote`, 'footer'];
  }
}


export function getServiceShortFormSectionIds(theme) {
  const archetype = getServiceArchetype(theme);

  switch (archetype) {
    case 'emergency-response':
      return [`${theme.slug}-hero`, `${theme.slug}-difference`, `${theme.slug}-quote`, 'footer'];
    case 'maintenance-plan':
      return [`${theme.slug}-hero`, `${theme.slug}-testimonials`, `${theme.slug}-quote`, 'footer'];
    case 'premium-visual':
      return [`${theme.slug}-hero`, `${theme.slug}-proof`, `${theme.slug}-quote`, 'footer'];
    default:
      return [`${theme.slug}-hero`, `${theme.slug}-services`, `${theme.slug}-quote`, 'footer'];
  }
}


export function getServiceVariantDescription(theme, variant) {
  const archetype = getServiceArchetype(theme);

  if (variant === 'short') {
    switch (archetype) {
      case 'emergency-response':
        return `Short-form ${theme.label.toLowerCase()} page for urgent or high-intent traffic that mainly needs trust, fast response cues, and a clean quote path.`;
      case 'maintenance-plan':
        return `Short-form ${theme.label.toLowerCase()} page built for repeat, referral, and local traffic that mostly needs social proof and a low-friction enquiry flow.`;
      case 'premium-visual':
        return `Short-form ${theme.label.toLowerCase()} page that leans on presentation, visual proof, and a tighter booking path for warmer traffic.`;
      default:
        return `Short-form ${theme.label.toLowerCase()} page for visitors who already understand the service and mainly need scope clarity plus a fast quote form.`;
    }
  }

  switch (archetype) {
    case 'emergency-response':
      return `Long-form ${theme.label.toLowerCase()} page that prioritises urgency, reassurance, clear trust signals, and a practical quote path.`;
    case 'maintenance-plan':
      return `Long-form ${theme.label.toLowerCase()} page built for recurring service value, reliability, and low-friction local enquiries.`;
    case 'premium-visual':
      return `Long-form ${theme.label.toLowerCase()} page built around presentation, visual proof, and higher-perceived-value service positioning.`;
    default:
      return `Long-form ${theme.label.toLowerCase()} page for project-led or scope-led enquiries with richer proof, clearer service framing, and a stronger quote path.`;
  }
}
