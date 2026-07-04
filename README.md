# BabbleDeck

BabbleDeck is a PWA-first realtime transcription, translation, recorder backup, and transcript export platform.

Production: https://babbledeck.aialra.online

## Current MVP

- Next.js App Router web app in `apps/web`.
- Prisma/PostgreSQL persistence in `db/schema.prisma`.
- Bootstrap admin seed via `SEED_ADMIN_PASSWORD`.
- Login, dashboard, live session creation, recorder page, public viewer page, session history, provider usage, budget caps with degraded-provider status, and exports.
- Browser microphone permission flow, volume meter, IndexedDB local backup, binary audio chunk upload to local/S3-compatible object storage, SSE viewer stream with polling fallback, and deterministic mock transcript provider.
- Recorder WebSocket transport streams audio chunks to server-side provider adapters; Soniox realtime activates when `SONIOX_API_KEY` is configured.
- Playwright desktop/mobile E2E for the full MVP flow.

## Development

```bash
pnpm install
docker compose up -d postgres
pnpm db:migrate
SEED_ADMIN_PASSWORD="set-a-local-secret" pnpm db:seed
pnpm dev
```

Open the app at `http://localhost:3000` or run Playwright on the port in `E2E_BASE_URL` with:

```bash
E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
E2E_NEW_ADMIN_PASSWORD="set-a-new-test-password" \
pnpm e2e
```

Set `E2E_RUN_BUDGET_TEST=true` to include low-budget Soniox-mode degraded-provider coverage.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

## Deployment Notes

The current production instance follows the server's existing systemd + Nginx pattern:

- Service: `aialra-babbledeck.service`
- App port: `127.0.0.1:11970`
- Recorder WebSocket service: `aialra-babbledeck-ws.service`
- Recorder WebSocket port: `127.0.0.1:11971`
- Nginx site: `/etc/nginx/sites-available/babbledeck.aialra.online`
- Secret env file: `/srv/aialra/config/secrets/babbledeck.env`
- Production database: `babbledeck_prod`
- Production audio storage: local object root from `AUDIO_STORAGE_DIR` until R2/S3 credentials are configured.
- Production backup timer: `aialra-babbledeck-backup.timer`
- Production raw audio retention timer: `aialra-babbledeck-audio-retention.timer`
- Backup root: `/srv/aialra/backups/babbledeck`

Soniox realtime requires `SONIOX_API_KEY`. Without it, Soniox-mode sessions are marked degraded while local backup continues.

To migrate existing raw audio from the local object root to R2/S3-compatible storage, configure the target `AUDIO_STORAGE_*` or `R2_*` variables, keep `SOURCE_AUDIO_STORAGE_DIR` pointed at the previous local root, run:

```bash
pnpm tsx scripts/migrate-audio-storage.ts --dry-run --limit=500
pnpm tsx scripts/migrate-audio-storage.ts --limit=500
```

Do not commit secrets, `.env.local`, raw recordings, provider keys, or production logs.

## Document Map

- `docs/01_PROJECT_PLAN.md`
- `docs/02_PRD.md`
- `docs/03_TECHNICAL_DESIGN.md`
- `docs/04_TEST_PLAN.md`
- `docs/05_DATABASE_DESIGN.md`
- `docs/06_API_SPECIFICATION.md`
- `docs/07_UI_UX_SPEC.md`
- `docs/08_CODING_STANDARDS_TECH_STACK.md`
- `docs/09_AGENT_INSTRUCTIONS_WORKFLOW.md`
- `docs/10_SECURITY_AND_OPERATIONS.md`
- `docs/11_IMPLEMENTATION_BACKLOG.md`
- `docs/operations/BACKUP_RESTORE.md`
