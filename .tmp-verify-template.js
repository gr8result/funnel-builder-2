const { JSDOM } = require("jsdom");
(async () => {
  const u = "http://localhost:3000/api/templates/import?scope=public&path=templates%2Fconfirm.html&name=confirm";
  const r = await fetch(u);
  const j = await r.json();
  const doc = new JSDOM(j.html).window.document;
  const container = doc.querySelector('td[role="modules-container"]') || doc.body;
  const sections = Array.from(container.children || []).filter((el) => {
    const tag = String(el.tagName || '').toLowerCase();
    if (!tag || ['script','style','meta','link'].includes(tag)) return false;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    return !!text || !!el.querySelector('img,a');
  });
  console.log('STATUS=' + r.status);
  console.log('SECTION_COUNT=' + sections.length);
  console.log('IMG_COUNT=' + doc.querySelectorAll('img').length);
})();
