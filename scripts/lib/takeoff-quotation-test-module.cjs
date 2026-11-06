// Expose the real quotation UI for the isolated Takeoff workflow without mounting
// or initialising unrelated workbook pages. Production source remains untouched.
const ts = require('typescript');
module.exports = function quotationTestModule(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const declarations = new Map();
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name) declarations.set(clause.name.text, statement);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) declarations.set(bindings.name.text, statement);
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) declarations.set(element.name.text, statement);
    } else if (statement.name && ts.isIdentifier(statement.name)) declarations.set(statement.name.text, statement);
    else if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, statement);
    }
  }
  const kept = new Set(), names = new Set(), queue = ['QuotationSheet'];
  while (queue.length) {
    const name = queue.pop();
    if (names.has(name)) continue;
    names.add(name);
    const statement = declarations.get(name);
    if (!statement || ts.isImportDeclaration(statement) || kept.has(statement)) continue;
    kept.add(statement);
    function visit(node) {
      if (ts.isIdentifier(node) && declarations.has(node.text) && !names.has(node.text)) queue.push(node.text);
      ts.forEachChild(node, visit);
    }
    visit(statement);
  }
  const printer = ts.createPrinter();
  const result = [];
  for (const statement of file.statements) {
    if (kept.has(statement)) result.push(statement.getFullText(file));
    else if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      const defaultName = clause.name && names.has(clause.name.text) ? clause.name : undefined;
      let bindings = clause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        const used = bindings.elements.filter(element => names.has(element.name.text));
        bindings = used.length ? ts.factory.updateNamedImports(bindings, used) : undefined;
      } else if (bindings && !names.has(bindings.name.text)) bindings = undefined;
      if (!defaultName && !bindings) continue;
      result.push(printer.printNode(ts.EmitHint.Unspecified, ts.factory.updateImportDeclaration(statement, statement.modifiers,
        ts.factory.updateImportClause(clause, clause.isTypeOnly, defaultName, bindings), statement.moduleSpecifier, statement.attributes), file));
    }
  }
  if (!kept.has(declarations.get('QuotationSheet'))) throw new Error('QuotationSheet was not found in the current workbook source');
  return result.join('\n') + '\nexport { QuotationSheet };';
};
