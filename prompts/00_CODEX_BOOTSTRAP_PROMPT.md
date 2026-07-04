# Codex Bootstrap Prompt — BabbleDeck Long-Horizon End-to-End Build

You are Codex acting as the long-horizon engineering agent for **BabbleDeck**.

## Mission

Build BabbleDeck: a secure, multi-endpoint real-time speech recognition, translation, recording, and transcript display platform.

Core selected architecture:

> **PWA Web App + Capacitor Mobile + Tauri Desktop + Soniox Realtime + LiveKit/WebSocket Hybrid**

Repository:

```text
https://github.com/AIALRA-0/BabbleDeck.git
```

Production domain target:

```text
https://babbledeck.aialra.online
```

You may assume GitHub push permissions are available. Use GitHub for version control continuously.

## Non-negotiable owner requirements

1. Prefer **real webpage interaction testing** over backend-only/API-only validation. Passing API tests is not enough. Test the actual UI flows in a browser with Playwright and screenshots/traces. Cover desktop, mobile viewport, low network, reconnect, microphone permission, real session flows, and history flows.
2. UI style must follow modern minimal SaaS aesthetics inspired by **Notion / Linear / Vercel / shadcn-ui**. Use shadcn/ui and Tailwind where possible. Avoid heavy, noisy, consumer-app styling.
3. Do **not** reinvent mature architecture. Reuse stable, mature libraries and official SDKs whenever possible. Optimize and integrate; do not build custom versions of solved infrastructure.
4. Proactively use available MCP servers, skills, official docs, browser automation, GitHub tooling, Cloudflare tooling, database tooling, and mature open resources. Do not be stingy with tool use when it improves correctness.
5. Website security must be serious from day one: OWASP ASVS-inspired controls, strong authentication, secret isolation, rate limits, CSRF/session handling, CORS, input validation, file upload limits, audit logs, and no plaintext secrets in the repo.
6. The site must have a bootstrap portal admin account:
   - Email: `admin@example.invalid`
   - Password: must be read from environment variable `SEED_ADMIN_PASSWORD` during seed/bootstrap.
   - Never hard-code, commit, log, or print the password. The operator will provide the value via `.env.local`, deployment secret, or secure secret manager. Force password rotation after first successful login if practical.

## Required document inputs

Before coding, read and obey these docs in order:

1. `docs/01_PROJECT_PLAN.md`
2. `docs/02_PRD.md`
3. `docs/03_TECHNICAL_DESIGN.md`
4. `docs/04_TEST_PLAN.md`
5. `docs/05_DATABASE_DESIGN.md`
6. `docs/06_API_SPECIFICATION.md`
7. `docs/07_UI_UX_SPEC.md`
8. `docs/08_CODING_STANDARDS_TECH_STACK.md`
9. `docs/09_AGENT_INSTRUCTIONS_WORKFLOW.md`
10. `docs/10_SECURITY_AND_OPERATIONS.md`
11. `docs/11_IMPLEMENTATION_BACKLOG.md`
12. `templates/ENV_EXAMPLE.md`
13. `checklists/RELEASE_CHECKLIST.md`
14. `checklists/AGENT_DAILY_CHECKLIST.md`

If these files are not in the repo yet, add them first from the package.

## Development process

Use an iterative, verifiable workflow:

```text
1. Pull latest main.
2. Inspect current repo state.
3. Create/update docs if missing.
4. Create a short implementation plan for the current milestone.
5. Implement one small vertical slice.
6. Run lint/typecheck/unit tests.
7. Run API/integration tests.
8. Run Playwright real-browser E2E tests.
9. Capture screenshots/traces for critical flows.
10. Fix all failures.
11. Commit with clear message.
12. Push branch or main as appropriate.
13. Update CHANGELOG / progress log.
```

## Git rules

- Default branch should remain stable.
- Prefer feature branches for major changes:
  - `feat/mvp-session-flow`
  - `feat/realtime-soniox-provider`
  - `feat/audio-backup-indexeddb`
- Use clear conventional commits:
  - `feat: add realtime session creation flow`
  - `test: add mobile recorder e2e coverage`
  - `fix: recover websocket after network loss`
- Push often after passing tests.
- Never commit secrets, `.env.local`, API keys, credentials, raw private recordings, or production logs.

## Target stack

Frontend:

```text
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui
Zustand or TanStack Query where appropriate
PWA support
AudioWorklet + MediaRecorder + IndexedDB
Playwright E2E
```

Mobile/Desktop wrappers:

```text
Capacitor for iOS/Android wrapper
Tauri for Windows/macOS/Linux desktop wrapper
```

Backend:

```text
Node.js / NestJS or Next.js API route + separate worker, choose cleanest maintainable route
WebSocket/SSE realtime gateway
Provider adapter layer
Soniox realtime provider as default
Azure Translator final-segment enhancement optional
OpenAI optional retranslate/summarize fallback
PostgreSQL
Redis or Upstash Redis for sessions/events if needed
Cloudflare R2/S3-compatible object storage
```

Realtime transport:

```text
V1: WebSocket for one-recorder/many-viewer sessions
V2: LiveKit for multi-speaker/multi-microphone sessions
```

Testing:

```text
Vitest/Jest unit tests
API/integration tests
Playwright real browser E2E tests
Mobile viewport tests
Network interruption tests
Security smoke tests
```

## Product MVP scope

Implement MVP around one-recorder/many-viewer:

1. Landing page.
2. Auth and portal with bootstrap admin seed.
3. Create live session.
4. Recorder page with microphone permission, mic test, volume meter, start/stop, local backup indicator.
5. Viewer page with session join link/QR, live original transcript, live translation, final-segment stabilization.
6. Soniox realtime integration behind provider interface.
7. Session history page.
8. Transcript export: Markdown, TXT, JSON, SRT/VTT where practical.
9. Local audio chunk backup in IndexedDB and server upload to R2.
10. Cost estimate per session and provider usage log.
11. Basic admin settings: provider keys status, default target language, budget limits.

## Testing must be real-webpage-first

Do not mark a task done unless you have:

- Run the app locally.
- Opened the real page in Playwright or browser.
- Tested the actual user path.
- Checked mobile viewport.
- Verified visual layout and interactions.
- Verified error handling.
- Verified persistence or backup where relevant.

Backend-only tests are necessary but insufficient.

## UX principles

- Modern minimal SaaS: Notion/Linear/Vercel/shadcn style.
- Large readable live captions.
- Mobile-first recorder UX.
- No complex settings before first successful use.
- Transparent states: listening, reconnecting, uploading backup, translating, offline, cost estimate.
- No scary technical jargon in user-facing copy.

## Safety and secrets

- Store all secrets in env vars or platform secret manager.
- Never commit `.env.local`.
- `.env.example` must contain placeholders only.
- Never hard-code `SEED_ADMIN_PASSWORD`.
- Force admin bootstrap only if no admin exists.
- Use strong password hashing.
- Use HTTP-only secure cookies if cookie auth is used.
- Add rate limiting to auth and realtime token endpoints.
- Validate all inbound payloads with Zod or equivalent.
- Restrict audio upload size and type.
- Add audit events for login, session create/delete/export, provider errors, admin changes.

## Acceptance criteria for first MVP

A reviewer can do this from a real browser:

1. Visit `http://localhost:3000`.
2. Log in as seeded admin using email `admin@example.invalid` and password supplied through local env.
3. Create a live session.
4. Grant microphone permission.
5. See live input volume meter.
6. Start recording.
7. Open viewer link in a second browser/mobile viewport.
8. See live transcript events appear.
9. Stop recording.
10. See session history.
11. Export transcript.
12. Confirm local/server backup indicators are correct.
13. Run Playwright tests covering this flow.
14. Push code to GitHub.

## Ongoing maintenance protocol

Maintain:

- `docs/CHANGELOG.md`
- `docs/DECISIONS.md` for architecture decision records
- `docs/KNOWN_ISSUES.md`
- `docs/TEST_RUNS.md` with dates, commands, screenshots/traces paths
- GitHub issues or checklist for backlog items

At the end of every agent session, summarize:

```text
What changed
What commands/tests ran
What failed and how it was fixed
What remains
Next recommended task
Commit hash / branch
```
