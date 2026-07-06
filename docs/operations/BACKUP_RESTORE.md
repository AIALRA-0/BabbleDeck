# BabbleDeck Backup and Restore

Production backups follow the server's systemd-managed project pattern.

## Files

- Backup root: `/srv/aialra/backups/babbledeck`
- Logs: `/srv/aialra/logs/babbledeck/backup.log`
- Service: `aialra-babbledeck-backup.service`
- Timer: `aialra-babbledeck-backup.timer`
- Backup verification service: `aialra-babbledeck-backup-verify.service`
- Backup verification timer: `aialra-babbledeck-backup-verify.timer`
- Raw audio retention service: `aialra-babbledeck-audio-retention.service`
- Raw audio retention timer: `aialra-babbledeck-audio-retention.timer`
- Health monitor service: `aialra-babbledeck-health-monitor.service`
- Health monitor timer: `aialra-babbledeck-health-monitor.timer`
- Metrics service: `aialra-babbledeck-metrics.service`
- Metrics timer: `aialra-babbledeck-metrics.timer`
- Logrotate config: `/etc/logrotate.d/aialra-babbledeck`
- Recorder WebSocket service: `aialra-babbledeck-ws.service`

Each backup directory contains:

- `db.dump`: PostgreSQL custom-format dump.
- `db-counts.json`: selected row counts captured before dump.
- `audio.tar.gz`: local audio object archive when `AUDIO_STORAGE_DRIVER=local`.
- `manifest.json`: non-secret metadata, sizes, counts, and git commit.
- SHA-256 checksum files.

## Manual Backup

```bash
scripts/backup-production.sh
```

## Production Readiness Audit

Run the non-destructive readiness audit after deploys or credential changes:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/check-production-readiness.ts
```

Use `--strict` when deciding whether the full production target is complete.
Strict mode fails while external dependencies such as R2/S3-compatible raw audio
storage remain unconfigured.

After Soniox credential changes, add `--check-soniox-live` to verify the
realtime websocket accepts a short generated WAV silence probe without printing
the provider key:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/check-production-readiness.ts --check-soniox-live
```

To re-sync the bootstrap admin with the server secret env after an operator
credential change:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/sync-seed-admin.ts
```

## Deployment Wrapper

Use the production deployment wrapper for routine releases:

```bash
pnpm deploy:production
```

The wrapper acquires a deployment lock, refuses dirty worktrees by default,
force-builds the Next standalone output, restarts
`aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, checks HTTPS
and readiness, runs seed-admin login/logout smoke, runs the anonymous
protected-route Playwright smoke, and appends a non-secret JSONL record to
`/srv/aialra/logs/babbledeck/deployments.jsonl`.

Useful overrides:

```bash
BABBLEDECK_DEPLOY_SKIP_BUILD=1 pnpm deploy:production
BABBLEDECK_DEPLOY_SKIP_E2E=1 pnpm deploy:production
BABBLEDECK_DEPLOY_STRICT=1 pnpm deploy:production
```

## Health Monitoring

Install or refresh the production health monitor with:

```bash
pnpm health:install:production
```

The timer checks `https://babbledeck.aialra.online/api/health` every five
minutes. It writes non-secret JSONL records to
`/srv/aialra/logs/babbledeck/health-monitor.jsonl` and exits nonzero if the
endpoint, database check, or audio storage core configuration is unhealthy.
After `BABBLEDECK_HEALTH_ALERT_THRESHOLD` consecutive unhealthy checks
(default: `3`), it writes a local alert event to
`/srv/aialra/logs/babbledeck/health-alerts.jsonl` and marks
`/srv/aialra/logs/babbledeck/health-monitor-state.json` as active. The next
healthy check clears the active state and writes a recovery event. Strict
readiness fails while a local health alert is active.
Inspect the latest records with:

```bash
tail -n 20 /srv/aialra/logs/babbledeck/health-monitor.jsonl
tail -n 20 /srv/aialra/logs/babbledeck/health-alerts.jsonl
systemctl status aialra-babbledeck-health-monitor.timer
```

## Metrics Snapshots

Install or refresh the production metrics timer with:

```bash
pnpm metrics:install:production
```

The timer writes non-secret JSONL snapshots every five minutes to
`/srv/aialra/logs/babbledeck/metrics.jsonl`. Each record includes active
sessions, recorder and viewer connections, provider errors, first-token
latency, audio upload failures, auth failures, estimated provider cost, uploaded
audio totals, and export counts. Strict readiness requires the timer to be
active and a recent metrics record to exist.

Inspect the latest records with:

```bash
tail -n 20 /srv/aialra/logs/babbledeck/metrics.jsonl
systemctl status aialra-babbledeck-metrics.timer
```

## Viewer Load Smoke

Run the production viewer load smoke before release checks:

```bash
pnpm load:smoke:production -- --viewers=10
```

The smoke uses the seed admin secret from the production env file, creates a
temporary mock-provider session on the real domain, opens N concurrent viewer
SSE streams, injects a transcript through the scoped recorder-token API,
confirms every viewer receives it, stops and archives the smoke session, and
writes a non-secret JSONL record to
`/srv/aialra/logs/babbledeck/load-smoke.jsonl`. Strict readiness requires a
recent passing load-smoke record.

Useful overrides:

```bash
BABBLEDECK_LOAD_SMOKE_VIEWERS=25 pnpm load:smoke:production
BABBLEDECK_LOAD_SMOKE_TIMEOUT_SECONDS=90 pnpm load:smoke:production
```

## Soniox Recorder Smoke

Run the production Soniox recorder WebSocket smoke after Soniox credential
changes or before release checks:

```bash
pnpm soniox:smoke:production
```

The smoke uses the seed admin secret from the production env file, creates a
temporary Soniox-backed session on the real domain, starts it with the scoped
recorder token, uploads a generated WAV probe through `/ws/recorder`, verifies
the recorder acknowledgement, stored audio chunk, provider usage, and absence of
provider errors, stops and archives the smoke session, and writes a non-secret
JSONL record to `/srv/aialra/logs/babbledeck/soniox-smoke.jsonl`. Strict
readiness requires a recent passing Soniox recorder smoke record.

Useful overrides:

```bash
BABBLEDECK_SONIOX_SMOKE_PROBE_MS=1000 pnpm soniox:smoke:production
BABBLEDECK_SONIOX_SMOKE_TIMEOUT_SECONDS=60 pnpm soniox:smoke:production
```

## LiveKit Room-Audio Smoke

Self-host production LiveKit on the existing server with the guarded installer:

```bash
pnpm livekit:selfhost:install:production
set -a; . /srv/aialra/config/secrets/babbledeck-livekit.env; set +a
LIVEKIT_URL=wss://babbledeck.aialra.online/livekit pnpm livekit:configure:production
pnpm deploy:production
pnpm livekit:ui-smoke:production
```

The installer writes a root-readable secret env, installs
`aialra-babbledeck-livekit.service`, and adds the Nginx `/livekit/` WebSocket
proxy for the same production origin. Its default ports are signal `11972`,
WebRTC TCP `7881`, UDP `50000-50020`, and Redis `127.0.0.1:6379`; LiveKit TURN
is disabled because the server already has coturn ownership of the standard
TURN port. The UI smoke opens the deployed recorder and viewer pages, verifies
the recorder reaches `Publishing`, verifies the viewer reaches `Audio live`,
and writes a non-secret JSONL record to
`/srv/aialra/logs/babbledeck/livekit-ui-smoke.jsonl`. When LiveKit credentials
are configured, strict readiness requires the LiveKit service to be active with
no auto-restarts and requires a recent passing LiveKit UI smoke record.

## Security Baseline Audit

Run the production security baseline audit after security-sensitive changes:

```bash
pnpm security:audit:production
```

The audit checks repo secret hygiene, `.env.example` placeholders,
source-level same-origin/rate-limit/token/audit/request-logging/error-boundary
controls, live production security and request-correlation headers,
unauthenticated admin API protection, same-origin mutation rejection, and
`/api/health` non-secret output. It writes a non-secret JSONL record to
`/srv/aialra/logs/babbledeck/security-baseline.jsonl`. Strict readiness
requires a recent passing security baseline audit.

## Log Rotation

Install or refresh production log rotation with:

```bash
pnpm logs:install:production
```

The config rotates `/srv/aialra/logs/babbledeck/*.log` and
`/srv/aialra/logs/babbledeck/*.jsonl`, keeps 14 rotations by default,
compresses old files, and uses `copytruncate` so systemd append logs continue
without restarting services.

## Verify Latest Backup

This restores into a temporary database and temporary audio directory, then
drops the temporary database.

```bash
scripts/verify-backup.sh latest
```

Install or refresh daily latest-backup restore verification with:

```bash
pnpm backup:verify:install:production
```

The timer runs after the daily backup window, restores the latest backup into a
temporary database and temporary audio directory, writes
`verify-counts.last.json` into the verified backup directory, and appends a
non-secret JSONL record to `/srv/aialra/logs/babbledeck/backup-verify.jsonl`.
Strict readiness requires the verification timer to be active and at least one
recent verification marker to exist.

## Restore

Restores require an explicit target database URL. The script refuses to restore
into production unless `ALLOW_PRODUCTION_RESTORE=I_UNDERSTAND` is set.

```bash
TARGET_DATABASE_URL=postgresql://user:password@127.0.0.1:55432/restore_db \
  scripts/restore-backup.sh /srv/aialra/backups/babbledeck/YYYYMMDDTHHMMSSZ
```

To restore local audio objects into a non-production directory:

```bash
TARGET_DATABASE_URL=postgresql://user:password@127.0.0.1:55432/restore_db \
RESTORE_AUDIO=1 \
TARGET_AUDIO_STORAGE_DIR=/tmp/babbledeck-audio-restore \
  scripts/restore-backup.sh /srv/aialra/backups/babbledeck/YYYYMMDDTHHMMSSZ
```

## Raw Audio Retention

Retention cleanup deletes uploaded raw audio objects for sessions whose
`endedAt` timestamp is older than `AUDIO_RETENTION_DAYS` or
`BABBLEDECK_AUDIO_RETENTION_DAYS` when set. Deleted chunks remain in the
database with status `DELETED` and retention metadata.

The default retention window is read from `/settings`, with env defaults used
when no database setting exists. A session-level legal hold skips raw audio
deletion for that session.

Manual dry run:

```bash
pnpm tsx scripts/prune-audio-retention.ts --dry-run --retention-days=30
```

Manual cleanup run:

```bash
pnpm tsx scripts/prune-audio-retention.ts --retention-days=30 --batch-size=500
```

## Raw Audio Storage Migration

Production intentionally stores uploaded raw audio chunks on the self-hosted
server at `/srv/aialra/storage/babbledeck`, and the daily backup includes that
local object archive. Use `scripts/migrate-audio-storage.ts` only when moving
uploaded raw audio chunks from the local object directory to R2/S3-compatible
storage. The script scans
`UPLOADED` audio chunks, reads each existing object from
`SOURCE_AUDIO_STORAGE_DIR`, validates the stored byte size and SHA-256 checksum
when available, writes the object through the configured audio storage adapter,
and records migration metadata on each chunk row.

For production, prefer the guarded cutover wrapper:

```bash
pnpm audio:readiness:production
pnpm audio:configure:production
pnpm audio:preflight:production
pnpm audio:cutover:production
BABBLEDECK_AUDIO_CUTOVER_APPLY=1 pnpm audio:cutover:production
```

The readiness step loads the production env without printing secrets, reports
which accepted R2/S3 variable groups are missing, counts source files, and
checks how many uploaded audio chunks are marked on the current target. The
configure step patches the production env file from R2/S3 variables in the
current shell, runs the off-host preflight against a temporary env copy, and
only installs the patched env after that preflight passes. It writes a
timestamped backup and appends a non-secret JSONL record. The preflight creates,
heads, and deletes a temporary object on the configured off-host target without
touching production audio rows. The default cutover run validates the current
source objects. The apply run migrates batches to the configured R2/S3 target,
audits that uploaded chunks are present and marked on the current target, and
then runs `pnpm deploy:production` in strict readiness mode.

Dry run:

```bash
SOURCE_AUDIO_STORAGE_DIR=/srv/aialra/storage/babbledeck \
  pnpm tsx scripts/migrate-audio-storage.ts --dry-run --limit=500
```

Audit the currently configured storage target before and after a migration:

```bash
pnpm tsx scripts/preflight-audio-storage.ts --require-off-host
pnpm tsx scripts/audit-audio-storage.ts --all --limit=500
pnpm tsx scripts/audit-audio-storage.ts --all --limit=500 --require-current-target
```

R2/S3 run:

```bash
SOURCE_AUDIO_STORAGE_DIR=/srv/aialra/storage/babbledeck \
AUDIO_STORAGE_DRIVER=r2 \
R2_ACCOUNT_ID=ACCOUNT_ID \
R2_BUCKET=babbledeck-prod \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
  pnpm tsx scripts/migrate-audio-storage.ts --limit=500
```

`R2_ENDPOINT` can still be set explicitly, but BabbleDeck derives the standard
Cloudflare R2 endpoint from `R2_ACCOUNT_ID` when it is omitted.

Repeat the non-dry run while `hasMore` is `true`. The script refuses to copy
local audio onto the same local target directory. After switching
`AUDIO_STORAGE_DRIVER` to `r2` or `s3`, production readiness checks that all
`UPLOADED` chunk rows are marked as present on the current R2/S3-compatible
target. In the default self-hosted server model, readiness instead checks that
the local storage directory is persistent/writable and that all uploaded chunks
are marked on the local target.

Non-dry R2/S3 migrations skip chunks already marked on the current target, so
repeat runs continue from the remaining unmigrated rows instead of rewriting the
first batch. Use `--include-migrated` only when intentionally refreshing objects
already present on the target.

## LiveKit V2 Configuration

Use the guarded production wrapper when LiveKit server credentials are
available:

```bash
pnpm livekit:configure:production
pnpm deploy:production
```

The wrapper reads `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and
optional token TTL/rate-limit variables from the current shell, writes a patched
temporary env file, and runs `pnpm livekit:preflight:production` before touching
the production env. The preflight generates a short-lived BabbleDeck publisher
token, verifies microphone publish grants, and calls the LiveKit management API
with `RoomServiceClient.listRooms()`. If preflight passes, the wrapper backs up
the production env with a UTC timestamp, installs the patched env, and appends a
non-secret JSONL record.

After LiveKit is configured, the browser recorder publishes its existing
microphone track to the LiveKit room, and viewers subscribe to room audio from
the public viewer page. When LiveKit is not configured or temporarily
unavailable, the room-audio status degrades without blocking captions, local
backup, recorder WebSocket upload, or viewer SSE/polling.

## Device Runtime Evidence

Strict production readiness requires recent Android, iOS, and desktop wrapper
runtime evidence for the currently deployed release. Before running the manual
device checks, generate a release-bound checklist:

```bash
pnpm device:evidence:checklist:production
```

The command fetches the live `/api/health` release metadata, writes a non-secret
Markdown snapshot under `/srv/aialra/logs/babbledeck/device-runtime-checklists/`,
and prints the Android, iOS, and desktop commands and manual checks. After each
real device or interactive wrapper run confirms production URL load, microphone
permission, recording start, visible captions, and audio backup/upload success,
record the evidence on the production server:

```bash
pnpm device:evidence:production -- --platform=android --passed --production-url-opened --microphone-granted --recording-started --captions-visible --audio-backup-confirmed
```

Repeat the record command with `--platform=ios` and `--platform=desktop`. Each
record includes the current `/api/health` release commit, and production
readiness rejects stale records from older deployments.

Authenticated admins can also record the same release-bound evidence directly
from the production Settings page, the recorder page, or a completed session
history page. The recorder and history forms prefill checks that the current
device/session has already observed, but the record is only written after all
checks are confirmed.

The production Settings page also includes the current release evidence status
and a `Download checklist` action that serves the same non-secret Markdown
checklist as an authenticated download.

Settings also includes `Download kit`, an authenticated JSON attachment with the
current release, evidence status, checklist URL, artifact URLs, artifact
SHA-256 values, and record commands. Use it when handing the active deployment
to another device or workstation for Android, iOS, or desktop verification.

Settings also includes `Create verification link`, which creates a
release-labeled live session using the configured realtime provider and shows an
authenticated recorder link plus QR code for a real device or interactive
wrapper session. Record evidence only after that device confirms production URL
load, microphone permission, recording, captions, and audio backup.

When the Android debug APK exists on the production server, the same Settings
status panel exposes an authenticated `Download Android APK` action for physical
Android install/run verification.

When the Linux desktop release binary exists on the production server, Settings
also exposes `Download desktop binary` so an authenticated admin can fetch the
exact server-built wrapper artifact for an interactive desktop verification
session.
