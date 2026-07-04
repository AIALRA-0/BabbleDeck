# PROJECT_MEMORY.md — Persistent Project Memory

## Project

- Name: BabbleDeck
- Repo: https://github.com/AIALRA-0/BabbleDeck.git
- Domain target: https://babbledeck.aialra.online
- Strategy: PWA-first realtime speech recognition, translation, recording backup, and transcript export platform.

## Immutable Decisions

- UI style follows modern minimal SaaS patterns inspired by Notion, Linear, Vercel, and shadcn/ui.
- Real browser Playwright validation is required for user-facing work.
- Bootstrap admin email is `admin@example.invalid`; password is read from `SEED_ADMIN_PASSWORD` only.
- Tokens are stored as hashes at rest.
- Mock realtime provider is required for deterministic tests before Soniox staging validation.

## Current Status

- Repository was empty at clone time.
- Development package docs, checklists, and prompt inputs were added.
- Initial pnpm/Turbo monorepo is in place.
- `apps/web` contains a Next.js App Router PWA shell.
- Prisma/PostgreSQL schema covers auth sessions, live sessions, transcript events/segments, translations, audio chunks, exports, glossary terms, provider usage, and audit logs.
- Seed script creates the bootstrap admin only when no admin exists and `SEED_ADMIN_PASSWORD` is set.
- Browser MVP path implemented: login, dashboard, session create, recorder shell, mic test, volume meter, IndexedDB backup, binary audio chunk upload to local/S3-compatible storage, mock transcript events, public viewer SSE with polling fallback, session history, and transcript export.
- Verification passed locally: Prisma validate/generate/migrate, format, lint, typecheck, Vitest unit tests, Next build, and Playwright desktop/mobile MVP E2E.
- Production deployment is live at `https://babbledeck.aialra.online` through systemd service `aialra-babbledeck.service`, Nginx TLS, and production database `babbledeck_prod`.
- Production audio object storage currently uses local root `/srv/aialra/storage/babbledeck` with S3/R2-compatible env hooks available for later off-host storage.
- Production smoke passed with Playwright desktop/mobile using a temporary smoke admin that was cleaned up afterward, including verification that binary audio chunk files were written before cleanup.

## Next Recommended Tasks

1. Add Soniox realtime adapter behind the current provider boundary.
2. Configure production R2/S3 credentials and migrate raw audio storage off the local object directory.
3. Add password-rotation UI for the bootstrap admin.
4. Add recorder WebSocket audio transport now that the deployment target is Nginx/systemd and can proxy upgrades.
5. Add production backup/restore automation for `babbledeck_prod`.
