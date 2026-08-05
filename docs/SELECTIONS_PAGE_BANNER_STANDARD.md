# Selections Page Banner Standard

Every Inclusions & Selections workflow page starts with the shared banner component:

`src/modules/inclusions-selections/components/InclusionsSelectionsProjectBanner.tsx`

Banner content:

- Inclusions & Selections icon at approximately 48px.
- Title: `Inclusions & Selections`.
- Subtitle: `Choose project areas, select products and finishes, and prepare the completed selections schedule.`
- Project name, job number, client, site address, current file name and current section.
- Back button.
- Local file controls where available: New, Open File, Save, Save As and File menu.

Routes using the banner:

- `/inclusions-selections/areas`
- `/inclusions-selections/templates`
- `/inclusions-selections/workspace`
- `/inclusions-selections/review`
- `/inclusions-selections/approvals`
- `/inclusions-selections/documents-export`
- `/inclusions-selections/procurement`
- `/modules/builders/product-library?tab=selections`

The banner wraps on tablet and mobile. The mobile layout keeps Back and Save visible while secondary file actions remain available through the File menu.
