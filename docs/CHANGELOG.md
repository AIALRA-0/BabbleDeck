# Changelog

## 2026-07-06

- Changed production web deploys to publish immutable standalone release directories under `/srv/aialra/releases/babbledeck` and restart the web service through a stable `current` symlink.
- Added deployment-time pruning for immutable web release directories, keeping the newest releases plus the active `current` symlink target and recording the non-secret prune summary in deployment JSONL.
- Added a production deployment disk-space preflight that checks app, release, log, and temp filesystems before build/restart and records the non-secret disk summary in deployment JSONL.
- Added a production build-cache cleanup command that removes only rebuildable Turbo, Next, pnpm, Gradle, and Rust/Tauri intermediate caches while preserving deployed releases and native runtime artifacts.
- Fixed production static-asset readiness so it reads the active immutable release before falling back to local workspace build output.
- Added build-time release metadata to `/api/health` so production can report the deployed git commit, branch, and build timestamp without exposing secrets, and made the deployment smoke verify the expected release commit.
- Fixed strict Next build typing for export downloads by narrowing the export format before selecting the response content type.
- Expanded production deployment JSONL records with non-secret readiness summaries and web/recorder systemd service state, result, start time, and restart counts.
- Strengthened native/device readiness reporting with Android APK and desktop binary artifact metadata plus an optional Tauri/Xvfb headless launch smoke, and rebuilt the Android debug APK against the production PWA.
- Strengthened production device runtime evidence so manual Android, iOS, and desktop evidence records include the live `/api/health` release commit and readiness rejects stale evidence from older releases.
- Revalidated the refreshed production Soniox key against the deployed site with live readiness, recorder smoke, UI fake-microphone smoke, and a long trace; required readiness is green while external storage/device evidence gates remain open.
- Added a production device runtime evidence command and wired recent Android, iOS, and desktop evidence into strict production readiness as an external completion gate.
- Added a production device runtime readiness command for Android, iOS, and desktop wrapper prerequisites against the deployed production PWA, with non-secret strict-mode gating for physical-device follow-up.

## 2026-07-05

- Added a production audio cutover readiness report command that checks non-secret R2/S3 target inputs, local source audio files, uploaded chunk counts, and current-target migration metadata before off-host cutover.
- Added recorder-track URLs for Main recorder, Speaker A, and Speaker B, and serialized per-session transcript appends so parallel recorder pages cannot collide on transcript event sequence numbers.
- Propagated Soniox recorder WebSocket track metadata into provider-generated transcript events, and extended the production Soniox smoke to assert persisted track events and segments from a real audio file.
- Added transcript track timelines with per-track segment indexes, speaker labels, export metadata, and production Playwright coverage for independent Speaker A/B captions.
- Added real-browser network recovery states for viewer and recorder pages, with production Playwright coverage that simulates offline/online recovery on the deployed site.
- Short-circuited suspicious production probe paths in the Next proxy so dotfile/config/PHP scanner requests and quoted fake static-asset requests return plain `404` responses without invoking app not-found rendering.
- Revalidated production after the Soniox key update with a deployed long trace: live Soniox websocket readiness passed, the UI trace persisted transcript/audio/provider-usage evidence, and web/recorder services remained active with `NRestarts=0`.

## 2026-07-04

- Added the BabbleDeck development documentation package.
- Initialized the pnpm/Turbo + Next.js + Prisma project structure.
- Added bootstrap admin seed flow using `SEED_ADMIN_PASSWORD`.
- Implemented the first browser MVP path with auth, session creation, recorder, viewer, history, backup indicators, and exports.
- Added SSE viewer streaming with polling fallback.
- Added binary audio chunk upload with local and S3/R2-compatible object storage adapters.
- Deployed production local audio storage under `/srv/aialra/storage/babbledeck` and verified it through Playwright smoke tests.
- Added enforced password rotation UI/API for seed admins.
- Added provider audio usage/cost tracking and admin usage visibility.
- Added production Postgres/audio backup scripts, restore verification, and a systemd backup timer.
- Added production raw audio retention automation and audio storage migration tooling for R2/S3 cutover.
- Validated configured Soniox realtime credentials with a real speech sample and improved bridge shutdown/keepalive handling.
- Switched production web service to the Next standalone server with copied static assets.
- Added opt-in real Soniox recorder UI smoke coverage with Chromium fake microphone audio, and limited mock caption injection to the mock provider.
- Restored one-time viewer links on reopened recorder pages through same-browser token caching, without storing plaintext share tokens server-side.
- Scoped recorder tokens now authorize no-cookie recorder links for page access, start/stop, transcript events, audio upload, and WebSocket backup.
- Added raw audio storage target audit tooling and stricter off-host migration readiness checks for the R2/S3 cutover.
- Added operator-managed raw audio retention days and per-session raw audio legal hold.
- Added recorder-side local backup reconnect and pending-chunk retry controls.
- Hardened Soniox realtime token-to-segment mapping for delayed and queued translation responses.
- Hardened GitHub Actions CI with format/schema/script checks, secret scanning, and deterministic fallback E2E credentials.
- Added audited transcript segment corrections from session history, with corrected text flowing into exports.
- Added an opt-in live Soniox realtime readiness probe that verifies websocket credentials with generated WAV silence.
- Hardened login rate limiting with both per-IP and per-IP/email attempt limits.
- Hardened trusted proxy client IP parsing for rate limits and audit logs.
- Added same-origin mutation guards for cookie-authenticated admin writes while preserving recorder-token flows.
- Added HSTS and stricter production security header readiness checks.
- Added rate limits for transcript export generation and server audio chunk uploads.
- Added rate limits for recorder control actions and transcript event submissions.
- Exposed SRT downloads in session history and expanded real-browser export coverage across Markdown, TXT, JSON, SRT, and VTT.
- Added real-browser recorder coverage for blocked microphone access and recovery guidance.
- Added viewer provider-error UI and real-browser coverage for provider error events.
- Expanded the production core browser flow so the mobile project exercises the recorder page at a phone viewport.
- Added real-browser coverage for viewer SSE failure fallback to polling.
- Added real-browser/API coverage that anonymous users are redirected or denied on protected admin surfaces.
- Allowed Cloudflare R2 audio storage to derive the standard endpoint from `R2_ACCOUNT_ID`.
- Added a systemd-aware production deployment wrapper with readiness, login, and Playwright smoke checks.
- Added a guarded production raw-audio cutover wrapper and made R2/S3 migrations skip chunks already marked on the current target.
- Added a non-secret production health endpoint and wired it into readiness checks.
- Added a systemd production health monitor timer that records non-secret `/api/health` checks.
- Added production logrotate installation for BabbleDeck `.log` and `.jsonl` files.
- Added a systemd latest-backup restore verification timer and readiness check.
- Added a systemd production metrics snapshot timer and readiness check.
- Added a production viewer load-smoke script and readiness check.
- Added a production security baseline audit and readiness check.
- Added request correlation headers, structured request logs, and an app error boundary.
- Queued Soniox recorder audio sends before close so a fast recorder stop cannot send end-of-audio before the first chunk.
- Added a production audio storage preflight that writes, heads, and deletes a temporary object before R2/S3 cutover.
- Added local health alert and recovery events for consecutive production health monitor failures.
- Added a production Soniox recorder WebSocket smoke and readiness check.
- Added Capacitor and Tauri wrapper scaffolds that load the deployed production PWA and verify secure wrapper config.
- Added production readiness checks for unexpected systemd auto-restarts on the web and recorder WebSocket services.
- Fixed the Tauri desktop scaffold crate layout, added a generated app icon, installed Linux Tauri prerequisites on the server, and validated cargo check, native release build, and headless startup smoke.
- Added a production Soniox UI smoke that generates fake-microphone speech, runs the real deployed recorder/viewer flow in Chromium, writes a non-secret JSONL marker, and is checked by production readiness.
- Added the Capacitor Android platform project and Android wrapper build scripts, installed the server Android SDK/JDK toolchain, and validated Android Gradle project resolution plus debug APK assembly.
- Added the Capacitor iOS platform project with Swift Package Manager integration, split mobile sync scripts by platform, and verified Android/iOS native microphone permission declarations.
- Hardened R2 audio storage config so `AUDIO_STORAGE_DRIVER=r2` uses the required `auto` S3 SDK region even when operators use the generic `AUDIO_STORAGE_BUCKET` variable.
- Added a guarded production audio storage env configuration wrapper that preflights a temporary R2/S3 env before installing it with a timestamped backup.
- Added the first LiveKit V2 foundation with official server SDK token generation, recorder/admin publisher tokens, viewer subscriber tokens, and non-secret configured status.
- Added guarded LiveKit production configure and preflight wrappers that validate token grants and management API connectivity before installing LiveKit env changes.
- Added browser LiveKit room-audio publishing/subscribing with recorder/viewer fallback states when LiveKit is not configured.
- Added self-hosted production LiveKit installation on the existing systemd/Nginx server through same-domain `/livekit/`, plus a guarded production UI smoke that verifies recorder publishing and viewer room-audio subscription.
- Added LiveKit production readiness evidence checks for configured credentials, the self-hosted systemd service, restart count, and recent passing UI smoke.
- Added a recorder microphone input selector backed by browser device enumeration, with desktop/mobile Playwright coverage that keeps the selector locked during active recording.
- Added admin settings management for persisted default session language/budget, glossary CRUD, and a read-only audit log view with desktop/mobile Playwright coverage.
- Added viewer caption controls for translation-only, bilingual, and original-only modes, large/compact captions, light/dark theme switching, and copying the visible transcript.
- Added recorder microphone input health feedback for no-input and clipping states, with real-browser coverage using controlled silent and high-gain audio streams.
- Added recorder-side cleanup for uploaded IndexedDB backup chunks, preserving pending/failed recovery chunks, with local and production Playwright coverage.
- Added a longer production Soniox trace that records through the deployed UI, verifies persisted segments/translations/audio chunks/provider usage, archives the trace session, and is checked by strict readiness.
