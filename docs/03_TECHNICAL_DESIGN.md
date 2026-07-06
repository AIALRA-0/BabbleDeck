# BabbleDeck Technical Design Document

## 1. Architecture overview

BabbleDeck is a web-first realtime captioning platform with a provider-agnostic speech pipeline.

```text
Recorder Client
  ├─ getUserMedia microphone capture
  ├─ AudioWorklet volume/meter processing
  ├─ MediaRecorder chunk backup
  ├─ IndexedDB local chunk queue
  └─ WebSocket audio stream
        ↓
Realtime Backend
  ├─ Auth/session validation
  ├─ Audio stream router
  ├─ Provider adapter manager
  ├─ Soniox realtime adapter
  ├─ Mock adapter for tests
  ├─ Event persistence
  ├─ Viewer broadcast via WS/SSE
  └─ Audio chunk upload to server-local object storage
        ↓
Viewer Client(s)
  ├─ Live transcript display
  ├─ Original/translation toggles
  ├─ Large captions mode
  └─ Connection status
        ↓
Postgres + server-local object storage + Redis(optional)
```

## 2. Design decisions

### D1. PWA-first

PWA provides the fastest path to web, mobile browser, and installable app behavior. Native wrappers come after core web stability.

### D2. Capacitor for mobile wrappers

Use Capacitor to wrap the same web app for iOS/Android when mobile browser limitations become a blocker.

### D3. Tauri for desktop wrapper

Use Tauri for desktop distribution to avoid Electron bloat while preserving web UI code reuse.

### D4. WebSocket V1, LiveKit V2

V1 assumes one recorder device. WebSocket is simpler and cheaper. LiveKit is reserved for multi-participant realtime audio and complex networks.

### D5. Provider adapter interface

All ASR/translation providers implement a common interface so Soniox can be replaced or augmented by Azure/OpenAI/Deepgram/self-hosted engines later.

### D6. Event-sourced transcript model

Store raw realtime events and final segments. Do not store only final text. This preserves replay, debugging, correction, and audit capabilities.

### D7. Partial/final caption model

Render partial results immediately but keep final results authoritative. Finalized segments can be exported and edited.

## 3. Recommended stack

### Frontend

```text
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui
Zustand for local UI/session state
TanStack Query for server state if needed
Dexie or idb for IndexedDB
Playwright for E2E
```

### Backend

Preferred:

```text
Node.js + NestJS or a separate TypeScript backend service
```

Alternative acceptable for MVP:

```text
Next.js API route + WebSocket server sidecar
```

Backend must support long-lived WebSocket connections, so if deployment platform limits WebSockets, run realtime backend as a separate service.

### Data

```text
PostgreSQL
Redis/Upstash optional for pub/sub and presence
Self-hosted server object directory, with optional Cloudflare R2/S3-compatible migration
Prisma or Drizzle ORM
Zod validation
```

### Providers

```text
Default realtime: Soniox realtime STT translation
Optional final translation: Azure Translator / OpenAI / other
Mock provider: deterministic provider for tests
Future: Deepgram, Google, Azure Speech, Whisper/FunASR
```

## 4. Deployment model

### MVP deployment

```text
Frontend/backend: self-hosted systemd services behind Nginx
Realtime backend: self-hosted WebSocket sidecar and LiveKit service
Database: self-hosted PostgreSQL
Object storage: self-hosted server directory under /srv/aialra/storage/babbledeck
Domain: babbledeck.aialra.online
```

### Production notes

- Keep provider API keys server-side only.
- Use environment secrets on deployment platform.
- Configure custom domain TLS.
- Configure backup schedules.
- Configure logging and alerting.

## 5. Runtime components

### 5.1 Web client

Main routes:

```text
/                         Landing page
/login                    Admin login
/dashboard                Dashboard/session list
/sessions/new             Create session
/sessions/[id]/record     Recorder UI
/s/[shareToken]           Public/secret viewer UI
/sessions/[id]            Session detail/history
/sessions/[id]/export     Export UI
/settings                 Admin settings
```

### 5.2 Recorder client audio path

```text
getUserMedia({ audio })
  ↓
MediaStream
  ↓
AudioContext + AudioWorklet for meter/quality indicators
  ↓
Realtime encoding/PCM chunking for WebSocket
  ↓
MediaRecorder Opus/WebM chunks for local backup
  ↓
IndexedDB chunk queue
  ↓
Upload chunk endpoint
```

MVP can start with MediaRecorder chunks for backup and browser-compatible audio chunks for provider streaming. If Soniox requires a specific PCM format, add a resampler module.

### 5.3 Backend realtime gateway

Responsibilities:

- Authenticate recorder token.
- Validate session status.
- Accept audio chunks.
- Forward chunks to provider adapter.
- Receive provider events.
- Persist events.
- Broadcast to viewers.
- Track usage.
- Handle stop/finalization.

### 5.4 Viewer broadcast

Options:

- WebSocket for bidirectional viewer controls.
- SSE for simple one-way transcript stream.

Recommended:

- Use WebSocket for recorder.
- Use SSE or WebSocket for viewers; choose one implementation for MVP.
- If using WS for both, namespace message types clearly.

### 5.5 Provider adapter

Interface sketch:

```ts
interface RealtimeSpeechProvider {
  readonly name: ProviderName;
  startSession(config: ProviderSessionConfig): Promise<ProviderSession>;
}

interface ProviderSession {
  sendAudio(chunk: AudioChunk): Promise<void>;
  stop(): Promise<void>;
  onEvent(handler: (event: ProviderRealtimeEvent) => void): void;
  onError(handler: (error: ProviderError) => void): void;
}
```

Provider events:

```ts
type ProviderRealtimeEvent =
  | {
      type: "partial_transcript";
      text: string;
      language?: string;
      startMs?: number;
      endMs?: number;
      confidence?: number;
    }
  | {
      type: "final_transcript";
      text: string;
      language?: string;
      startMs?: number;
      endMs?: number;
      confidence?: number;
    }
  | {
      type: "partial_translation";
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
      startMs?: number;
      endMs?: number;
    }
  | {
      type: "final_translation";
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
      startMs?: number;
      endMs?: number;
    }
  | { type: "language_detected"; language: string; confidence?: number }
  | { type: "usage"; audioMs: number; billableMs?: number };
```

## 6. Session state machine

```text
created
  ↓
ready
  ↓ start recording
recording
  ├─ reconnecting
  ├─ provider_degraded
  ├─ budget_exceeded
  └─ stopping
        ↓
completed
```

Failure states:

```text
failed_provider
failed_upload
failed_auth
archived
```

State transitions must be persisted.

## 7. Language identification design

### Candidate languages

Default candidate set:

```text
en, zh, ja, ko, yue
```

User may select:

- Auto.
- English.
- Chinese.
- Japanese.
- Korean.
- Cantonese.
- Mixed presets.

### State machine

- Maintain current language.
- Ignore low-confidence short tokens.
- Switch language only after repeated evidence or provider final event.
- Show detected language in admin/recorder, not necessarily in viewer.

## 8. Translation design

### Display model

```text
Partial original: light/temporary
Partial translation: light/temporary
Final original: normal/committed
Final translation: normal/committed
```

### Final translation enhancement

Optional workflow:

```text
Provider final transcript
  ↓
if qualityMode enabled or confidence low
  ↓
Translate final segment via Azure/OpenAI/etc.
  ↓
Store enhanced final translation
  ↓
Broadcast correction event
```

Correction event:

```json
{
  "type": "segment.corrected",
  "segmentId": "seg_...",
  "translationText": "...",
  "reason": "final_translation_enhancement"
}
```

## 9. Audio backup design

### Local backup

Use IndexedDB with chunk metadata:

```ts
type LocalAudioChunk = {
  id: string;
  sessionId: string;
  chunkIndex: number;
  startedAt: string;
  durationMs: number;
  mimeType: string;
  blob: Blob;
  status: "local_only" | "uploading" | "uploaded" | "failed";
  serverObjectKey?: string;
};
```

### Server backup

Upload chunks to server-local object storage:

```text
sessions/{sessionId}/audio/chunk-{index}.webm
```

Persist metadata in `audio_chunks` table.

### Recovery

On recorder page load:

1. Check IndexedDB for unsynced chunks.
2. Offer resume upload.
3. Reconcile with server chunk list.
4. Never auto-delete unsynced local chunks.

## 10. Persistence design

Primary entities:

- users
- sessions
- session_participants
- recorder_connections
- transcript_events
- transcript_segments
- translations
- audio_chunks
- provider_usage
- glossary_terms
- audit_logs

Full schema is in `05_DATABASE_DESIGN.md`.

## 11. Security design

### Authentication

- Bootstrap admin seeded with email `admin@example.invalid`.
- Password from `SEED_ADMIN_PASSWORD` only.
- Use Argon2id or bcrypt with strong cost.
- HTTP-only secure cookies or secure JWT strategy.
- Rate limit login.

### Authorization

- Admin-only routes for dashboard/history/settings.
- Viewer routes use unguessable share token.
- Recorder token is separate from viewer token.
- Session permissions checked server-side.

### Secrets

- Provider API keys only in backend env.
- No secret exposed to client bundle.
- `.env.example` placeholders only.

### Input validation

- Zod schemas for all REST/WS messages.
- Limit message size.
- Limit audio chunk size.
- Sanitize export filenames.

### Security headers

- CSP.
- HSTS in production.
- X-Content-Type-Options.
- Frame-ancestors restrictions.
- Referrer-Policy.

### Audit events

Log:

- login success/failure.
- session create/start/stop/delete/export.
- admin settings changes.
- provider errors.
- budget exceeded.
- transcript edit.

## 12. Cost control design

Track:

- audio seconds sent to provider.
- provider mode.
- target language count.
- final translation character count.
- estimated cost.

Enforce:

- per-session hard cap.
- per-day cap optional.
- stop provider stream if hard cap exceeded.
- alert user before reaching cap.

## 13. Error handling

### User-facing states

- Microphone blocked.
- No input detected.
- Audio clipping.
- Reconnecting.
- Provider delayed.
- Translation delayed.
- Backup upload pending.
- Budget exceeded.

### Internal errors

- Store structured error logs.
- Do not expose stack traces.
- Include correlation/session IDs.

## 14. LiveKit V2 design

When implemented:

```text
LiveKit room per BabbleDeck session
Recorder participants publish audio tracks
Backend agent subscribes to tracks
Each track mapped to provider stream
Events merged into shared timeline by timestamp and participant
```

LiveKit is not mandatory for V1 unless WebSocket audio proves insufficient.

## 15. Observability

Track metrics:

- session start count.
- active session count.
- viewer count.
- provider latency.
- first-token latency.
- reconnect count.
- audio upload failures.
- cost per session.
- auth failures.

Logs:

- JSON structured logs.
- Mask secrets.
- Correlation IDs.

## 16. References and source docs

- Soniox realtime STT translation docs.
- Soniox language identification docs.
- LiveKit docs.
- Capacitor docs.
- Tauri docs.
- Next.js App Router docs.
- shadcn/ui docs.
- Cloudflare R2 docs.
- OWASP ASVS.
- Playwright docs.
