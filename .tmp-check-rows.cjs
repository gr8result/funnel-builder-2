const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync("email/confirm.html", "utf8");
const doc = new JSDOM(html).window.document;
const rows = Array.from(doc.querySelectorAll('tr')).filter((el) => {
  if (el.querySelector('tr')) return false;
  const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  const imgs = Array.from(el.querySelectorAll('img[src]')).filter((img) => !/spacer\.gif/i.test(String(img.getAttribute('src') || '')));
  return !!text || imgs.length > 0 || !!el.querySelector('a[href]');
});
console.log('ROW_COUNT=' + rows.length);
console.log('FIRST_ROW_HTML=' + rows[0].innerHTML.slice(0,300));
