const fs = require('fs');
const path = require('path');
const { transformSync } = require('next/dist/build/swc');

const sourcePath = path.join(process.cwd(), 'components/email/editor2/EmailEditor.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const transformed = transformSync(source, {
  jsc: {
    parser: { syntax: 'ecmascript', jsx: true },
    transform: { react: { runtime: 'automatic' } },
  },
  module: { type: 'commonjs' },
});

const mod = { exports: {} };
const fn = new Function('require', 'module', 'exports', transformed.code);
fn(require, mod, mod.exports);

const { exportFullHtml } = mod.exports;

const blocks = [
  {
    id: 'b1',
    type: 'imageText',
    props: {
      imageSrc: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      overlayImageSrc: 'https://dummyimage.com/320x140/ffffff/1e3a8a.png&text=LOGO',
      headline: 'Text over your image',
      subtext: 'Add a headline and supporting copy directly on top of the image.',
      buttonText: 'Learn More',
      href: '#',
      textColor: '#ffffff',
      headlineColor: '#facc15',
      subtextColor: '#ffffff',
      headlineSize: 30,
      subtextSize: 15,
      buttonBgColor: '#f97316',
      buttonTextColor: '#ffffff',
      overlayShade: 'rgba(15,23,42,0.20)',
      overlayImageX: 50,
      overlayImageY: 18,
      overlayImageWidthPct: 24,
      overlayImageHeightPx: 72,
      overlayImageRadius: 0,
      headlineX: 50,
      headlineY: 56,
      headlineBoxWidthPct: 78,
      headlineBoxHeightPx: 84,
      subtextX: 50,
      subtextY: 70,
      subtextBoxWidthPct: 84,
      subtextBoxHeightPx: 60,
      buttonX: 50,
      buttonY: 84,
      buttonBoxWidthPct: 36,
      buttonBoxHeightPx: 56,
      height: 320,
    },
  },
];

const settings = {
  outerBgColor: '#dbeafe',
  outerBgImageSrc: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  outerBgRepeat: 'no-repeat',
  canvasWidth: 600,
  canvasBgColor: '#ffffff',
  canvasRadius: 0,
};

const html = exportFullHtml(blocks, 'Debug Email', settings);
const outputPath = path.join(process.cwd(), 'tmp', 'email-debug-export.html');
fs.writeFileSync(outputPath, html);
console.log('wrote', outputPath);
const marker = '<td style="padding:28px;">';
const start = html.indexOf(marker);
if (start === -1) {
  console.log('marker not found');
  process.exit(0);
}
console.log(html.slice(start, start + 2200));
