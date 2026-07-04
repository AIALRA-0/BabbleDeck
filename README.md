# BabbleDeck

BabbleDeck is a PWA-first realtime transcription, translation, recorder backup, and transcript export platform.

Production: https://babbledeck.aialra.online

## Current MVP

- Next.js App Router web app in `apps/web`.
- Prisma/PostgreSQL persistence in `db/schema.prisma`.
- Bootstrap admin seed via `SEED_ADMIN_PASSWORD`.
- Login, dashboard, live session creation, recorder page, public viewer page, session history, and exports.
- Browser microphone permission flow, volume meter, IndexedDB local backup, metadata upload endpoint, SSE viewer stream with polling fallback, and deterministic mock transcript provider.
- Playwright desktop/mobile E2E for the full MVP flow.

## Development

```bash
pnpm install
docker compose up -d postgres
pnpm db:migrate
SEED_ADMIN_PASSWORD="set-a-local-secret" pnpm db:seed
pnpm dev
```

Open the app at `http://localhost:3000` or run Playwright on port `3100` with:

```bash
E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e
```

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

## Deployment Notes

The current production instance follows the server's existing systemd + Nginx pattern:

- Service: `aialra-babbledeck.service`
- App port: `127.0.0.1:11970`
- Nginx site: `/etc/nginx/sites-available/babbledeck.aialra.online`
- Secret env file: `/srv/aialra/config/secrets/babbledeck.env`
- Production database: `babbledeck_prod`

Do not commit secrets, `.env.local`, raw recordings, provider keys, or production logs.

## Document Map

- `docs/01_PROJECT_PLAN.md`
- `docs/02_PRD.md`
- `docs/03_TECHNICAL_DESIGN.md`
- `docs/04_TEST_PLAN.md`
- `docs/05_DATABASE_DESIGN.md`
- `docs/06_API_SPECIFICATION.md`
- `docs/07_UI_UX_SPEC.md`
- `docs/08_CODING_STANDARDS_TECH_STACK.md`
- `docs/09_AGENT_INSTRUCTIONS_WORKFLOW.md`
- `docs/10_SECURITY_AND_OPERATIONS.md`
- `docs/11_IMPLEMENTATION_BACKLOG.md`
