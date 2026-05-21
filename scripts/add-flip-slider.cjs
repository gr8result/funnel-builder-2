require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const flipSliderBlock = {
  id: 'flip-slider-modules-001',
  type: 'grid-section',
  _pinned: true,
  props: {
    title: 'Our Platform Modules',
    gridVariant: 'services',
    cardFlipEffect: true,
    servicesLayoutMode: 'slider',
    columns: 3,
    backgroundColor: 'linear-gradient(180deg, #050914 0%, #08131f 100%)',
    sectionTitleColor: '#f8fafc',
    buttonBackgroundColor: '#0ea5e9',
    cardFlipBackColor: '#1e293b',
    cardFlipBorderColor: 'rgba(148,163,184,0.2)',
    cardFlipTitleColor: '#f8fafc',
    cardFlipBodyColor: 'rgba(248,250,252,0.75)',
    cardFlipButtonText: 'Learn More',
    columnGap: 20,
    items: [
      {
        id: 'flip-crm',
        title: 'CRM',
        eyebrow: 'Contact & Pipeline Management',
        content: 'Manage your contacts, deals and sales pipeline all in one place.',
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        link: '/crm',
        icon: 'Users',
      },
      {
        id: 'flip-email',
        title: 'Email Marketing',
        eyebrow: 'Campaigns & Automation',
        content: 'Design and send beautiful email campaigns that convert.',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
        link: '/email',
        icon: 'Mail',
      },
      {
        id: 'flip-sms',
        title: 'SMS Marketing',
        eyebrow: 'Direct Text Messaging',
        content: 'Reach customers instantly with targeted, personalised SMS messages.',
        image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80',
        link: '/sms',
        icon: 'MessageSquare',
      },
      {
        id: 'flip-website',
        title: 'Website Builder',
        eyebrow: 'Drag & Drop Builder',
        content: 'Create stunning websites with our drag-and-drop builder and AI.',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
        link: '/website-builder',
        icon: 'Globe',
      },
      {
        id: 'flip-automation',
        title: 'Automation',
        eyebrow: 'Marketing Workflows',
        content: 'Automate your marketing and save hours every week with smart flows.',
        image: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=800&q=80',
        link: '/automation',
        icon: 'Zap',
      },
      {
        id: 'flip-funnels',
        title: 'Sales Funnels',
        eyebrow: 'High-Converting Funnels',
        content: 'Build sales funnels that guide visitors to buy with confidence.',
        image: 'https://images.unsplash.com/photo-1591696331111-ef9586a5b17a?auto=format&fit=crop&w=800&q=80',
        link: '/funnels',
        icon: 'TrendingUp',
      },
    ],
  },
};

(async () => {
  // Fetch current row
  const { data, error } = await supabase
    .from('published_websites')
    .select('id, site_data')
    .eq('project_id', 'draft:2208a52a-8175-477e-823c-fc6de7fe4afe')
    .single();

  if (error) {
    console.error('Fetch error:', error.message);
    process.exit(1);
  }

  console.log('Row id:', data.id);
  // Deep clone to avoid any reference issues
  const siteData = JSON.parse(JSON.stringify(data.site_data || {}));
  const pageBlocks = siteData.pageBlocks || {};
  const modulesBlocks = pageBlocks.Modules || [];

  // Remove any existing flip slider, then append at the end
  const existingIdx = modulesBlocks.findIndex(b => b.id === 'flip-slider-modules-001');
  if (existingIdx !== -1) {
    modulesBlocks.splice(existingIdx, 1);
    console.log('Removed existing flip slider from index', existingIdx);
  }
  modulesBlocks.push(flipSliderBlock);
  console.log('Appended flip slider at the end (index', modulesBlocks.length - 1, ')');

  pageBlocks.Modules = modulesBlocks;
  siteData.pageBlocks = pageBlocks;

  const { error: updateError } = await supabase
    .from('published_websites')
    .update({ site_data: siteData })
    .eq('id', data.id);

  if (updateError) {
    console.error('Update error:', updateError.message);
    process.exit(1);
  }

  console.log('Updated successfully!');
  console.log('Modules blocks now:');
  pageBlocks.Modules.forEach((b, i) => console.log(` ${i}: ${b.type} (${b.id || 'no id'})`));

  // Re-fetch to confirm persistence
  const { data: verify, error: ve } = await supabase
    .from('published_websites')
    .select('site_data')
    .eq('id', data.id)
    .single();
  if (ve) { console.error('Verify fetch error:', ve.message); return; }
  const verifyBlocks = verify.site_data?.pageBlocks?.Modules || [];
  console.log('\nVerification re-fetch - Modules block count:', verifyBlocks.length);
  verifyBlocks.forEach((b, i) => console.log(` ${i}: ${b.type} (${b.id || 'no id'})`));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
