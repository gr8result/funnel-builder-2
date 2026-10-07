This is a [Next.js](https://nextjs.org) project.

## Repository layout

| Path | What lives there |
|---|---|
| `pages/`, `components/`, `hooks/`, `lib/`, `styles/` | The Next.js application |
| `modules/`, `platform-core/`, `services/` | Feature modules and shared platform services |
| `data/` | Curated product data (`product-library/`) and catalogue working data (`catalogue/`) |
| `supabase/` | Migrations and schema |
| `scripts/` | Generators, importers, audits, and browser regression scripts |
| `docs/` | All written documentation - start at [`docs/README.md`](docs/README.md) |
| `deploy/` | docker-compose files, the pm2 ecosystem config, and `reset-dev.ps1` |
| `artifacts/` | Test and diagnostic output (`test-artifacts/` is kept, `test-results/` is git-ignored) |
| `archive/` | Local one-off snapshots that are not a source of truth |

Around 60 report, CSV and config files used to sit at the repository root. They were relocated
on 2026-09-07; [`docs/README.md`](docs/README.md) carries the full old-path to new-path map, and
`git log --follow <new path>` still shows each file's complete history.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
