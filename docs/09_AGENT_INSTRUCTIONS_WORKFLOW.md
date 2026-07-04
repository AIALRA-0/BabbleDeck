# BabbleDeck Agent Instructions / Workflow

## 1. Role

You are an autonomous-but-reviewed engineering agent building BabbleDeck in the GitHub repository:

```text
https://github.com/AIALRA-0/BabbleDeck.git
```

You may assume push permission is available. Use GitHub as the source of truth for version control.

## 2. Core agent obligations

1. Build the product described in the docs.
2. Do not skip UI testing.
3. Prefer mature libraries and official SDKs.
4. Use MCP/tools/docs proactively.
5. Keep security strong.
6. Commit and push regularly.
7. Maintain progress records.
8. Never commit secrets.

## 3. Required workflow loop

For each task:

```text
1. Read relevant docs.
2. Inspect repo state.
3. Create or update a short task plan.
4. Implement a small vertical slice.
5. Run lint/typecheck/unit tests.
6. Run integration tests if backend changed.
7. Run Playwright real-browser tests if UI changed.
8. Manually inspect screenshots/traces if needed.
9. Fix issues.
10. Update docs/progress logs.
11. Commit.
12. Push.
13. Report summary and next task.
```

## 4. GitHub rules

- Use clear commit messages.
- Push only after tests pass or explicitly mark WIP.
- Do not squash important debugging context during early development.
- Keep main branch stable when possible.
- Use branches for larger features.

Suggested branch naming:

```text
feat/mvp-shell
feat/auth-portal
feat/session-recorder
feat/mock-realtime-provider
feat/soniox-provider
feat/audio-backup
feat/history-export
test/e2e-recorder-viewer
sec/auth-hardening
```

## 5. Real webpage testing rule

This is the most important owner instruction.

Do **not** declare success merely because:

- API route works.
- Backend test passes.
- TypeScript compiles.
- Provider mock emitted events.

A user-facing feature is only done when a real page was opened and tested.

Required for UI features:

- Playwright opens actual route.
- User action is performed through UI.
- The visible result is asserted.
- Mobile viewport is checked when relevant.
- Screenshot/trace generated for critical flows.

## 6. UI style rule

Use modern minimal SaaS UI:

- Notion clarity.
- Linear precision.
- Vercel whitespace.
- shadcn/ui components.

Avoid visual clutter. The live caption screen is a utility screen; it should be calm and readable.

## 7. Mature architecture rule

Do not reinvent:

- UI primitives.
- Form validation.
- Schema validation.
- Password hashing.
- Realtime connection infrastructure.
- Object storage client.
- QR generation.
- Date/time utilities.
- E2E framework.

Use mature packages and official SDKs. Keep wrappers thin and testable.

## 8. MCP/tools rule

Use MCP servers/skills/tools when available:

- Browser automation for real UI testing.
- GitHub for PR/issues/version state.
- Cloudflare for deployment/R2/domain when configured.
- Database tools for schema inspection.
- Official docs via web/MCP.
- Playwright traces/screenshots.

If a current library API is uncertain, consult official docs instead of guessing.

## 9. Security rule

Security is not a later task. Every feature must respect:

- No secrets in git.
- No provider keys client-side.
- No hard-coded admin password.
- All inputs validated.
- Auth required for admin endpoints.
- Tokens hashed at rest.
- Rate limits for sensitive endpoints.
- Audit logs for sensitive actions.

Bootstrap admin:

```text
email: admin@example.invalid
password: read from SEED_ADMIN_PASSWORD only
```

If `SEED_ADMIN_PASSWORD` is missing, the seed script must fail with a clear error. It must never invent or print a password.

## 10. Development phases for Codex

### Phase 0: Repo/document setup

Tasks:

- Clone/inspect repo.
- Add docs if missing.
- Add README setup.
- Add `.gitignore` and `.env.example`.
- Add `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/TEST_RUNS.md`, `docs/KNOWN_ISSUES.md`.

### Phase 1: App skeleton

Tasks:

- Next.js app.
- Tailwind/shadcn.
- Landing page.
- Login page.
- Dashboard shell.
- Responsive layout.
- Playwright smoke.

### Phase 2: Auth and seed

Tasks:

- Postgres/ORM.
- User table.
- Password hash.
- Bootstrap admin seed.
- Login/logout/me.
- Protected dashboard.
- Rate limit.
- E2E login.

### Phase 3: Session shell

Tasks:

- Session model.
- Create session form.
- Recorder page shell.
- Viewer page shell.
- Share token and QR.
- Session list/detail.

### Phase 4: Mock realtime

Tasks:

- WebSocket/SSE infrastructure.
- Mock provider.
- Transcript event model.
- Viewer live update.
- Real-browser E2E with mock events.

### Phase 5: Audio capture and backup

Tasks:

- getUserMedia.
- Mic device selector.
- Volume meter.
- MediaRecorder chunks.
- IndexedDB queue.
- Chunk upload endpoint.
- Backup UI states.

### Phase 6: Soniox provider

Tasks:

- Soniox adapter.
- Audio forwarding.
- Event normalization.
- Usage/cost tracking.
- Provider errors.
- Manual/staging real provider tests.

### Phase 7: History/export

Tasks:

- Transcript timeline.
- Segment editing.
- Export formats.
- Export object storage if needed.
- E2E export.

### Phase 8: Hardening/deployment

Tasks:

- Security headers.
- Rate limits.
- Audit logs.
- CI/CD.
- Cloudflare domain/deployment.
- Production smoke tests.

### Phase 9: Capacitor/Tauri wrappers

Tasks:

- Capacitor app setup.
- Tauri app setup.
- Permissions docs.
- Wrapper smoke tests.

### Phase 10: LiveKit V2

Tasks:

- LiveKit local/dev setup.
- Room creation.
- Track subscription.
- Agent worker.
- Multi-audio provider streams.

## 11. Required progress files

Maintain these in repo:

### docs/CHANGELOG.md

Human-readable changes by date/version.

### docs/DECISIONS.md

Architecture decisions:

```text
ADR-001: WebSocket V1 and LiveKit V2
ADR-002: Soniox as default provider
ADR-003: IndexedDB local audio backup
```

### docs/TEST_RUNS.md

Each major run:

```text
Date
Branch
Commit
Commands
Browser/device
Results
Failures
Screenshots/traces
```

### docs/KNOWN_ISSUES.md

Open bugs and limitations.

## 12. Completion report template

At the end of each Codex run, report:

```text
Summary:
- ...

Files changed:
- ...

Tests run:
- pnpm lint: pass/fail
- pnpm typecheck: pass/fail
- pnpm test: pass/fail
- pnpm test:e2e: pass/fail

Real UI validation:
- Routes tested:
- Viewports tested:
- Screenshots/traces:

Security notes:
- Secrets touched? no/yes
- Auth/rate limits affected? no/yes

Commit/branch:
- Branch:
- Commit:
- Pushed: yes/no

Next recommended task:
- ...
```

## 13. Failure protocol

If blocked:

1. Stop guessing.
2. Inspect logs.
3. Search official docs or use MCP.
4. Reproduce in a minimal test.
5. Document the blocker.
6. Implement a safe fallback.
7. Ask for operator decision only if required.

## 14. Prohibited behavior

- Do not commit plaintext passwords or API keys.
- Do not expose provider keys to client.
- Do not mark backend-only features as complete if UI is untested.
- Do not skip mobile viewport checks for recorder/viewer.
- Do not silently ignore failing tests.
- Do not replace mature libraries with custom rewrites without decision record.
- Do not hard-code production domain assumptions in local-only code.
