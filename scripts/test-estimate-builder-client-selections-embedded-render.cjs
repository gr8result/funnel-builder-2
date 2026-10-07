const fs = require("fs");
const Module = require("module");
const path = require("path");
const React = require("react");
const { renderToString } = require("react-dom/server");
const swc = require("next/dist/build/swc");

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "local-test-anon-key";

const root = process.cwd();
const oldJs = Module._extensions[".js"];

require.extensions[".css"] = function ignoreCss(module) {
  module._compile("", module.filename);
};

Module._extensions[".js"] = function transpileWorkspaceJs(module, filename) {
  if (filename.includes("node_modules")) return oldJs(module, filename);
  const source = fs.readFileSync(filename, "utf8");
  const output = swc.transformSync(source, {
    filename,
    jsc: {
      parser: { syntax: "ecmascript", jsx: true, dynamicImport: true },
      transform: { react: { runtime: "automatic", development: false } },
      target: "es2020",
    },
    module: { type: "commonjs" },
    sourceMaps: false,
  });
  module._compile(output.code, filename);
};

const BuilderSelectionsBookPage = require(path.join(root, "pages/modules/builders/selections-book.js")).default;
const { WorkspaceProvider } = require(path.join(root, "hooks/useWorkspace.js"));

const workbookWithKitchenSelection = {
  rooms: [
    {
      id: "kitchen",
      name: "Kitchen",
      rows: [
        {
          id: "oven-selection",
          item: "Oven",
          selectedProduct: "Westinghouse 600mm Oven",
          selectedCost: 1200,
        },
      ],
    },
  ],
};

const renderCases = [
  {
    name: "empty product library and no project context",
    props: {
      organisationId: "846885cd-25b9-4eca-b9f9-3fd02f5882d8",
      workbook: null,
      projectContext: {},
      fileState: {},
    },
  },
  {
    name: "empty product library with project context",
    props: {
      organisationId: "846885cd-25b9-4eca-b9f9-3fd02f5882d8",
      workbook: null,
      projectContext: {
        organisationId: "846885cd-25b9-4eca-b9f9-3fd02f5882d8",
        projectName: "Embedded Client Selections Render Test",
      },
      fileState: { fileName: "embedded-test.xlsx" },
    },
  },
  {
    name: "missing optional catalogue families with embedded workbook",
    props: {
      organisationId: "846885cd-25b9-4eca-b9f9-3fd02f5882d8",
      workbook: workbookWithKitchenSelection,
      projectContext: {
        organisationId: "846885cd-25b9-4eca-b9f9-3fd02f5882d8",
        projectName: "Embedded Client Selections Render Test",
      },
      fileState: { fileName: "embedded-test.xlsx" },
    },
  },
];

try {
  for (const renderCase of renderCases) {
    const html = renderToString(
      React.createElement(
        WorkspaceProvider,
        null,
        React.createElement(BuilderSelectionsBookPage, {
          ...renderCase.props,
          onEmbeddedMount: () => {},
        })
      )
    );

    if (!html.includes("Client Selections") && !html.includes("Selections")) {
      throw new Error(`${renderCase.name} rendered without expected selections content.`);
    }
  }

  console.log("Embedded Client Selections render smoke passed.");
} catch (error) {
  console.error("Embedded Client Selections render smoke failed.");
  console.error(error?.stack || error);
  process.exit(1);
}
