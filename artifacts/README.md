# Test and diagnostic output

`test-artifacts/` and `test-results/` were both at the repository root until 2026-09-07 and are
now grouped here. The folder names are unchanged, so paths inside reports read the same with an
`artifacts/` prefix. The ~90 scripts and docs that referenced them were updated in the same
commit. Full relocation map: [`docs/README.md`](../docs/README.md).

| Folder | Written by | Tracked in git? |
|---|---|---|
| `test-artifacts/` | The `scripts/test-*-browser.mjs`, `scripts/audit-*` and recovery scripts — evidence deliberately kept alongside a written report | Yes. The reports in `docs/` cite these paths, so they are committed on purpose |
| `test-results/` | The same browser scripts, for throwaway screenshots of a run | No — git-ignored (`/artifacts/test-results/`). Regenerate by re-running the script |

Both folders are excluded from Vercel deploys via `artifacts/` in `.vercelignore`.

If a screenshot is worth keeping as evidence for a report, put it in `test-artifacts/` under a
folder named for the investigation; otherwise let it land in `test-results/`.
