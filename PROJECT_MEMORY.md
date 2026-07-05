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
- Browser MVP path implemented: login, forced password rotation for seed admins, dashboard, session create with persisted admin defaults, recorder shell, mic test, microphone input selector where browser device enumeration is available, volume meter, IndexedDB backup with reconnect/retry controls, WebSocket-first recorder audio chunk transport with HTTP fallback, binary audio chunk upload to local/S3-compatible storage, provider audio usage/cost tracking, Soniox realtime adapter scaffolding, budget-cap enforcement with degraded-provider UI, mock transcript events, public viewer SSE with polling fallback, session history, and transcript export.
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
- Operators can update persisted default session language/budget, glossary terms, and raw audio retention days from `/settings`; the same page also exposes a read-only audit log, and session history exposes per-session raw audio legal hold that prevents retention cleanup for that session.
- Recorder pages expose backup reconnect and pending-chunk retry controls; Playwright seeds a failed IndexedDB chunk and verifies it replays to the server.
- Soniox realtime mapping now advances original transcript segments independently from delayed translations and queues pending translation segment indexes, preventing late translations from forcing later original text back onto an earlier segment.
- GitHub Actions CI now runs format, Prisma validation/generation/migration, lint, app typecheck, unit tests, script typecheck, build, and repository secret scanning; the E2E workflow uses a non-production fallback test password when `SEED_ADMIN_PASSWORD` is not configured.
- Session history now supports audited transcript segment corrections for original and translated text; history display and transcript exports use the corrected values.
- Production readiness can now run an opt-in live Soniox websocket probe with generated WAV silence through `scripts/check-production-readiness.ts --check-soniox-live`; the current production `SONIOX_API_KEY` passed without printing the key.
- Soniox recorder shutdown now waits for queued audio sends before sending the provider end-of-audio frame; regression coverage locks the fast recorder-close order as config, audio, then end.
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
- Production R2/S3 env setup can now use `pnpm audio:configure:production`; it builds a patched env from the current shell, runs off-host preflight against the temporary env by default, and only then installs the production env with a timestamped backup and non-secret JSONL record.
- Production off-host audio targets can now be checked with `pnpm audio:preflight:production`; the preflight writes, heads, and deletes a temporary object before any raw audio migration is attempted.
- R2/S3 audio migrations now skip chunks already marked on the current target by default, so repeated batch runs continue through remaining unmigrated rows. `--include-migrated` is available for intentional rewrites.
- R2 audio storage config now uses S3 SDK `region=auto` whenever `AUDIO_STORAGE_DRIVER=r2` selects the target, even if operators prefer generic `AUDIO_STORAGE_BUCKET` credentials over the `R2_BUCKET` aliases.
- The R2 generic-bucket region hardening has been deployed to production; production health and strict live Soniox readiness still pass, while `pnpm audio:preflight:production` still fails only because production remains on local audio storage.
- Production now exposes `/api/health` for non-secret uptime monitoring; readiness checks verify that it reports database and audio storage core health.
- Production health monitoring is systemd-managed through `aialra-babbledeck-health-monitor.timer`; it checks `/api/health` every five minutes, writes non-secret JSONL records to `/srv/aialra/logs/babbledeck/health-monitor.jsonl`, and writes local alert/recovery events when consecutive failures cross the configured threshold.
- Production log rotation can be installed with `pnpm logs:install:production`; readiness checks `/etc/logrotate.d/aialra-babbledeck` for BabbleDeck `.log` and `.jsonl` files.
- Production latest-backup restore verification can be installed with `pnpm backup:verify:install:production`; readiness checks that `aialra-babbledeck-backup-verify.timer` is active and that a recent verification marker exists.
- Production metrics snapshots can be installed with `pnpm metrics:install:production`; readiness checks that `aialra-babbledeck-metrics.timer` is active and that a recent non-secret JSONL metrics record exists.
- Production viewer load smoke can be run with `pnpm load:smoke:production -- --viewers=N`; readiness checks for a recent passing non-secret JSONL load-smoke record.
- Production Soniox recorder WebSocket smoke can be run with `pnpm soniox:smoke:production`; readiness checks for a recent passing non-secret JSONL smoke record covering session create/start, public recorder WS audio upload, provider usage, and no provider errors.
- Production Soniox UI smoke can be run with `pnpm soniox:ui-smoke:production`; it generates a temporary speech WAV, feeds it to Chromium as fake microphone input on the real production UI, verifies recorder and viewer captions, writes a non-secret JSONL marker, and is now part of required readiness evidence.
- Production LiveKit UI smoke can be run with `pnpm livekit:ui-smoke:production`; it opens recorder and viewer pages on the deployed domain, verifies recorder room-audio publishing plus viewer `Audio live`, writes a non-secret JSONL marker, and is now part of required readiness evidence when LiveKit credentials are configured.
- Production security baseline can be run with `pnpm security:audit:production`; readiness checks for a recent passing non-secret JSONL audit covering repo hygiene, env placeholders, live security headers, unauthenticated admin API protection, CSRF rejection, and non-secret health output.
- Production web responses now carry `x-request-id` and `x-correlation-id`; production request middleware writes structured JSON request logs, and the App Router has a client error boundary that emits structured `ui.error_boundary` logs.
- Native wrapper scaffolds exist in `apps/mobile` (Capacitor) and `apps/desktop` (Tauri), both defaulting to the deployed production PWA for live-site-first wrapper testing; `pnpm wrappers:check` verifies HTTPS production URLs, the committed Android and iOS wrapper projects, native microphone permission declarations, and no default Tauri remote capabilities. Capacitor Doctor passes, the Android SDK/JDK toolchain is installed on the server, `pnpm --filter @babbledeck/mobile native:check:android` validates the Android Gradle project, and `pnpm --filter @babbledeck/mobile native:build:android` produces a debug APK. The iOS project uses Capacitor Swift Package Manager integration and `pnpm --filter @babbledeck/mobile native:check:ios` verifies the Xcode metadata on Linux, while actual iOS build/run still needs macOS. The Linux Tauri prerequisites are installed, `tauri info` reports a healthy desktop toolchain, `cargo check` validates the desktop crate, `pnpm --filter @babbledeck/desktop native:build` produces a Linux release binary, and the headless Xvfb smoke keeps the app alive until timeout.
- LiveKit V2 room audio is production-configured: `livekit-server-sdk` creates short-lived room tokens, `/api/sessions/:id/livekit-token` issues recorder/admin publisher tokens, `/api/viewer/session/:shareToken/livekit-token` issues viewer subscriber tokens, `livekit-client` publishes the recorder microphone track and subscribes viewer audio, and health/settings expose only non-secret configured status.
- Production LiveKit is self-hosted through `aialra-babbledeck-livekit.service` behind the same-domain Nginx `/livekit/` proxy, with signal port `11972`, WebRTC TCP `7881`, UDP `50000-50020`, Redis at `127.0.0.1:6379`, and TURN disabled because coturn owns the standard TURN port.
- Production LiveKit env setup can use `pnpm livekit:selfhost:install:production` plus `pnpm livekit:configure:production`; configure prepares a patched env from the current shell, runs `pnpm livekit:preflight:production` against the temporary env by default, and only installs the env after token grant and management API checks pass.
- Production readiness checks `NRestarts=0` for the web and recorder WebSocket systemd services, after a one-off web service `SIGSEGV` during security-baseline probing showed that active/running alone can mask an auto-restart.
- After the latest production deploy, `https://babbledeck.aialra.online` reports Soniox and LiveKit configured, LiveKit preflight passed through `/livekit`, LiveKit UI smoke passed, Soniox recorder and UI smokes passed, and strict live readiness has all required checks passing while the only remaining external failure is local audio storage.
- Cloudflare/R2 provisioning is not currently authenticated on the server: `wrangler whoami` reports not logged in, and no inspected server secret files expose Cloudflare/R2/S3/AWS credential variable names for BabbleDeck.

## Next Recommended Tasks

1. Configure production R2/S3 credentials, run `pnpm audio:preflight:production`, run `pnpm audio:cutover:production`, rerun with `BABBLEDECK_AUDIO_CUTOVER_APPLY=1`, and pass strict readiness.
2. Run the Android APK on a physical Android device, run iOS Capacitor on a macOS/iOS toolchain, and run desktop wrapper camera/microphone behavior in a real desktop session against `https://babbledeck.aialra.online`.
3. Run one manual live microphone check from a physical browser/device for final hardware confidence.
4. Collect longer real Soniox multilingual traces beyond the short automated UI smoke and compare them against persisted segments for continued alignment confidence.
