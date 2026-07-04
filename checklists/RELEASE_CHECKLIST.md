# BabbleDeck Release Checklist

## Code quality

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] No TypeScript `any` added without justification.
- [ ] No dead code or debug-only UI left in production.

## Real browser tests

- [ ] Playwright landing/login/session smoke passes.
- [ ] Recorder flow tested in real browser.
- [ ] Viewer flow tested in second browser context.
- [ ] Mobile recorder viewport tested.
- [ ] Mobile viewer viewport tested.
- [ ] Screenshot/trace reviewed for core flows.

## Audio/realtime

- [ ] Mic permission accepted path tested.
- [ ] Mic denied path tested.
- [ ] Volume meter visible and working.
- [ ] Mock provider realtime flow tested.
- [ ] Soniox provider tested in staging/manual when enabled.
- [ ] Provider error UI tested.

## Backup/export

- [ ] Local IndexedDB backup tested.
- [ ] Audio chunk upload tested.
- [ ] Failed upload retry tested.
- [ ] Session stop/finalize tested.
- [ ] Markdown/TXT/JSON export tested.

## Security

- [ ] No `.env.local` committed.
- [ ] No plaintext password committed.
- [ ] No API keys in frontend bundle.
- [ ] Bootstrap admin uses env password only.
- [ ] Login rate limit enabled.
- [ ] Protected routes verified.
- [ ] Viewer token read-only.
- [ ] Recorder token scoped to one session.
- [ ] Security headers configured.

## Deployment

- [ ] Environment variables configured.
- [ ] Database migrations applied.
- [ ] R2/S3 bucket configured private.
- [ ] Domain TLS working.
- [ ] Production smoke test passes.
- [ ] Rollback plan known.

## Documentation

- [ ] README updated.
- [ ] CHANGELOG updated.
- [ ] TEST_RUNS updated.
- [ ] KNOWN_ISSUES updated.
- [ ] API/DB docs updated if changed.
