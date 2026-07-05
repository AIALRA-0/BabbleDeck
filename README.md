# BabbleDeck

BabbleDeck is a PWA-first realtime transcription, translation, recorder backup, and transcript export platform.

Production: https://babbledeck.aialra.online

## Current MVP

- Next.js App Router web app in `apps/web`.
- Prisma/PostgreSQL persistence in `db/schema.prisma`.
- Bootstrap admin seed via `SEED_ADMIN_PASSWORD`.
- Login, dashboard, live session creation, recorder page, public viewer page, session history, provider usage, budget caps with degraded-provider status, and exports.
- Browser microphone permission flow, volume meter, IndexedDB local backup with recorder-side reconnect/retry controls, binary audio chunk upload to local/S3-compatible object storage, SSE viewer stream with polling fallback, and deterministic mock transcript provider.
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

Set `E2E_RUN_SONIOX_UI_TEST=true` with `E2E_FAKE_AUDIO_FILE=/path/to/speech.wav` to run the opt-in real Soniox recorder UI smoke. The fake audio file is passed to Chromium as the microphone source, so this test should only be used where `SONIOX_API_KEY` is configured.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Production readiness audit:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/check-production-readiness.ts
pnpm tsx scripts/check-production-readiness.ts --strict
pnpm tsx scripts/check-production-readiness.ts --check-soniox-live
```

Production exposes a non-secret health endpoint for monitoring at
`/api/health`. It checks database connectivity, audio storage configuration,
process uptime, and provider configuration booleans without returning secret
values.

Install the systemd health monitor after deploying the app:

```bash
pnpm health:install:production
```

The monitor runs every five minutes, checks `/api/health`, and appends
non-secret JSONL records to `/srv/aialra/logs/babbledeck/health-monitor.jsonl`.

Install log rotation for the app, WebSocket, backup, health monitor, deploy,
and Nginx logs:

```bash
pnpm logs:install:production
```

Install daily restore verification for the latest production backup:

```bash
pnpm backup:verify:install:production
```

Production deploys should use the systemd-aware wrapper:

```bash
pnpm deploy:production
```

The wrapper force-builds the standalone app, restarts the web and recorder
WebSocket services, checks HTTPS/readiness/login, runs the anonymous protected
route Playwright smoke, and appends a non-secret record to
`/srv/aialra/logs/babbledeck/deployments.jsonl`.

Production raw-audio storage cutovers should use the guarded wrapper after the
R2/S3 target variables are present in the production env file:

```bash
pnpm audio:cutover:production
BABBLEDECK_AUDIO_CUTOVER_APPLY=1 pnpm audio:cutover:production
```

The first command only validates the local source objects. The apply run
migrates batches to the configured off-host target, audits object presence and
metadata, then runs a strict production deploy smoke.

Synchronize the bootstrap admin with `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` after credential changes:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/sync-seed-admin.ts
```

## Deployment Notes

The current production instance follows the server's existing systemd + Nginx pattern:

- Service: `aialra-babbledeck.service`
- Web start: standalone Next server at `apps/web/.next/standalone/apps/web/server.js`
- App port: `127.0.0.1:11970`
- Recorder WebSocket service: `aialra-babbledeck-ws.service`
- Recorder WebSocket port: `127.0.0.1:11971`
- Nginx site: `/etc/nginx/sites-available/babbledeck.aialra.online`
- Secret env file: `/srv/aialra/config/secrets/babbledeck.env`
- Production database: `babbledeck_prod`
- Production audio storage: local object root from `AUDIO_STORAGE_DIR` until R2/S3 credentials are configured.
- Production backup timer: `aialra-babbledeck-backup.timer`
- Production backup verification timer: `aialra-babbledeck-backup-verify.timer`
- Production raw audio retention timer: `aialra-babbledeck-audio-retention.timer`
- Production health monitor timer: `aialra-babbledeck-health-monitor.timer`
- Production logrotate config: `/etc/logrotate.d/aialra-babbledeck`
- Backup root: `/srv/aialra/backups/babbledeck`
- Raw audio retention days are configurable at `/settings`; per-session raw audio legal hold is available from session history.

Soniox realtime requires `SONIOX_API_KEY`. Without it, Soniox-mode sessions are marked degraded while local backup continues. After key changes, run the live readiness probe with `--check-soniox-live`; it sends a short generated WAV silence sample over the Soniox websocket and does not print the key.

`pnpm build` also copies `.next/static` and `public` into the standalone output through `scripts/prepare-standalone-assets.sh`; this keeps the production unit aligned with Next standalone hosting requirements.

To migrate existing raw audio from the local object root to R2/S3-compatible storage, configure the target `AUDIO_STORAGE_*` or `R2_*` variables, keep `SOURCE_AUDIO_STORAGE_DIR` pointed at the previous local root, run:

For Cloudflare R2, `R2_ACCOUNT_ID` is enough to derive `https://ACCOUNT_ID.r2.cloudflarestorage.com`; set `R2_ENDPOINT` only when overriding that endpoint.

```bash
pnpm tsx scripts/audit-audio-storage.ts --all --limit=500
pnpm tsx scripts/migrate-audio-storage.ts --dry-run --limit=500
pnpm tsx scripts/migrate-audio-storage.ts --limit=500
pnpm tsx scripts/audit-audio-storage.ts --all --limit=500 --require-current-target
```

Non-dry migrations to R2/S3 skip chunks already marked on the current target by
default; use `--include-migrated` only when intentionally rewriting existing
target objects.

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
