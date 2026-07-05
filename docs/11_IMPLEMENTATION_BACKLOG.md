# BabbleDeck Implementation Backlog

This backlog is written as issue-sized tasks for Codex/agents. Each task must follow the agent workflow and real-browser testing rules.

## Epic 0: Repository and documentation

### BDK-0001 Add development package docs

- Add all docs to repo.
- Add package index.
- Add progress docs placeholders.

Acceptance:

- Docs committed.
- README links docs.

### BDK-0002 Initialize project skeleton

- Create Next.js App Router project if repo empty.
- Add TypeScript strict.
- Add Tailwind.
- Add shadcn/ui.
- Add lint/format/test scripts.

Acceptance:

- `pnpm lint`, `pnpm typecheck`, `pnpm build` pass.

### BDK-0003 Add CI skeleton

- GitHub Actions workflow.
- Lint/typecheck/test/build.

Acceptance:

- CI passes on push.

## Epic 1: Auth and portal

### BDK-0101 Database and ORM setup

- Add Postgres ORM.
- Add users/auth_sessions tables.
- Add migration scripts.

Acceptance:

- Migration runs locally.

### BDK-0102 Bootstrap admin seed

- Seed admin email `admin@example.invalid`.
- Read password from `SEED_ADMIN_PASSWORD`.
- Fail if missing and no admin exists.

Acceptance:

- No plaintext password in repo.
- Seed test passes.

### BDK-0103 Login/logout UI and API

- Login page.
- Auth API.
- Logout.
- Protected dashboard.
- Rate limit login.

Acceptance:

- Playwright login/logout pass.

## Epic 2: Session shell

### BDK-0201 Session schema and API

- Add live_sessions table.
- Add create/list/detail endpoints.
- Generate share token and recorder token.

Acceptance:

- API integration tests pass.

### BDK-0202 New session UI

- Form for title, target language, provider mode, budget cap.
- Navigate to recorder page.

Acceptance:

- Playwright create session flow pass.

### BDK-0203 Viewer and recorder shell

- Recorder page with session title/share QR.
- Viewer page with session title/status.

Acceptance:

- Viewer link opens in second browser context.

## Epic 3: Realtime mock provider

### BDK-0301 Canonical realtime event types

- Add shared types/schemas.
- Add event validation.

Acceptance:

- Unit tests for schema.

### BDK-0302 WebSocket/SSE live event channel

- Implement server live event broadcaster.
- Viewer subscribes.

Acceptance:

- Mock event appears on viewer page.

### BDK-0303 Mock provider

- Deterministic transcript/translation events.
- Test-only controls.

Acceptance:

- E2E can simulate live captions without API keys.

## Epic 4: Audio capture and backup

### BDK-0401 Microphone permission and meter

- getUserMedia.
- Device selector.
- Volume meter.
- Silence/clipping warnings.

Acceptance:

- Manual and UI tests validate states.

### BDK-0402 Local audio backup

- MediaRecorder chunks.
- IndexedDB queue.
- Upload status UI.

Acceptance:

- Refresh does not delete unsynced chunks.

### BDK-0403 Server chunk upload

- Upload endpoint.
- Local and R2/S3-compatible storage client.
- audio_chunks table.

Acceptance:

- Chunk metadata stored and binary object uploaded.

## Epic 5: Soniox provider

### BDK-0501 Soniox provider adapter

- Connect to Soniox realtime API.
- Normalize events.
- Handle language/translation tokens.

Acceptance:

- Staging/manual real provider test works.

### BDK-0502 Provider usage and cost tracking

- Log audio seconds.
- Estimate cost.
- Enforce configured budget cap and mark the session `provider_degraded` when the cap is reached. (implemented)

Acceptance:

- Session usage, estimated cost, and degraded-provider status are visible in admin. (implemented)

## Epic 6: History and exports

### BDK-0601 Transcript event and segment persistence

- transcript_events.
- transcript_segments.
- translations.

Acceptance:

- Final events persist and display.

### BDK-0602 Session history UI

- Timeline.
- Original and translation.
- Edit segment.

Acceptance:

- Playwright history flow pass.

### BDK-0603 Export formats

- Markdown.
- TXT.
- JSON.
- SRT/VTT if timestamps.

Acceptance:

- Export downloads/returns correct content.

## Epic 7: Security and ops

### BDK-0701 Security headers and CSRF/session hardening

Acceptance:

- Headers present in production-like env.

### BDK-0702 Audit logs

Acceptance:

- Login/session/export/edit events logged.

### BDK-0703 Provider failure handling

Acceptance:

- UI shows degraded state and preserves backup.

## Epic 8: Deployment

### BDK-0801 Configure production deployment

- Deploy to chosen platform.
- Configure domain `babbledeck.aialra.online`.
- Configure secrets.

Acceptance:

- Production smoke test passes.

### BDK-0802 Playwright production smoke

Acceptance:

- Landing/login/session smoke on production domain.

## Epic 9: Capacitor and Tauri wrappers

### BDK-0901 Capacitor wrapper

Acceptance:

- Mobile app dev wrapper runs.

Progress:

- Scaffolded `apps/mobile` with Capacitor config that defaults to the deployed
  production PWA for live-site-first wrapper testing.
- Added `pnpm --filter @babbledeck/mobile check` and root `pnpm wrappers:check`
  verification.
- Added the Android Capacitor platform project, normalized the pnpm Gradle
  module path after sync, installed the server Android SDK/JDK toolchain, and
  verified `native:check:android` plus `native:build:android`.
- Added the iOS Capacitor platform project with Swift Package Manager
  integration and verified project metadata plus native microphone permission
  declarations with `native:check:ios`.

### BDK-0902 Tauri wrapper

Acceptance:

- Desktop app dev wrapper runs.

Progress:

- Scaffolded `apps/desktop` with Tauri 2 config that defaults to the deployed
  production PWA for live-site-first wrapper testing.
- Added `pnpm --filter @babbledeck/desktop check` and root `pnpm wrappers:check`
  verification.
- Fixed the Rust crate layout, added the app icon, and verified Linux
  `native:check`, `native:build`, and `native:smoke:headless` on the server.

## Epic 10: LiveKit V2

### BDK-1001 LiveKit local integration

Acceptance:

- Local LiveKit room can publish/subscribe audio.

Progress:

- Added optional LiveKit V2 server-side token generation using the official
  LiveKit JS server SDK.
- Added recorder/admin publisher token API and viewer subscriber token API.
- Added non-secret LiveKit configured status to settings and health responses.
- Local room publish/subscribe still requires `LIVEKIT_URL`,
  `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` plus a running LiveKit server.

### BDK-1002 Multi-track provider worker

Acceptance:

- Two audio tracks produce independent transcript timelines.
