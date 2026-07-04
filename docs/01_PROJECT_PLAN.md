# BabbleDeck Project Plan

## 1. Project identity

Product name: **BabbleDeck**  
Repository: `https://github.com/AIALRA-0/BabbleDeck.git`  
Production domain target: `https://babbledeck.aialra.online`

## 2. Vision

BabbleDeck is a multi-endpoint realtime speech capture, transcription, translation, and transcript management platform. It should be as easy to access as a webpage and as reliable as a dedicated app.

Primary MVP:

> One recorder device captures audio. Multiple viewer devices read live original transcript and translated captions. Sessions are recorded, backed up, searchable, exportable, and recoverable after failures.

Long-term product:

> A cross-platform realtime translation workspace for conferences, classes, field research, interviews, events, and personal multilingual note-taking.

## 3. Selected architecture

```text
PWA Web App
+ Capacitor Mobile
+ Tauri Desktop
+ Soniox Realtime
+ LiveKit/WebSocket Hybrid
```

V1 uses WebSocket for one-recorder/many-viewer. V2 adds LiveKit for multi-speaker/multi-microphone and remote room audio.

## 4. Project goals

### G1. Real-time usefulness

- Low-latency transcript display.
- Translation displayed while speech is happening.
- Stable final transcript after segment completion.
- Original and translated text both available.

### G2. Multi-endpoint accessibility

- Browser/PWA first.
- Mobile-friendly recorder and viewer.
- Later native wrappers with Capacitor and Tauri.
- QR/link sharing for viewer devices.

### G3. Recording quality and recoverability

- Mic test before recording.
- Volume meter, silence warning, clipping warning.
- Local chunk backup with IndexedDB.
- Server-side audio object storage.
- Transcript event log and final segments.

### G4. Provider flexibility and cost control

- Soniox default for realtime STT translation.
- Azure Translator final-segment enhancement as optional quality mode.
- OpenAI optional for retranslation, summarization, semantic cleanup.
- Provider adapter interface to avoid lock-in.
- Per-session budget tracking and hard caps.

### G5. Security and operational safety

- Secure auth.
- Secrets never committed.
- Default admin seed through environment variable only.
- Rate limiting, audit logs, input validation.
- OWASP ASVS-inspired controls.

## 5. Success metrics

### MVP success metrics

- A user can create a session and record audio from a mobile browser within 60 seconds of landing.
- A viewer can join by link/QR and see captions within 3 seconds of recorder start.
- Network interruption under 30 seconds does not lose already captured local audio chunks.
- A 30-minute session can be exported as Markdown/TXT/JSON.
- Real-browser Playwright E2E covers create/session/record/view/stop/export.
- No secrets are committed.

### Quality metrics

- Time to first transcript token: target < 2.5s under normal network.
- Segment finalization latency: target < 5s after speech pause.
- Local audio backup chunk interval: 10–30s.
- Critical UI mobile viewport coverage: 375px, 390px, 430px, 768px, desktop.
- Error state coverage: mic denied, provider down, network reconnect, budget exceeded.

## 6. Milestones

### M0 — Repository foundation and documentation

Deliverables:

- Add all development docs.
- Initialize project structure if repository is empty.
- Configure TypeScript, lint, formatting, test frameworks.
- Configure CI skeleton.
- Add `.env.example` only, no secrets.

Exit criteria:

- `pnpm lint`, `pnpm typecheck`, and base tests run.
- README includes local setup.
- Codex/agent workflow documented.

### M1 — PWA shell and authentication portal

Deliverables:

- Landing page.
- Auth pages.
- Dashboard shell.
- Bootstrap admin seed using `SEED_ADMIN_PASSWORD`.
- Session list placeholder.
- Security basics: password hashing, rate limiting, session cookies or token strategy.

Exit criteria:

- Admin can log in locally.
- Playwright covers login/logout and protected dashboard.
- No hard-coded password.

### M2 — Session creation and viewer shell

Deliverables:

- Create session flow.
- Session detail page.
- Recorder page shell.
- Viewer page shell with share link and QR.
- Session status state machine.

Exit criteria:

- Browser can create a session and open viewer page in another tab.
- UI works on mobile and desktop.

### M3 — Audio capture and local backup

Deliverables:

- Microphone permission flow.
- Device selector.
- Volume meter.
- Silence/clipping warnings.
- AudioWorklet or fallback audio processing.
- MediaRecorder chunks persisted to IndexedDB.
- Server chunk upload endpoint and R2/S3 integration interface.

Exit criteria:

- User can start/stop local recording.
- Local chunks remain after refresh until uploaded or discarded.
- Playwright/manual tests cover mic-denied and backup states.

### M4 — Realtime transcript mock provider

Deliverables:

- Provider adapter interface.
- Mock realtime provider for deterministic tests.
- WebSocket/SSE live event broadcasting.
- Transcript event persistence.
- Viewer receives simulated transcript and translation events.

Exit criteria:

- End-to-end session flow works without external API keys.
- CI can test realtime flows deterministically.

### M5 — Soniox realtime integration

Deliverables:

- Soniox provider adapter.
- Audio stream forwarding.
- Language identification handling.
- Partial/final transcript event mapping.
- Partial/final translation event mapping.
- Provider error handling and retry strategy.

Exit criteria:

- Real microphone to Soniox to viewer works in browser.
- Provider failures surface user-friendly UI states.
- Usage/cost logging records audio seconds.

### M6 — Transcript history, export, and finalization

Deliverables:

- Session history page.
- Transcript timeline.
- Edit final segment.
- Export Markdown/TXT/JSON/SRT/VTT.
- Optional Azure final translation enhancement interface.

Exit criteria:

- Completed session can be reviewed and exported.
- Tests cover exports.

### M7 — Production hardening

Deliverables:

- Audit logs.
- Security headers.
- CSRF/session hardening.
- Rate limits.
- Provider budget caps.
- Error boundary and logging.
- Backup/recovery smoke tests.

Exit criteria:

- OWASP checklist pass for MVP baseline.
- Load smoke test for N viewers.
- Production deployment guide complete.

### M8 — Deployment and domain

Deliverables:

- Deploy frontend/backend target.
- Configure domain `babbledeck.aialra.online`.
- Configure environment secrets in deployment platform.
- Add monitoring and backups.

Exit criteria:

- Production smoke test passes on real domain.
- Admin login works with seeded secret.
- End-to-end live session works.

### M9 — Mobile and desktop wrappers

Deliverables:

- Capacitor wrapper for iOS/Android.
- Tauri wrapper for desktop.
- Platform-specific permissions and packaging docs.

Exit criteria:

- App runs in mobile wrapper dev mode.
- Desktop wrapper can load app and record audio locally.

### M10 — LiveKit V2 multi-audio mode

Deliverables:

- LiveKit room integration.
- Multiple recorder tracks.
- Per-track provider workers.
- Speaker labels and timeline merging.

Exit criteria:

- Two audio tracks can produce independent transcripts in one session.

## 7. Release strategy

### Release channels

- `local` — developer machine.
- `preview` — temporary branch deployment.
- `staging` — stable pre-production domain if configured.
- `production` — `babbledeck.aialra.online`.

### Versioning

Use semantic versioning once MVP is stable:

- `0.1.0` — local MVP with mock provider.
- `0.2.0` — Soniox realtime MVP.
- `0.3.0` — history/export/backup stable.
- `0.4.0` — production hardening.
- `1.0.0` — production-ready first release.

## 8. Risks and mitigations

| Risk                                         |   Impact | Mitigation                                                                   |
| -------------------------------------------- | -------: | ---------------------------------------------------------------------------- |
| Browser mic permissions are inconsistent     |     High | Clear permission UX, browser support matrix, native wrappers later           |
| Mobile browser suspends background recording |     High | Keep screen awake where possible, warn user, Capacitor native wrapper later  |
| ASR provider latency or outage               |     High | Mock provider tests, provider adapter, fallback provider, clear UI state     |
| Language detection misfires                  |   Medium | Candidate language narrowing, manual language lock, final-segment correction |
| Translation instability                      |   Medium | Partial/final display model, optional final translation enhancement          |
| Secrets leak                                 | Critical | `.env.example` placeholders only, secret scanning, no hard-coded passwords   |
| Agent builds backend only and misses UI      |     High | Playwright real-page tests mandatory before done                             |
| Scope creep into speech-to-speech            |   Medium | Explicitly defer TTS to future; focus text captions                          |

## 9. Definition of done

A feature is done only when:

- Implementation complete.
- Unit/integration tests pass.
- Real-browser Playwright flow passes.
- Mobile viewport checked.
- Error states handled.
- Security implications checked.
- Documentation updated if behavior changed.
- Commit pushed.
