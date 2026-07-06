# BabbleDeck Security and Operations Plan

## 1. Security posture

BabbleDeck handles sensitive data: voice recordings, transcripts, translations, user login, provider credentials, and potentially private event notes. Security must be implemented from the first milestone.

Target baseline: OWASP ASVS-inspired practical controls for MVP.

## 2. Secret handling

### Rules

- Never commit secrets.
- Never hard-code default passwords.
- Never print secrets in logs or UI.
- Never expose provider API keys to frontend.
- Use platform secret manager or environment variables.
- `.env.example` must contain placeholders only.

### Required secrets

```text
DATABASE_URL
AUTH_SECRET
SEED_ADMIN_PASSWORD
SONIOX_API_KEY
AZURE_TRANSLATOR_KEY optional
AZURE_TRANSLATOR_REGION optional
OPENAI_API_KEY optional
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_ENDPOINT optional when R2_ACCOUNT_ID is set
```

### Bootstrap admin

Email:

```text
admin@example.invalid
```

Password:

```text
process.env.SEED_ADMIN_PASSWORD
```

Seed behavior:

1. If admin user exists, do nothing.
2. If no admin user exists and `SEED_ADMIN_PASSWORD` is set, create admin.
3. If no admin user exists and env is missing, fail loudly.
4. Set password rotation required if implemented.
5. Do not log password.

## 3. Authentication security

- Use strong password hashing: Argon2id preferred; bcrypt acceptable with strong cost.
- Use secure session cookies or robust token session.
- Production cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or stricter.
- Rate limit login.
- Generic auth failure messages.
- Logout invalidates server-side session if DB sessions are used.

## 4. Authorization model

Roles:

```text
admin: full portal access
operator: create/manage own sessions later
viewer: no portal, view via share token only
```

MVP can use only admin + unauthenticated viewer share token.

Rules:

- Admin endpoints require admin session.
- Viewer share token allows read-only live stream and viewer-safe metadata.
- Recorder token allows audio upload/record events for one session only.
- Tokens stored as hashes.
- Tokens should be long and random.

## 5. Data security

### At rest

- Database managed encryption if provider supports it.
- R2/S3 bucket private by default.
- Signed URLs for downloads.
- No public raw audio links.

### In transit

- HTTPS/WSS only in production.
- HSTS.
- Current production sends `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, and `Permissions-Policy`; readiness checks the core required security headers.
- TLS-managed domain.

### Data minimization

- Hash IP addresses if stored.
- Store user agent only for debugging/security.
- Avoid storing raw provider payloads longer than necessary unless useful for debugging.

## 6. Web security controls

Implement:

- Content Security Policy.
- X-Content-Type-Options: nosniff.
- Referrer-Policy.
- Frame-ancestors restrictions.
- Secure CORS config.
- CSRF protection if cookie-auth mutation endpoints are used.
- Current production applies same-origin `Origin` and Fetch Metadata checks to cookie-authenticated admin mutations while leaving scoped recorder-token writes available for no-cookie recorder links.
- HTML escaping through React default behavior.
- File upload validation.

## 7. Rate limits

Minimum rate limits:

- Login attempts by IP/email.
- Login attempts by source IP across changing emails.
- Session creation.
- Recorder token exchange.
- Audio chunk upload.
- Export generation.
- Retranslate endpoint.
- Current production enforces login, session creation, recorder control, transcript event append, export generation, and audio chunk upload rate limits with environment-configurable per-minute thresholds.

If using serverless, use Redis/Upstash or provider-native rate limiting.

## 8. Audit logs

Log:

- Login success.
- Login failure.
- Logout.
- Session created.
- Recording started/stopped.
- Session exported.
- Transcript edited.
- Settings changed.
- Provider key status changed, not key value.
- Provider failure.
- Budget exceeded.

Audit logs must not include secrets or raw password values.

## 9. Object storage operations

### Server-local object access

- Production raw audio chunks live in the self-hosted object directory
  `/srv/aialra/storage/babbledeck`.
- Keep the directory outside release/workspace paths and readable/writable only by
  the application service account.
- Daily backups include a local audio archive under
  `/srv/aialra/backups/babbledeck`, followed by restore verification.
- R2/S3-compatible storage remains optional migration tooling, not a production
  launch requirement for the current single-server deployment.

### Object keys

Use predictable internal keys but never expose without signed URL:

```text
sessions/{sessionId}/audio/chunk-{chunkIndex}.webm
sessions/{sessionId}/exports/transcript-{timestamp}.md
```

## 10. Backup plan

### Database

- Use managed Postgres backups.
- Daily backups minimum for production.
- Test restore before production launch.
- Current production uses `aialra-babbledeck-backup.timer` for daily Postgres custom dumps plus local audio object archives under `/srv/aialra/backups/babbledeck`.
- `scripts/verify-backup.sh latest` restores into a temporary database and temporary audio directory to prove backup integrity without touching production data.
- `aialra-babbledeck-backup-verify.timer` runs daily latest-backup restore
  verification and writes non-secret JSONL records to
  `/srv/aialra/logs/babbledeck/backup-verify.jsonl`.

### Object storage

- The self-hosted server object directory stores raw chunks.
- Retention is enforced by `aialra-babbledeck-audio-retention.timer`.
- For critical sessions, export transcript immediately after completion.

### Local client backup

- IndexedDB chunk queue.
- Never delete unsynced chunks automatically.
- Give user cleanup action after upload complete.

## 11. Incident response

### Provider outage

- Show `Provider delayed` or `Translation unavailable`.
- Keep local recording backup active.
- Allow session stop and export partial transcript.
- Log provider outage.

### Database outage

- Recorder should surface `Saving delayed`.
- Local chunks remain.
- Avoid claiming data is saved until confirmed.

### Object storage outage

- Continue local backup.
- Mark server upload pending.
- Retry with exponential backoff.

### Suspected secret leak

1. Rotate affected key immediately.
2. Revoke old key.
3. Review logs.
4. Search repo history.
5. Add prevention test if possible.
6. Document incident.

## 12. Deployment operations

### Environments

```text
local
preview
staging optional
production
```

### Environment separation

- Separate database or schema.
- Separate object storage prefix/bucket.
- Separate provider keys if possible.
- No production secrets in preview builds.

### Domain

Production domain target:

```text
babbledeck.aialra.online
```

Configure:

- TLS.
- HTTPS redirect.
- Security headers.
- DNS records.

## 13. Monitoring

Minimum metrics:

- Active sessions.
- Recorder connections.
- Viewer connections.
- Provider errors.
- First-token latency.
- Audio chunk upload failures.
- Auth failures.
- Estimated provider cost.
- `/api/health` exposes non-secret core readiness status for external uptime
  monitors, including database connectivity, audio storage configuration,
  process uptime, and provider configuration booleans.
- `aialra-babbledeck-health-monitor.timer` checks `/api/health` every five
  minutes and writes non-secret JSONL status records under
  `/srv/aialra/logs/babbledeck/health-monitor.jsonl`.
- After consecutive unhealthy health checks exceed the configured threshold,
  the health monitor writes local alert/recovery JSONL events under
  `/srv/aialra/logs/babbledeck/health-alerts.jsonl`; strict readiness checks
  that the local health alert state is not active.
- `aialra-babbledeck-metrics.timer` writes non-secret JSONL snapshots every
  five minutes under `/srv/aialra/logs/babbledeck/metrics.jsonl`, covering the
  minimum operational metrics above plus uploaded audio byte/duration totals
  and export completion/failure counts.
- `pnpm load:smoke:production -- --viewers=N` opens N concurrent viewer SSE
  streams against the real production domain, verifies transcript fanout, and
  writes a non-secret release-gate record under
  `/srv/aialra/logs/babbledeck/load-smoke.jsonl`.
- `pnpm security:audit:production` checks repo secret hygiene, placeholder
  env examples, source-level auth/rate-limit/token controls, live security
  headers, request correlation headers, unauthenticated admin API protection,
  same-origin mutation rejection, and `/api/health` non-secret output; it writes
  a non-secret baseline record under
  `/srv/aialra/logs/babbledeck/security-baseline.jsonl`.
- `/etc/logrotate.d/aialra-babbledeck` rotates BabbleDeck `.log` and `.jsonl`
  files so append-style service logs do not grow without bound.

Minimum logs:

- Structured JSON.
- Correlation ID via `x-request-id`/`x-correlation-id`.
- Session ID.
- Error code.
- Provider name.

## 14. Cost operations

Default budget targets:

```text
Default realtime mode: $0.20–$0.50 / audio hour
Enhanced mode: $0.60–$1.50 / audio hour
Fallback hard cap: $3.00 / audio hour
```

Implement:

- Session cost estimate.
- Provider usage table.
- Budget warning.
- Hard stop or confirmation at cap.

## 15. Production readiness checklist

- [x] No secrets in repo.
- [x] `.env.example` placeholders only.
- [x] Admin seed uses env password only.
- [x] Auth rate limit enabled.
- [x] Protected routes tested.
- [x] Viewer share token read-only.
- [x] Recorder token scoped.
- [ ] R2 bucket private and off-host audio cutover complete.
- [x] Security headers configured.
- [x] Error boundary and request correlation logging configured.
- [x] Playwright core flows pass.
- [x] Mobile browser smoke tested.
- [x] Soniox live readiness probe passes after provider credential changes.
- [x] Backups tested.
- [x] Export tested.
- [x] Provider outage behavior tested.
- [x] Domain HTTPS working.
