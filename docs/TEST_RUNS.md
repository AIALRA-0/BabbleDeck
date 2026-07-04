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

## 2026-07-04 SSE Viewer Upgrade

- Environment: local workspace with Docker Postgres on `localhost:55432`.
- Commands:
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
  - Static checks, unit tests, and production build passed.
  - Playwright MVP flow passed on desktop and mobile.
  - Viewer test now asserts the visible `SSE live` state before transcript events are sent, proving the EventSource path is active.
- Screenshots/traces:
  - Final run passed without failure screenshots.

## 2026-07-04 Production SSE Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy with SSE buffering disabled for `/api/viewer/session/*/stream`.
- Commands:
  - `pnpm build`
  - `nginx -t`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed and exposed `/api/viewer/session/[shareToken]/stream`.
  - HTTPS landing smoke returned `HTTP/2 200`.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin that was deleted after the run.
  - Viewer test asserted the visible `SSE live` state on production before transcript events were sent.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.
