# BabbleDeck Test Plan

## 1. Testing philosophy

BabbleDeck must be tested through the actual UI. Backend/API success is necessary but insufficient. Every core feature must be verified in a real browser using Playwright, including mobile viewports, microphone permission states where possible, network interruption simulations, and visual layout checks.

## 2. Test levels

```text
Static checks
  ↓
Unit tests
  ↓
Integration tests
  ↓
API contract tests
  ↓
Realtime protocol tests
  ↓
Playwright E2E real-browser tests
  ↓
Mobile viewport tests
  ↓
Manual device tests
  ↓
Security/performance/recovery tests
```

## 3. Required tooling

- TypeScript strict mode.
- ESLint.
- Prettier.
- Vitest/Jest for unit tests.
- Playwright for E2E.
- MSW or mock provider for deterministic frontend tests.
- Zod schema tests.
- CI through GitHub Actions.

## 4. Test environments

### Local

- Developer machine.
- Mock provider by default.
- Optional Soniox key for live provider tests.

### CI

- No real provider key required for default CI.
- Mock realtime provider.
- Playwright headless browsers.
- Seeded test admin with test password only.

### Staging

- Real provider keys.
- Real database/object storage.
- Real browser smoke tests.

### Production

- Smoke tests only.
- No destructive test data unless flagged.

## 5. Static checks

Run on every PR/commit:

```bash
pnpm lint
pnpm typecheck
pnpm format:check
```

Acceptance:

- No lint/type errors.
- No unused broad `any` unless explicitly justified.
- No secrets detected.

## 6. Unit tests

### Frontend unit tests

Test:

- Caption rendering.
- Session state reducer.
- Provider event normalization.
- Cost estimate calculation.
- Language display mapping.
- Export formatting.

### Backend unit tests

Test:

- Zod request validation.
- Provider adapter mapping.
- Session state transitions.
- Auth password hashing/verification wrapper.
- Budget cap logic.
- Audit logging wrapper.

## 7. Integration tests

Test with database:

- Create user.
- Seed bootstrap admin.
- Login.
- Create session.
- Insert transcript event.
- Finalize segment.
- Export session.
- Upload audio chunk metadata.
- Query history.

Use isolated test database or transaction rollback.

## 8. Realtime protocol tests

Use mock provider.

Scenarios:

1. Recorder connects with valid token.
2. Recorder sends audio frames.
3. Mock provider emits partial transcript.
4. Viewer receives partial transcript.
5. Mock provider emits final transcript and translation.
6. Viewer replaces temporary text with final segment.
7. Recorder stops.
8. Session completes.

Failure cases:

- Invalid recorder token.
- Viewer joins invalid share token.
- Provider error mid-session.
- Budget cap exceeded.
- Recorder disconnects and reconnects.
- Duplicate audio chunk.

## 9. Playwright E2E tests

### Mandatory E2E suite

#### E2E-001: Landing page loads

- Open `/`.
- Verify hero, primary CTA, login link.
- Screenshot desktop and mobile.

#### E2E-002: Admin login

- Open `/login`.
- Log in with seeded test admin.
- Verify dashboard visible.
- Logout.

#### E2E-003: Create session

- Login.
- Click `New live session`.
- Fill title and target language.
- Create.
- Verify recorder page.
- Verify share link and QR presence.

#### E2E-004: Viewer joins

- Create session.
- Open viewer URL in second context.
- Verify viewer connected state.

#### E2E-005: Mock realtime transcript

- Start session using mock provider.
- Trigger mock transcript events through test hook or backend endpoint available only in test env.
- Verify original and translation appear on viewer page.
- Verify partial/final visual distinction.

#### E2E-006: End and export

- Stop session.
- Open session history.
- Export Markdown/TXT/JSON.
- Verify file or export text contains segments.

#### E2E-007: Mobile recorder layout

- Use mobile viewport.
- Verify mic setup card, volume meter area, start button, status bar fit without horizontal scroll.

#### E2E-008: Mobile viewer large captions

- Use mobile viewport.
- Open viewer.
- Toggle large captions.
- Verify readable layout.

#### E2E-009: Error states

- Mock provider failure.
- Verify UI shows provider delayed/error state.
- Verify user-friendly text.

#### E2E-010: Reconnect state

- Simulate network offline/online in Playwright.
- Verify reconnect banner.
- Verify no page crash.

## 10. Real microphone tests

Automated microphone tests are limited by browser permissions. Add manual test checklist:

- Chrome desktop microphone grant.
- Safari iOS microphone grant.
- Chrome Android microphone grant.
- Mic denied recovery.
- External microphone selection where supported.
- Volume meter reacts.
- Clipping warning shows when input is too loud.
- Silence warning shows when no input.

## 11. Mobile device manual test matrix

Minimum:

- iPhone Safari latest.
- Android Chrome latest.
- iPad Safari if available.
- Desktop Chrome.
- Desktop Safari.
- Desktop Edge.

Scenarios:

- Record 5 minutes.
- Lock screen behavior warning.
- Switch app and return.
- Low battery mode visual behavior.
- Network change Wi-Fi to cellular.

## 12. Security tests

### Auth

- Login rate limit.
- Invalid password does not reveal account existence.
- Protected pages redirect when unauthenticated.
- Session cookie is HTTP-only/secure in production.

### Authorization

- Viewer cannot access admin session history.
- Share token cannot mutate session.
- Recorder token cannot access other sessions.

### Input validation

- Invalid REST payloads rejected.
- Invalid WS messages rejected.
- Oversized audio chunk rejected.
- Malicious transcript text escaped.

### Secrets

- `.env.local` ignored.
- No API key in frontend bundle.
- CI scans for obvious secrets.

### OWASP baseline

Map test checklist to OWASP ASVS-inspired controls:

- Authentication.
- Session management.
- Access control.
- Validation/sanitization.
- Stored data protection.
- Error handling/logging.
- File upload/storage.

## 13. Performance tests

### Local smoke

- 1 recorder + 1 viewer.
- 1 recorder + 5 viewers.
- 1 recorder + 20 simulated viewers if feasible.

Measure:

- First result latency.
- Viewer event delivery latency.
- CPU usage.
- Memory growth over 30 minutes.
- DB insert rate.

### Long session test

- Mock provider emits events for 2 hours simulated or accelerated.
- Verify no memory leaks, transcript pagination works, exports complete.

## 14. Backup and recovery tests

### BAK-001: local chunk persists after refresh

- Start recording.
- Create local chunk.
- Refresh.
- Verify unsynced chunk visible in local backup queue.

### BAK-002: upload retry

- Force upload failure.
- Verify chunk status `failed`.
- Restore network.
- Retry upload.
- Verify `uploaded`.

### BAK-003: server object metadata

- Upload chunk.
- Verify object key and DB row.

### BAK-004: export after provider error

- Start session.
- Receive some transcript.
- Provider fails.
- Stop session.
- Verify partial transcript remains in history.

## 15. Provider tests

### Mock provider

Required in CI.

### Soniox provider

Manual/staging tests:

- Connect with real key.
- Stream short English audio.
- Verify original and translation.
- Stream mixed language sample.
- Verify language events.
- Stop session cleanly.
- Verify usage recorded.

### Provider fallback tests

When secondary providers are added:

- Final segment enhancement succeeds.
- Final segment enhancement fails without breaking live transcript.

## 16. Regression suite

Run before release:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:e2e:mobile
pnpm build
```

Attach or store:

- Playwright report.
- Screenshots.
- Trace for failed tests.
- Coverage if available.

## 17. Test reporting

Maintain `docs/TEST_RUNS.md` with:

```text
Date/time
Branch/commit
Environment
Commands run
Results
Failures
Screenshots/traces
Manual devices tested
Known issues
Next action
```

## 18. Release test gates

A release cannot ship unless:

- All critical Playwright flows pass.
- No known secret leaks.
- Auth/session smoke tests pass.
- Create/record/view/stop/export path works on a real browser.
- Mobile viewer and recorder layouts are checked.
- Backup warning and status states exist.
