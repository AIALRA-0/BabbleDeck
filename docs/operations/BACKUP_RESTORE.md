# BabbleDeck Backup and Restore

Production backups follow the server's systemd-managed project pattern.

## Files

- Backup root: `/srv/aialra/backups/babbledeck`
- Logs: `/srv/aialra/logs/babbledeck/backup.log`
- Service: `aialra-babbledeck-backup.service`
- Timer: `aialra-babbledeck-backup.timer`

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
