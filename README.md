# BabbleDeck

BabbleDeck is a PWA-first realtime transcription, translation, recorder backup, and transcript export platform.

Production: https://babbledeck.aialra.online

## Current MVP

- Next.js App Router web app in `apps/web`.
- Prisma/PostgreSQL persistence in `db/schema.prisma`.
- Bootstrap admin seed via `SEED_ADMIN_PASSWORD`.
- Login, dashboard, live session creation, recorder page, public viewer page with caption display controls and transcript copy, session history, provider usage, budget caps with degraded-provider status, and exports.
- Browser microphone permission flow, volume meter with no-input/clipping feedback, IndexedDB local backup with recorder-side reconnect/retry/uploaded-cleanup controls, binary audio chunk upload to local/S3-compatible object storage, SSE viewer stream with polling fallback, and deterministic mock transcript provider.
- Recorder WebSocket transport streams audio chunks to server-side provider adapters; Soniox realtime activates when `SONIOX_API_KEY` is configured.
- Playwright desktop/mobile E2E for the full MVP flow.
- Capacitor and Tauri wrapper scaffolds that load the deployed production PWA
  for native-shell testing.

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
After three consecutive unhealthy checks, it writes a local alert event to
`/srv/aialra/logs/babbledeck/health-alerts.jsonl`; a later healthy check writes
a recovery event. Strict readiness also verifies that no local health alert is
active.

Install the production metrics snapshot timer after deploying the app:

```bash
pnpm metrics:install:production
```

The timer runs every five minutes and appends non-secret JSONL records to
`/srv/aialra/logs/babbledeck/metrics.jsonl` for active sessions, recorder and
viewer connections, provider errors, first-token latency, upload failures, auth
failures, and estimated provider cost.

Run the production viewer load smoke after deploys or before release checks:

```bash
pnpm load:smoke:production -- --viewers=10
```

The smoke creates a temporary mock-provider session on the real domain, opens N
viewer SSE streams, injects a transcript through the recorder-token API,
confirms every viewer receives it, then archives the smoke session and writes a
non-secret record to `/srv/aialra/logs/babbledeck/load-smoke.jsonl`.

Run the production Soniox recorder smoke after Soniox credential changes:

```bash
pnpm soniox:smoke:production
```

The smoke creates a temporary Soniox session on the real domain, uploads a
generated WAV probe through the public recorder WebSocket, verifies the recorder
acknowledgement, provider usage, and zero provider errors, then archives the
session and writes a non-secret record to
`/srv/aialra/logs/babbledeck/soniox-smoke.jsonl`.

Run the production Soniox UI smoke when you need real browser confirmation that
the recorder page streams fake-microphone speech through Soniox into live
captions:

```bash
pnpm soniox:ui-smoke:production
```

The smoke generates a temporary speech WAV with `ffmpeg`, passes it to Chromium
as the fake microphone source, runs the deployed production UI flow, verifies
recorder and viewer captions, and writes a non-secret record to
`/srv/aialra/logs/babbledeck/soniox-ui-smoke.jsonl`.

Run the longer production Soniox trace when you need stronger evidence that the
real deployed recorder can sustain a longer fake-microphone session and persist
provider output:

```bash
pnpm soniox:trace:production
```

The trace generates a longer speech WAV, runs the deployed recorder/viewer UI,
keeps recording after the first captions arrive, checks persisted transcript
segments, translations, audio chunks, provider usage, and provider errors, then
archives the trace session and writes a non-secret record to
`/srv/aialra/logs/babbledeck/soniox-trace.jsonl`. Strict readiness requires a
recent passing trace.

Run the production security baseline audit after security-sensitive changes:

```bash
pnpm security:audit:production
```

The audit checks repo secret hygiene, `.env.example` placeholders, source-level
security controls, live security headers, unauthenticated admin API protection,
same-origin mutation rejection, and `/api/health` non-secret output. It appends
a non-secret record to `/srv/aialra/logs/babbledeck/security-baseline.jsonl`.

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
pnpm audio:readiness:production
pnpm audio:configure:production
pnpm audio:preflight:production
pnpm audio:cutover:production
BABBLEDECK_AUDIO_CUTOVER_APPLY=1 pnpm audio:cutover:production
```

The readiness step loads the production env without printing secrets, reports
which accepted R2/S3 variable groups are missing, and counts uploaded audio
chunks that still need current-target metadata. The configure step patches the
production env file from the R2/S3 variables in the current shell, runs the
off-host preflight against a temporary env copy, and only then installs the
patched env with a timestamped backup. The preflight creates, heads, and
deletes a temporary object on the configured off-host target. The first cutover
command then validates the local source objects. The apply run migrates batches
to the configured off-host target, audits object presence and metadata, then
runs a strict production deploy smoke.

Production LiveKit V2 room audio can be self-hosted on the existing production
server. The installer follows the current systemd + Nginx project pattern,
creates `/srv/aialra/config/secrets/babbledeck-livekit.env`, starts
`aialra-babbledeck-livekit.service`, and exposes LiveKit on the same production
origin under `/livekit/`:

```bash
pnpm livekit:selfhost:install:production
set -a; . /srv/aialra/config/secrets/babbledeck-livekit.env; set +a
LIVEKIT_URL=wss://babbledeck.aialra.online/livekit pnpm livekit:configure:production
pnpm deploy:production
pnpm livekit:ui-smoke:production
```

The self-host default uses signal port `11972`, WebRTC TCP `7881`, UDP
`50000-50020`, Redis at `127.0.0.1:6379`, and leaves LiveKit TURN disabled
because this server already reserves the standard TURN port for coturn. Normal
browser networks can use the same-domain WebSocket path plus LiveKit TCP/UDP
ICE candidates; very restricted corporate networks may still need a dedicated
TURN plan later.

External LiveKit deployments can use the guarded wrapper after `LIVEKIT_URL`,
`LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are available in the current shell:

```bash
pnpm livekit:configure:production
pnpm deploy:production
pnpm livekit:ui-smoke:production
```

The configure step patches the production env file from the current shell,
runs a LiveKit preflight against a temporary env copy, and only installs the
patched env after the preflight passes. The preflight generates a short-lived
BabbleDeck publisher token, verifies its room grants, and checks the LiveKit
management API without printing secrets.

When LiveKit is configured, the recorder publishes the active microphone track
to the BabbleDeck room and viewers subscribe to room audio from the browser. If
LiveKit is missing or unavailable, room audio shows a not-configured/unavailable
state while captions, local audio backup, recorder WebSocket upload, and viewer
SSE/polling continue.

The LiveKit UI smoke opens the deployed recorder and viewer pages on the real
domain, starts a mock-caption session with Chromium fake microphone capture,
verifies recorder publishing plus viewer `Audio live`, and writes a non-secret
JSONL marker to `/srv/aialra/logs/babbledeck/livekit-ui-smoke.jsonl`. Production
readiness treats configured LiveKit credentials, the LiveKit systemd service,
and a recent passing LiveKit UI smoke as required checks.

Synchronize the bootstrap admin with `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` after credential changes:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/sync-seed-admin.ts
```

Native wrapper configuration checks:

```bash
pnpm wrappers:check
pnpm device:readiness:production
pnpm device:readiness:production -- --check-desktop-headless
pnpm --filter @babbledeck/mobile check
pnpm --filter @babbledeck/desktop check
```

The mobile and desktop wrapper packages default to the deployed production PWA
at `https://babbledeck.aialra.online` for live-site-first wrapper testing.
`device:readiness:production` checks the production URL, Android debug APK,
connected physical Android devices, Xcode availability for iOS, and an
interactive desktop display session without printing device serials or secrets.
It also reports non-secret artifact size/sha256 metadata for the Android APK
and desktop binary when present. Add `-- --check-desktop-headless` to run the
Linux Tauri binary under Xvfb as a launch smoke; this still does not replace
real microphone/caption/audio-backup evidence from an interactive desktop run.
After a real device run, record non-secret manual evidence for each platform:

```bash
pnpm device:evidence:checklist:production
pnpm device:evidence:production -- --platform=android --passed --production-url-opened --microphone-granted --recording-started --captions-visible --audio-backup-confirmed
```

The checklist command fetches the current production `/api/health` release and
writes a non-secret Markdown checklist under
`/srv/aialra/logs/babbledeck/device-runtime-checklists/`. Use that release-bound
checklist while running the Android, iOS, and desktop wrappers so each evidence
record matches the deployed build.

Authenticated admins can also record release-bound device evidence from the
production Settings page after completing the real wrapper run on that device.
The form writes the same non-secret JSONL evidence log and records an audit log
entry.

Strict production readiness requires recent passing Android, iOS, and desktop
device evidence before treating native wrapper runtime validation as complete.
Each evidence record is tied to the current `/api/health` release commit, so
new production deployments require fresh device evidence for the deployed
release.

## Deployment Notes

The current production instance follows the server's existing systemd + Nginx pattern:

- Service: `aialra-babbledeck.service`
- Web start: standalone Next server from `/srv/aialra/releases/babbledeck/current/apps/web/server.js`
- Release root: `/srv/aialra/releases/babbledeck/releases/<commit>-<timestamp>` with `current` as the active symlink
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
- Production metrics timer: `aialra-babbledeck-metrics.timer`
- Production logrotate config: `/etc/logrotate.d/aialra-babbledeck`
- Backup root: `/srv/aialra/backups/babbledeck`
- Raw audio retention days are configurable at `/settings`; per-session raw audio legal hold is available from session history.

Soniox realtime requires `SONIOX_API_KEY`. Without it, Soniox-mode sessions are marked degraded while local backup continues. After key changes, run the live readiness probe with `--check-soniox-live`; it sends a short generated WAV silence sample over the Soniox websocket and does not print the key.

`pnpm build` also copies `.next/static` and `public` into the standalone output through `scripts/prepare-standalone-assets.sh`. `pnpm deploy:production` then copies the full standalone output into an immutable release directory and flips the `current` symlink before restarting the web service, so later builds do not rewrite the directory currently serving production traffic.

To migrate existing raw audio from the local object root to R2/S3-compatible storage, configure the target `AUDIO_STORAGE_*` or `R2_*` variables, keep `SOURCE_AUDIO_STORAGE_DIR` pointed at the previous local root, run:

For Cloudflare R2, `R2_ACCOUNT_ID` is enough to derive `https://ACCOUNT_ID.r2.cloudflarestorage.com`; set `R2_ENDPOINT` only when overriding that endpoint.

```bash
pnpm audio:readiness:production
pnpm tsx scripts/preflight-audio-storage.ts --require-off-host
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
