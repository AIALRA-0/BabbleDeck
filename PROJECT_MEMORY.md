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

## Next Recommended Tasks

1. Configure production R2/S3 credentials, run the raw audio audit plus migration dry-run, migrate storage off the local object directory, then pass strict readiness.
2. Run one manual live microphone check from a physical browser/device for final hardware confidence.
3. Collect longer real Soniox multilingual traces and compare them against persisted segments for continued alignment confidence.
