# Test Runs

## 2026-07-04

- Environment: local workspace with Docker Postgres on `localhost:55432`.
- Commands:
  - `pnpm db:validate`
  - `pnpm db:generate`
  - `pnpm db:migrate`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Format, lint, typecheck, unit tests, and build passed.
  - Playwright MVP flow passed on desktop and mobile: landing, login, session creation, recorder, microphone permission, mock transcript, public viewer, stop/history, and Markdown export.
- Screenshots/traces:
  - Final run passed without failure screenshots.
  - Playwright HTML report generated locally under `playwright-report/`.

## 2026-07-04 Production Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`.
- Commands:
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `curl -fsS https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - HTTPS returned `HTTP/2 200` with security headers.
  - Landing page contained BabbleDeck content.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin that was deleted after the run.
  - Bootstrap admin `admin@example.invalid` remains present with role `ADMIN`.
- Screenshots/traces:
  - Production run passed without failure screenshots.
