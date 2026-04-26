const { JSDOM } = require("jsdom");
(async () => {
  const u = "http://localhost:3000/api/templates/import?scope=public&path=templates%2Fconfirm.html&name=confirm";
  const r = await fetch(u);
  const j = await r.json();
  const doc = new JSDOM(j.html).window.document;
  const genericContainer = doc.querySelector('td[role="modules-container"]') || doc.body;
  const genericSections = Array.from(genericContainer.querySelectorAll('tr') || []).filter((el) => {
    if (el.querySelector('tr')) return false;
    const textOnly = String(el.textContent || '').replace(/\s+/g, ' ').replace(/&nbsp;/gi, ' ').trim();
    const meaningfulImages = Array.from(el.querySelectorAll('img[src]')).filter((img) => !/spacer\.gif/i.test(String(img.getAttribute('src') || '')));
    return !!textOnly || meaningfulImages.length > 0 || !!el.querySelector('a[href]');
  });
  console.log('STATUS=' + r.status);
  console.log('GENERIC_SECTION_COUNT=' + genericSections.length);
})();
