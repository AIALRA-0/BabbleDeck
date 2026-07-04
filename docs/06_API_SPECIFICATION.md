# BabbleDeck API Specification

## 1. API style

BabbleDeck uses:

- REST for authentication, session management, settings, history, export.
- WebSocket for recorder audio streaming and possibly viewer live events.
- SSE may be used for viewer-only live transcript streams if simpler.

All request/response schemas must be validated with Zod or equivalent. API keys must never be exposed to clients.

## 2. Base paths

```text
/api/auth/*
/api/sessions/*
/api/viewer/*
/api/realtime/*
/api/exports/*
/api/settings/*
/ws/record
/ws/session
/sse/session/:shareToken
```

## 3. Common response envelope

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "details": {}
  }
}
```

## 4. Error codes

```text
UNAUTHENTICATED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
RATE_LIMITED
SESSION_NOT_RECORDING
SESSION_ALREADY_ENDED
MIC_STREAM_REQUIRED
PROVIDER_UNAVAILABLE
PROVIDER_TIMEOUT
BUDGET_EXCEEDED
AUDIO_CHUNK_TOO_LARGE
EXPORT_FAILED
INTERNAL_ERROR
```

## 5. Auth API

### POST /api/auth/login

Request:

```json
{
  "email": "admin@example.invalid",
  "password": "string"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@example.invalid",
      "role": "admin",
      "passwordRotationRequired": true
    }
  }
}
```

Security:

- Rate limited.
- Generic error message for invalid credentials.
- Password never logged.

### POST /api/auth/logout

Request: empty.  
Response: `{ "ok": true }`

### GET /api/auth/me

Returns current user.

### POST /api/auth/password

Requires an authenticated session and is allowed while password rotation is required.

Request:

```json
{
  "currentPassword": "string",
  "newPassword": "at-least-12-characters",
  "confirmPassword": "at-least-12-characters"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@example.invalid",
      "role": "admin",
      "passwordRotationRequired": false
    }
  }
}
```

Security:

- Verifies the current password.
- Hashes the new password server-side.
- Clears `passwordRotationRequired`.
- Revokes other active sessions for the same user.

## 6. Sessions API

### POST /api/sessions

Create a session.

Request:

```json
{
  "title": "AX Day 2 Panel",
  "description": "optional",
  "sourceLanguageMode": "auto",
  "targetLanguage": "zh",
  "providerName": "soniox",
  "qualityMode": "realtime",
  "budgetCapUsd": 1.5
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "session": {
      "id": "uuid",
      "title": "AX Day 2 Panel",
      "status": "created",
      "targetLanguage": "zh",
      "viewerUrl": "https://babbledeck.aialra.online/s/SHARE_TOKEN",
      "recordUrl": "/sessions/uuid/record"
    },
    "recorderToken": "plain-token-shown-once",
    "shareToken": "plain-share-token-shown-once"
  }
}
```

### GET /api/sessions

Query params:

```text
status?
limit?
cursor?
```

Response:

```json
{
  "ok": true,
  "data": {
    "sessions": [],
    "nextCursor": null
  }
}
```

### GET /api/sessions/:id

Returns session detail, transcript summary, cost, backup state, and provider usage.

Usage shape:

```json
{
  "usage": {
    "audioMs": 10000,
    "eventCount": 10
  },
  "estimatedCostUsd": 0
}
```

### PATCH /api/sessions/:id

Update title, description, settings if not recording.

### POST /api/sessions/:id/start

Marks session as ready/recording. In practice, recorder WebSocket can trigger this.

### POST /api/sessions/:id/stop

Stops session and finalizes provider stream.

### DELETE /api/sessions/:id

Soft-delete or archive session. Must require admin.

## 7. Viewer API

### GET /api/viewer/session/:shareToken

Returns public/secret viewer session metadata.

Response:

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "title": "Panel",
    "status": "recording",
    "targetLanguage": "zh",
    "startedAt": "2026-07-04T01:00:00.000Z"
  }
}
```

No admin-only data returned.

## 8. Audio chunk upload API

### POST /api/sessions/:id/audio-chunks

Used by recorder client to upload backup chunks.

Content-type: `multipart/form-data`.

Fields:

```text
chunkIndex
startedAt
durationMs
mimeType
checksumSha256
file
```

Response:

```json
{
  "ok": true,
  "data": {
    "chunkId": "uuid",
    "objectKey": "sessions/{id}/audio/chunk-000001.webm",
    "status": "uploaded",
    "provider": {
      "budgetExceeded": false,
      "sessionStatus": "recording",
      "estimatedCostUsd": 0.000097
    }
  }
}
```

Limits:

- Max chunk size configurable.
- Current implementation accepts chunks up to 25 MB, computes SHA-256 server-side, and writes the binary object to local or S3-compatible storage before marking the database row uploaded.
- Validate mime type.
- Require recorder token or admin auth.

## 9. Transcript API

### GET /api/sessions/:id/transcript

Query:

```text
mode=segments|events
limit?
cursor?
```

Response:

```json
{
  "ok": true,
  "data": {
    "segments": [
      {
        "id": "uuid",
        "index": 1,
        "startMs": 1000,
        "endMs": 5200,
        "sourceLanguage": "en",
        "originalText": "Hello everyone.",
        "translationText": "大家好。",
        "targetLanguage": "zh"
      }
    ]
  }
}
```

### PATCH /api/sessions/:id/segments/:segmentId

Edit final original/translation text.

Request:

```json
{
  "originalText": "optional",
  "translationText": "optional"
}
```

Response: updated segment.

### POST /api/sessions/:id/segments/:segmentId/retranslate

Use configured enhancement provider to retranslate one segment.

Request:

```json
{
  "targetLanguage": "zh",
  "providerName": "openai"
}
```

## 10. Export API

### POST /api/sessions/:id/exports

Request:

```json
{
  "format": "markdown",
  "includeOriginal": true,
  "includeTranslation": true,
  "includeTimestamps": true
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "exportId": "uuid",
    "downloadUrl": "/api/exports/uuid/download"
  }
}
```

### GET /api/exports/:id/download

Requires admin/session access.

## 11. Settings API

### GET /api/settings

Returns non-secret app settings and provider status.

```json
{
  "ok": true,
  "data": {
    "defaultTargetLanguage": "zh",
    "defaultProvider": "soniox",
    "providers": {
      "soniox": { "configured": true },
      "azure": { "configured": false },
      "openai": { "configured": false }
    },
    "defaultBudgetCapUsd": 1.5
  }
}
```

### PATCH /api/settings

Admin-only.

### GET /api/settings/glossary

Returns glossary terms.

### POST /api/settings/glossary

Create term.

## 12. Recorder WebSocket

Endpoint:

```text
/ws/recorder?sessionId=...
```

Uses the same `babbledeck_session` auth cookie as the admin app. Production is
proxied by Nginx to `aialra-babbledeck-ws.service`.

For sessions whose provider is `soniox`, the WebSocket service also forwards
saved audio chunks to Soniox realtime STT/translation when `SONIOX_API_KEY` is
configured. If the key is missing or the provider errors, the session is marked
`provider_degraded` and local backup continues.

### Client → server messages

#### audio_chunk

```json
{
  "type": "audio_chunk",
  "requestId": "uuid",
  "sessionId": "uuid",
  "chunkIndex": 1,
  "startedAt": "2026-07-04T01:00:00.000Z",
  "durationMs": 1000,
  "mimeType": "audio/webm",
  "checksumSha256": "optional",
  "dataBase64": "..."
}
```

#### ping

```json
{ "type": "ping", "requestId": "uuid" }
```

### Server → client messages

#### ready

```json
{
  "type": "ready",
  "connectionId": "uuid",
  "sessionId": "uuid"
}
```

#### audio_chunk_ack

```json
{
  "type": "audio_chunk_ack",
  "requestId": "uuid",
  "data": {
    "chunkId": "uuid",
    "objectKey": "sessions/{id}/audio/chunk-000001.webm",
    "status": "uploaded",
    "provider": {
      "budgetExceeded": false,
      "sessionStatus": "recording",
      "estimatedCostUsd": 0.000097
    }
  }
}
```

#### error

```json
{
  "type": "error",
  "requestId": "uuid",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Audio chunk checksum mismatch."
  }
}
```

#### pong

```json
{ "type": "pong", "requestId": "uuid" }
```

## 13. Viewer live stream

### Option A: WebSocket

Endpoint:

```text
/ws/session?shareToken=...
```

Client messages:

```json
{ "type": "viewer.hello", "protocolVersion": 1 }
{ "type": "viewer.set_preferences", "fontSize": "large", "showOriginal": true, "showTranslation": true }
```

Server messages mirror `transcript.event`, `session.state`, `segment.corrected`.

### Option B: SSE

Endpoint:

```text
/sse/session/:shareToken
```

Events:

```text
event: session.state
data: {...}

event: transcript.event
data: {...}

event: segment.corrected
data: {...}
```

SSE is simpler for viewer-only one-way updates. WebSocket is more flexible.

## 14. Event schema

Canonical transcript event:

```ts
type TranscriptEvent = {
  id: string;
  sessionId: string;
  type:
    | "partial_transcript"
    | "final_transcript"
    | "partial_translation"
    | "final_translation"
    | "language_detected"
    | "segment_corrected"
    | "provider_error"
    | "usage";
  sequenceNo: number;
  segmentId?: string;
  text?: string;
  language?: string;
  targetLanguage?: string;
  confidence?: number;
  startMs?: number;
  endMs?: number;
  isFinal?: boolean;
  createdAt: string;
};
```

## 15. API security requirements

- Validate every request.
- Auth required for admin endpoints.
- Share token access only for viewer-safe data.
- Recorder token required for upload/record endpoints.
- Rate limit auth and session creation.
- Limit audio chunk size.
- No provider secrets in any API response.
- Audit sensitive actions.
