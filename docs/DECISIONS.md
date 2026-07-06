# Architecture Decisions

## ADR-001: PWA First, Native Wrappers Later

BabbleDeck starts as a Next.js PWA so browser, mobile browser, and installable app behavior can be tested first. Capacitor and Tauri wrappers remain later milestones.

## ADR-002: PostgreSQL and Prisma for MVP Persistence

The MVP uses PostgreSQL with Prisma for auth, sessions, transcript events, backup metadata, exports, and audit logs. This keeps the schema close to the development package and existing server project conventions.

## ADR-003: Mock Provider First

The first end-to-end path uses a deterministic mock realtime provider through server event APIs. Soniox remains the default production provider target, but mock mode keeps CI and Playwright runs reliable without external keys.

## ADR-004: Polling Viewer Stream for First Web Deployment

The first viewer implementation polls for new transcript events. This is less sophisticated than WebSocket/SSE but deploys reliably on more hosts and preserves the API boundary for later realtime transport upgrades.

## ADR-005: SSE Viewer Stream With Polling Fallback

The production viewer now uses Server-Sent Events for live transcript updates and falls back to short polling if EventSource fails. This fits the one-way viewer update path, works through the current Nginx/systemd deployment, and keeps WebSocket reserved for recorder audio and later multi-party flows.

## ADR-006: Binary Audio Backup Through Object Storage Adapter

Recorder backup chunks upload as `multipart/form-data` and are written as binary objects before the `audio_chunks` row is marked uploaded. Production intentionally uses the server-local object root for durability under the current systemd/Nginx deployment, with daily backup and restore verification covering the local audio archive. The same adapter can still switch to Cloudflare R2 or S3-compatible storage through environment variables if the hosting model changes later.
