# BabbleDeck Agent Daily Checklist

Use this before and after every long-running Codex/agent task.

## Start

- [ ] Pull latest repo.
- [ ] Check branch and status.
- [ ] Read relevant docs.
- [ ] Check `docs/KNOWN_ISSUES.md`.
- [ ] Define today's small vertical slice.
- [ ] Confirm no secrets are in working tree.

## During development

- [ ] Prefer mature libraries.
- [ ] Use official docs/MCP when uncertain.
- [ ] Keep changes small.
- [ ] Update types/schemas with API changes.
- [ ] Add/adjust tests as implementation changes.
- [ ] Run real page locally for UI changes.

## Before commit

- [ ] `pnpm lint`.
- [ ] `pnpm typecheck`.
- [ ] Unit/integration tests relevant to change.
- [ ] Playwright test for affected UI flow.
- [ ] Mobile viewport check if UI changed.
- [ ] No `.env.local`, secrets, recordings, or debug dumps staged.
- [ ] Docs updated.

## End report

- [ ] Summarize what changed.
- [ ] List tests run and results.
- [ ] List screenshots/traces if any.
- [ ] List known failures.
- [ ] Commit hash/branch.
- [ ] Next recommended task.
