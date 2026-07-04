# Test Runs

## 2026-07-04 Soniox Realtime Staging Check

- Environment: production secret env file loaded locally without printing secrets; Soniox realtime WebSocket endpoint `wss://stt-rt.soniox.com/transcribe-websocket`.
- Commands:
  - Checked `SONIOX_API_KEY` presence without echoing the value.
  - Generated a short valid 16 kHz PCM WAV silence sample with `ffmpeg` and confirmed Soniox accepted audio frames without provider errors.
  - Downloaded the public `brooklyn_bridge.flac` speech sample, streamed it to Soniox in 3840-byte frames with 120 ms pacing, and ended the stream with an empty WebSocket frame.
  - Created a temporary production smoke session, streamed the public speech sample through `SonioxRealtimeBridge`, verified database transcript/translation writes, and cleaned up the temporary session/user.
- Results:
  - Soniox WebSocket opened successfully with the configured production API key.
  - Real speech sample returned original transcript tokens and translation tokens.
  - App adapter smoke wrote transcript events, translation events, transcript segment rows, and translation rows with no provider error.
  - The stream returned a `finished` response with no provider error.
  - This uncovered and fixed an app bridge issue where BabbleDeck closed the Soniox socket immediately after sending the end-of-audio frame instead of waiting for the provider's final responses.
  - This also uncovered and fixed a transcript `sequenceNo` race by serializing Soniox message handling before database writes.

## 2026-07-04 Production Soniox and Migration Deploy Smoke

- Environment: `https://babbledeck.aialra.online`, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, production Postgres database `babbledeck_prod`, local production audio root `/srv/aialra/storage/babbledeck`, configured `SONIOX_API_KEY`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test`
  - Script typecheck for `scripts/recorder-ws-server.ts`, `scripts/prune-audio-retention.ts`, `scripts/migrate-audio-storage.ts`, and `playwright.config.ts`.
  - `pnpm build`
  - `pnpm tsx scripts/migrate-audio-storage.ts --dry-run --limit=20`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with a temporary smoke admin and `E2E_RUN_BUDGET_TEST=true`.
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - HTTPS returned `HTTP/2 200` with expected security headers.
  - Production audio migration dry-run scanned 20 uploaded chunks, read 20 source objects, and found no missing files, size mismatches, or checksum mismatches.
  - Production Playwright passed 4/4 tests, including WebSocket backup and low-budget Soniox-mode degraded-provider coverage.
  - Smoke cleanup removed 4 temporary sessions and 13 local audio objects.

## 2026-07-04

- Environment: local workspace with Docker Postgres on `localhost:55432`.
- Commands:
  - `pnpm db:validate`
  - `pnpm db:generate`
  - `pnpm db:migrate`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Format, lint, typecheck, unit tests, and build passed.
  - Playwright MVP flow passed on desktop and mobile: landing, login, session creation, recorder, microphone permission, mock transcript, public viewer, stop/history, and Markdown export.
- Screenshots/traces:
  - Final run passed without failure screenshots.
  - Playwright HTML report generated locally under `playwright-report/`.

## 2026-07-04 Production Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`.
- Commands:
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `curl -fsS https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - HTTPS returned `HTTP/2 200` with security headers.
  - Landing page contained BabbleDeck content.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin that was deleted after the run.
  - Bootstrap admin `admin@example.invalid` remains present with role `ADMIN`.
- Screenshots/traces:
  - Production run passed without failure screenshots.

## 2026-07-04 SSE Viewer Upgrade

- Environment: local workspace with Docker Postgres on `localhost:55432`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Playwright MVP flow passed on desktop and mobile.
  - Viewer test now asserts the visible `SSE live` state before transcript events are sent, proving the EventSource path is active.
- Screenshots/traces:
  - Final run passed without failure screenshots.

## 2026-07-04 Production SSE Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy with SSE buffering disabled for `/api/viewer/session/*/stream`.
- Commands:
  - `pnpm build`
  - `nginx -t`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed and exposed `/api/viewer/session/[shareToken]/stream`.
  - HTTPS landing smoke returned `HTTP/2 200`.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin that was deleted after the run.
  - Viewer test asserted the visible `SSE live` state on production before transcript events were sent.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Binary Audio Object Storage

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3101`, and `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e` with `E2E_BASE_URL=http://127.0.0.1:3101`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Added unit coverage for local audio object writes.
  - Playwright MVP flow passed on desktop and mobile with assertions for uploaded backup chunk counts.
  - Local post-run verification found `10` audio object files under the configured temporary storage root.
- Screenshots/traces:
  - Final run passed without failure screenshots; temporary Playwright artifacts and local test audio files were removed after the successful run.

## 2026-07-04 Production Binary Audio Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed without Turbopack NFT warnings.
  - Service restarted successfully and remained active with `NRestarts=0`.
  - HTTPS landing smoke returned `HTTP/2 200`.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin that was deleted after the run.
  - Production post-run verification found `5` audio chunk records and `5` matching audio object files before cleanup removed the temporary smoke session objects.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Password Rotation Enforcement

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3102`, and `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e` with `E2E_BASE_URL=http://127.0.0.1:3102`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Seeded admin still starts with `passwordRotationRequired=true`.
  - Playwright desktop flow verified forced password rotation before dashboard access, then completed session creation, recorder, viewer, audio backup, history, and export.
  - Playwright mobile flow logged in with the rotated test password and completed the same MVP flow.
  - Local post-run verification found `8` audio object files under the configured temporary storage root.
- Screenshots/traces:
  - Final run passed without failure screenshots; temporary Playwright artifacts and local test audio files were removed after the successful run.

## 2026-07-04 Production Password Rotation Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed and exposed `/account/password` plus `/api/auth/password`.
  - Service restarted successfully and remained active with `NRestarts=0`.
  - HTTPS landing smoke returned `HTTP/2 200` after the service finished starting.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin created with `passwordRotationRequired=true`.
  - Post-run verification confirmed the temporary smoke admin had `passwordRotationRequired=false` after the browser flow.
  - Production post-run verification found `5` audio chunk records and `5` matching audio object files before cleanup removed the temporary smoke session objects.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Provider Usage Tracking

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3104`, and `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e` with `E2E_BASE_URL=http://127.0.0.1:3104`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Added unit coverage for provider audio-hour cost estimation.
  - Playwright MVP flow passed on desktop and mobile with assertions for visible non-zero `Audio processed` in session detail.
  - Local post-run verification found `10` audio object files, `10` provider usage rows, and `10000` provider audio milliseconds.
- Screenshots/traces:
  - Final run passed without failure screenshots; temporary Playwright artifacts and local test audio files were removed after the successful run.

## 2026-07-04 Production Provider Usage Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed after adding provider usage serialization and admin display.
  - Service restarted successfully and remained active with `NRestarts=0`.
  - HTTPS landing smoke returned `HTTP/2 200`.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin created with `passwordRotationRequired=true`.
  - Production post-run verification found `5` audio chunk records, `5` matching audio object files, `5` provider usage rows, and `5000` provider audio milliseconds before cleanup removed the temporary smoke session objects.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Production Backup and Restore

- Environment: production server with `babbledeck_prod`, local audio root `/srv/aialra/storage/babbledeck`, backup root `/srv/aialra/backups/babbledeck`, and Postgres tools from Docker container `2026-07-04-babbledeck-postgres-1`.
- Commands:
  - `scripts/backup-production.sh`
  - `scripts/verify-backup.sh /srv/aialra/backups/babbledeck/20260704T191342Z`
  - `systemctl enable --now aialra-babbledeck-backup.timer`
  - `systemctl start aialra-babbledeck-backup.service`
  - `scripts/verify-backup.sh latest`
  - Production restore refusal check with `TARGET_DATABASE_URL=$DATABASE_URL scripts/restore-backup.sh ...`
- Results:
  - Manual backup created `/srv/aialra/backups/babbledeck/20260704T191342Z`.
  - Systemd service backup created `/srv/aialra/backups/babbledeck/20260704T191624Z`.
  - Latest backup verified by restoring into temporary database `babbledeck_restore_verify_20260704191625_2734377` and a temporary audio directory.
  - Production restore safety check passed: restore script refused to target the production `DATABASE_URL` without explicit `ALLOW_PRODUCTION_RESTORE=I_UNDERSTAND`.
  - `aialra-babbledeck-backup.timer` is active and scheduled daily.
- Artifacts:
  - Backup directories include `db.dump`, `db-counts.json`, `audio.tar.gz`, checksum files, `manifest.json`, and the latest verification counts.
