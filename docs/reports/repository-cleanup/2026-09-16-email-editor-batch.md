# Email editor decomposition batch — 2026-09-16

Scope: structural decomposition of the existing email editor. No layouts, HTML output, storage keys, API requests, product records, or editing behavior were redesigned. No files were deleted. No commit, push, merge, or deployment was performed.

The email editor folder and broadcast consumer were clean in Git before editing, with the editor last modified on July 6. The appliance catalogue and recovery work were excluded from this batch.

## Result and ownership

`components/email/editor2/EmailEditor.jsx` decreased from **6,719 to 955 lines**. Its extracted components, model/configuration, helpers, hooks, styles, and tests remain inside `components/email/editor2/`. Every extracted implementation file is below 1,000 lines. The main file now composes these pieces and retains document initialization, block mutation coordination, upload/export actions, and the central canvas composition.

`pages/modules/email/broadcast/index.js` changed only its named imports: HTML export and settings extraction now come directly from their owning modules. Its line count changed from 1,559 to 1,560. The email editor route continues dynamically importing the same default editor component. No compatibility re-export shim remains.

| New file under `components/email/editor2/` | Lines | Responsibility |
| --- | ---: | --- |
| `editorUtils.js` | 70 | IDs, cloning, escaping, URLs, sizing helpers |
| `richTextCommands.js` | 369 | DOM selection and rich-text editing commands |
| `alignmentGuides.js` | 59 | Canvas guide DOM lifecycle |
| `colors.js` | 71 | Color parsing, contrast, overlay colors |
| `socialAssets.js` | 115 | Social icon assets and export URLs |
| `editorOptions.js` | 145 | Field options, fonts, block catalogue |
| `blockModel.js` | 497 | Block defaults, normalization, grouping, saved settings |
| `htmlExport.js` | 540 | Email HTML rendering |
| `canvasControls.jsx` | 303 | Image, resize, overlay, and link controls |
| `richTextCanvas.jsx` | 495 | Editable text and existing active editor binding |
| `canvasRenderers.jsx` | 846 | Block canvas renderers |
| `inspectorFields.jsx` | 510 | Inspector fields and toolbar input controls |
| `blockInspectors.jsx` | 653 | Block-specific inspector components |
| `textToolbar.jsx` | 288 | Text ribbon and floating toolbar |
| `editorControls.jsx` | 167 | Catalogue/file buttons and drop zones |
| `BlockWrapper.jsx` | 108 | Block selection/actions container |
| `useEditorMedia.js` | 139 | Image edit/library/AI modal state and callbacks |
| `useSavedBlocks.js` | 39 | Saved-block localStorage and insertion |
| `useDocumentPersistence.js` | 187 | Thumbnail capture, save payload, Save and Save As |
| `editorStyles.jsx` | 185 | Existing injected and rendered CSS |
| `EditorInspector.jsx` | 94 | Inspector sidebar composition |
| `tests/export-contract.test.mjs` | 69 | Saved metadata, grouping, links, escaping, supported block export |

## Preservation checks

- Initial extraction preserved all 140 top-level declarations exactly except export modifiers; later main-component extraction moved existing callback and JSX bodies unchanged. The final check confirmed all 139 non-main declarations still match the original exactly except export modifiers.
- All **71 original main-component hook expressions** remain identical and execute in the same flattened order. State initialization, effect bodies, callback dependencies, and storage keys were preserved.
- The existing mutable `activeRichTextApi` binding remains a single exported live binding. Its writers moved together; other components and the persistence hook read that same binding.
- All relative imports resolved and all 27 module files form an import graph without cycles. Next successfully compiled both runtime consumer routes after the final hook extraction.
- **57 baseline comparisons** passed for exact HTML/settings/model output: all 18 block types at actual canvas widths 420/600/900, plus empty, grouped/settings, and unknown-block cases.
- **42 complete SSR markup comparisons** matched the original editor: all 18 default block types, grouped grid/list cards, and an empty editor, in both editor and preview modes. This validates unchanged markup/styles for those initial states; it does not claim a full authenticated interactive browser regression.

## Repeatable tests and checks

```powershell
node --test components/email/editor2/tests/export-contract.test.mjs
```

Result: **21 tests passed**. The grouped-card test uses image URLs because existing email HTML attaches card links to images. No runtime behavior was changed to satisfy the test.

Browser-aware ESLint over the email module and broadcast consumer passed with **zero errors**. It reported 19 warnings, compared with 14 before hook extraction. The five additional warnings arise because existing stable React state setters and a `useRef` result are parameters of the extracted hooks; ESLint cannot infer their stable identities. Comments record that contract. Callback dependency arrays were retained to preserve behavior. The other warnings concern existing image elements and hook dependencies.

The repository's separate `check-undefined-identifiers.mjs` helper reports `NodeFilter` twice in both the original file and its extracted counterpart because its browser-global allowlist omits `NodeFilter`. Browser-aware ESLint recognizes that standard DOM global and reported no undefined names. No unrelated checker configuration was changed.

`git diff --check` passed for the changed tracked files.

The parent-owned isolated Next server at `http://127.0.0.1:3108` returned HTTP 200, the expected Next page ID, and no Next error for both routes after final extraction:

- `/modules/email/editor`
- `/modules/email/broadcast`

No files in the email editor implementation remain above 1,000 lines. The separate email route (outside this batch) and broadcast page remain candidates in the repository-wide oversized-file inventory; the broadcast page received only the required import migration.
