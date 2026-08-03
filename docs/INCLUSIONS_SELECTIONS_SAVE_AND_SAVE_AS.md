# Inclusions & Selections Save And Save As

Save persists the current selections stage through the existing stage repository/service. The banner displays:

- Saved
- Unsaved Changes
- Saving...
- Save Failed
- Read Only
- Locked Version

Ctrl+S is captured while the module is active and routes through the same Save handler, preventing the browser's Save Page action.

Save As creates a separate project copy with a new project ID and new project context. It requires project name, job number, client and site address. Copy options cover areas, templates and tiers, product selections, pricing and allowances, notes and attachments, and review state.

Client approvals, builder approvals, locked snapshots and export history are excluded by default from Save As.
