export function buildLibrarySeedImages(groups = []) {
  const curatedPool = [
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1555374018-13a8994ab246?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1581091215367-59ab6dcef35b?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1574359411659-15573f1f0f5d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80',
  ];

  return groups.map((group, index) => {
    const tags = Array.isArray(group) ? group.filter(Boolean) : [group].filter(Boolean);
    const keyword = tags.join(' ').toLowerCase();

    if (/(law|legal)/.test(keyword)) return curatedPool[6 + (index % 2)];
    if (/(medical|clinic|doctor|health)/.test(keyword)) return curatedPool[10 + (index % 2)];
    if (/(fitness|gym|coach|training)/.test(keyword)) return curatedPool[12 + (index % 2)];
    if (/(restaurant|hospitality|bar|dining)/.test(keyword)) return curatedPool[14 + (index % 2)];
    if (/(retail|ecommerce|shop|showroom)/.test(keyword)) return curatedPool[16 + (index % 2)];
    if (/(property|realestate|broker|finance)/.test(keyword)) return curatedPool[8 + (index % 2)];
    if (/(construction|renovation|plumber|electrician|roof|servicebusiness|localbusiness|crew)/.test(keyword)) return curatedPool[18 + (index % 10)];
    if (/(creative|agency|marketing|technology|workspace|office|meeting|boardroom|professional|business|consulting)/.test(keyword)) return curatedPool[index % 10];

    return curatedPool[index % curatedPool.length];
  });
}
