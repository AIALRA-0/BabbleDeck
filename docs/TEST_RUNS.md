# Test Runs

## 2026-07-05 Production Health Monitor Timer

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `bash -n scripts/monitor-production-health.sh scripts/install-production-health-monitor.sh scripts/deploy-production.sh scripts/cutover-audio-storage.sh`
  - `BABBLEDECK_LOG_DIR="$tmpdir" BABBLEDECK_HEALTH_BASE_URL=https://babbledeck.aialra.online pnpm health:monitor:production`
  - `pnpm health:install:production`
  - `systemctl status aialra-babbledeck-health-monitor.timer --no-pager`
  - `tail -n 3 /srv/aialra/logs/babbledeck/health-monitor.jsonl`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm deploy:production`
- Results:
  - Added `scripts/monitor-production-health.sh` for non-secret `/api/health` probes with JSONL status output.
  - Added `pnpm health:monitor:production` and `pnpm health:install:production`; the installer creates `aialra-babbledeck-health-monitor.service` and `aialra-babbledeck-health-monitor.timer` using the existing server systemd pattern.
  - `scripts/check-production-readiness.ts` now requires the health monitor timer to be active.
  - A temporary-log monitor run against the live domain returned `httpStatus=200`, `ok=true`, `databaseOk=true`, `audioStorageOk=true`, `audioStorageDriver=local`, and `sonioxConfigured=true`.
  - The production timer was installed and is active, with the next run scheduled every five minutes.
  - The production JSONL monitor log wrote a non-secret record with `httpStatus=200`, `healthStatus=ok`, `databaseOk=true`, `audioStorageOk=true`, `audioStorageDriver=local`, `offHostAudioReady=false`, and `sonioxConfigured=true`.
  - Strict production readiness now passes the required `aialra-babbledeck-health-monitor.timer` check; strict completion still waits on off-host audio storage.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Production deploy wrapper force-built the standalone app, restarted `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, confirmed readiness `requiredOk=true`, confirmed seed-admin login/logout, and passed the anonymous protected-route Playwright smoke.

## 2026-07-05 Production Health Endpoint

- Environment: local workspace first, then production deployment at `https://babbledeck.aialra.online` after deployment.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/health.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `/api/health` as a non-secret monitoring endpoint.
  - The endpoint reports service name, version, generated timestamp, uptime, database connectivity, audio storage driver/core config health, off-host storage readiness, and Soniox configured status without returning secret values.
  - `scripts/check-production-readiness.ts` now verifies that the live production health endpoint reports core database and audio storage health.
  - Local format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests now cover `15` files and `48` tests, including non-secret health status coverage.
  - Production deploy wrapper force-built the standalone app, restarted `aialra-babbledeck.service` and `aialra-babbledeck-ws.service` at `2026-07-05 03:54:06 CEST`, confirmed readiness `requiredOk=true`, confirmed seed-admin login/logout, and passed the anonymous protected-route Playwright smoke.
  - Live `/api/health` returned `ok=true`, service `babbledeck`, status `ok`, version `0.1.0`, database `ok=true`, audio storage `{ ok: true, driver: "local", offHostReady: false }`, and Soniox configured `true`.
  - Strict production readiness passed all required checks, including `health_endpoint` and live Soniox connectivity with `360ms` accepted probe audio.
  - Strict production completion still waits on off-host R2/S3-compatible audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.

## 2026-07-05 Audio Storage Cutover Guard

- Environment: local workspace, production secret env inspected without printing secrets, production audio driver still local.
- Commands:
  - `bash -n scripts/cutover-audio-storage.sh`
  - `pnpm audio:cutover:production`
  - `BABBLEDECK_ENV_FILE="$tmp_env" BABBLEDECK_AUDIO_CUTOVER_BATCH_SIZE=2 pnpm audio:cutover:production`
  - `SOURCE_AUDIO_STORAGE_DIR=/tmp/babbledeck-source-does-not-exist AUDIO_STORAGE_DRIVER=r2 R2_ACCOUNT_ID=raw-sql-smoke R2_BUCKET=raw-sql-smoke R2_ACCESS_KEY_ID=raw-sql-smoke R2_SECRET_ACCESS_KEY=raw-sql-smoke pnpm tsx scripts/migrate-audio-storage.ts --limit=1`
  - `pnpm tsx scripts/audit-audio-storage.ts --all --limit=2`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `pnpm audio:cutover:production` for guarded R2/S3 cutover.
  - The wrapper defaults to dry-run source validation and requires `BABBLEDECK_AUDIO_CUTOVER_APPLY=1` before migrating objects.
  - The storage audit script now supports `--all`, and the cutover wrapper uses it so target audits page through every uploaded chunk instead of only the first batch.
  - With the current production env, the wrapper refuses to run because `AUDIO_STORAGE_DRIVER=local`.
  - With a temporary fake R2 env file and production DB URL, the wrapper dry-run scanned `2` chunks, read `2` source objects, found no missing objects, size mismatches, or checksum mismatches, and exited without writing any target objects.
  - A non-dry fake R2 smoke with a nonexistent source directory exercised the current-target skip query and returned nonzero on a missing source object before any network write.
  - The production local storage audit with `--all --limit=2` scanned all `21` uploaded chunks, found `21` present objects, and reported no size mismatches.
  - R2/S3 migrations now skip chunks already marked on the current target by default, which makes repeated batch runs continue from remaining unmigrated rows.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Strict production readiness required checks passed, including live Soniox connectivity with `360ms` accepted probe audio; strict completion still waits on off-host audio storage.
  - Production still needs real R2/S3 credentials before the cutover wrapper can perform an apply run.

## 2026-07-05 Production Deploy Wrapper

- Environment: production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`.
- Commands:
  - `bash -n scripts/deploy-production.sh`
  - `BABBLEDECK_DEPLOY_ALLOW_DIRTY=1 pnpm deploy:production`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
- Results:
  - Added `scripts/deploy-production.sh` and `pnpm deploy:production`.
  - The wrapper lock-checks deploys, refuses dirty worktrees unless explicitly overridden, force-builds standalone output, restarts web and recorder WebSocket services, checks HTTPS/homepage/readiness, runs seed-admin login/logout smoke, runs anonymous protected-route Playwright smoke, and writes non-secret deployment records.
  - Initial wrapper smoke exposed a short post-restart `502` window from Nginx before the Next standalone server was ready; the wrapper now waits up to `BABBLEDECK_DEPLOY_HTTP_WAIT_SECONDS` for HTTPS readiness before continuing.
  - Production deployment wrapper smoke passed against the live domain.
  - The passing wrapper run restarted web and recorder WebSocket services at `2026-07-05 03:30:38 CEST`, confirmed readiness `requiredOk=true`, confirmed seed-admin login/logout, and passed the anonymous protected-route Playwright smoke.
  - Strict production completion still waits on real R2/S3 credentials and audio chunk migration.

## 2026-07-05 Production Deploy Smoke for R2 Endpoint Build

- Environment: production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`.
- Commands:
  - `pnpm build --force`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `systemctl is-active aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `curl -fsS https://babbledeck.aialra.online/ | rg -n "BabbleDeck|Live multilingual captions|Open portal"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "anonymous users"`
  - Login API smoke against `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` using the seed admin from the production secret env.
- Results:
  - Forced production build completed and copied standalone static assets.
  - Web and recorder WebSocket services restarted successfully and were active with start timestamp `2026-07-05 03:20:07 CEST`.
  - HTTPS returned `HTTP/2 200` with HSTS, CSP, COOP, frame, nosniff, referrer, and permissions-policy headers.
  - The homepage HTML contained `BabbleDeck`, `Live multilingual captions`, and `Open portal`.
  - Strict readiness required checks passed, including live Soniox connectivity with `360ms` accepted probe audio.
  - Anonymous protected-route Playwright smoke passed against the live domain without creating data.
  - Seed-admin login, `/api/auth/me`, and logout returned `200` and `ok: true`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; production still needs real R2/S3 credentials and audio chunk migration.

## 2026-07-05 R2 Endpoint Derivation

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/audio-storage.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
  - `AUDIO_STORAGE_DRIVER=r2 R2_ACCOUNT_ID=readiness-account-smoke R2_BUCKET=readiness-smoke R2_ACCESS_KEY_ID=readiness-smoke R2_SECRET_ACCESS_KEY=readiness-smoke pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Audio storage now derives `https://ACCOUNT_ID.r2.cloudflarestorage.com` from `R2_ACCOUNT_ID` when no explicit endpoint is set.
  - Strict readiness now accepts `R2_ACCOUNT_ID` as the Cloudflare R2 endpoint source.
  - Documented that `R2_ENDPOINT` is optional when using the standard R2 account endpoint.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests now cover `14` files and `45` tests, including R2 endpoint derivation.
  - The live Soniox readiness probe passed with `360ms` of accepted probe audio.
  - A read-only fake-R2 readiness smoke confirmed `off_host_audio_storage` passes with `R2_ACCOUNT_ID` and no `R2_ENDPOINT`; strict readiness then fails on `off_host_audio_migration`, as expected before real migration metadata exists.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks, including live Soniox connectivity, pass.

## 2026-07-05 Protected Admin Route Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "anonymous users"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
- Results:
  - Added a desktop-only Playwright scenario that verifies anonymous browser visits to `/dashboard`, `/sessions/new`, and `/settings` redirect to login.
  - The same scenario verifies anonymous calls to `/api/auth/me`, `/api/settings`, `GET /api/sessions`, and `POST /api/sessions` return `UNAUTHENTICATED`.
  - Production Playwright protected-route smoke passed against the live domain.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - The live Soniox readiness probe passed with `360ms` of accepted probe audio.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks, including `SONIOX_API_KEY` and `soniox_realtime_connectivity`, pass.

## 2026-07-05 Viewer Polling Fallback Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "SSE stream is unavailable"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Added a desktop-only Playwright scenario that opens a public viewer while aborting the SSE stream request, verifies the viewer switches to `Polling`, injects final transcript/translation events through the recorder-token API, and confirms the viewer still receives captions.
  - Production Playwright polling-fallback smoke passed against the live domain.
  - Production Playwright desktop and mobile MVP flows still passed after the new fallback scenario was added.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production smoke cleanup removed 3 temporary Playwright sessions and 7 local audio objects across the fallback and core-flow runs.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Mobile Recorder Viewport Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm format:check`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - The core Playwright flow now opens the recorder page at `390x844` when running under the `chromium-mobile` project while keeping the wider recorder context for desktop.
  - Production Playwright desktop and mobile MVP flows passed; the mobile project now covers recorder backup reconnect/retry, microphone grant, recording, viewer streaming, stop/history, legal hold, transcript correction, and all export downloads from a phone-sized recorder page.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production smoke cleanup removed 2 temporary Playwright sessions and 6 local audio objects.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Provider Error Viewer UI

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/components/ViewerClient.tsx e2e/mvp.spec.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "provider error events"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Viewer pages now show a `Provider issue` banner when a live `provider_error` event arrives.
  - Added a desktop-only Playwright scenario that creates a session, opens the public viewer, injects a recorder-token `provider_error` event through the production API, and verifies the viewer updates over SSE.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production services restarted successfully and returned `HTTP/2 200` with expected security headers.
  - Production Playwright desktop and mobile MVP flows still passed after the viewer UI change.
  - Production smoke cleanup removed 3 temporary Playwright sessions and 6 local audio objects.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Microphone Denied Browser Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "microphone access is blocked"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Added a desktop-only Playwright scenario that creates a live session, opens the recorder token URL in a real Chromium context without automatic microphone permission grants, and verifies the `denied` microphone state plus recovery guidance.
  - First production run reached the expected denied state but failed because the assertion matched both the session title and badge text; the selector was tightened to exact badge text and the production rerun passed.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production Playwright desktop and mobile MVP flows still passed after the new scenario was added.
  - Production smoke cleanup removed 4 temporary Playwright sessions and 7 local audio objects across the denied-path and core-flow runs.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Multi-Format Export Browser Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts apps/web/src/components/SessionHistoryClient.tsx apps/web/src/lib/export.test.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/lib/export.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Session history now exposes an `SRT` export button in addition to Markdown, TXT, JSON, and VTT.
  - The core Playwright MVP flow now downloads all five formats and verifies corrected original/translation text in each export.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `14` files and `44` tests, including TXT, JSON, SRT, and VTT export rendering coverage.
  - Production services restarted successfully; an immediate post-restart HTTPS probe briefly returned `502`, then `HTTP/2 200` with expected security headers after startup settled.
  - Production Playwright desktop and mobile MVP flows both passed against the live domain with multi-format export verification.
  - Production smoke cleanup removed 2 temporary Playwright sessions and 6 local audio objects.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Recorder Control and Event Rate Limits

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/sensitive-route-rate-limit.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --check-soniox-live`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added configurable `RECORDER_CONTROL_RATE_LIMIT_PER_MINUTE` and `TRANSCRIPT_EVENT_APPEND_RATE_LIMIT_PER_MINUTE`.
  - Recorder start/stop controls are now limited per session/source IP; transcript event append is now limited per session/source IP before JSON body parsing.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `14` files and `41` tests, including recorder control and transcript event append throttling coverage.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Production Soniox live readiness passed after the credential update; the websocket accepted probe audio and reported `360ms` processed.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming recorder start/stop, mock transcript event append, audio backup uploads, and export generation still work.
  - Production smoke cleanup removed 1 temporary Playwright session and 4 local audio objects.

## 2026-07-05 Export and Audio Upload Rate Limits

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/sensitive-route-rate-limit.test.ts src/server/login-rate-limit.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added configurable `EXPORT_RATE_LIMIT_PER_MINUTE` and `AUDIO_CHUNK_UPLOAD_RATE_LIMIT_PER_MINUTE`.
  - Export generation is now limited per user/session; audio chunk upload is now limited per session/source IP before multipart body parsing.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `14` files and `39` tests, including export and audio chunk upload throttling coverage.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming normal audio backup uploads and Markdown export generation still work.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Security Headers Readiness

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/next.config.mjs scripts/check-production-readiness.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/check-production-readiness.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Production responses now include `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, and `Permissions-Policy` in addition to existing CSP, referrer, frame, and nosniff headers.
  - Strict readiness now includes a required `security_headers` check; production passed it.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `13` files and `37` tests.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200` with the expected security headers.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks, including `security_headers`, pass.
  - Production Playwright desktop MVP passed after restart.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Same-Origin Mutation Guard

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/same-origin.test.ts src/server/recorder-access.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - Logged in to production with the seed admin through the JSON login API using the server secret env, then attempted a cross-site `Origin: https://attacker.example` POST to `/api/sessions`.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Cookie-authenticated admin mutation endpoints now enforce same-origin Origin/Fetch Metadata checks.
  - Recorder-token routes still permit no-cookie recorder links while protecting the admin-cookie path.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `13` files and `37` tests, including same-origin guard and recorder access coverage.
  - Production CSRF probe returned login `200` and cross-site mutation `403 FORBIDDEN` with `Cross-site mutation blocked.`
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming same-origin UI writes and no-cookie recorder-token writes still work.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects; CSRF probe auth sessions were logged out afterward.

## 2026-07-05 Login Rate Limit Hardening

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/client-ip.test.ts src/server/login-rate-limit.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - Sent six failed JSON login attempts to production `/api/auth/login` with a synthetic email.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Login throttling now applies both per-IP and per-IP/email windows; `.env.example` documents `LOGIN_IP_RATE_LIMIT_PER_MINUTE`.
  - Client IP parsing now prefers Nginx-managed `X-Real-IP` and falls back to the proxy-appended `X-Forwarded-For` address for rate limits and audit logs.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `12` files and `33` tests, including same-account login throttling, changing-email IP throttling, and trusted proxy IP parsing coverage.
  - Production login probe returned `401` for the first five failed attempts and `429 RATE_LIMITED` on the sixth attempt.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming normal admin login was not affected.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Soniox Live Readiness Probe

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/server/soniox-realtime.ts apps/web/src/server/soniox-realtime.test.ts scripts/check-production-readiness.ts README.md docs/10_SECURITY_AND_OPERATIONS.md docs/operations/BACKUP_RESTORE.md`
  - `pnpm --filter @babbledeck/web test -- --run src/server/soniox-realtime.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm db:generate`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --check-soniox-live`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added `--check-soniox-live`, which sends a short generated WAV silence probe through the Soniox realtime websocket and reports success without printing `SONIOX_API_KEY`.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `10` files and `27` tests, including Soniox readiness probe audio coverage and missing-key behavior.
  - Production live Soniox readiness passed: the websocket accepted probe audio and reported `360ms` processed.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Transcript Segment Corrections

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3110`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/server/schemas.ts apps/web/src/server/session-service.ts apps/web/src/app/api/sessions/[id]/segments/[segmentId]/route.ts apps/web/src/server/serializers.ts apps/web/src/components/SessionHistoryClient.tsx e2e/mvp.spec.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm db:migrate`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm tsx scripts/sync-seed-admin.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev E2E_BASE_URL=http://127.0.0.1:3110 E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Format, lint, app typecheck, script typecheck, and full unit tests passed.
  - Unit tests passed with `10` files and `25` tests, including audited transcript segment update coverage.
  - Local and production Playwright desktop MVP passed while editing the first transcript segment from session history, verifying corrected original and translated text in the UI, and confirming Markdown export content uses the corrections.
  - Production build passed; production web and recorder WS services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness confirms all required checks pass, including `SONIOX_API_KEY`; strict completion still waits on off-host R2/S3-compatible audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 CI Workflow Hardening

- Environment: local workspace inspecting `.github/workflows`.
- Commands:
  - `pnpm format:check`
  - `git diff --check`
  - Repository secret-pattern scan with `rg`.
- Results:
  - CI workflow now runs `pnpm format:check`, `pnpm db:validate`, Prisma generate/migrate/seed, lint, app typecheck, unit tests, script typecheck, build, and a repository secret scan.
  - E2E workflow now seeds and logs in with a non-production fallback CI password when `SEED_ADMIN_PASSWORD` is not configured, preventing silent full-flow skips on PRs without secrets.
  - Workflow formatting and whitespace checks passed; secret scan returned no matches.

## 2026-07-05 Soniox Segment Alignment Hardening

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/server/soniox-realtime.ts apps/web/src/server/soniox-realtime.test.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/server/soniox-realtime.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - Downloaded the public `LDC93S1.wav` sample to `/tmp/babbledeck-soniox-smoke.wav` for Chromium fake microphone input.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" E2E_RUN_SONIOX_UI_TEST=true E2E_FAKE_AUDIO_FILE=/tmp/babbledeck-soniox-smoke.wav E2E_SONIOX_EXPECTED_TEXT='dark|soup|greasy|wash|洗漱|深色' pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "soniox provider streams"`
- Results:
  - Format, lint, app typecheck, script typecheck, and full unit tests passed.
  - Unit tests passed with `9` files and `24` tests.
  - Soniox mapping tests now cover delayed translations arriving after the next original segment has started, plus multiple final original segments queued before their translations arrive.
  - Production build passed; production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Real Soniox UI smoke passed with fake microphone speech against production after matching the current public sample transcript text.
  - Production smoke cleanup removed 1 temporary Soniox session and 6 local audio objects.

## 2026-07-05 Recorder Backup Retry Controls

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3108`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm db:migrate`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm tsx scripts/sync-seed-admin.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev E2E_BASE_URL=http://127.0.0.1:3108 E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Format, lint, app typecheck, script typecheck, and full unit tests passed.
  - Unit tests passed with `9` files and `22` tests, including local backup summary coverage.
  - Local Playwright desktop MVP passed while seeding a failed IndexedDB backup chunk, reconnecting backup transport, retrying the pending chunk, uploading it to the server, then completing recording, viewer streaming, legal hold, and export.
  - Production build passed; production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed with the same failed IndexedDB backup retry path.
  - Production smoke cleanup removed 1 temporary Playwright session and 4 local audio objects.

## 2026-07-05 Retention Settings and Legal Hold

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3107`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm db:validate`
  - `pnpm db:generate`
  - `pnpm db:migrate` against local dev DB
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `E2E_BASE_URL=http://127.0.0.1:3107 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm db:migrate` against production DB
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `pnpm tsx scripts/prune-audio-retention.ts --dry-run --batch-size=10`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - Downloaded the public `LDC93S1.wav` sample to `/tmp/babbledeck-soniox-smoke.wav` for Chromium fake microphone input.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" E2E_RUN_SONIOX_UI_TEST=true E2E_FAKE_AUDIO_FILE=/tmp/babbledeck-soniox-smoke.wav E2E_SONIOX_EXPECTED_TEXT='dark|suit|wash' pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "soniox provider streams"`
- Results:
  - Migration `20260705001500_app_settings` applied successfully to local and production Postgres.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `8` files and `21` tests.
  - Local and production Playwright desktop MVP passed while saving raw audio retention in Settings, enabling session raw audio legal hold, recording from a no-cookie recorder link, streaming captions to the viewer, and exporting from history.
  - Production retention dry-run used the configured `30` day setting and matched `0` chunks.
  - Production app settings contain only non-secret `audio.retentionDays`.
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness confirms all required checks pass, including `SONIOX_API_KEY`; strict completion still waits on off-host R2/S3-compatible audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.
  - Production smoke cleanup removed 1 temporary Playwright session and 2 local audio objects.
  - Real Soniox UI smoke passed with fake microphone speech against production, then cleanup removed 1 temporary Soniox session and 6 local audio objects.

## 2026-07-05 Audio Storage Cutover Audit Tooling

- Environment: production secret env loaded without printing secrets, current production storage target still local through `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - Checked R2/S3/Cloudflare credential presence as booleans only.
  - `pnpm prettier --write apps/web/src/server/audio-storage.ts apps/web/src/server/audio-storage.test.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts`
  - `pnpm format:check`
  - `pnpm typecheck`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/server/audio-storage.test.ts`
  - `pnpm tsx scripts/audit-audio-storage.ts --limit=500`
  - `pnpm tsx scripts/audit-audio-storage.ts --limit=500 --require-current-target`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Server secret env currently has no R2/S3-compatible bucket, endpoint, access key, or secret key variables configured.
  - Format, app typecheck, script typecheck, and targeted audio storage tests passed.
  - Audio storage audit scanned 21 uploaded chunks; all 21 objects were present with no missing objects and no size mismatches.
  - Current-target audit also passed for the current local target.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; when R2/S3 env is configured, strict readiness now also checks that all uploaded chunks are marked on the current off-host target.

## 2026-07-04 Recorder Token No-Cookie Access

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3106`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `E2E_BASE_URL=http://127.0.0.1:3106 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `7` files and `18` tests, including recorder token header/query parsing coverage.
  - Local and production Playwright desktop MVP passed while opening the generated recorder URL in a fresh no-cookie browser context, hiding admin-only History controls there, recording through recorder-token HTTP and WebSocket auth, streaming captions to the viewer, stopping, then exporting from the admin history page.
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Production readiness returned `requiredOk=true`; strict completion remains blocked only by local audio storage until R2/S3-compatible credentials are configured.
  - Production smoke cleanup removed 1 temporary Playwright session and 2 local audio objects.

## 2026-07-04 Recorder Viewer Link Restore

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3105`, and production secret env loaded without printing secrets for admin password sync.
- Commands:
  - `pnpm prettier --write apps/web/src/features/recorder/session-tokens.ts apps/web/src/features/recorder/session-tokens.test.ts apps/web/src/components/NewSessionForm.tsx apps/web/src/components/RecorderClient.tsx e2e/mvp.spec.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/features/recorder/session-tokens.test.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm db:migrate`
  - `pnpm tsx scripts/sync-seed-admin.ts`
  - `E2E_BASE_URL=http://127.0.0.1:3105 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -I -sS https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Unit tests passed with `6` files and `15` tests.
  - Format, lint, TypeScript typecheck, full unit tests, and production build passed.
  - Playwright desktop MVP passed and verified that opening a recorder from the history page, without the original `share` query parameter, restores the same viewer link from same-browser token cache.
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Production readiness returned `requiredOk=true`; strict completion remains blocked only by local audio storage until R2/S3-compatible credentials are configured.
  - Production Playwright desktop MVP passed against `https://babbledeck.aialra.online`.
  - Production smoke cleanup removed 1 temporary Playwright session and 2 local audio objects.

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

## 2026-07-04 Production Standalone and Soniox UI Smoke

- Environment: `https://babbledeck.aialra.online`, standalone Next server under `aialra-babbledeck.service`, recorder WebSocket sidecar under `aialra-babbledeck-ws.service`, production Postgres database `babbledeck_prod`, configured `SONIOX_API_KEY`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test`
  - Script typecheck for `scripts/recorder-ws-server.ts`, `scripts/prune-audio-retention.ts`, `scripts/migrate-audio-storage.ts`, and `playwright.config.ts`.
  - `pnpm lint`
  - `pnpm build`
  - `scripts/prepare-standalone-assets.sh`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - HTTPS smoke for `/` and a static `_next/static` CSS chunk.
  - Minimal Playwright login probe with fake microphone audio.
  - `pnpm e2e` with a temporary smoke admin, `E2E_RUN_BUDGET_TEST=true`, `E2E_RUN_SONIOX_UI_TEST=true`, and a fake microphone WAV converted from the public `brooklyn_bridge.flac` sample.
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Standalone server returned `HTTP/2 200` for the app and static assets with correct CSS MIME type after `.next/static` was copied into the standalone tree.
  - Minimal Playwright login probe reached `/dashboard` with no browser console errors.
  - Production Playwright passed 5/6 tests with 1 intentional mobile skip for the desktop-only real Soniox UI smoke.
  - The Soniox UI smoke created a real Soniox session, used Chromium fake microphone speech, observed expected `Brooklyn` transcript text in the recorder UI and viewer, and confirmed backup chunks.
  - Smoke cleanup removed 5 temporary sessions and 15 local audio objects.

## 2026-07-04 Production Readiness and Seed Admin Audit

- Environment: `https://babbledeck.aialra.online`, production secret env file loaded without printing secrets, production Postgres database `babbledeck_prod`.
- Commands:
  - HTTPS login API probe for `SEED_ADMIN_EMAIL` with `SEED_ADMIN_PASSWORD`.
  - Seed admin password hash check using `verifyPassword` without printing the password.
  - Password hash reset to match `SEED_ADMIN_PASSWORD`, followed by HTTPS login API verification.
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck ... scripts/check-production-readiness.ts`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Initial audit found the seed admin existed and was enabled but its password hash did not match `SEED_ADMIN_PASSWORD`.
  - The seed admin was reset to match `SEED_ADMIN_PASSWORD`, old auth sessions were revoked, and HTTPS login returned `200` with an auth cookie.
  - Readiness audit returned `requiredOk=true`.
  - Strict readiness returned exit code `1` only because R2/S3-compatible off-host audio storage is not configured yet.

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
