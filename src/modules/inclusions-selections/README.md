# Inclusions and Selections

This is a clean top-down rebuild.

Required architecture:

Project
→ Areas and rooms
→ Area types
→ Area groups
→ Room templates
→ Selection requirements
→ Inclusion tiers
→ Product selections
→ Pricing and variations
→ Approvals
→ Locked snapshots
→ Estimate export

Rules:

- No legacy selections business logic may be imported.
- No product-first workflow may be restored.
- Products cannot create or imply project rooms.
- Draft selections cannot directly alter an approved estimate.
- The new module must remain isolated from the retired interface.

Do not add working selections features yet.
