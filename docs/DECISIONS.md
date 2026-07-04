# Architecture Decisions

## ADR-001: PWA First, Native Wrappers Later

BabbleDeck starts as a Next.js PWA so browser, mobile browser, and installable app behavior can be tested first. Capacitor and Tauri wrappers remain later milestones.

## ADR-002: PostgreSQL and Prisma for MVP Persistence

The MVP uses PostgreSQL with Prisma for auth, sessions, transcript events, backup metadata, exports, and audit logs. This keeps the schema close to the development package and existing server project conventions.

## ADR-003: Mock Provider First

The first end-to-end path uses a deterministic mock realtime provider through server event APIs. Soniox remains the default production provider target, but mock mode keeps CI and Playwright runs reliable without external keys.

## ADR-004: Polling Viewer Stream for First Web Deployment

The first viewer implementation polls for new transcript events. This is less sophisticated than WebSocket/SSE but deploys reliably on more hosts and preserves the API boundary for later realtime transport upgrades.
