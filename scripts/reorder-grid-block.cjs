const fs = require('fs');
const vm = require('vm');

const filePath = 'public/inject-ls.js';
const content = fs.readFileSync(filePath, 'utf8');

const captured = {};
const sandbox = {
  localStorage: { setItem: (k, v) => { captured[k] = v; } },
  console: { log: () => {} }
};
vm.runInNewContext(content, sandbox);

function moveGridAfterMarquees(blocks) {
  const marqueeIndices = blocks.reduce((a, b, i) => b.type === 'marquee-strip' ? [...a, i] : a, []);
  const gridIdx = blocks.findIndex(b => b.type === 'grid-section');
  const lastMarqueeIdx = marqueeIndices[marqueeIndices.length - 1];
  if (gridIdx !== -1 && lastMarqueeIdx !== undefined && gridIdx > lastMarqueeIdx + 1) {
    const [grid] = blocks.splice(gridIdx, 1);
    blocks.splice(lastMarqueeIdx + 1, 0, grid);
    console.log(`Moved grid-section from index ${gridIdx} to ${lastMarqueeIdx + 1}`);
  } else {
    console.log(`No move needed (gridIdx=${gridIdx}, lastMarqueeIdx=${lastMarqueeIdx})`);
  }
  return blocks;
}

const projects = JSON.parse(captured['gr8:website-projects:v1']);
projects[0].pageBlocks.Home = moveGridAfterMarquees(projects[0].pageBlocks.Home);

const overrides = JSON.parse(captured['gr8:website-template-overrides:v1']);
overrides['business-solution-template'].pageBlocks.Home = moveGridAfterMarquees(overrides['business-solution-template'].pageBlocks.Home);

const p = JSON.stringify(JSON.stringify(projects));
const o = JSON.stringify(JSON.stringify(overrides));
const newContent = `(function(){localStorage.setItem('gr8:website-projects:v1',${p});localStorage.setItem('gr8:website-template-overrides:v1',${o});console.log('injected ok');})();`;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Done - inject-ls.js updated.');
