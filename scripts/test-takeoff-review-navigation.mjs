import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Run only actual startup statements before the manual capture handshake.
// Files, HTTP, Chrome, Puppeteer, and authentication remain entirely stubbed.
for (const [filename, handshake] of [['start-real-review-browser.mjs', 'authenticated'], ['capture-real-runtime.mjs', 'exported']]) {
  const file = path.resolve('artifacts/test-results/takeoff-precommit-review', filename);
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const prefix = [];
  let boundaryFound = false;
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement)) continue;
    if (ts.isExpressionStatement(statement) && ts.isAwaitExpression(statement.expression) && statement.expression.expression.getText(ast) === handshake) {
      boundaryFound = true;
      break;
    }
    prefix.push(statement.getText(ast));
  }
  assert.ok(boundaryFound, `${filename}: preserve the explicit capture handshake`);
  const writes = [];
  const launches = [];
  const logs = [];
  const server = { listen: (...args) => args.at(-1)(), address: () => ({ port: 40123 }) };
  const env = {
    fs: { writeFileSync: (file, contents) => writes.push({ file, contents }) },
    path,
    http: { createServer: () => server },
    crypto: { randomBytes: () => ({ toString: () => '0123456789abcdef0123456789abcdef012345' }) },
    os: {},
    spawn: (...args) => { launches.push(args); return { unref() {} }; },
    puppeteer: { launch: (...args) => { launches.push(args); throw new Error('Unexpected automatic browser launch'); } },
    console: { log: (...args) => logs.push(args.join(' ')) },
  };
  await new Function(...Object.keys(env), `return (async () => {\n${prefix.join('\n')}\n})();`)(...Object.values(env));
  assert.equal(launches.length, 0, `${filename}: startup must not launch Chrome or replace the active takeoff tab`);
  assert.equal(writes.length, 1, `${filename}: preserve the generated review page`);
  const expectedUrl = `http://localhost:3000/${path.basename(writes[0].file)}`;
  assert.ok(logs.some((line) => line.includes(expectedUrl)), `${filename}: print the exact manual review URL`);
  const html = writes[0].contents;
  assert.ok(html.includes('<script'), `${filename}: retain the existing capture feature`);
  assert.doesNotMatch(html, /http-equiv\s*=\s*["']?refresh\b/i, `${filename}: no automatic HTML redirect`);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  for (const script of scripts) {
    const browserAst = ts.createSourceFile('review-inline.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const hasLocalOpen = browserAst.statements.some((statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === 'open'
      || ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => declaration.name.getText(browserAst) === 'open'));
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(browserAst);
        assert.doesNotMatch(callee, /(?:^|\.)location\.(?:assign|replace|reload)$|^window\.open$/, `${filename}: generated page must not navigate automatically`);
        if (!hasLocalOpen) assert.notEqual(callee, 'open', `${filename}: no automatic global window open`);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        assert.doesNotMatch(node.left.getText(browserAst), /^(?:(?:window|document)\.)?location(?:\.href)?$/, `${filename}: generated page must not overwrite app location`);
      }
      ts.forEachChild(node, visit);
    }
    visit(browserAst);
  }
}
console.log('Takeoff review navigation checks passed: actual startup scripts launch no browser before the manual handshake, print their review URLs, and generate pages with no automatic navigation.');
