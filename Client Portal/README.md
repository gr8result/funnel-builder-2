# Client Portal

This folder owns the client-facing Project Workspace portal.

Portal UI, route bridging, API data shaping, and portal-specific helpers should live here. Next.js route files and shared navigation entries can stay in the platform folders, but they should be thin wrappers or links into this folder.

Security defaults:

- Do not render or import the Project Estimate editor for portal views.
- Do not expose internal rates, costs, margins, BOQ costing, missing-rate warnings, RFIs, staff notes, or procurement pricing.
- Treat records as hidden unless they are explicitly marked client-visible or published.
- Client access must be checked server-side before returning project data.
