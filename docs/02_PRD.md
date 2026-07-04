# BabbleDeck Product Requirements Document (PRD)

## 1. Product summary

BabbleDeck is a realtime multilingual transcription and translation workspace. It turns one or more microphones into live bilingual captions that can be viewed across phones, tablets, desktops, and web browsers, with robust recording backup and exportable transcripts.

## 2. Problem statement

People attending conferences, classes, conventions, meetings, interviews, and live events often need to understand speech in another language in real time. Existing mobile translation apps are easy but hard to share across multiple devices and poor for persistent session records. Commercial live translation platforms can be expensive. DIY open-source setups are hard to use.

BabbleDeck solves this by providing a web-first, app-like, low-cost, multi-device realtime transcription and translation system with reliable backups and clean transcript management.

## 3. Target users

### U1. Solo attendee

Wants to record a lecture/panel from a phone and read translated captions live.

Needs:

- Fast start.
- Mobile-friendly captions.
- Low cost.
- Recording backup.
- Exportable notes.

### U2. Small team / group

One person records, several people view captions on their own devices.

Needs:

- Share link/QR.
- Multiple viewers.
- Stable session.
- Transcript history.

### U3. Researcher / interviewer

Records multilingual interviews and needs saved transcript and translation.

Needs:

- Audio backup.
- Timestamped transcript.
- Speaker labels later.
- Editing and export.

### U4. Event operator

Runs live caption sessions for audiences.

Needs:

- Reliability.
- Budget controls.
- Admin portal.
- Session monitoring.
- Security and audit logs.

## 4. MVP scope

MVP supports:

- One recorder per session.
- Multiple viewers per session.
- Web/PWA access.
- Admin login.
- Session creation.
- Microphone test.
- Live original transcript.
- Live translation.
- Partial/final segment display.
- Local audio backup.
- Server-side transcript persistence.
- Export.
- Cost estimate.

MVP does not include:

- Realtime speech-to-speech voice output.
- Full multi-speaker diarization UI.
- Team billing.
- Public marketplace.
- Native App Store distribution.
- Offline full ASR.

## 5. Product principles

1. **Start in under one minute.** The app must not require complex setup before first use.
2. **Real webpages first.** Users interact through real UI; API-only success is not product success.
3. **Mobile-first recorder.** The phone is likely the main recorder.
4. **Trust through visibility.** Show listening, reconnecting, backing up, translating, and budget state clearly.
5. **Never lose raw audio if avoidable.** Save local chunks and server chunks.
6. **Partial now, final later.** Fast live captions plus stable final transcript.
7. **Provider-agnostic.** Soniox default, but no deep lock-in.
8. **Secure by default.** Secrets, sessions, and transcripts are sensitive.

## 6. User journeys

### Journey A: First-time admin creates session

1. User opens `babbledeck.aialra.online`.
2. User signs in.
3. User sees dashboard.
4. User clicks `New live session`.
5. User chooses target language.
6. User enters optional title.
7. Session is created.
8. User lands on recorder page.
9. User grants microphone permission.
10. User sees volume meter.
11. User starts recording.
12. User shares viewer link/QR.
13. Viewer opens link and sees captions.
14. User stops recording.
15. Transcript appears in history.
16. User exports Markdown/TXT/JSON.

### Journey B: Viewer joins session

1. Viewer opens link or scans QR.
2. Viewer sees session title and status.
3. Viewer chooses view mode:
   - Translation only.
   - Original + translation.
   - Large captions.
4. Viewer watches transcript update.
5. Viewer can change font size and theme.
6. Viewer sees connection status.

### Journey C: Recorder loses network

1. Network disconnects.
2. UI shows reconnecting.
3. Local audio chunks continue being saved when browser permits.
4. When connection returns, queued chunks upload.
5. Transcript resumes.
6. Session history notes reconnect event.

### Journey D: Mic permission denied

1. User opens recorder page.
2. Browser asks mic permission.
3. User denies.
4. App shows clear recovery instructions.
5. User can retry permission.
6. Session is not started until input is valid.

## 7. Functional requirements

### FR1. Authentication and portal

- Admin login required for session creation and history.
- Bootstrap admin email: `admin@example.invalid`.
- Bootstrap admin password supplied via `SEED_ADMIN_PASSWORD`; never hard-coded.
- If no admin user exists, seed admin on first boot or via seed command.
- If admin exists, never reset password automatically.
- Provide logout.
- Protect dashboard, session history, admin settings.

Acceptance:

- Admin can log in locally using env-seeded password.
- Incorrect password is rejected.
- Login endpoint is rate-limited.

### FR2. Session management

- Create session with title, source language mode, target language, provider mode, budget cap.
- Session statuses: `created`, `ready`, `recording`, `paused`, `stopping`, `completed`, `failed`, `archived`.
- Generate viewer link and QR code.
- Show session elapsed time and estimated cost.
- End session.
- List sessions.
- Open history.

Acceptance:

- Session can be created and viewed from second browser.
- Ended session persists.

### FR3. Recorder page

- Ask for microphone permission.
- Show mic device selector where browser supports it.
- Show live volume meter.
- Show clipping indicator.
- Show silence/no-input warning.
- Show connection status.
- Show backup status.
- Start/stop recording.
- Warn before leaving during active recording.

Acceptance:

- User can start/stop recording from mobile viewport.
- UI correctly handles mic-denied state.

### FR4. Audio backup

- Save local audio chunks in IndexedDB during recording.
- Upload chunks to server object storage.
- Track chunk status: `local_only`, `uploading`, `uploaded`, `failed`.
- Resume upload after reconnect.
- Allow cleanup after session finalized.

Acceptance:

- Refreshing page during a session does not immediately delete local chunks.
- Server receives uploaded chunk metadata.

### FR5. Realtime ASR and translation

- Default provider: Soniox realtime STT translation.
- Support mock provider for tests.
- Provider interface must handle partial/final original transcript and partial/final translation.
- Support automatic language identification events.
- Support manual source language lock.
- Support target language selection.
- Show partial captions differently from final captions.

Acceptance:

- Mock provider can drive deterministic transcript UI.
- Soniox provider can be enabled via env key.

### FR6. Viewer live transcript

- Viewer receives live transcript events without login if session link is public/secret.
- Viewer can change font size.
- Viewer can switch original/translation visibility.
- Viewer sees connection state.
- Viewer can copy current transcript if allowed.

Acceptance:

- Second browser tab receives live events from recorder session.

### FR7. Transcript history and export

- Store transcript events.
- Store final segments.
- Display timeline.
- Allow admin to edit final segment text.
- Export Markdown, TXT, JSON.
- Add SRT/VTT export if timestamps are available.

Acceptance:

- Completed session export works.

### FR8. Cost and provider usage

- Track audio seconds sent to provider.
- Estimate cost per session by provider mode.
- Display estimated cost in admin/session view.
- Support hard budget cap per session.

Acceptance:

- Session records provider usage events.

### FR9. Admin settings

- Show provider configuration status, not secrets.
- Set default target language.
- Set default budget cap.
- Manage glossary terms.
- View audit logs.

Acceptance:

- Admin can add glossary term and it is used in prompt/translation enhancement layer when implemented.

## 8. Non-functional requirements

### NFR1. Performance

- Time to first live result target: < 2.5 seconds under normal network.
- Viewer update latency after provider event: < 500ms internal broadcast target.
- Session list loads < 1.5 seconds for 1,000 sessions.

### NFR2. Reliability

- WebSocket reconnect with exponential backoff.
- Local audio backup before network upload.
- Server stores transcript events as append-only event log.

### NFR3. Security

- OWASP ASVS-inspired baseline.
- Rate limit auth/session/token endpoints.
- Secure cookie or token handling.
- No secrets in client bundle.
- No API keys exposed to frontend.
- Server-side validation for all payloads.

### NFR4. Accessibility

- Keyboard navigable controls.
- Color contrast sufficient for captions.
- ARIA labels for recording controls.
- Large captions mode.

### NFR5. Responsive design

Minimum supported layouts:

- 360px mobile portrait.
- 390px iPhone portrait.
- 430px large phone.
- 768px tablet.
- Desktop 1280px+.

### NFR6. Browser support target

- Chrome latest.
- Safari iOS latest.
- Safari macOS latest.
- Edge latest.
- Firefox best-effort.

## 9. UX acceptance criteria

- First screen has at most three primary actions.
- Recorder screen has one dominant `Start recording` / `Stop recording` action.
- Captions are readable at arm’s length on mobile.
- Status indicators are plain language:
  - Listening.
  - Connecting.
  - Reconnecting.
  - Backing up audio.
  - Upload paused.
  - Translation delayed.
- No raw provider errors shown to end users.

## 10. Out of scope for MVP

- Billing and payments.
- Full team workspaces.
- Public account registration.
- Mobile app store release.
- Realtime voice output.
- Offline full translation.
- Full diarization UI.
- Advanced AI summary generation.

## 11. Open product questions

These should not block MVP but should be tracked:

1. Should viewer links require a passcode by default?
2. Should recordings auto-delete after N days?
3. Should admin be able to disable raw audio storage?
4. Should users be able to share sessions publicly?
5. Should transcript edits preserve edit history? Recommended yes.
6. Should target languages be per-session or per-viewer? MVP: per-session, future: per-viewer.
