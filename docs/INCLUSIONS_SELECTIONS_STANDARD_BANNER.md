# Inclusions & Selections Standard Banner

`InclusionsSelectionsPageBanner` is the shared page banner for the main Inclusions & Selections routes.

It renders below the app header and above stage navigation on:

- `/inclusions-selections/areas`
- `/inclusions-selections/templates`
- `/inclusions-selections/workspace`
- `/inclusions-selections/review`
- `/inclusions-selections/approvals`
- `/inclusions-selections/documents-export`

The banner uses the standard module hierarchy: 48px icon, 48px/600 heading, 18px subtitle, compact project/file details and visible file actions. Tablet and mobile layouts wrap the same controls without hiding Open File or Save.

When no file is open, the banner remains visible and the route shows the shared `InclusionsSelectionsNoFileState` instead of the normal workflow editor.
