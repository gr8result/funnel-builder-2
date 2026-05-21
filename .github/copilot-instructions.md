# AI Coding Agent Instructions for Funnel Builder

## Architecture Overview
This is a Next.js-based funnel builder application with modular components for sales funnels, CRM, email marketing, automation, and more. Key architectural elements:

- **Frontend**: Next.js with React components organized by feature (e.g., `/components/automation/`, `/components/email/`)
- **Backend**: Supabase for data storage and authentication
- **Integrations**: Stripe (payments), Twilio (telephony), SendGrid (email), OpenAI (AI features), n8n (advanced automation workflows)
- **Data Flow**: UI components → `/lib/` utility functions → Supabase API calls or external service integrations
- **Builders**: Uses ReactFlow for flow diagrams, Craft.js/GrapesJS for drag-and-drop page/website building

## Key Directories & Files
- `/components/`: Feature-organized React components (automation, crm, email, etc.)
- `/lib/`: Core utilities and service integrations (supabaseAdmin.js, sendEmail.js, etc.)
- `/data/`: Static data files (pricing.js, website-templates.js)
- `/pages/`: Next.js pages/routes
- `/n8n-automation/`: Docker setup for n8n workflow automation
- `reset-dev.ps1`: PowerShell script for full development environment reset

## Development Workflows
- **Start dev server**: `npm run dev` (runs Next.js dev server)
- **Full reset**: Run `.\reset-dev.ps1` to clean caches, reinstall deps, and restart (useful when builds break)
- **n8n automation**: `docker-compose up` in `/n8n-automation/` for workflow testing
- **Environment**: Requires `.env.local` with Supabase, SendGrid, Stripe, Twilio keys

## Coding Patterns & Conventions
- **Error Handling**: Graceful fallbacks for missing env vars (e.g., sendEmail.js skips if SENDGRID_API_KEY absent)
- **Component Structure**: Feature-based organization with shared UI in `/components/ui/`
- **Data Fetching**: Direct Supabase calls via `supabaseAdmin` client in lib functions
- **Flows**: Use ReactFlow with custom node types (trigger, email, delay, condition) in FlowCanvas component
- **Builders**: GrapesJS for email/website editing, Craft.js for page building
- **State Management**: Zustand for global state where needed

## Integration Points
- **Supabase**: Primary data store; use `supabaseAdmin` for server-side operations
- **External APIs**: Wrapped in `/lib/` with consistent error handling (ok/error response pattern)
- **n8n**: For complex automations beyond basic flows
- **File Handling**: Supabase storage via `supabaseFiles.js`

## Common Tasks
- Adding new funnel nodes: Extend node types in AutomationBuilder.js and NodeRenderer.js
- New integrations: Add to `/lib/` with graceful config checks
- UI components: Follow existing patterns in `/components/ui/` for consistency

## Website Builder - Design Generation
- AI site generation: `pages/api/website/generate-site-content.js`
- The AI is asked to return a `design` object with: `personality`, `heroVariant`, `featureVariant`, `statsVariant`, `testimonialVariant`, color tokens (`colorPrimary`, `colorAccent`, `colorBg`, `colorSurface`, `colorText`, `heroGradient`, `ctaGradient`)
- Industry defaults in `industryDefaults` map provide fallbacks when AI design tokens are absent
- Design tokens flow through `normalizeAiPayload` → `siteContent.design` → `buildProjectBlueprint` resolved variables
- Available heroVariant: `split | editorial | framed | spotlight`
- Available featureVariant: `glass-cards | editorial-strip | minimal-list | cards`
- Available statsVariant: `spotlight-orbs | split-scoreboard | minimal-ticker | data-ribbon | editorial-band`
- Available testimonialVariant: `wall | spotlight | bubble | stacked-card | split-banner`
- SaaS industry always overrides to `split` hero, `split-scoreboard` stats, `wall` testimonials

## Website Builder - Key Data
- Real site row ID: `3fa13735-b2d1-42de-ab37-5e4560909dee`
- Real site project_id: `5179b554-6092-4148-a3d8-256f0d91a3ed`
- Published rows always beat draft rows in deduplication — never delete published rows
- User ID: `35ab846e-0764-498b-b1f8-7d2cf27d85a5`</content>
<parameter name="filePath">c:\Users\grant\dev\funnel-builder-clean\.github\copilot-instructions.md