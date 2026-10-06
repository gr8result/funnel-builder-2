# Deployment and local-environment configs

These five files were at the repository root until 2026-09-07. Each one was adjusted so it
still resolves the repository root correctly from this folder — nothing changed about what
they do. Full relocation map: [`docs/README.md`](../docs/README.md).

| File | Run it with | Root-path fix applied |
|---|---|---|
| `docker-compose.yml` | `docker compose -f deploy/docker-compose.yml up` | Build context is now `../transcribe-local` |
| `docker-compose.onlyoffice.yml` | `docker compose -f deploy/docker-compose.onlyoffice.yml up` | None needed — image-only, no relative paths |
| `docker-compose-sitebuilder.yml` | `docker compose -f deploy/docker-compose-sitebuilder.yml up` | None needed — image-only, no relative paths |
| `ecosystem.config.cjs` | `pm2 start deploy/ecosystem.config.cjs` | Each app sets `cwd: repoRoot`, so `./scripts/...` and `--env-file=.env.local` resolve as before |
| `reset-dev.ps1` | `.\deploy\reset-dev.ps1` | `Set-Location $PSScriptRoot/..` at the top, so it cleans the repo root from anywhere |

The n8n stack is separate and did not move: `docker compose up` inside `n8n-automation/`.
