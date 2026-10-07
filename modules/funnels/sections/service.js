import { getServiceImageUrl } from '../services/images.js';
import { serviceInitials } from '../utils/serviceText.js';
import { F } from '../config.js';
import { getServiceArchetype } from '../templates/serviceVariants.js';


export function buildServiceSectionImageBand(theme, options = {}) {
  const image = getServiceImageUrl(theme, options.variant || 'hero', {
    title: options.title || theme.label,
    subtitle: options.subtitle || theme.visualHeadline,
    caption: options.caption || theme.services?.[0]?.title || theme.responseLine,
    slot: options.slot || `band-${options.variant || 'hero'}`,
    icon: options.icon || theme.icon,
    secondaryIcon: options.secondaryIcon || theme.secondaryIcon,
  });

  return `<div style="position:relative;width:100%;min-height:${options.height || 320}px;background-image:linear-gradient(90deg,rgba(15,23,42,${options.overlayStart || 0.24}) 0%,rgba(15,23,42,${options.overlayEnd || 0.06}) 100%),url('${image}');background-size:cover;background-position:center;overflow:hidden;">
    <div style="position:absolute;inset:0;background:${options.tint || `linear-gradient(135deg, ${theme.accentDark}22, ${theme.accent}18)`};mix-blend-mode:multiply;"></div>
    <div style="position:relative;z-index:1;max-width:1500px;margin:0 auto;min-height:${options.height || 320}px;display:flex;align-items:flex-end;padding:clamp(24px,5vw,48px) clamp(24px,6vw,72px);box-sizing:border-box;">
      <div style="display:grid;gap:10px;max-width:760px;">
        <span style="display:inline-flex;align-items:center;gap:10px;width:max-content;max-width:100%;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:10px 16px;color:#fff;font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">${theme.icon} ${options.eyebrow || theme.heroVisualTagline}</span>
        <h2 style="color:#fff;font-size:clamp(34px,4vw,52px);font-weight:900;line-height:1.05;margin:0;">${options.title || theme.sectionHeadline || theme.label}</h2>
        <p style="color:rgba(255,255,255,0.88);font-size:clamp(16px,1.8vw,20px);line-height:1.7;margin:0;">${options.subtitle || theme.sectionIntro || theme.visualHeadline}</p>
      </div>
    </div>
  </div>`;
}


export function buildServiceShowcase(theme) {
  const featureImage = getServiceImageUrl(theme, 'gallery', {
    title: theme.label,
    subtitle: theme.visualHeadline,
    caption: theme.services?.[0]?.title,
    slot: 'showcase-feature',
  });
  const detailImages = (theme.services || []).slice(0, 2).map((service, index) => getServiceImageUrl(theme, 'card', {
    title: service.title,
    subtitle: index === 0 ? theme.heroVisualTagline : theme.responseLine,
    caption: service.title,
    slot: `showcase-detail-${index}`,
    icon: service.icon || theme.icon,
    secondaryIcon: index === 0 ? theme.secondaryIcon : theme.icon,
  }));

  return `<div style="position:relative;z-index:1;display:grid;gap:18px;height:100%;align-content:start;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:10px 16px;color:#fff;font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${theme.icon} ${theme.heroVisualTagline}</span>
      <span style="display:inline-flex;align-items:center;gap:10px;background:rgba(15,23,42,0.42);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:10px 16px;color:#dbeafe;font-size:14px;font-weight:700;">${theme.responseLine}</span>
    </div>
    <div style="background:linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08));border:1px solid rgba(255,255,255,0.16);border-radius:30px;padding:24px;box-shadow:0 24px 80px rgba(2,6,23,0.22);">
      <div style="background:linear-gradient(180deg,rgba(248,250,252,0.98),rgba(226,232,240,0.92));border-radius:24px;min-height:340px;padding:24px;position:relative;overflow:hidden;display:grid;gap:18px;">
        <div style="position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,${theme.glow} 0%,transparent 70%);"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;position:relative;z-index:1;">
          <div>
            <p style="color:#64748b;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 6px;">Featured visual</p>
            <h3 style="color:#0f172a;font-size:24px;font-weight:900;line-height:1.2;margin:0;">${theme.visualHeadline}</h3>
          </div>
          <div style="min-width:70px;height:70px;border-radius:20px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:34px;box-shadow:0 18px 40px rgba(15,23,42,0.14);">${theme.icon}</div>
        </div>
        <div style="background:#fff;border:1px solid #dbeafe;border-radius:22px;padding:18px;box-shadow:0 16px 40px rgba(15,23,42,0.08);display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:center;position:relative;z-index:1;">
          <div style="display:grid;gap:12px;">
            <img src="${featureImage}" alt="${theme.label} featured image" style="display:block;width:100%;height:240px;object-fit:cover;border-radius:20px;box-shadow:0 18px 48px rgba(15,23,42,0.12);" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              ${detailImages.map((image, index) => `<img src="${image}" alt="${theme.services?.[index]?.title || theme.label} image" style="display:block;width:100%;height:132px;object-fit:cover;border-radius:18px;border:1px solid #dbeafe;box-shadow:0 12px 32px rgba(15,23,42,0.08);" />`).join('')}
            </div>
          </div>
          <div style="display:grid;gap:10px;">
            <div style="background:#f8fafc;border:1px solid #dbeafe;border-radius:16px;padding:12px 14px;">
              <p style="color:#64748b;font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 4px;">Company logo</p>
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;flex-shrink:0;">${serviceInitials(theme.logo)}</div>
                <div>
                  <p style="color:#0f172a;font-size:15px;font-weight:800;margin:0;">${theme.logo}</p>
                  <p style="color:#64748b;font-size:13px;margin:2px 0 0;">${theme.logoTagline}</p>
                </div>
              </div>
            </div>
            ${theme.heroChecks.map((item) => `<div style="background:#fff;border:1px solid #dbeafe;border-radius:16px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 10px 24px rgba(15,23,42,0.06);"><span style="width:24px;height:24px;border-radius:50%;background:${theme.accent};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#0f172a;font-size:14px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#64748b;font-size:13px;line-height:1.5;margin:0;">${item.text}</p></div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}


export function buildServiceHeroSection(theme) {
  const heroImage = getServiceImageUrl(theme, 'hero', {
    title: theme.label,
    subtitle: theme.visualHeadline,
    caption: theme.services?.[0]?.title,
    slot: 'hero-main',
  });

  return `<section style="${F}position:relative;overflow:hidden;padding:96px 24px;background-image:linear-gradient(90deg,rgba(15,23,42,0.86) 0%,rgba(15,23,42,0.7) 40%,rgba(15,23,42,0.46) 100%),radial-gradient(circle at 15% 15%,${theme.glow} 0%,transparent 26%),radial-gradient(circle at 85% 10%,rgba(255,255,255,0.10) 0%,transparent 22%),url('${heroImage}'),linear-gradient(135deg,${theme.accentDark} 0%,${theme.accent} 52%,#0f172a 100%);background-size:cover,auto,auto,cover,cover;background-position:center,center,center,center,center;">
  <div style="max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:42px;align-items:center;">
    <div style="display:grid;gap:22px;align-content:start;">
      <div style="display:inline-flex;align-items:center;gap:14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:999px;padding:12px 18px;width:max-content;max-width:100%;box-sizing:border-box;">
        <div style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;flex-shrink:0;">${serviceInitials(theme.logo)}</div>
        <div>
          <p style="color:#dbeafe;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;margin:0 0 2px;">Company logo</p>
          <p style="color:#fff;font-size:15px;font-weight:800;margin:0;">${theme.logo}</p>
        </div>
      </div>
      <p style="color:${theme.badgeColor};font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">${theme.badge}</p>
      <h1 style="color:#fff;font-size:58px;font-weight:900;line-height:1.06;margin:0;max-width:760px;">${theme.headline}</h1>
      <p style="color:rgba(255,255,255,0.86);font-size:21px;line-height:1.7;margin:0;max-width:700px;">${theme.subheadline}</p>
      <div style="display:grid;gap:12px;max-width:660px;">
        ${theme.highlights.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;"><span style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#fff;font-size:17px;font-weight:800;line-height:1.4;margin:0 0 4px;">${item.title}</p><p style="color:#dbeafe;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;">
        <a href="#quote" style="display:inline-block;background:#fff;color:${theme.accentDark};padding:20px 34px;border-radius:999px;font-size:18px;font-weight:900;text-decoration:none;box-shadow:0 18px 50px rgba(2,6,23,0.26);">${theme.cta}</a>
        <span style="display:inline-flex;align-items:center;gap:10px;color:#dbeafe;font-size:16px;font-weight:700;">${theme.secondaryIcon} ${theme.responseLine}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;max-width:760px;">
        ${theme.stats.map((item) => `<div style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:18px 16px;"><p style="color:#fff;font-size:28px;font-weight:900;line-height:1;margin:0 0 6px;">${item.value}</p><p style="color:#dbeafe;font-size:14px;line-height:1.5;margin:0;">${item.label}</p></div>`).join('')}
      </div>
    </div>
    ${buildServiceShowcase(theme)}
  </div>
</section>`;
}


export function buildServiceOffersSection(theme) {
  return `<section style="${F}background:linear-gradient(180deg,${theme.accentSoft} 0%, #f8fafc 34%, #eef2ff 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'hero', height: 360, title: theme.sectionHeadline, subtitle: theme.sectionIntro, eyebrow: 'Service scope', overlayStart: 0.38, overlayEnd: 0.14 })}
  <div style="max-width:1160px;margin:0 auto;padding:88px 24px;">
    <p style="text-align:center;color:${theme.accent};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">What this page is built to sell</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;line-height:1.15;margin:0 0 16px;">${theme.sectionHeadline}</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;line-height:1.7;max-width:760px;margin:0 auto 52px;">${theme.sectionIntro}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;align-items:stretch;">
      ${theme.services.map((service, index) => `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:18px;box-shadow:0 18px 48px rgba(15,23,42,0.06);display:grid;gap:14px;overflow:hidden;">
        <img src="${getServiceImageUrl(theme, 'card', { title: service.title, subtitle: theme.label, caption: service.title, slot: `service-card-${index}`, icon: service.icon || theme.icon, secondaryIcon: theme.secondaryIcon })}" alt="${service.title} image" style="display:block;width:100%;height:180px;object-fit:cover;border-radius:18px;" />
        <div style="width:56px;height:56px;border-radius:18px;background:${index % 2 === 0 ? `linear-gradient(135deg,${theme.accentSoft},#ffffff)` : `linear-gradient(135deg,#ffffff,${theme.accentSoft})`};display:flex;align-items:center;justify-content:center;font-size:26px;">${service.icon}</div>
        <h3 style="color:#0f172a;font-size:24px;font-weight:800;line-height:1.2;margin:0;">${service.title}</h3>
        <p style="color:#475569;font-size:17px;line-height:1.7;margin:0;">${service.text}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}


export function buildServiceProofSection(theme) {
  const archetype = getServiceArchetype(theme);
  const proofHeading = archetype === 'premium-visual'
    ? 'Use this section to sell the finish, the care, and the visible outcome'
    : archetype === 'emergency-response'
      ? 'Use this section to reassure fast-moving leads before they bounce'
      : archetype === 'maintenance-plan'
        ? 'Use this section to show consistency, service standards, and repeatable quality'
        : 'Use this section to frame the work clearly and make the business feel established';
  const proofIntro = archetype === 'premium-visual'
    ? 'Premium-looking service pages convert better when the work feels tangible. Pair this layout with real project images, vehicle shots, before-and-after examples, or strong finished-job photography.'
    : archetype === 'emergency-response'
      ? 'High-intent service buyers are usually deciding quickly. This section gives them the fast reassurance they need around trust, response, and fit before they submit the form.'
      : archetype === 'maintenance-plan'
        ? 'Recurring local-service businesses win by feeling dependable, not flashy. Use this area to show routine quality, care standards, and why people keep rebooking.'
        : 'Project-led service businesses need a page that feels credible before the quote request. This layout helps you reinforce scope, reliability, and visible proof without falling back into generic filler.';

  return `<section style="${F}background:linear-gradient(180deg,#ffffff 0%, ${theme.accentSoft} 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'gallery', height: 340, title: proofHeading, subtitle: proofIntro, eyebrow: 'Visual proof', overlayStart: 0.42, overlayEnd: 0.16 })}
  <div style="max-width:1160px;margin:0 auto;padding:88px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:26px;align-items:stretch;">
    <div style="background:linear-gradient(135deg,${theme.accentDark},${theme.accent});border-radius:30px;padding:32px;color:#fff;box-shadow:0 26px 72px rgba(15,23,42,0.16);display:grid;gap:18px;">
      <div>
        <p style="color:${theme.badgeColor};font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Visual and trust proof</p>
        <h2 style="font-size:42px;font-weight:900;line-height:1.12;margin:0 0 14px;">${proofHeading}</h2>
        <p style="color:#dbeafe;font-size:18px;line-height:1.75;margin:0;">${proofIntro}</p>
      </div>
      <div style="display:grid;gap:12px;">
        ${theme.heroChecks.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.14);border-radius:18px;padding:14px 16px;"><span style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="font-size:16px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#dbeafe;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
    <div style="display:grid;gap:18px;align-content:start;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:28px;padding:28px;box-shadow:0 18px 48px rgba(15,23,42,0.06);display:grid;gap:18px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;">
          <div>
            <p style="color:${theme.accent};font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:1.8px;margin:0 0 8px;">Suggested proof assets</p>
            <h3 style="color:#0f172a;font-size:28px;font-weight:900;line-height:1.15;margin:0;">${theme.visualHeadline}</h3>
          </div>
          <div style="min-width:62px;height:62px;border-radius:18px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;box-shadow:0 16px 40px rgba(15,23,42,0.12);">${theme.icon}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;">
          ${theme.stats.map((item) => `<div style="background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:18px 16px;"><p style="color:${theme.accentDark};font-size:24px;font-weight:900;line-height:1;margin:0 0 6px;">${item.value}</p><p style="color:#64748b;font-size:14px;line-height:1.5;margin:0;">${item.label}</p></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
          ${(theme.services || []).slice(0, 3).map((service, index) => `<div style="display:grid;gap:10px;">
            <img src="${getServiceImageUrl(theme, 'gallery', { title: service.title, subtitle: index === 0 ? theme.visualHeadline : theme.heroVisualTagline, caption: service.title, slot: `proof-gallery-${index}`, icon: service.icon || theme.icon, secondaryIcon: theme.secondaryIcon })}" alt="${service.title} gallery image" style="display:block;width:100%;height:160px;object-fit:cover;border-radius:20px;box-shadow:0 16px 36px rgba(15,23,42,0.08);" />
            <p style="color:#475569;font-size:14px;line-height:1.5;margin:0;">${service.title}</p>
          </div>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
        ${theme.trustPoints.map((item) => `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:22px;box-shadow:0 16px 40px rgba(15,23,42,0.05);display:grid;gap:10px;"><span style="font-size:24px;line-height:1;">${item.icon}</span><p style="color:#0f172a;font-size:18px;font-weight:800;line-height:1.35;margin:0;">${item.title}</p><p style="color:#475569;font-size:15px;line-height:1.7;margin:0;">${item.text}</p></div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
}


export function buildServiceDifferenceSection(theme) {
  return `<section style="${F}background:#fff;padding:88px 24px;">
  <div style="max-width:1120px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px;align-items:start;">
    <div style="background:linear-gradient(180deg,#ffffff,#f8fafc);border:1px solid #e2e8f0;border-radius:28px;padding:32px;box-shadow:0 18px 48px rgba(15,23,42,0.06);">
      <p style="color:${theme.accent};font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Why customers choose this offer</p>
      <h2 style="color:#0f172a;font-size:42px;font-weight:900;line-height:1.15;margin:0 0 18px;">${theme.differenceHeadline}</h2>
      <p style="color:#475569;font-size:18px;line-height:1.75;margin:0 0 26px;">${theme.differenceIntro}</p>
      <div style="display:grid;gap:14px;">
        ${theme.differentiators.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:16px 18px;"><span style="width:28px;height:28px;border-radius:50%;background:${theme.accent};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#0f172a;font-size:17px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#64748b;font-size:15px;line-height:1.6;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
    <div style="display:grid;gap:18px;">
      <div style="background:linear-gradient(135deg,${theme.accentDark},${theme.accent});border-radius:28px;padding:30px;color:#fff;box-shadow:0 24px 72px rgba(15,23,42,0.14);">
        <p style="color:rgba(255,255,255,0.78);font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">How the page flows</p>
        <h3 style="font-size:30px;font-weight:900;line-height:1.15;margin:0 0 16px;">Built to convert quote-ready visitors into booked work</h3>
        <div style="display:grid;gap:12px;">
          ${theme.process.map((step, index) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;"><div style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;flex-shrink:0;">${index + 1}</div><div><p style="font-size:16px;font-weight:800;margin:0 0 4px;">${step.title}</p><p style="color:#dbeafe;font-size:14px;line-height:1.55;margin:0;">${step.text}</p></div></div>`).join('')}
        </div>
      </div>
      <div style="background:#0f172a;border-radius:28px;padding:28px;display:grid;gap:12px;box-shadow:0 18px 48px rgba(15,23,42,0.12);">
        <p style="color:#93c5fd;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">Trust signals</p>
        ${theme.trustPoints.map((item) => `<div style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px 16px;"><span style="font-size:18px;line-height:1;">${item.icon}</span><div><p style="color:#fff;font-size:16px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#cbd5e1;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
}


export function buildServiceTestimonialsSection(theme) {
  return `<section style="${F}background:linear-gradient(180deg,${theme.accentDark} 0%, #0f172a 28%, #f8fafc 28%, #f8fafc 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'gallery', height: 320, title: 'Trade-specific proof should look visual, not generic.', subtitle: `Real ${theme.label.toLowerCase()} pages convert harder when the proof feels tied to visible work and real customers.`, eyebrow: 'Customer proof', overlayStart: 0.52, overlayEnd: 0.22, tint: `linear-gradient(135deg, ${theme.accentDark}66, ${theme.accent}33)` })}
  <div style="max-width:1120px;margin:0 auto;padding:88px 24px;">
    <p style="text-align:center;color:${theme.accent};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Recent customer feedback</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;line-height:1.15;margin:0 0 16px;">Proof that feels believable because it is specific</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;line-height:1.7;max-width:760px;margin:0 auto 52px;">These examples are written for ${theme.customerGroup.toLowerCase()}, not supplements, info products, or generic ecommerce offers.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">
      ${theme.testimonials.map((item) => `<div style="background:#fff;border-radius:24px;padding:30px;border:1px solid #e2e8f0;box-shadow:0 18px 44px rgba(15,23,42,0.06);display:grid;gap:18px;">
        <div style="color:#f59e0b;font-size:24px;letter-spacing:2px;">★★★★★</div>
        <p style="color:#334155;font-size:18px;line-height:1.78;margin:0;">"${item.quote}"</p>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:50px;height:50px;border-radius:16px;background:linear-gradient(135deg,${theme.accent},${theme.accentDark});display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;flex-shrink:0;">${item.name.charAt(0)}</div>
          <div><p style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">${item.name}</p><p style="margin:4px 0 0;font-size:14px;color:#64748b;">${item.meta}</p></div>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`;
}


export function buildServiceFaqSection(theme) {
  return `<section style="${F}background:linear-gradient(180deg,#ffffff 0%, ${theme.accentSoft} 100%);">
  ${buildServiceSectionImageBand(theme, { variant: 'card', height: 280, title: 'Answer the questions people ask before they enquire.', subtitle: 'Clear answers work better when they sit inside a section that still feels designed, visual, and specific to the trade.', eyebrow: 'FAQ section', overlayStart: 0.4, overlayEnd: 0.14 })}
  <div style="max-width:860px;margin:0 auto;padding:88px 24px;">
    <p style="text-align:center;color:${theme.accent};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Questions customers actually ask</p>
    <h2 style="text-align:center;color:#0f172a;font-size:46px;font-weight:900;line-height:1.15;margin:0 0 16px;">Frequently asked questions</h2>
    <p style="text-align:center;color:#64748b;font-size:20px;line-height:1.7;max-width:720px;margin:0 auto 48px;">Clear, service-relevant answers reduce friction and make the quote form easier to complete.</p>
    <div style="display:grid;gap:16px;">
      ${theme.faqs.map((item) => `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;padding:22px 24px;"><p style="color:#0f172a;font-size:20px;font-weight:800;line-height:1.4;margin:0 0 10px;">${item.q}</p><p style="color:#475569;font-size:17px;line-height:1.75;margin:0;">${item.a}</p></div>`).join('')}
    </div>
  </div>
</section>`;
}


export function buildServiceQuoteFormSection(theme) {
  return `<section id="quote" style="${F}position:relative;overflow:hidden;padding:92px 24px;background-image:radial-gradient(circle at 12% 18%,${theme.glow} 0%,transparent 22%),linear-gradient(135deg,#0f172a 0%,${theme.accentDark} 58%,${theme.accent} 100%);">
  <div style="max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px;align-items:start;">
    <div style="display:grid;gap:18px;align-content:start;">
      <p style="color:${theme.badgeColor};font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">Request a quote</p>
      <h2 style="color:#fff;font-size:50px;font-weight:900;line-height:1.08;margin:0;">${theme.formHeadline}</h2>
      <p style="color:#dbeafe;font-size:20px;line-height:1.7;margin:0;max-width:640px;">${theme.formIntro}</p>
      <div style="display:grid;gap:12px;max-width:640px;">
        ${theme.formPoints.map((item) => `<div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;"><span style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;">✓</span><div><p style="color:#fff;font-size:16px;font-weight:800;margin:0 0 4px;">${item.title}</p><p style="color:#cbd5e1;font-size:14px;line-height:1.55;margin:0;">${item.text}</p></div></div>`).join('')}
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:30px;padding:28px;backdrop-filter:blur(12px);box-shadow:0 28px 80px rgba(2,6,23,0.32);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        <div>
          <p style="color:#dbeafe;font-size:14px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;margin:0 0 6px;">Fast enquiry form</p>
          <h3 style="color:#fff;font-size:32px;font-weight:900;line-height:1.15;margin:0;">${theme.formCardTitle}</h3>
        </div>
        <span style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:10px 14px;color:#fff;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">${theme.icon} ${theme.formBadge}</span>
      </div>
      <form method="post" action="/api/forms/submit" style="display:grid;gap:14px;">
        <input type="hidden" name="funnel_id" value="" />
        <input type="hidden" name="list_id" value="" />
        <input type="hidden" name="success_url" value="?ok=1" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <input name="name" placeholder="Full name" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
          <input name="phone" type="tel" placeholder="Phone number" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <input name="email" type="email" placeholder="Email address" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
          <input name="suburb" placeholder="Suburb or service area" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;" />
        </div>
        <select name="service_type" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;">
          <option value="">Select the service you need</option>
          ${theme.serviceOptions.map((option) => `<option value="${option}">${option}</option>`).join('')}
        </select>
        <textarea name="details" placeholder="Tell us what you need, what has happened, and any timing requirements" style="padding:18px 20px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(15,23,42,0.34);color:#fff;font-size:17px;outline:none;width:100%;box-sizing:border-box;min-height:150px;resize:vertical;"></textarea>
        <button type="submit" style="padding:20px;border:none;border-radius:18px;background:#fff;color:${theme.accentDark};font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 18px 48px rgba(2,6,23,0.24);">${theme.formCta}</button>
      </form>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:14px 0 0;">${theme.formDisclaimer}</p>
    </div>
  </div>
</section>`;
}
