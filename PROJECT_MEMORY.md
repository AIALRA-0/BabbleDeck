# PROJECT_MEMORY.md — Persistent Project Memory

## Project

- Name: BabbleDeck
- Repo: https://github.com/AIALRA-0/BabbleDeck.git
- Domain target: https://babbledeck.aialra.online
- Strategy: PWA-first realtime speech recognition, translation, recording backup, and transcript export platform.

## Immutable Decisions

- UI style follows modern minimal SaaS patterns inspired by Notion, Linear, Vercel, and shadcn/ui.
- Real browser Playwright validation is required for user-facing work.
- Bootstrap admin email is `admin@example.invalid`; password is read from `SEED_ADMIN_PASSWORD` only.
- Tokens are stored as hashes at rest.
- Mock realtime provider is required for deterministic tests before Soniox staging validation.

## Current Status

- Repository was empty at clone time.
- Development package docs, checklists, and prompt inputs were added.
- Initial pnpm/Turbo monorepo is in place.
- `apps/web` contains a Next.js App Router PWA shell.
- Prisma/PostgreSQL schema covers auth sessions, live sessions, transcript events/segments, translations, audio chunks, exports, glossary terms, provider usage, and audit logs.
- Seed script creates the bootstrap admin only when no admin exists and `SEED_ADMIN_PASSWORD` is set.
- Browser MVP path implemented: login, forced password rotation for seed admins, dashboard, session create, recorder shell, mic test, volume meter, IndexedDB backup with reconnect/retry controls, WebSocket-first recorder audio chunk transport with HTTP fallback, binary audio chunk upload to local/S3-compatible storage, provider audio usage/cost tracking, Soniox realtime adapter scaffolding, budget-cap enforcement with degraded-provider UI, mock transcript events, public viewer SSE with polling fallback, session history, and transcript export.
- Verification passed locally: Prisma validate/generate/migrate, format, lint, typecheck, Vitest unit tests, Next build, and Playwright desktop/mobile MVP E2E.
- Production deployment is live at `https://babbledeck.aialra.online` through systemd service `aialra-babbledeck.service`, Nginx TLS, and production database `babbledeck_prod`.
- Production recorder WebSocket transport is live through `aialra-babbledeck-ws.service` on `127.0.0.1:11971` and Nginx `/ws/recorder` upgrade proxying.
- Production audio object storage currently uses local root `/srv/aialra/storage/babbledeck` with S3/R2-compatible env hooks available for later off-host storage.
- Raw audio storage migration tooling exists in `scripts/migrate-audio-storage.ts`; it dry-runs local source readability, validates byte size/checksum, and can copy existing chunks to configured R2/S3-compatible storage once credentials are provided.
- Production `SONIOX_API_KEY` is configured. Direct Soniox realtime staging and BabbleDeck adapter write-path checks with a public speech sample returned transcript and translation events without provider errors.
- Production backup/restore automation is installed through `aialra-babbledeck-backup.timer`; verified backups restore into a temporary database and temporary audio directory.
- Production raw audio retention automation is installed through `aialra-babbledeck-audio-retention.timer`; it deletes uploaded raw audio objects for ended sessions after the configured retention window and marks chunks `DELETED`.
- Production smoke passed with Playwright desktop/mobile using a temporary smoke admin that was cleaned up afterward, including verification that binary audio chunk files were written before cleanup.
- Budget-cap enforcement and degraded-provider UI are deployed to production; smoke coverage verifies that low-cap Soniox-mode sessions enter `provider_degraded` while audio backup continues.
- After Soniox key configuration, production web and recorder WS services were restarted successfully and Playwright desktop/mobile E2E passed with WebSocket backup plus budget-degraded Soniox coverage.
- Production web now runs through the Next standalone server under systemd, with `.next/static` and `public` copied into the standalone output by `scripts/prepare-standalone-assets.sh`.
- Production recorder UI Soniox validation passed with Chromium fake-microphone speech audio: the UI and viewer received real Soniox transcript text from the fake microphone source without mock caption injection.
- Production seed admin credentials were reset to match `SEED_ADMIN_PASSWORD` and verified through the HTTPS login API without printing the password.
- Recorder pages can now restore the one-time viewer link from same-browser local token cache after reopening from history; the fix is deployed to production and keeps plaintext share tokens out of server-side storage.
- Generated recorder tokens now authorize recorder-page rendering plus start/stop/events/audio upload over HTTP and recorder WebSocket transport, so recorder links work from a no-cookie browser while remaining scoped to one session.
- Raw audio storage cutover now has an audit script that verifies object presence and byte sizes against the configured storage target; production local storage audit currently finds 21 uploaded chunks present with no size mismatches.
- Operators can update raw audio retention days from `/settings`, and session history now exposes per-session raw audio legal hold that prevents retention cleanup for that session.
- Recorder pages expose backup reconnect and pending-chunk retry controls; Playwright seeds a failed IndexedDB chunk and verifies it replays to the server.
- Soniox realtime mapping now advances original transcript segments independently from delayed translations and queues pending translation segment indexes, preventing late translations from forcing later original text back onto an earlier segment.
- GitHub Actions CI now runs format, Prisma validation/generation/migration, lint, app typecheck, unit tests, script typecheck, build, and repository secret scanning; the E2E workflow uses a non-production fallback test password when `SEED_ADMIN_PASSWORD` is not configured.
- Session history now supports audited transcript segment corrections for original and translated text; history display and transcript exports use the corrected values.
- Production readiness can now run an opt-in live Soniox websocket probe with generated WAV silence through `scripts/check-production-readiness.ts --check-soniox-live`; the current production `SONIOX_API_KEY` passed without printing the key.
- Login throttling now enforces both per-IP and per-IP/email attempt windows, with `LOGIN_IP_RATE_LIMIT_PER_MINUTE` documented in `.env.example`.
- Client IP parsing now prefers Nginx-managed `X-Real-IP` and otherwise uses the proxy-appended `X-Forwarded-For` address, protecting rate limits and audit IP hashes from spoofed leading XFF values.
- Cookie-authenticated admin mutation endpoints now enforce same-origin `Origin`/Fetch Metadata checks; recorder-token writes remain available for no-cookie recorder links.
- Production responses now include HSTS, COOP, and Permissions-Policy headers; strict readiness verifies the core security headers as required checks.
- Export generation and server audio chunk uploads now have configurable per-minute rate limits; production E2E confirms normal export and backup upload flows still pass.
- Recorder control requests and transcript event submissions now have configurable per-minute rate limits; production E2E confirms start/stop and mock event flows still pass.
- Session history now exposes SRT alongside Markdown, TXT, JSON, and VTT; production desktop/mobile Playwright verifies all five download formats contain corrected transcript text.
- Recorder microphone denied recovery guidance is now covered by production Playwright using a real Chromium recorder context without automatic microphone permission grants.
- Viewer pages now surface provider-error events as a visible provider issue banner; production Playwright injects a recorder-token provider_error event and verifies the live viewer update.
- The production core Playwright flow now opens the recorder page at a phone viewport for the mobile project, covering mobile recorder controls, backup retry, microphone grant, recording, and stop/history navigation.
- Viewer network resilience now has production Playwright coverage: the test aborts the SSE stream, verifies the UI enters `Polling`, injects transcript events through the recorder API, and confirms the viewer still receives captions.
- Protected admin surfaces now have production Playwright coverage: anonymous browser visits to `/dashboard`, `/sessions/new`, and `/settings` redirect to login, and anonymous admin API calls return `UNAUTHENTICATED`.
- R2 audio storage configuration now derives the standard Cloudflare endpoint from `R2_ACCOUNT_ID`; `R2_ENDPOINT` is only needed for overrides.
- Production services were restarted after the R2 endpoint derivation build; HTTPS headers, strict readiness required checks, anonymous protected-route smoke, and seed-admin login/logout smoke passed on `https://babbledeck.aialra.online`.
- Routine production deploys can now use `pnpm deploy:production`, which locks, force-builds, restarts systemd web/WS services, checks HTTPS/readiness/login, runs anonymous protected-route Playwright smoke, and appends a non-secret deployment record.
- Production raw-audio cutovers can now use `pnpm audio:cutover:production`; it defaults to dry-run source validation, requires `BABBLEDECK_AUDIO_CUTOVER_APPLY=1` before writing objects, migrates batches to the configured off-host target, audits target metadata, and runs strict production deploy smoke.
- R2/S3 audio migrations now skip chunks already marked on the current target by default, so repeated batch runs continue through remaining unmigrated rows. `--include-migrated` is available for intentional rewrites.
- Production now exposes `/api/health` for non-secret uptime monitoring; readiness checks verify that it reports database and audio storage core health.
- Production health monitoring is systemd-managed through `aialra-babbledeck-health-monitor.timer`; it checks `/api/health` every five minutes and writes non-secret JSONL records to `/srv/aialra/logs/babbledeck/health-monitor.jsonl`.
- Production log rotation can be installed with `pnpm logs:install:production`; readiness checks `/etc/logrotate.d/aialra-babbledeck` for BabbleDeck `.log` and `.jsonl` files.
- Production latest-backup restore verification can be installed with `pnpm backup:verify:install:production`; readiness checks that `aialra-babbledeck-backup-verify.timer` is active and that a recent verification marker exists.

## Next Recommended Tasks

1. Configure production R2/S3 credentials, run `pnpm audio:cutover:production`, rerun with `BABBLEDECK_AUDIO_CUTOVER_APPLY=1`, and pass strict readiness.
2. Run one manual live microphone check from a physical browser/device for final hardware confidence.
3. Collect longer real Soniox multilingual traces and compare them against persisted segments for continued alignment confidence.
