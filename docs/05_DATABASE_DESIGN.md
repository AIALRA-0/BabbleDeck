# BabbleDeck Database Design

## 1. Database choice

Use PostgreSQL as the primary relational database. Use Cloudflare R2/S3-compatible storage for raw audio chunks and exported files. Redis is optional for realtime presence/pub-sub but not authoritative persistence.

## 2. Naming conventions

- Table names: snake_case plural.
- Primary keys: `id` UUID or cuid-style text.
- Timestamps: `created_at`, `updated_at` as timestamptz.
- Soft delete: `deleted_at` where applicable.
- JSON payloads: `jsonb`.
- Monetary/cost fields: store micro-units or decimal numeric.

## 3. Core enums

```sql
-- Suggested enums; can be Prisma enums or DB check constraints.
user_role: 'admin' | 'operator' | 'viewer'
session_status: 'created' | 'ready' | 'recording' | 'reconnecting' | 'provider_degraded' | 'stopping' | 'completed' | 'failed' | 'archived'
participant_role: 'recorder' | 'viewer' | 'admin' | 'agent'
provider_name: 'mock' | 'soniox' | 'azure' | 'openai' | 'deepgram' | 'google' | 'self_hosted'
transcript_event_type: 'partial_transcript' | 'final_transcript' | 'partial_translation' | 'final_translation' | 'language_detected' | 'segment_corrected' | 'provider_error' | 'session_state' | 'usage'
audio_chunk_status: 'local_only' | 'uploading' | 'uploaded' | 'failed' | 'deleted'
export_format: 'markdown' | 'txt' | 'json' | 'srt' | 'vtt'
```

## 4. Tables

## 4.1 users

Stores portal users.

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  display_name text,
  first_login_at timestamptz,
  last_login_at timestamptz,
  password_rotation_required boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_email_idx on users (lower(email));
```

Notes:

- Bootstrap admin email: `admin@example.invalid`.
- Bootstrap password from `SEED_ADMIN_PASSWORD`; never committed.
- Set `password_rotation_required = true` for seed admin if practical.

## 4.2 auth_sessions

If using database-backed sessions.

```sql
create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_token_hash text not null unique,
  user_agent text,
  ip_hash text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index auth_sessions_user_id_idx on auth_sessions (user_id);
create index auth_sessions_expires_at_idx on auth_sessions (expires_at);
```

## 4.3 live_sessions

Main session entity.

```sql
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id),
  title text not null,
  description text,
  status text not null default 'created',
  source_language_mode text not null default 'auto',
  target_language text not null default 'zh',
  provider_name text not null default 'soniox',
  quality_mode text not null default 'realtime',
  budget_cap_usd numeric(12,4),
  estimated_cost_usd numeric(12,4) not null default 0,
  share_token_hash text not null unique,
  recorder_token_hash text,
  started_at timestamptz,
  ended_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index live_sessions_owner_idx on live_sessions (owner_user_id, created_at desc);
create index live_sessions_status_idx on live_sessions (status);
create index live_sessions_created_at_idx on live_sessions (created_at desc);
```

Token handling:

- Store token hashes only.
- Plain share/recorder tokens are shown/generated once.

## 4.4 session_participants

Tracks viewer/recorder connections conceptually.

```sql
create table session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id uuid references users(id),
  role text not null,
  display_name text,
  connection_id text,
  user_agent text,
  ip_hash text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  metadata jsonb not null default '{}'
);

create index session_participants_session_idx on session_participants (session_id, joined_at desc);
```

## 4.5 recorder_connections

Detailed recorder connection events.

```sql
create table recorder_connections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  connection_id text not null,
  transport text not null default 'websocket',
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  reconnect_count integer not null default 0,
  last_error_code text,
  last_error_message text,
  client_info jsonb not null default '{}'
);

create index recorder_connections_session_idx on recorder_connections (session_id, started_at desc);
```

## 4.6 transcript_events

Append-only event log for realtime transcript stream.

```sql
create table transcript_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  provider_name text not null,
  event_type text not null,
  sequence_no bigint not null,
  segment_id uuid,
  language text,
  target_language text,
  text text,
  confidence numeric(6,5),
  start_ms integer,
  end_ms integer,
  is_final boolean not null default false,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(session_id, sequence_no)
);

create index transcript_events_session_seq_idx on transcript_events (session_id, sequence_no);
create index transcript_events_session_created_idx on transcript_events (session_id, created_at);
create index transcript_events_type_idx on transcript_events (event_type);
```

## 4.7 transcript_segments

Canonical final transcript segments.

```sql
create table transcript_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  segment_index integer not null,
  source_language text,
  original_text text not null,
  final_original_text text,
  start_ms integer,
  end_ms integer,
  confidence numeric(6,5),
  speaker_label text,
  provider_name text not null,
  edited_by_user_id uuid references users(id),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, segment_index)
);

create index transcript_segments_session_idx on transcript_segments (session_id, segment_index);
```

## 4.8 translations

Final translations for segments.

```sql
create table translations (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references transcript_segments(id) on delete cascade,
  session_id uuid not null references live_sessions(id) on delete cascade,
  target_language text not null,
  translation_text text not null,
  provider_name text not null,
  quality_mode text not null default 'realtime',
  is_enhanced boolean not null default false,
  edited_by_user_id uuid references users(id),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(segment_id, target_language, quality_mode)
);

create index translations_session_idx on translations (session_id, target_language);
```

## 4.9 audio_chunks

Server-side metadata for audio backup chunks.

```sql
create table audio_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  chunk_index integer not null,
  object_key text not null,
  mime_type text not null,
  byte_size bigint not null,
  duration_ms integer,
  checksum_sha256 text,
  status text not null default 'uploaded',
  started_at timestamptz,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  unique(session_id, chunk_index)
);

create index audio_chunks_session_idx on audio_chunks (session_id, chunk_index);
```

## 4.10 provider_usage

Cost and usage tracking.

```sql
create table provider_usage (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  provider_name text not null,
  usage_type text not null,
  audio_ms integer,
  input_characters integer,
  output_characters integer,
  target_language text,
  estimated_cost_usd numeric(12,6),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index provider_usage_session_idx on provider_usage (session_id, created_at);
create index provider_usage_provider_idx on provider_usage (provider_name, created_at);
```

## 4.11 glossary_terms

Terms to preserve or translate consistently.

```sql
create table glossary_terms (
  id uuid primary key default gen_random_uuid(),
  source_term text not null,
  target_term text not null,
  source_language text,
  target_language text not null,
  notes text,
  enabled boolean not null default true,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index glossary_terms_target_idx on glossary_terms (target_language, enabled);
```

## 4.12 exports

Export records.

```sql
create table exports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  requested_by_user_id uuid references users(id),
  format text not null,
  object_key text,
  byte_size bigint,
  status text not null default 'completed',
  error_message text,
  created_at timestamptz not null default now()
);

create index exports_session_idx on exports (session_id, created_at desc);
```

## 4.13 audit_logs

Security and operational audit events.

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  session_id uuid references live_sessions(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on audit_logs (created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);
create index audit_logs_session_idx on audit_logs (session_id, created_at desc);
```

## 5. Data retention policy

MVP defaults:

- Transcript records: retained until user deletes session.
- Raw audio chunks: retained until user deletes session or retention policy runs.
- Audit logs: retained at least 90 days.
- Local IndexedDB chunks: retain until uploaded and user confirms cleanup.

Future settings:

- Auto-delete raw audio after N days.
- Keep transcript only.
- Export before deletion.

## 6. Object storage layout

```text
babbledeck/
  sessions/
    {sessionId}/
      audio/
        chunk-000001.webm
        chunk-000002.webm
      exports/
        transcript.md
        transcript.json
        captions.vtt
```

## 7. Migration strategy

- Use ORM migrations.
- Never edit applied migrations.
- Add migrations per feature.
- Include seed script for bootstrap admin.
- Seed only if admin absent.

## 8. Privacy notes

- Hash IP if stored.
- Store provider payloads only when useful; avoid excess PII.
- Redact secrets in payloads.
- Exports should require admin authorization.
