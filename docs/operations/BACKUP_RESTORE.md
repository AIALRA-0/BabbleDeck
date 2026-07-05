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

Use `scripts/migrate-audio-storage.ts` when moving uploaded raw audio chunks
from the local object directory to R2/S3-compatible storage. The script scans
`UPLOADED` audio chunks, reads each existing object from
`SOURCE_AUDIO_STORAGE_DIR`, validates the stored byte size and SHA-256 checksum
when available, writes the object through the configured audio storage adapter,
and records migration metadata on each chunk row.

For production, prefer the guarded cutover wrapper:

```bash
pnpm audio:preflight:production
pnpm audio:cutover:production
BABBLEDECK_AUDIO_CUTOVER_APPLY=1 pnpm audio:cutover:production
```

The preflight creates, heads, and deletes a temporary object on the configured
off-host target without touching production audio rows. The default cutover run
validates the current source objects. The apply run migrates batches to the
configured R2/S3 target, audits that uploaded chunks are present and marked on
the current target, and then runs `pnpm deploy:production` in strict readiness
mode.

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
`AUDIO_STORAGE_DRIVER` to `r2` or `s3`, strict production readiness also checks
that all `UPLOADED` chunk rows are marked as migrated to the current off-host
target.

Non-dry R2/S3 migrations skip chunks already marked on the current target, so
repeat runs continue from the remaining unmigrated rows instead of rewriting the
first batch. Use `--include-migrated` only when intentionally refreshing objects
already present on the target.
