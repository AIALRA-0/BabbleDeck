# Changelog

## 2026-07-04

- Added the BabbleDeck development documentation package.
- Initialized the pnpm/Turbo + Next.js + Prisma project structure.
- Added bootstrap admin seed flow using `SEED_ADMIN_PASSWORD`.
- Implemented the first browser MVP path with auth, session creation, recorder, viewer, history, backup indicators, and exports.
- Added SSE viewer streaming with polling fallback.
- Added binary audio chunk upload with local and S3/R2-compatible object storage adapters.
- Deployed production local audio storage under `/srv/aialra/storage/babbledeck` and verified it through Playwright smoke tests.
- Added enforced password rotation UI/API for seed admins.
- Added provider audio usage/cost tracking and admin usage visibility.
- Added production Postgres/audio backup scripts, restore verification, and a systemd backup timer.
- Added production raw audio retention automation and audio storage migration tooling for R2/S3 cutover.
- Validated configured Soniox realtime credentials with a real speech sample and improved bridge shutdown/keepalive handling.
- Switched production web service to the Next standalone server with copied static assets.
- Added opt-in real Soniox recorder UI smoke coverage with Chromium fake microphone audio, and limited mock caption injection to the mock provider.
