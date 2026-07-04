# BabbleDeck Backup and Restore

Production backups follow the server's systemd-managed project pattern.

## Files

- Backup root: `/srv/aialra/backups/babbledeck`
- Logs: `/srv/aialra/logs/babbledeck/backup.log`
- Service: `aialra-babbledeck-backup.service`
- Timer: `aialra-babbledeck-backup.timer`
- Raw audio retention service: `aialra-babbledeck-audio-retention.service`
- Raw audio retention timer: `aialra-babbledeck-audio-retention.timer`
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

To re-sync the bootstrap admin with the server secret env after an operator
credential change:

```bash
set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a
pnpm tsx scripts/sync-seed-admin.ts
```

## Verify Latest Backup

This restores into a temporary database and temporary audio directory, then
drops the temporary database.

```bash
scripts/verify-backup.sh latest
```

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

Dry run:

```bash
SOURCE_AUDIO_STORAGE_DIR=/srv/aialra/storage/babbledeck \
  pnpm tsx scripts/migrate-audio-storage.ts --dry-run --limit=500
```

Audit the currently configured storage target before and after a migration:

```bash
pnpm tsx scripts/audit-audio-storage.ts --limit=500
pnpm tsx scripts/audit-audio-storage.ts --limit=500 --require-current-target
```

R2/S3 run:

```bash
SOURCE_AUDIO_STORAGE_DIR=/srv/aialra/storage/babbledeck \
AUDIO_STORAGE_DRIVER=r2 \
R2_BUCKET=babbledeck-prod \
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
  pnpm tsx scripts/migrate-audio-storage.ts --limit=500
```

Repeat the non-dry run while `hasMore` is `true`. The script refuses to copy
local audio onto the same local target directory. After switching
`AUDIO_STORAGE_DRIVER` to `r2` or `s3`, strict production readiness also checks
that all `UPLOADED` chunk rows are marked as migrated to the current off-host
target.
