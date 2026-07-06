# Test Runs

## 2026-07-06 Recorder Token Device Evidence

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, cross-device recorder links created from Settings, and production evidence log kept empty during automated validation.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- device-runtime-evidence route recorder-access settings-service`
  - `pnpm exec prettier --check apps/web/src/app/api/device-runtime-evidence/route.ts apps/web/src/app/api/device-runtime-evidence/route.test.ts apps/web/src/components/DeviceRuntimeEvidenceForm.tsx apps/web/src/components/RecorderClient.tsx apps/web/src/server/device-runtime-evidence.ts apps/web/src/server/device-runtime-evidence.test.ts apps/web/src/server/schemas.ts README.md docs/operations/BACKUP_RESTORE.md docs/TEST_RUNS.md`
- Results:
  - Recorder-token sessions can now submit `recorder_page` device runtime evidence without requiring an admin login on the real device.
  - The evidence API still rejects unauthenticated requests without a matching recorder token and rejects recorder tokens for non-recorder evidence sources.
  - Recorder-page evidence records include the session id for auditability.
  - This enables Android/iOS devices opened from the Settings QR recorder link to write release-bound evidence only after the real checks are completed.

## 2026-07-06 Device Verification Session Launcher

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, current release-bound Settings device evidence workflow, and Soniox configured in production.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- DeviceVerificationSessionLauncher settings-service device-runtime-evidence kit wrapper-artifacts`
  - `pnpm exec prettier --check apps/web/src/components/DeviceVerificationSessionLauncher.tsx apps/web/src/components/DeviceVerificationSessionLauncher.test.ts apps/web/src/app/settings/page.tsx README.md docs/operations/BACKUP_RESTORE.md docs/TEST_RUNS.md`
- Results:
  - Added a Settings `Create verification link` action that creates a release-labeled live session and shows an authenticated recorder link plus QR code for real-device handoff.
  - The launcher uses Soniox when configured and falls back to the mock provider otherwise.
  - The recorder page still requires the real device or wrapper session to confirm production URL load, microphone permission, recording, captions, and audio backup before evidence can be submitted.

## 2026-07-06 Device Runtime Verification Kit

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, current release-bound device evidence workflow, and server-built Android/desktop wrapper artifacts.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- device-runtime-evidence kit wrapper-artifacts settings-service`
  - `pnpm exec prettier --check apps/web/src/app/api/device-runtime-evidence/kit/route.ts apps/web/src/app/api/device-runtime-evidence/kit/route.test.ts apps/web/src/app/settings/page.tsx apps/web/src/components/DeviceRuntimeEvidenceStatusPanel.tsx README.md docs/operations/BACKUP_RESTORE.md docs/TEST_RUNS.md`
- Results:
  - Added authenticated `GET /api/device-runtime-evidence/kit`, a JSON attachment that bundles the current release, evidence status, checklist URL, artifact URLs, artifact SHA-256 values, and record commands.
  - Added a Settings `Download kit` action beside the existing checklist and wrapper artifact downloads.
  - Settings evidence form now detects the current device platform, reducing accidental Android records from desktop or iOS runs.
  - This improves real-device handoff and auditability but does not create passing Android, iOS, or desktop runtime evidence by itself.

## 2026-07-06 Settings Desktop Binary Download

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, Linux desktop release binary present at `apps/desktop/src-tauri/target/release/babbledeck-desktop`, and no interactive desktop display session.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- wrapper-artifacts desktop-release-binary android-debug-apk device-runtime-evidence settings-service`
  - `pnpm exec prettier --check apps/web/src/server/wrapper-artifacts.ts apps/web/src/server/wrapper-artifacts.test.ts apps/web/src/app/api/wrappers/desktop-release-binary/route.ts apps/web/src/app/api/wrappers/desktop-release-binary/route.test.ts apps/web/src/app/settings/page.tsx apps/web/src/components/DeviceRuntimeEvidenceStatusPanel.tsx apps/web/src/server/device-runtime-evidence.ts apps/web/src/server/device-runtime-evidence.test.ts README.md docs/operations/BACKUP_RESTORE.md docs/TEST_RUNS.md`
- Results:
  - Added authenticated `GET /api/wrappers/desktop-release-binary`, which serves the current server-built Linux desktop wrapper binary as an attachment and returns the SHA-256 in a non-secret response header.
  - Added Settings page desktop binary status and download action next to the Android APK and release-bound checklist.
  - Updated the release-bound device evidence checklist so Android and desktop verification steps mention the authenticated Settings artifact downloads.
  - This makes interactive desktop handoff easier but does not mark desktop runtime evidence as passing; a real interactive wrapper run is still required.

## 2026-07-06 Settings Android APK Download

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, Android debug APK present at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, and no physical Android device connected.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- wrapper-artifacts android-debug-apk settings-service device-runtime-evidence`
  - `pnpm exec prettier --check apps/web/src/server/wrapper-artifacts.ts apps/web/src/server/wrapper-artifacts.test.ts apps/web/src/app/api/wrappers/android-debug-apk/route.ts apps/web/src/app/api/wrappers/android-debug-apk/route.test.ts apps/web/src/app/settings/page.tsx apps/web/src/components/DeviceRuntimeEvidenceStatusPanel.tsx`
- Results:
  - Added authenticated `GET /api/wrappers/android-debug-apk`, which serves the current server-built Android debug APK as an attachment and returns the SHA-256 in a non-secret response header.
  - Added Settings page Android APK status and download action next to the release-bound device evidence checklist.
  - Unit coverage verifies configured artifact paths, metadata extraction, missing-artifact handling, authentication, 404 behavior, and successful APK attachment responses.
  - This makes physical Android handoff easier but does not mark Android runtime evidence as passing; a real physical-device run is still required.

## 2026-07-06 Settings Checklist Download

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, authenticated device evidence Settings workflow, and existing release-bound checklist command.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- health settings-service device-runtime-evidence`
  - `pnpm exec prettier --check apps/web/src/server/device-runtime-evidence.ts apps/web/src/server/device-runtime-evidence.test.ts apps/web/src/app/api/device-runtime-evidence/checklist/route.ts apps/web/src/app/api/device-runtime-evidence/checklist/route.test.ts apps/web/src/components/DeviceRuntimeEvidenceStatusPanel.tsx scripts/prepare-device-runtime-evidence.ts`
  - `pnpm exec tsx scripts/prepare-device-runtime-evidence.ts --base-url=https://babbledeck.aialra.online --platforms=android`
- Results:
  - Added a shared checklist Markdown builder used by both the CLI checklist script and the web server.
  - Added authenticated `GET /api/device-runtime-evidence/checklist`, which returns the current release checklist as a non-secret Markdown attachment.
  - Added a Settings page `Download checklist` action beside the current release evidence status panel.
  - Route coverage verifies authentication is required and the response is a Markdown attachment for the current release.
  - This only improves operator handoff for real device verification; it does not create or mark Android, iOS, or desktop evidence as passing.

## 2026-07-06 Device Evidence Status Visibility

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, current release-bound device evidence log semantics, and no positive Android/iOS/desktop evidence submitted during automated validation.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- health settings-service device-runtime-evidence`
  - `pnpm exec prettier --check apps/web/src/server/device-runtime-evidence.ts apps/web/src/server/device-runtime-evidence.test.ts apps/web/src/components/DeviceRuntimeEvidenceStatusPanel.tsx apps/web/src/app/settings/page.tsx`
  - `pnpm db:generate`
  - `BABBLEDECK_RELEASE_COMMIT=$(git rev-parse --short=12 HEAD) BABBLEDECK_RELEASE_BRANCH=$(git rev-parse --abbrev-ref HEAD) BABBLEDECK_RELEASE_BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ) pnpm --filter @babbledeck/web build`
  - `pnpm deploy:production`
- Results:
  - Added a server-side device evidence status summary that reads the JSONL evidence log, selects the latest record for Android, iOS, and desktop, and validates current release, production base URL, all required checks, timestamp freshness, and source metadata.
  - Added a Settings page status panel that shows current release evidence status, base URL, max evidence age, per-platform Verified/Missing state, latest record source, latest record release, and log-read warnings.
  - Unit coverage now verifies missing logs, complete current-release evidence, and latest-record release mismatch behavior.
  - Web build completed after `pnpm db:generate`; the device evidence log path uses Turbopack ignore annotations matching the existing audio-storage pattern, so the standalone build no longer emits the NFT trace warning from this helper.
  - Production deploy smoke passed through build, service restart, readiness, seed-admin login/logout smoke, and anonymous protected-route Playwright smoke.
  - This adds observability only; it does not create passing device evidence or change the requirement for real Android, iOS, and interactive desktop runs.

## 2026-07-06 Recorder Flow Device Evidence Entry

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, self-hosted audio storage, authenticated admin browser flow, and no positive Android/iOS/desktop evidence submitted during automated validation.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- health settings-service device-runtime-evidence`
  - `pnpm exec prettier --check apps/web/src/server/device-runtime-evidence.ts apps/web/src/server/device-runtime-evidence.test.ts apps/web/src/app/api/device-runtime-evidence/route.ts apps/web/src/components/DeviceRuntimeEvidenceForm.tsx apps/web/src/components/RecorderClient.tsx apps/web/src/app/sessions/[id]/record/page.tsx apps/web/src/app/sessions/[id]/page.tsx apps/web/src/server/schemas.ts README.md docs/operations/BACKUP_RESTORE.md`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=$(git rev-parse --short=12 HEAD)`
  - Authenticated production smoke for Settings, recorder, and session history `Device evidence` entry visibility plus incomplete evidence rejection.
  - `pnpm device:readiness:production -- --check-desktop-headless`
  - `pnpm device:evidence:checklist:production`
- Results:
  - Deployment smoke passed from `main`; `/api/health` reports `{ ok: true }` and local audio storage `{ ok: true, driver: "local", selfHostedReady: true, offHostReady: false }`.
  - Added source-aware device evidence records with `admin_settings`, `recorder_page`, and `session_history` sources.
  - The recorder page now prechecks evidence items observed by the current live run: production URL opened, microphone granted, recording started, captions visible, and audio backup uploaded. The completed session history page prechecks session-derived recording, captions, and backup items while still requiring admin confirmation and microphone verification.
  - Production smoke created a temporary session and confirmed Settings, recorder, and history pages all expose `Device evidence`.
  - Incomplete `/api/device-runtime-evidence` submission returned `400 VALIDATION_ERROR`; JSONL evidence remained at `0` lines, so no positive evidence was fabricated.
  - Required production readiness is green. External readiness remains incomplete only because real Android, iOS, and interactive desktop evidence for the deployed release has not yet been recorded.
  - A new release-bound checklist was written under `/srv/aialra/logs/babbledeck/device-runtime-checklists/`.

## 2026-07-06 Settings Device Evidence Entry

- Environment: local workspace plus production target `https://babbledeck.aialra.online`, existing production JSONL evidence format, authenticated Settings page, and no real device evidence submitted during automated validation.
- Commands:
  - `pnpm --filter @babbledeck/web test -- device-runtime-evidence health settings-service`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm exec prettier --check apps/web/src/server/device-runtime-evidence.ts apps/web/src/server/device-runtime-evidence.test.ts apps/web/src/app/api/device-runtime-evidence/route.ts apps/web/src/components/DeviceRuntimeEvidenceForm.tsx apps/web/src/server/schemas.ts apps/web/src/app/settings/page.tsx`
- Results:
  - Added a server helper for release-bound device runtime evidence records and JSONL appends.
  - Added `/api/device-runtime-evidence`, guarded by same-origin mutation checks and authenticated admin sessions, which writes only complete passing evidence records and records an audit-log entry.
  - Added a Settings page form for Android, iOS, and desktop evidence with the five readiness checks and a browser microphone authorization probe.
  - Unit coverage confirms passing records, incomplete records, and JSONL append behavior.
  - The first production deploy attempt after dependency restoration exposed a missing Prisma client generation step (`sessions.map((session) => ...)` lost Prisma types during Next build); running `pnpm db:generate` restored typecheck, and `scripts/deploy-production.sh` now regenerates Prisma before the standalone build.
  - Positive evidence was not fabricated; the production readiness external gate still requires real Android, iOS, and desktop wrapper runs.

## 2026-07-06 Device Evidence Checklist

- Environment: production `https://babbledeck.aialra.online`, live `/api/health` release `8d0e07fa0de7`, production env loaded without printing secrets, and existing device runtime evidence gate still waiting on real Android, iOS, and interactive desktop runs.
- Commands:
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/prepare-device-runtime-evidence.ts scripts/record-device-runtime-evidence.ts scripts/check-production-readiness.ts`
  - `pnpm exec prettier --check scripts/prepare-device-runtime-evidence.ts package.json README.md docs/KNOWN_ISSUES.md docs/operations/BACKUP_RESTORE.md`
  - `bash -n scripts/prepare-device-runtime-evidence-production.sh scripts/record-device-runtime-evidence-production.sh`
  - `pnpm device:evidence:checklist:production -- --platforms=android,ios,desktop`
- Results:
  - Added `pnpm device:evidence:checklist:production`, which fetches the live production `/api/health` release and writes a non-secret Markdown checklist under `/srv/aialra/logs/babbledeck/device-runtime-checklists/`.
  - The generated checklist includes release commit, branch, build timestamp, Android/iOS/desktop manual steps, and the exact `pnpm device:evidence:production` commands to run after real device verification.
  - The smoke run wrote `/srv/aialra/logs/babbledeck/device-runtime-checklists/20260706T053645Z.md` for release `8d0e07fa0de7`.
  - This does not satisfy the external device gate by itself; it makes the remaining physical-device evidence collection release-bound and auditable.

## 2026-07-06 Self-Hosted Audio Storage Readiness

- Environment: production `https://babbledeck.aialra.online`, production env loaded without printing secrets, self-hosted audio storage at `/srv/aialra/storage/babbledeck`, recent backup archive and restore verification present, and the root filesystem close to the deploy preflight threshold.
- Commands:
  - `pnpm db:generate`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- health audio-storage`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/check-production-readiness.ts`
  - `pnpm exec prettier --check scripts/check-production-readiness.ts apps/web/src/server/health.ts apps/web/src/server/health.test.ts docs/KNOWN_ISSUES.md docs/DECISIONS.md docs/10_SECURITY_AND_OPERATIONS.md docs/operations/BACKUP_RESTORE.md docs/03_TECHNICAL_DESIGN.md docs/05_DATABASE_DESIGN.md docs/08_CODING_STANDARDS_TECH_STACK.md`
  - `pnpm metrics:collect:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=80332bcf8167`
  - `pnpm cache:cleanup:production`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=$(git rev-parse --short=12 HEAD)`
- Results:
  - Production readiness no longer requires off-host R2/S3 storage for the current single-server architecture.
  - New required checks `production_audio_storage` and `audio_chunks_on_current_storage` passed: `/srv/aialra/storage/babbledeck` is persistent/writable and all `428` uploaded chunks are marked on the current self-hosted target.
  - `/api/health` now reports audio storage `{ ok: true, driver: "local", selfHostedReady: true, offHostReady: false }` for the deployed release.
  - R2/S3 cutover scripts remain available as optional migration tooling, and operations/design docs now describe that distinction.
  - The first deploy retry hit the disk preflight with `/` below the `3072MB` threshold; `pnpm cache:cleanup:production` safely removed rebuildable caches, then `pnpm deploy:production` passed build, service restart, readiness, seed-admin login/logout smoke, anonymous protected-route Playwright smoke, and release pruning.
  - Required production readiness is green. The only remaining external completion gap is `recent_device_runtime_evidence` for Android, iOS, and desktop physical/runtime checks.

## 2026-07-06 Production Build Cache Cleanup

- Environment: production workspace for `https://babbledeck.aialra.online`, root filesystem near deployment preflight pressure, immutable production releases serving from `/srv/aialra/releases/babbledeck/current`, and local build caches present in the workspace/root home.
- Commands:
  - `df -h / /srv /tmp`
  - `du -h -d 1 /srv/aialra/apps/codexapp/state/browser-workspaces/2026-07-04-babbledeck`
  - `du -h -d 2 apps/desktop/src-tauri/target`
  - `./apps/mobile/android/gradlew -p apps/mobile/android --stop`
  - Manual cache cleanup of `.turbo`, `apps/web/.next`, `/root/.cache/pnpm`, selected `/root/.gradle` caches, and Rust/Tauri release intermediates while preserving `apps/desktop/src-tauri/target/release/babbledeck-desktop`.
  - `pnpm device:readiness:production -- --check-desktop-headless`
  - `bash -n scripts/cleanup-production-build-cache.sh`
  - `BABBLEDECK_BUILD_CACHE_CLEANUP_DRY_RUN=1 pnpm cache:cleanup:production`
  - `pnpm cache:cleanup:production`
  - Temporary `.turbo/cleanup-smoke.bin` cleanup smoke
  - `bash -n scripts/install-production-build-cache-cleanup.sh`
  - `pnpm cache:cleanup:install:production`
  - `systemctl list-timers --all --no-pager | rg 'build-cache|babbledeck'`
  - `systemctl show aialra-babbledeck-build-cache-cleanup.timer aialra-babbledeck-build-cache-cleanup.service --property=Id,ActiveState,SubState,Result,ExecMainStartTimestamp --no-pager`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=2c2bfe9d3e43`
- Results:
  - Manual cleanup raised free root disk from about `3.1G` to about `9.2G`.
  - The Android debug APK remained present with sha256 `857955bcd635774ee5af6adafb2c1f6b84e79a528d09ad5ec19773ad4109b0f8`.
  - The desktop release binary remained present with sha256 `4863aedaaab82953a6f1e7c626ba3d82c5f70c7797ecd0656cef313e4aec75c3`, and the Tauri/Xvfb headless launch smoke still passed.
  - Added `pnpm cache:cleanup:production`, which removes only rebuildable Turbo, local Next build, pnpm HTTP metadata, Gradle, and Rust/Tauri intermediate caches; it preserves immutable production releases, database/audio storage, Android APKs, and the desktop release binary.
  - The cleanup command logs non-secret JSONL records to `/srv/aialra/logs/babbledeck/build-cache-cleanups.jsonl` and supports `BABBLEDECK_BUILD_CACHE_CLEANUP_DRY_RUN=1`.
  - The dry-run command reported existing cleanup targets without removing them.
  - A real cleanup command and a temporary `.turbo` smoke both wrote JSONL records with `disk.plannedRemovedMb`, so the log captures the deleted cache footprint even when filesystem free-space accounting updates later.
  - `standalone_static_assets` initially failed after local `.next` cleanup because readiness still looked only at workspace build output; `scripts/check-production-readiness.ts` now checks the active immutable release path `/srv/aialra/releases/babbledeck/current/apps/web/.next/static/chunks` before falling back to local build directories.
  - Added `pnpm cache:cleanup:install:production`, which installs `aialra-babbledeck-build-cache-cleanup.service` and `.timer` under systemd, runs the cleanup once, and enables daily cleanup with randomized delay.
  - The production timer is active/waiting, and the service completed successfully after install.
  - `scripts/cleanup-production-build-cache.sh` now also takes the deployment lock; if a deployment is active it records a skipped JSONL event and exits without deleting build output.
  - Readiness now checks the build-cache cleanup timer and scans for the latest non-dry-run cleanup record, so dry-run JSONL entries do not hide a valid recent cleanup.
  - Strict production readiness with live Soniox returned `requiredOk=true` again after that fix; the only remaining failures are still external device runtime evidence and off-host audio storage.

## 2026-07-06 Device Evidence Release Binding

- Environment: production `https://babbledeck.aialra.online`, live `/api/health` reporting release `da98c799690a`, production secret env loaded without printing secrets, and temporary JSONL evidence logs that do not touch production evidence.
- Commands:
  - `pnpm exec tsx scripts/record-device-runtime-evidence.ts --platform=android --passed --production-url-opened --microphone-granted --recording-started --captions-visible --audio-backup-confirmed`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/record-device-runtime-evidence.ts scripts/check-production-readiness.ts`
  - `bash -n scripts/record-device-runtime-evidence-production.sh`
  - `pnpm prettier --write scripts/record-device-runtime-evidence.ts scripts/check-production-readiness.ts README.md docs/CHANGELOG.md PROJECT_MEMORY.md`
  - Temporary three-platform JSONL readiness check with `release.commit="da98c799690a"`.
  - Temporary three-platform JSONL readiness check with `release.commit="old-release-for-test"`.
- Results:
  - `scripts/record-device-runtime-evidence.ts` now fetches `/api/health` and includes non-secret `release.commit`, `release.branch`, and `release.builtAt` in every device runtime evidence record.
  - `scripts/check-production-readiness.ts` now validates recent Android, iOS, and desktop evidence against the current health release commit, so evidence from an older deployed release no longer satisfies the external runtime gate.
  - The direct record command emitted an Android evidence record with `release.commit="da98c799690a"` and all required manual checks true.
  - The current-release temporary three-platform log made `recent_device_runtime_evidence` pass with message `Recent production device runtime evidence passed for Android, iOS, and desktop wrappers on release da98c799690a.`
  - The old-release temporary three-platform log made `recent_device_runtime_evidence` fail as release-mismatched while leaving other required checks passing.

## 2026-07-06 Production Deploy Disk Preflight

- Environment: production deployment workspace for `https://babbledeck.aialra.online`, root filesystem at about `4525MB` free before the change, and immutable release directories already enabled.
- Commands:
  - `df -Pm / /srv /tmp`
  - `bash -n scripts/deploy-production.sh`
  - `BABBLEDECK_DEPLOY_ALLOW_DIRTY=1 BABBLEDECK_DEPLOY_MIN_FREE_MB=999999 scripts/deploy-production.sh` (expected exit `1` before build/restart)
  - GitHub Actions run `28759618951`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `tail -n 1 /srv/aialra/logs/babbledeck/deployments.jsonl`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service aialra-babbledeck-livekit.service --property=Id,ActiveState,SubState,NRestarts,ExecMainStartTimestamp --no-pager`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=f4cc1e075cec'`
- Results:
  - Added `BABBLEDECK_DEPLOY_MIN_FREE_MB`, defaulting to `3072`, and `BABBLEDECK_DEPLOY_DISK_PATHS`, defaulting to the app directory, release root, log directory, and `/tmp`.
  - `pnpm deploy:production` now checks deployment disk space before building standalone output or restarting services.
  - The preflight deduplicates paths by mounted filesystem, records filesystem, checked path, available MB, use percentage, and mounted path in deployment JSONL, and exits before build/restart if any checked filesystem is below the threshold.
  - The high-threshold smoke failed safely at `[deploy] checking deployment disk space` with `/` reporting about `4386MB` free and did not enter build or service restart.
  - CI run `28759618951` passed for commit `f4cc1e075cec`.
  - Production deploy for commit `f4cc1e075cec` passed: disk preflight, forced standalone build, immutable release publication, web/recorder service restart, HTTPS readiness, homepage content check, readiness, seed-admin login/logout smoke, anonymous protected-route Playwright smoke, and release prune.
  - Live `/api/health` returned `release.commit="f4cc1e075cec"`, `status="ok"`, audio storage `driver="local"`, Soniox configured, and LiveKit configured.
  - Deployment JSONL recorded `disk.ok=true`, `minFreeMb=3072`, and `/` with about `4123MB` available at preflight time.
  - Release prune kept five immutable releases and removed the oldest release directory, `9bb1a504cfbd-20260705T233435Z`.
  - Web, recorder WebSocket, and LiveKit services were active/running after deployment with `NRestarts=0`.
  - Strict production readiness with live Soniox returned `requiredOk=true`; `externalOk=false` remains because production still lacks Android/iOS/desktop runtime evidence and off-host audio storage.

## 2026-07-06 Immutable Release Retention

- Environment: production workspace with immutable web release directories enabled, `/srv/aialra/releases/babbledeck` containing three releases, and server root filesystem at roughly 98% usage before any new cleanup automation.
- Commands:
  - `du -h -d 2 /srv/aialra/releases/babbledeck`
  - `find /srv/aialra/releases/babbledeck/releases -mindepth 1 -maxdepth 1 -type d -printf '%TY-%Tm-%Td %TH:%TM %p\\n'`
  - `df -h / /srv /tmp`
  - `bash -n scripts/deploy-production.sh`
  - Isolated prune smoke using a temporary release root with four fake releases, `keep=2`, and `current` deliberately pointing at the oldest release.
  - `pnpm --filter @babbledeck/mobile native:build:android`
  - `pnpm device:readiness:production -- --check-desktop-headless`
  - GitHub Actions run `28759270730`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `tail -n 1 /srv/aialra/logs/babbledeck/deployments.jsonl`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service aialra-babbledeck-livekit.service --property=Id,ActiveState,SubState,NRestarts,ExecMainStartTimestamp --no-pager`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=55c7266a9731'`
- Results:
  - Added `BABBLEDECK_RELEASE_PRUNE` and `BABBLEDECK_RELEASES_KEEP` to `pnpm deploy:production`; pruning defaults on and keeps the newest five immutable releases while always protecting the active `current` symlink target.
  - Deployment JSONL release records now include a non-secret `release.prune` summary with prune enablement, keep count, release directory, current target, and pruned release names/paths.
  - The isolated prune smoke kept the two newest releases plus the oldest current target and pruned only the unprotected older release.
  - `bash -n scripts/deploy-production.sh` passed.
  - CI run `28759270730` passed for commit `55c7266a9731`.
  - Production deploy for commit `55c7266a9731` passed: forced standalone build, immutable release publication, web/recorder service restart, HTTPS readiness, homepage content check, readiness, seed-admin login/logout smoke, anonymous protected-route Playwright smoke, and release prune.
  - Live `/api/health` returned `release.commit="55c7266a9731"`, `status="ok"`, audio storage `driver="local"`, Soniox configured, and LiveKit configured.
  - The active release symlink pointed to `/srv/aialra/releases/babbledeck/releases/55c7266a9731-20260705T235713Z`.
  - Deployment JSONL recorded `release.prune.enabled=true`, `keep=5`, current release path, and `pruned=[]` because only four release directories existed.
  - Web, recorder WebSocket, and LiveKit services were active/running after deployment with `NRestarts=0`.
  - Strict production readiness with live Soniox returned `requiredOk=true`; `externalOk=false` remains because production still lacks Android/iOS/desktop runtime evidence and off-host audio storage.
  - Android debug APK was rebuilt successfully after the deploy/build cycle had removed it; device readiness again reports `debugApkExists=true` with sha256 `857955bcd635774ee5af6adafb2c1f6b84e79a528d09ad5ec19773ad4109b0f8`.
  - Device readiness still cannot produce full runtime evidence on this host: no physical Android device is connected, Linux lacks macOS/Xcode for iOS, and no interactive desktop display session is available, though the Tauri release binary still passes the Xvfb headless launch smoke.
  - Android emulator installation was not attempted because the server has no `/dev/kvm` and only about `4.5G` free root disk space.

## 2026-07-06 Production Soniox API Key Verification

- Environment: production deployment at `https://babbledeck.aialra.online`, `SONIOX_API_KEY` present in the production secrets env, immutable web release directories enabled, and production audio storage still local.
- Commands:
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service aialra-babbledeck-livekit.service --property=Id,ActiveState,SubState,NRestarts,ExecMainStartTimestamp --no-pager`
  - `readlink -f /srv/aialra/releases/babbledeck/current`
  - `tail -n 1 /srv/aialra/logs/babbledeck/deployments.jsonl`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=550611dac9e2'`
- Results:
  - Production deploy for commit `550611dac9e2` passed: forced standalone build, immutable release publication, web/recorder service restart, HTTPS readiness, homepage content check, readiness, seed-admin login/logout smoke, and anonymous protected-route Playwright smoke.
  - Live `/api/health` returned `status="ok"`, `release.commit="550611dac9e2"`, Soniox configured, LiveKit configured, audio storage `driver="local"`, and `offHostReady=false`.
  - The active release symlink pointed to `/srv/aialra/releases/babbledeck/releases/550611dac9e2-20260705T234021Z`, and the deployment JSONL record reported release mode `standalone_release`.
  - Web, recorder WebSocket, and LiveKit services were active/running after deployment with `NRestarts=0`.
  - Strict production readiness with `--check-soniox-live` returned `requiredOk=true`: `soniox_api_key`, `soniox_realtime_connectivity`, recent Soniox recorder smoke, recent Soniox UI smoke, and recent Soniox long trace all passed.
  - The remaining readiness gaps are external: missing recent Android/iOS/desktop device runtime evidence, and off-host audio storage is not cut over because production still uses local audio storage.

## 2026-07-06 Immutable Web Release Directory

- Environment: production systemd/Nginx deployment for `https://babbledeck.aialra.online`, current web service still running before the release-dir cutover, and local workspace build output available.
- Commands:
  - `bash -n scripts/deploy-production.sh`
  - `pnpm build`
  - `find apps/web/.next/standalone/apps/web/node_modules -maxdepth 2 -type l -print -exec readlink {} \\;`
  - `tmp=$(mktemp -d); mkdir -p "$tmp/release"; cp -a apps/web/.next/standalone/. "$tmp/release/"; test -f "$tmp/release/apps/web/server.js"; test -d "$tmp/release/apps/web/.next/static"; test -d "$tmp/release/node_modules"; rm -rf "$tmp"`
  - `pnpm lint`
  - `pnpm deploy:production`
  - `systemctl cat aialra-babbledeck.service --no-pager`
  - `readlink -f /srv/aialra/releases/babbledeck/current`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=9bb1a504cfbd'`
- Results:
  - `pnpm deploy:production` now defaults to copying the built standalone output into `/srv/aialra/releases/babbledeck/releases/<commit>-<timestamp>` and flipping `/srv/aialra/releases/babbledeck/current` before restarting the web service.
  - The deploy wrapper installs a systemd drop-in for `aialra-babbledeck.service` so the web service runs `server.js` from the active release symlink instead of the mutable workspace `.next/standalone` directory.
  - Deployment JSONL records now include release mode, release path, and current symlink.
  - A local release-copy smoke verified the standalone server file, static directory, root `node_modules`, and relative standalone symlink layout survive the release copy.
  - Production deploy for commit `9bb1a504cfbd` passed and installed `/etc/systemd/system/aialra-babbledeck.service.d/release.conf`.
  - `systemctl show` confirmed the web service runs from `/srv/aialra/releases/babbledeck/current/apps/web` with `ExecStart=/usr/bin/node server.js`.
  - The active release symlink points to `/srv/aialra/releases/babbledeck/releases/9bb1a504cfbd-20260705T233435Z`.
  - Live `/api/health` reports `release.commit="9bb1a504cfbd"`, and expected-release readiness passed for that commit.
  - Web, recorder WebSocket, and LiveKit services were active/running after the release-dir cutover with `NRestarts=0`.
  - This prevents future workspace builds from rewriting the directory currently serving production web traffic.

## 2026-07-06 Production Health Release Metadata

- Environment: local workspace plus production deployment target `https://babbledeck.aialra.online`, existing systemd/Nginx deployment wrapper, and production audio storage still local.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/health.test.ts`
  - `bash -n scripts/deploy-production.sh`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm build`
  - `BABBLEDECK_RELEASE_COMMIT=abc1234 BABBLEDECK_RELEASE_BRANCH=release-test BABBLEDECK_RELEASE_BUILT_AT=2026-07-05T23:11:22Z pnpm build --force`
  - `pnpm db:generate`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --expected-release-commit=521306e51a16'`
- Results:
  - `/api/health` now includes sanitized non-secret release metadata fields: `release.commit`, `release.branch`, and `release.builtAt`.
  - `next.config.mjs` captures `BABBLEDECK_RELEASE_*` values at build time, `turbo.json` passes those non-secret variables into build tasks, and `pnpm deploy:production` injects the current git commit, branch, and build timestamp before building the standalone server.
  - `scripts/check-production-readiness.ts` accepts `--expected-release-commit` / `BABBLEDECK_EXPECT_RELEASE_COMMIT`; `pnpm deploy:production` passes the current commit so the deployment smoke fails if `/api/health` reports a different release.
  - Health unit coverage verifies valid release metadata is reported and malformed values are dropped instead of echoed.
  - A forced release-env build confirmed the standalone output contains the expected non-secret release values.
  - The first deployment attempt correctly failed when Turbo had not passed `BABBLEDECK_RELEASE_*` into the build; adding the Turbo `globalEnv` whitelist fixed release injection.
  - The forced production build also exposed a strict Next type error in export download content-type indexing; the route now narrows the export format before indexing the content-type map.
  - Production deploy for commit `521306e51a16` passed: forced build, service restart, readiness with expected release commit, seed-admin login/logout smoke, and anonymous protected-route Playwright smoke.
  - Live `/api/health` now reports `release.commit="521306e51a16"`, `release.branch="main"`, and a non-secret build timestamp.
  - Web, recorder WebSocket, and LiveKit services were active/running after deployment with `NRestarts=0`.
  - This lets production health output prove which git commit is actually deployed, instead of relying only on local deployment logs.

## 2026-07-06 Production Deploy Log Evidence

- Environment: production deployment at `https://babbledeck.aialra.online`, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, configured production Soniox and LiveKit, and production audio storage still local.
- Commands:
  - `pnpm deploy:production`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service aialra-babbledeck-livekit.service --property=Id,ActiveState,SubState,NRestarts,Result,ExecMainStartTimestamp,MainPID --no-pager`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live'`
  - `bash -n scripts/deploy-production.sh`
- Results:
  - Production was redeployed from the current `main` commit with the existing guarded deployment wrapper: forced build, systemd web/WS restart, HTTPS readiness, homepage content check, live Soniox production readiness, seed-admin login/logout smoke, and anonymous protected-route Playwright smoke.
  - Web, recorder WebSocket, and LiveKit services were active/running after deployment with `NRestarts=0`.
  - Production `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox configured, and LiveKit configured.
  - Production readiness returned `requiredOk=true`, `externalOk=false`, and `productionReady=false`; the remaining external failures are still missing Android/iOS/desktop runtime evidence and local audio storage.
  - `scripts/deploy-production.sh` now appends non-secret readiness summary fields and web/recorder service state, result, start time, and restart counts to `/srv/aialra/logs/babbledeck/deployments.jsonl`.

## 2026-07-06 Native Wrapper Artifact Readiness

- Environment: production deployment at `https://babbledeck.aialra.online`, Linux server with Android SDK/JDK, ADB, Tauri/Linux dependencies, Xvfb, no connected physical Android device, no macOS/Xcode host, and no interactive desktop display session.
- Commands:
  - `pnpm audio:readiness:production`
  - `pnpm --filter @babbledeck/desktop native:smoke:headless`
  - `pnpm --filter @babbledeck/mobile native:build:android`
  - `pnpm device:readiness:production`
  - `pnpm --filter @babbledeck/mobile native:check:ios`
  - `pnpm --filter @babbledeck/mobile check && pnpm --filter @babbledeck/desktop check`
  - `pnpm device:readiness:production -- --check-desktop-headless`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/check-device-runtime-readiness.ts`
- Results:
  - Production audio cutover readiness still reports `cutoverReady=false`: local source `/srv/aialra/storage/babbledeck` exists with `554` files, the database has `428` uploaded chunks, and the production env is missing the R2/S3 driver, bucket, access key, and secret key variable groups.
  - The committed Android wrapper synced against the production PWA and built `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` successfully.
  - `pnpm device:readiness:production` now reports `debugApkExists=true`; ADB is available, but no physical Android device is connected.
  - iOS Capacitor sync and wrapper metadata validation passed on Linux, while actual iOS build/run remains blocked on a macOS/Xcode host.
  - Mobile and desktop wrapper config checks passed, confirming production HTTPS URLs, native microphone permission declarations, and no default Tauri remote capabilities.
  - The Tauri Linux release binary passed the existing Xvfb headless startup smoke.
  - `scripts/check-device-runtime-readiness.ts` now reports non-secret artifact path/size/sha256 metadata for the Android APK and desktop binary, plus optional desktop headless smoke status with `--check-desktop-headless`.
  - Device runtime readiness still remains incomplete until real Android, iOS, and interactive desktop runs record microphone grant, recording start, visible captions, and audio-backup evidence through `pnpm device:evidence:production`.

## 2026-07-06 Production Soniox Key Revalidation

- Environment: production deployment at `https://babbledeck.aialra.online`, refreshed production `SONIOX_API_KEY` loaded from `/srv/aialra/config/secrets/babbledeck.env` without printing secrets, self-hosted LiveKit present, Chromium fake-microphone capture, and production audio storage still local.
- Commands:
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live'`
  - `pnpm soniox:smoke:production`
  - `pnpm soniox:ui-smoke:production`
  - `pnpm soniox:trace:production`
  - `curl -fsSL https://api.github.com/repos/AIALRA-0/BabbleDeck/actions/runs/28757203997`
- Results:
  - Production `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox configured, and LiveKit configured.
  - Live Soniox readiness passed: `SONIOX_API_KEY` was configured and the realtime websocket accepted the generated probe audio with `360ms` processed.
  - Production Soniox recorder smoke passed with recorder WebSocket readiness, ack, `1` persisted audio chunk, `360ms` Soniox provider usage, `0` provider errors, completed session status, and archived cleanup.
  - Production Soniox UI smoke passed through Chromium fake-microphone capture against the deployed site.
  - Production Soniox long trace passed with `40000ms` Soniox provider usage, `40` audio chunks, `15` transcript segments, `14` translations, expected matches for `Brooklyn`, `Spanish`, and `French`, `0` provider errors, and archived cleanup.
  - Production readiness returned `requiredOk=true`; `externalOk=false` remains because production still needs off-host R2/S3-compatible audio storage and recent Android, iOS, and desktop runtime evidence.
  - GitHub Actions run `28757203997` for commit `98044d2` completed successfully.

## 2026-07-05 Production Network Recovery UI

- Environment: local browser test server first, then production deployment at `https://babbledeck.aialra.online`, configured production seed admin credentials loaded from env without printing secrets, configured Soniox key, self-hosted LiveKit present, and production audio storage still local.
- Commands:
  - `pnpm prettier --write apps/web/src/components/ViewerClient.tsx apps/web/src/components/RecorderClient.tsx e2e/mvp.spec.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "network reconnect states"`
  - `pnpm --filter @babbledeck/web build`
  - `pnpm deploy:production`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "network reconnect states"`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live'`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service --property=Id,ActiveState,SubState,NRestarts,Result,ExecMainStartTimestamp,MainPID --no-pager`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
- Results:
  - Viewer pages now respond to browser `offline` and `online` events by showing an explicit `Offline` connection state and recovery copy, then returning to SSE or polling when the connection comes back.
  - Recorder pages now show a visible browser-offline recovery banner explaining that local backup remains on the device while uploads reconnect.
  - Added a real-browser Playwright scenario that creates a session, opens the production-style mobile viewer, confirms `SSE live`, uses Playwright context offline/online to simulate network interruption and recovery, and verifies the recorder offline banner appears and clears.
  - Local Chromium network recovery test passed.
  - Production deploy for commit `aff47929185b` passed the deployment wrapper: forced build, systemd web/WS restart, HTTPS/readiness checks, seed-admin login smoke, and anonymous protected-route Playwright smoke.
  - Production Chromium network recovery test passed against `https://babbledeck.aialra.online`.
  - Production readiness returned `requiredOk=true` with live Soniox websocket connectivity; `externalOk=false` remains only because production audio storage is still local until R2/S3-compatible storage is configured and cut over.
  - Production `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox configured, and LiveKit configured.
  - Web and recorder WS services stayed active/running with `NRestarts=0` after deployment and production network-recovery testing.

## 2026-07-05 Production Suspicious Probe Hardening

- Environment: production deployment at `https://babbledeck.aialra.online`, configured production `SONIOX_API_KEY`, self-hosted LiveKit present, and production audio storage still local.
- Commands:
  - `pnpm db:generate`
  - `pnpm --filter @babbledeck/web test -- src/server/suspicious-probe.test.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm --filter @babbledeck/web build`
  - `pnpm deploy:production`
  - `curl -sS -D - -o /tmp/babbledeck-dotenv-body https://babbledeck.aialra.online/.env`
  - `curl -sS -D - -o /tmp/babbledeck-quoted-static-body 'https://babbledeck.aialra.online/%22/_next/static/chunks/app.js%22'`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live --strict'`
  - `pnpm soniox:trace:production`
  - `bash -lc 'set -a; . /srv/aialra/config/secrets/babbledeck.env; set +a; pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live'`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service --property=Id,ActiveState,SubState,NRestarts,Result,ExecMainStartTimestamp,MainPID --no-pager`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
- Results:
  - Added a proxy-level suspicious probe detector for dotfile probes, PHP/config scanner paths, and quoted fake `/_next/static` requests so these paths return a plain `404` before reaching Next's app not-found renderer.
  - Added unit coverage for scanner paths such as `/.env`, `/.git/config`, `/wp-config.php`, `/config.json`, `/aws.config.js`, and `/%22/_next/static/chunks/app.js%22`, while allowing app paths and `/.well-known/acme-challenge`.
  - Full Vitest run passed with `20` files and `77` tests after regenerating Prisma Client; web typecheck, lint, and production build passed.
  - Production deploy for commit `c48aa9fe4af7` passed the deployment wrapper: forced build, systemd web/WS restart, HTTPS/readiness checks, seed-admin login smoke, and anonymous protected-route Playwright smoke.
  - Production probe requests to `/.env` and `/%22/_next/static/chunks/app.js%22` returned `HTTP/2 404` with `content-type: text/plain; charset=utf-8`, request/correlation IDs, and the configured security headers.
  - Deployment-era logs showed the probe requests were logged without new `/_not-found` client-reference manifest errors; older manifest errors were confirmed to predate the hardening deployment.
  - Web and recorder WS services stayed active/running with `NRestarts=0` after deployment and probe requests.
  - Post-deploy Soniox trace passed with `39000ms` Soniox provider usage, `39` persisted audio chunks, `16` transcript segments, `15` translations, expected text matches for `Brooklyn`, `Spanish`, and `French`, `0` provider errors, and the trace session archived.
  - Production readiness returned `requiredOk=true` with live Soniox websocket connectivity and the latest long trace passing; `externalOk=false` remains only because production audio storage is still local until R2/S3-compatible storage is configured and cut over.
  - Production `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox configured, and LiveKit configured.

## 2026-07-05 Production Soniox Long Trace

- Environment: production deployment at `https://babbledeck.aialra.online`, configured production `SONIOX_API_KEY`, self-hosted LiveKit present, Chromium fake-microphone capture, and production audio storage still local.
- Commands:
  - `bash -n scripts/soniox-trace-production.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/soniox-trace-summary.ts scripts/check-production-readiness.ts playwright.config.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm soniox:trace:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/preflight-audio-storage.ts scripts/preflight-livekit.ts scripts/collect-production-metrics.ts scripts/load-smoke-production.ts scripts/soniox-smoke-production.ts scripts/soniox-trace-summary.ts scripts/security-baseline-audit.ts scripts/verify-wrapper-configs.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm db:validate && pnpm db:generate`
  - `pnpm build`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health | jq -r '{status:.data.status,version:.data.version,audioDriver:.data.checks.audioStorage.driver,offHostReady:.data.checks.audioStorage.offHostReady,soniox:.data.checks.providers.soniox.configured,livekit:.data.checks.providers.livekit.configured,uptime:.data.uptimeSeconds}'`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service aialra-babbledeck-livekit.service -p Id -p ActiveState -p SubState -p NRestarts -p ExecMainStartTimestamp`
- Results:
  - Added `pnpm soniox:trace:production`, which generates a longer fake-microphone WAV, runs the deployed production recorder/viewer UI, waits after captions arrive, and writes a non-secret JSONL record to `/srv/aialra/logs/babbledeck/soniox-trace.jsonl`.
  - Added `scripts/soniox-trace-summary.ts`, which finds the trace session by title, verifies persisted transcript segments/translations, expected text matches, audio chunks, provider usage, and zero provider errors, then archives the trace session.
  - Added `recent_soniox_trace` to strict production readiness.
  - Parameterized the Soniox Playwright test with `E2E_SONIOX_SESSION_TITLE`, `E2E_SONIOX_EXPECTED_TEXTS`, and `E2E_SONIOX_RECORD_SECONDS`.
  - Hardened the Soniox Playwright flow to click the app error-boundary `Retry` button if the session workspace transiently fails to load after opening `/sessions/new`.
  - Production trace passed after deployment with `40000ms` Soniox provider usage, `40` persisted audio chunks, `15` transcript segments, `14` translations, expected text matches for `Brooklyn`, `Spanish`, and `French`, and `0` provider errors.
  - Production `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox configured, and LiveKit configured.
  - Web, recorder WS, and LiveKit systemd services were active/running with `NRestarts=0`.
  - Strict production readiness had all required checks passing, including live Soniox websocket probe and the new long trace check, and exited nonzero only because the external `off_host_audio_storage` check still fails while production remains on local storage.
  - Full local format, lint, typecheck, Vitest/unit, script typecheck, Prisma validate/generate, and production build gates passed.
  - Production deploy for commit `2c9799c3cc1f` passed the deployment wrapper: forced build, systemd web/WS restart, HTTPS/readiness checks, seed-admin login smoke, and anonymous protected-route Playwright smoke.

## 2026-07-05 Uploaded Local Backup Cleanup

- Environment: local workspace with Playwright dev server on `127.0.0.1:3100`, production deployment at `https://babbledeck.aialra.online`, production `SONIOX_API_KEY` present, self-hosted LiveKit present, and production audio storage still local.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "recorder cleans uploaded local backup chunks"`
  - `E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm format:check`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/preflight-audio-storage.ts scripts/preflight-livekit.ts scripts/collect-production-metrics.ts scripts/load-smoke-production.ts scripts/soniox-smoke-production.ts scripts/security-baseline-audit.ts scripts/verify-wrapper-configs.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm db:validate && pnpm db:generate`
  - `pnpm build`
  - `pnpm deploy:production`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session|recorder cleans uploaded local backup chunks"`
  - `curl -fsS https://babbledeck.aialra.online/api/health | jq -r '{status:.data.status,version:.data.version,audioDriver:.data.checks.audioStorage.driver,offHostReady:.data.checks.audioStorage.offHostReady,soniox:.data.checks.providers.soniox.configured,livekit:.data.checks.providers.livekit.configured,uptime:.data.uptimeSeconds}'`
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service aialra-babbledeck-livekit.service -p Id -p ActiveState -p SubState -p NRestarts -p ExecMainStartTimestamp`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm soniox:smoke:production`
  - `pnpm soniox:ui-smoke:production`
- Results:
  - Added `deleteUploadedLocalChunks()` for browser IndexedDB backup storage and a recorder `Clean uploaded` action that deletes only chunks with `status="uploaded"`.
  - The cleanup action is disabled while recording or when no uploaded local chunks remain; failed/pending chunks remain visible and recoverable.
  - The main MVP browser flow now cleans uploaded local backup after stopping recording, before returning to the history page.
  - Added deterministic desktop Playwright coverage that seeds two uploaded chunks and one failed chunk, verifies `2/3 uploaded`, cleans uploaded chunks, then verifies `0/1 uploaded` with `1 pending · 1 failed`.
  - Local targeted cleanup E2E passed, and local desktop/mobile main MVP flow passed.
  - Full local format, lint, typecheck, Vitest/unit, script typecheck, Prisma validate/generate, and production build gates passed.
  - Production deploy for commit `2602746534c4` passed the deployment wrapper: forced build, systemd web/WS restart, HTTPS/readiness checks, seed-admin login smoke, and anonymous protected-route Playwright smoke.
  - Production Playwright passed desktop main flow, desktop cleanup-specific flow, and mobile main flow on `https://babbledeck.aialra.online`.
  - Production `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox configured, and LiveKit configured.
  - Web, recorder WS, and LiveKit systemd services were active/running with `NRestarts=0`.
  - Strict production readiness had all required checks passing, including live Soniox websocket probe, and exited nonzero only because the external `off_host_audio_storage` check still fails while production remains on local storage.
  - Production Soniox recorder smoke passed with one audio chunk, `360ms` provider usage, zero provider errors, and cleanup archiving.
  - Production Soniox UI smoke passed in Chromium using fake-microphone speech and verified expected `Brooklyn` captions on recorder and viewer.
  - Recent Playwright/smoke sessions were archived after validation; zero recent unarchived smoke sessions remained.

## 2026-07-05 Recorder Microphone Input Selector

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev servers on `127.0.0.1:3112` and `127.0.0.1:3113`, and production secret env loaded only for the local seed-admin password.
- Commands:
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm db:migrate`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm db:seed`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm tsx scripts/sync-seed-admin.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev E2E_BASE_URL=http://127.0.0.1:3112 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev E2E_BASE_URL=http://127.0.0.1:3113 pnpm e2e e2e/mvp.spec.ts --project=chromium-mobile --grep "admin creates a live session"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/preflight-audio-storage.ts scripts/preflight-livekit.ts scripts/collect-production-metrics.ts scripts/load-smoke-production.ts scripts/soniox-smoke-production.ts scripts/security-baseline-audit.ts scripts/verify-wrapper-configs.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
- Results:
  - Recorder pages now enumerate `audioinput` devices where the browser supports `navigator.mediaDevices.enumerateDevices`.
  - The recorder shows a `Microphone input` selector with a default microphone option and any discovered input labels, refreshes labels after microphone permission is granted, and listens for `devicechange`.
  - Starting recording uses the selected device id when present and disables the selector while recording is active.
  - Desktop and mobile Playwright main flows passed while asserting the selector is visible/enabled before recording and disabled during active recording.
  - Full format, lint, typecheck, unit tests, script typecheck, and production build passed.

## 2026-07-05 Production Self-Hosted LiveKit Room Audio

- Environment: production deployment at `https://babbledeck.aialra.online`, self-hosted LiveKit service `aialra-babbledeck-livekit.service`, same-domain Nginx `/livekit/` proxy, configured Soniox key, and local production audio storage.
- Commands:
  - `bash -n scripts/start-production-livekit.sh scripts/install-production-livekit-selfhost.sh scripts/livekit-ui-smoke-production.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/preflight-livekit.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm db:validate && pnpm db:generate`
  - CI secret-scan pattern from `.github/workflows/ci.yml`
  - `pnpm db:generate && pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health | jq`
  - `pnpm livekit:preflight:production`
  - `pnpm livekit:ui-smoke:production`
  - `pnpm soniox:smoke:production`
  - `pnpm soniox:ui-smoke:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Installed self-hosted LiveKit on the existing production server through systemd and Nginx, using same-domain `wss://babbledeck.aialra.online/livekit`.
  - Updated LiveKit preflight to support path-prefixed deployments by calling Twirp management APIs under `/livekit/twirp`.
  - Added `pnpm livekit:ui-smoke:production`; Chromium verified recorder room-audio `Publishing` and viewer `Audio live` on the real deployed site.
  - `/api/health` returned `status="ok"`, database ok, audio storage `driver="local"` with `offHostReady=false`, Soniox `configured=true`, and LiveKit `configured=true`.
  - LiveKit preflight passed with `managementApiPath="/livekit"`, token grant checks, and room list connectivity.
  - Soniox recorder smoke passed with one uploaded audio chunk, `360ms` provider usage, zero provider errors, and cleanup archiving.
  - Soniox UI smoke passed with Chromium fake-microphone speech and expected `Brooklyn` captions.
  - Web, recorder WS, and LiveKit systemd services were active/running with `NRestarts=0`.
  - Strict live readiness now checks LiveKit credentials, LiveKit service state/restart count, and recent LiveKit UI smoke; all required checks pass.
  - Strict readiness still exits nonzero only because the external `off_host_audio_storage` check fails while `AUDIO_STORAGE_DRIVER=local`.

## 2026-07-05 LiveKit Browser Room Audio Client

- Environment: local workspace, `livekit-client@2.20.0`, current BabbleDeck browser UI, and current production env loaded only for Playwright authentication.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `SESSION_CREATE_RATE_LIMIT_PER_MINUTE=1000 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added `livekit-client` to the web app.
  - The recorder now requests a publisher token when recording starts and, when LiveKit is configured, publishes the existing microphone track to the BabbleDeck room without requesting a second microphone stream.
  - The viewer now requests a subscriber token, joins the BabbleDeck room, attaches remote audio tracks to hidden audio elements, and exposes a compact room-audio status with an autoplay recovery button.
  - If LiveKit is not configured or token fetch/connection fails, room audio shows an unavailable/not-configured state while existing Soniox captions, mock captions, local backup, recorder WebSocket upload, and viewer SSE/polling continue.
  - Playwright mocked both LiveKit token endpoints to `503 PROVIDER_NOT_CONFIGURED` and verified the recorder/viewer fallback states while the full MVP browser flow still passed.
  - Full format, lint, typecheck, unit tests, and production build passed.

## 2026-07-05 Latest Production Soniox Recheck

- Environment: production deployment at `https://babbledeck.aialra.online`, commit `19f77c7`, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, configured `SONIOX_API_KEY`, and local production audio storage.
- Commands:
  - `curl -fsS https://babbledeck.aialra.online/api/health | jq -r '{status:.data.status,version:.data.version,audio:.data.checks.audioStorage.driver,offHost:.data.checks.audioStorage.offHostReady,soniox:.data.checks.providers.soniox.configured,livekit:.data.checks.providers.livekit.configured,uptime:.data.uptimeSeconds}'`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm security:audit:production`
  - `pnpm soniox:smoke:production`
  - `pnpm soniox:ui-smoke:production`
  - `pnpm livekit:preflight:production`
- Results:
  - `/api/health` returned `status="ok"`, audio storage `driver="local"`, `offHostReady=false`, Soniox `configured=true`, and LiveKit `configured=false`.
  - Strict readiness passed every required check, including live Soniox realtime websocket connectivity with `360ms` accepted probe audio; strict completion still fails only the external `off_host_audio_storage` check because production remains on local audio storage.
  - Production Soniox recorder WebSocket smoke passed with recorder ready/ack, one uploaded audio chunk, `360ms` provider usage, zero provider errors, and cleanup archiving.
  - Production Soniox UI smoke passed in Chromium using fake-microphone speech and verified the recorder/viewer live-caption path on the real deployed site.
  - Production security baseline passed with 10 checks.
  - Latest GitHub Actions run for commit `19f77c7` completed successfully.
  - `pnpm livekit:preflight:production` correctly failed without printing secrets because `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are not configured yet.

## 2026-07-05 LiveKit Production Configure and Preflight Wrappers

- Environment: local workspace, temporary env files, and official `livekit-server-sdk`.
- Commands:
  - `bash -n scripts/preflight-livekit-production.sh scripts/configure-production-livekit.sh`
  - Missing-credential smoke with `BABBLEDECK_ENV_FILE` pointed at a temporary `.env.example` copy.
  - Fake LiveKit preflight with temporary `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and redacted fake secret values plus `--skip-connectivity`.
  - Fake LiveKit configure smoke with `BABBLEDECK_LIVEKIT_CONFIGURE_PREFLIGHT=0`.
- Results:
  - Added `pnpm livekit:preflight:production` and `pnpm livekit:configure:production`.
  - The preflight generates a short-lived publisher token, verifies the room grant and microphone publish grant, and can check the LiveKit management API with `RoomServiceClient.listRooms()` when credentials point at a real server.
  - The configure wrapper prepares a patched env without printing secrets, runs the preflight against the temporary env by default, and only installs the production env after preflight passes.
  - Missing-credential smoke exited nonzero with missing `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
  - Fake token-only preflight and configure smokes exited zero, wrote non-secret JSONL markers, and did not print the fake secret value.

## 2026-07-05 LiveKit V2 Token Foundation

- Environment: local workspace, official `livekit-server-sdk`, and Vitest route/module coverage.
- Commands:
  - `pnpm --filter @babbledeck/web add livekit-server-sdk`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test -- livekit`
  - `pnpm tsx scripts/security-baseline-audit.ts --base-url=https://babbledeck.aialra.online`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm db:generate && pnpm deploy:production`
  - Production LiveKit token smoke with a temporary mock session and recorder token.
- Results:
  - Added optional LiveKit V2 token generation with short TTL, BabbleDeck room naming, publisher/subscriber roles, and microphone-only publish grants.
  - Added `/api/sessions/[id]/livekit-token` for owner/recorder-token access and `/api/viewer/session/[shareToken]/livekit-token` for subscriber-only viewer access.
  - Added non-secret LiveKit configured status to settings and `/api/health`.
  - LiveKit-specific tests passed with `19` files and `62` tests, including JWT grant decoding and route behavior.
  - Full format, lint, typecheck, test, and build gates passed.
  - Production deploy for commit `0e5ff0a` passed the deployment wrapper, including build, service restart, readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke.
  - Production `/api/health` returned LiveKit `configured=false`, as expected before LiveKit server credentials are supplied.
  - The production recorder/admin LiveKit token endpoint returned `503 PROVIDER_NOT_CONFIGURED` for a temporary session, and the smoke session was archived on cleanup.
  - Production security baseline passed after adding LiveKit env placeholders and sensitive-key checks.
  - Production LiveKit remains unconfigured until `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are supplied.

## 2026-07-05 Production Audio Storage Env Configure Wrapper

- Environment: local workspace, temporary env files, and production audio storage management scripts.
- Commands:
  - `bash -n scripts/configure-production-audio-storage.sh`
  - Missing-credential smoke with `BABBLEDECK_ENV_FILE` pointed at a temporary `.env.example` copy.
  - Fake R2 env smoke with `BABBLEDECK_AUDIO_STORAGE_CONFIGURE_PREFLIGHT=0`, `BABBLEDECK_AUDIO_STORAGE_DRIVER=r2`, fake R2 account/bucket/access-key values, and a redacted fake secret value.
- Results:
  - Added `pnpm audio:configure:production`.
  - The script prepares a patched env without printing secrets, runs off-host storage preflight against the temporary env by default, and only installs the production env after preflight passes.
  - The script writes a timestamped backup and appends a non-secret JSONL record containing the target driver and updated key names.
  - The missing-credential smoke exited nonzero and left the temporary env checksum unchanged.
  - The fake R2 smoke with preflight disabled exited zero, wrote the expected R2 key names to the temporary env, created a non-secret configure log, and did not print the fake secret value.

## 2026-07-05 R2 Generic Bucket Region Hardening

- Environment: local workspace, TypeScript unit tests, and production R2/S3 cutover configuration code.
- Commands:
  - `pnpm --filter @babbledeck/web test -- audio-storage`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm db:generate && pnpm deploy:production`
  - `pnpm audio:preflight:production` (expected exit 1 while production remains local)
- Results:
  - Updated `resolveAudioStorageConfig()` so `AUDIO_STORAGE_DRIVER=r2` selects S3 SDK `region="auto"` even when the target bucket comes from `AUDIO_STORAGE_BUCKET` instead of `R2_BUCKET`.
  - Added regression coverage for a generic-bucket R2 configuration using `R2_ACCOUNT_ID` plus `AUDIO_STORAGE_ACCESS_KEY_ID` and `AUDIO_STORAGE_SECRET_ACCESS_KEY`.
  - Targeted Vitest passed with `16` files and `54` tests, and web typecheck passed.
  - Full format, lint, typecheck, test, and build gates passed.
  - Production deploy for commit `4a0d6ae` passed the deployment wrapper: build, service restart, HTTPS readiness, seed-admin login smoke, production readiness required checks, and anonymous protected-route Playwright smoke.
  - GitHub Actions run `28747844382` for commit `4a0d6ae` completed successfully.
  - Production `/api/health` remained `ok` with audio storage `driver="local"`, `offHostReady=false`, and Soniox `configured=true`; strict live Soniox readiness passed with `360ms` accepted probe audio.
  - `pnpm audio:preflight:production` correctly failed with `targetDriver="local"`, proving the remaining off-host storage gap is missing production R2/S3 credentials and cutover, not the R2 config parser.

## 2026-07-05 Post-Deploy Soniox Key Verification

- Environment: production deployment at `https://babbledeck.aialra.online`, commit `d49c8b6`, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, configured `SONIOX_API_KEY`, and local production audio storage.
- Commands:
  - `curl -fsS https://babbledeck.aialra.online/api/health | jq .`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm health:monitor:production`
  - `pnpm soniox:smoke:production`
  - `pnpm soniox:ui-smoke:production`
  - `pnpm --filter @babbledeck/mobile native:check:ios`
  - `pnpm --filter @babbledeck/mobile native:build:android`
- Results:
  - `/api/health` returned `ok=true`, database `ok=true`, audio storage `driver="local"`, `offHostReady=false`, and Soniox `configured=true`.
  - Strict readiness passed all required checks, including live Soniox realtime websocket connectivity with `360ms` accepted probe audio, and failed only the external `off_host_audio_storage` check because production still uses local audio storage.
  - Production Soniox recorder WebSocket smoke passed with one audio chunk, recorder ready/ack, `360ms` provider usage, zero provider errors, and cleanup archiving.
  - Production Soniox UI smoke passed in Chromium with fake microphone speech and verified live captions on the recorder/viewer flow.
  - The latest GitHub Actions run for `d49c8b6` completed successfully.
  - Web and recorder WebSocket services remained active with `NRestarts=0`.
  - iOS Capacitor metadata validation and Android debug APK assembly both passed after the production deploy.
  - Production completion still waits on real R2/S3-compatible audio credentials and physical device runtime checks.

## 2026-07-05 Capacitor Android Build

- Environment: production-first mobile wrapper pointing at `https://babbledeck.aialra.online`, Ubuntu 24.04 server, OpenJDK 21, Android SDK command-line tools, Android platform 36, build-tools 36.0.0, and platform-tools 37.0.0.
- Commands:
  - `pnpm --filter @babbledeck/mobile exec cap add android`
  - `apt-get install openjdk-21-jdk google-android-cmdline-tools-13.0-installer google-android-platform-tools-installer`
  - `sdkmanager --sdk_root=/usr/lib/android-sdk 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'`
  - `pnpm --filter @babbledeck/mobile native:check:android`
  - `pnpm --filter @babbledeck/mobile native:build:android`
  - `pnpm wrappers:check`
- Results:
  - Added the committed Capacitor Android project in `apps/mobile/android`.
  - Added `scripts/fix-capacitor-android-settings.ts` because Capacitor sync generated a pnpm virtual-store path that was one directory too shallow for this workspace layout; `native:sync` now normalizes the Android Gradle module path after every sync.
  - Android Gradle project resolution passed with projects `:app`, `:capacitor-android`, and `:capacitor-cordova-android-plugins`.
  - Debug APK assembly passed and produced `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` locally; build artifacts remain ignored.
  - Physical Android device execution and iOS wrapper validation remain follow-up items.

## 2026-07-05 Capacitor iOS Scaffold

- Environment: production-first mobile wrapper pointing at `https://babbledeck.aialra.online`, Linux server, Capacitor iOS package, and Swift Package Manager integration.
- Commands:
  - `pnpm --filter @babbledeck/mobile exec cap add ios --packagemanager SPM`
  - `pnpm --filter @babbledeck/mobile native:sync`
  - `pnpm --filter @babbledeck/mobile native:check:ios`
  - `pnpm wrappers:check`
- Results:
  - Added the committed Capacitor iOS project in `apps/mobile/ios`.
  - The iOS wrapper uses Swift Package Manager metadata through `CapApp-SPM/Package.swift`.
  - Added native microphone permissions for wrapper recording: `android.permission.RECORD_AUDIO` in Android and `NSMicrophoneUsageDescription` in iOS.
  - `scripts/verify-wrapper-configs.ts` now verifies Android and iOS wrapper project metadata, bundle identifiers, production URL config source, and microphone permission declarations.
  - iOS build and device execution still require macOS/Xcode and a physical or simulator device outside this Linux server.

## 2026-07-05 Production Soniox UI Smoke

- Environment: production deployment at `https://babbledeck.aialra.online`, configured `SONIOX_API_KEY`, Chromium desktop project, and generated fake-microphone WAV from `ffmpeg` flite speech.
- Commands:
  - `bash -n scripts/soniox-ui-smoke-production.sh scripts/soniox-smoke-production.sh scripts/deploy-production.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/check-production-readiness.ts`
  - `pnpm soniox:ui-smoke:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `scripts/soniox-ui-smoke-production.sh` and `pnpm soniox:ui-smoke:production`.
  - The wrapper generates a temporary speech WAV, passes it to Chromium as the fake microphone source, runs the real production Soniox recorder UI, opens a mobile-width viewer page, and verifies both recorder and viewer receive expected Soniox caption text.
  - The production run passed: Playwright reported `1 passed`, the fake audio duration was 6.34475 seconds, and a non-secret marker was appended to `/srv/aialra/logs/babbledeck/soniox-ui-smoke.jsonl`.
  - Strict production readiness now requires `recent_soniox_ui_smoke`; all required checks pass, while strict completion still waits on the external `off_host_audio_storage` check.

## 2026-07-05 R2 Credential Probe

- Environment: production server workspace and `/srv/aialra/config/secrets/babbledeck.env`.
- Commands:
  - `npx wrangler whoami`
  - Server secret variable-name scan for `CLOUDFLARE`, `CF_`, `R2_`, `S3_`, `AWS_`, and `WRANGLER` prefixes.
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - `wrangler` is not authenticated on this server.
  - No Cloudflare/R2/S3/AWS credential variable names are present in the BabbleDeck production env or other inspected server secret files.
  - Strict readiness still fails only the external `off_host_audio_storage` check until off-host bucket credentials are supplied.

## 2026-07-05 Native Wrapper Scaffold

- Environment: local workspace with production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `pnpm wrappers:check`
  - `pnpm --filter @babbledeck/mobile typecheck`
  - `pnpm --filter @babbledeck/mobile check`
  - `pnpm --filter @babbledeck/desktop check`
  - `pnpm --filter @babbledeck/mobile exec cap doctor`
  - `pnpm --filter @babbledeck/desktop native:info`
  - `pnpm --filter @babbledeck/desktop native:check`
  - `pnpm --filter @babbledeck/desktop native:build`
  - `pnpm --filter @babbledeck/desktop native:smoke:headless` (treats timeout after the app stays alive for 15s as success)
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/verify-wrapper-configs.ts`
- Results:
  - Added `apps/mobile` as a Capacitor scaffold that defaults to the deployed production PWA.
  - Added `apps/desktop` as a Tauri 2 scaffold that defaults to the deployed production PWA.
  - Added wrapper config verification for HTTPS production URLs and no default Tauri remote capabilities.
  - Capacitor Doctor reports the installed Capacitor dependencies are current.
  - Installed the Linux Tauri prerequisites on this host and fixed the Rust scaffold with `src/lib.rs` plus a generated PNG icon.
  - Tauri CLI now reports `webkit2gtk-4.1`, `rsvg2`, Rust, and app config as healthy; `cargo check` validates the desktop wrapper crate.
  - `pnpm --filter @babbledeck/desktop native:build` produced the Linux release binary at `apps/desktop/src-tauri/target/release/babbledeck-desktop`.
  - The headless Xvfb smoke kept the desktop app running until the timeout, with only DRI acceleration warnings from the virtual display.

## 2026-07-05 Service Restart Readiness Gate

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `systemctl show aialra-babbledeck.service aialra-babbledeck-ws.service --property=ActiveState,SubState,NRestarts,ExecMainStartTimestamp,ExecMainPID --no-pager`
  - `pnpm security:audit:production`
  - `for i in $(seq 1 25); do curl -fsS -o /dev/null https://babbledeck.aialra.online/api/health || exit 1; done`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/check-production-readiness.ts`
- Results:
  - Observed one production web service `SIGSEGV` followed by systemd auto-restart while running security-baseline checks; the rerun passed and health probes did not reproduce the crash.
  - Added required readiness checks for `NRestarts=0` on `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, so future unexpected auto-restarts are not hidden by active/running state.

## 2026-07-05 Production Soniox Recorder Smoke

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `bash -n scripts/soniox-smoke-production.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/soniox-smoke-production.ts scripts/check-production-readiness.ts`
  - `pnpm soniox:smoke:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `scripts/soniox-smoke-production.ts` and `pnpm soniox:smoke:production` for repeatable production Soniox recorder coverage.
  - The smoke signs in with the production seed admin, creates a temporary Soniox session, starts it with the scoped recorder token, uploads a generated WAV probe through `/ws/recorder`, verifies recorder acknowledgement, provider usage, one stored audio chunk, and zero provider errors, then stops and archives the session.
  - Strict readiness now requires a recent passing non-secret Soniox smoke JSONL marker.

## 2026-07-05 Health Monitor Local Alerts

- Environment: local workspace with temporary log directories and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `BABBLEDECK_LOG_DIR="$tmpdir" BABBLEDECK_HEALTH_BASE_URL=http://127.0.0.1:9 BABBLEDECK_HEALTH_ALERT_THRESHOLD=2 pnpm health:monitor:production` twice, expecting nonzero exits.
  - `BABBLEDECK_LOG_DIR="$tmpdir" BABBLEDECK_HEALTH_BASE_URL=https://babbledeck.aialra.online BABBLEDECK_HEALTH_ALERT_THRESHOLD=2 pnpm health:monitor:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - The health monitor now tracks consecutive unhealthy checks in `health-monitor-state.json`.
  - It writes `health_alert_opened` only after the configured failure threshold is crossed, avoiding one-off deployment 502 noise.
  - It writes `health_alert_recovered` when a later healthy check clears an active alert.
  - Production readiness now includes `health_alert_state`, which fails while a local health alert is active.

## 2026-07-05 Audio Storage Preflight

- Environment: local workspace and production secret env at `https://babbledeck.aialra.online`.
- Commands:
  - `AUDIO_STORAGE_DRIVER=local AUDIO_STORAGE_DIR=$(mktemp -d) pnpm tsx scripts/preflight-audio-storage.ts`
  - `pnpm audio:preflight:production` (expected exit 1 while production target remains local)
  - `bash -n scripts/preflight-audio-storage-production.sh scripts/cutover-audio-storage.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/preflight-audio-storage.ts`
- Results:
  - Added `scripts/preflight-audio-storage.ts` to create, head, and delete a temporary object against the configured audio storage target without touching production audio rows.
  - Added `pnpm audio:preflight:production`, which loads the production secret env, requires an off-host target, writes a non-secret JSONL result, and fails cleanly while production still uses local audio storage.
  - Wired the preflight into `pnpm audio:cutover:production` before migration dry-run or apply steps, so bucket/endpoint/credential/delete permission problems are caught before raw audio migration.

## 2026-07-05 Soniox Recorder Close Race

- Environment: local workspace plus one-off production probe at `https://babbledeck.aialra.online`.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/soniox-realtime.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/collect-production-metrics.ts scripts/load-smoke-production.ts scripts/security-baseline-audit.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - One-off production recorder WebSocket smoke using a temporary `soniox` session and generated WAV probe.
- Results:
  - The production smoke confirmed the public recorder WebSocket path could create a `soniox` session, upload and acknowledge one audio chunk, and archive the temporary session, but an immediate recorder close exposed a provider-side `No audio received` error.
  - Fixed the shutdown race by queueing Soniox audio sends and delaying the provider end-of-audio frame until queued audio has been sent.
  - Added a regression test that opens the Soniox bridge, queues the first audio chunk, closes while the provider socket is still connecting, and verifies the provider send order is config, audio, then end.
  - Local validation passed with 53 unit tests, format, lint, app typecheck, script typecheck, and production build.

## 2026-07-05 Request Correlation and Error Boundary

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/request-id.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/collect-production-metrics.ts scripts/load-smoke-production.ts scripts/security-baseline-audit.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm deploy:production`
  - `curl -fsSI -H 'x-request-id: 123e4567-e89b-42d3-a456-426614174000' https://babbledeck.aialra.online/`
  - `pnpm security:audit:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `apps/web/src/proxy.ts` to preserve or generate `x-request-id`, mirror it as `x-correlation-id`, and write structured JSON request logs in production while skipping `/api/health` noise.
  - Added `apps/web/src/server/request-id.ts` and unit coverage for UUID validation, incoming ID preservation, replacement generation, and structured request log records.
  - Added `apps/web/src/app/error.tsx` as an App Router error boundary with retry/dashboard actions and structured `ui.error_boundary` logging.
  - Next production build now reports `ƒ Proxy (Middleware)` without the deprecated `middleware` file warning.
  - Live HTTPS confirmed `x-request-id` and `x-correlation-id` both preserved the supplied request ID.
  - Production security baseline audit now passes 10 checks, including `live_correlation_headers`.
  - Strict production readiness now passes `recent_security_baseline` with `Recent production security baseline audit passed with 10 checks.`
  - Production deploy wrapper passed after restart with `requiredOk=true`, seed-admin login/logout smoke, and anonymous protected-route Playwright smoke.
  - Strict production completion still waits on off-host audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.

## 2026-07-05 Production Security Baseline Audit

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `bash -n scripts/security-baseline-production.sh scripts/load-smoke-production.sh scripts/collect-production-metrics.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/security-baseline-audit.ts scripts/check-production-readiness.ts`
  - Secret scan regex used by CI and the production audit.
  - `pnpm security:audit:production`
  - `tail -n 3 /srv/aialra/logs/babbledeck/security-baseline.jsonl`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `scripts/security-baseline-audit.ts` and `pnpm security:audit:production` for a non-secret MVP security baseline check.
  - Added `AUTH_SECRET=replace-with-random-64-byte-secret` to `.env.example` so required sensitive envs have placeholders.
  - Initial audit correctly failed because the repo secret-like scan matched a historical fake R2 secret assignment and the audit script's own regex literal.
  - Reworked the audit regex to avoid self-matching and rewrote the historical fake R2 command as prose with a redacted secret value.
  - The production security baseline audit then passed all 9 checks: repo secret scan, `.env.example` placeholders, source-level same-origin/rate-limit/hashed-token/audit/E2E/CI controls, live security headers, unauthenticated `/api/auth/me`, `/api/settings`, and `/api/sessions`, cross-origin mutation rejection, and non-secret `/api/health` output.
  - Strict production readiness now passes the required `recent_security_baseline` check with `Recent production security baseline audit passed with 9 checks.`
  - Strict production completion still waits on off-host audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.

## 2026-07-05 Production Viewer Load Smoke

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `bash -n scripts/load-smoke-production.sh scripts/collect-production-metrics.sh scripts/install-production-metrics-monitor.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/load-smoke-production.ts scripts/check-production-readiness.ts`
  - `pnpm load:smoke:production -- --viewers=10`
  - `tail -n 3 /srv/aialra/logs/babbledeck/load-smoke.jsonl`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - Production DB query for latest `Load smoke` session archive status.
- Results:
  - Added `scripts/load-smoke-production.ts` and `pnpm load:smoke:production` for release-gate viewer load smoke on the real production domain.
  - The smoke signs in with the production seed admin, creates a temporary mock-provider session, opens N concurrent viewer SSE streams, injects transcript and translation events through the scoped recorder-token API, verifies every viewer receives the text, stops the session, archives it, and writes a non-secret JSONL marker.
  - The production run with `--viewers=10` passed: all `10` viewers received the transcript, `p95FirstByteMs=228`, `p95ReceivedMs=1262`, and the temporary session was archived.
  - Strict production readiness now passes the required `recent_load_smoke` check with `Recent production load smoke passed with 10 viewers.`
  - Strict production completion still waits on off-host audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.

## 2026-07-05 Production Metrics Snapshot Timer

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `bash -n scripts/collect-production-metrics.sh scripts/install-production-metrics-monitor.sh scripts/monitor-production-health.sh scripts/install-production-health-monitor.sh`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/collect-production-metrics.ts scripts/check-production-readiness.ts`
  - `pnpm metrics:collect:production`
  - `pnpm metrics:install:production`
  - `systemctl status aialra-babbledeck-metrics.timer --no-pager`
  - `tail -n 3 /srv/aialra/logs/babbledeck/metrics.jsonl`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/collect-production-metrics.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `git diff --check`
- Results:
  - Added `scripts/collect-production-metrics.ts` and `pnpm metrics:collect:production` for non-secret JSONL metrics snapshots from production database state.
  - Added `pnpm metrics:install:production`; the installer creates `aialra-babbledeck-metrics.service` and `aialra-babbledeck-metrics.timer` using the existing server systemd pattern.
  - Metrics records include active sessions, recorder and viewer connections, provider errors, first-token latency, audio upload failures, auth failures, estimated provider cost, uploaded audio totals, and export counts.
  - A production collection wrote a JSONL record with `sessions.total=2`, `sessions.active=2`, `connections.recorderActive=1`, `provider.errorsLastWindow=0`, `audio.uploadFailuresLastWindow=0`, and `auth.failuresLastWindow=0`.
  - `aialra-babbledeck-metrics.timer` is active and scheduled every five minutes; the install run immediately appended a second metrics JSONL record.
  - Strict production readiness now passes the required `aialra-babbledeck-metrics.timer` and `recent_metrics_snapshot` checks; strict completion still waits on off-host audio storage.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, production build, and whitespace diff check passed.

## 2026-07-05 Production Backup Verification Timer

- Environment: local workspace and production backup root `/srv/aialra/backups/babbledeck`.
- Commands:
  - `bash -n scripts/verify-latest-backup-production.sh scripts/install-production-backup-verify.sh scripts/verify-backup.sh scripts/restore-backup.sh`
  - `pnpm backup:verify:production`
  - `pnpm backup:verify:install:production`
  - `systemctl status aialra-babbledeck-backup-verify.timer --no-pager`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
- Results:
  - Added `pnpm backup:verify:production` to run latest-backup restore verification with a lock and non-secret JSONL record.
  - Added `pnpm backup:verify:install:production` to install `aialra-babbledeck-backup-verify.service` and `aialra-babbledeck-backup-verify.timer` using the existing server systemd pattern.
  - `scripts/check-production-readiness.ts` now requires the backup verification timer to be active and a recent restore verification marker to exist.
  - Latest backup `/srv/aialra/backups/babbledeck/20260705T011837Z` restored successfully into temporary database `babbledeck_restore_verify_20260705021914_4131192`; the wrapper reported `verifiedAudioFiles=79`.
  - The latest backup now contains `verify-counts.last.json` with restored counts for users, live sessions, audio chunks, provider usage, and transcript events.
  - `aialra-babbledeck-backup-verify.timer` is active and scheduled for the next daily backup verification window.
  - Strict production readiness now passes the required `aialra-babbledeck-backup-verify.timer` and `recent_backup_verification` checks; strict completion still waits on off-host audio storage.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.

## 2026-07-05 Production Log Rotation

- Environment: local workspace and production server log directory `/srv/aialra/logs/babbledeck`.
- Commands:
  - `bash -n scripts/install-production-logrotate.sh scripts/monitor-production-health.sh scripts/install-production-health-monitor.sh`
  - `BABBLEDECK_LOGROTATE_CONFIG="$tmpdir/aialra-babbledeck" BABBLEDECK_LOG_DIR="$tmpdir" pnpm logs:install:production`
  - `logrotate -d "$tmpdir/aialra-babbledeck"`
  - `pnpm logs:install:production`
  - `logrotate -d /etc/logrotate.d/aialra-babbledeck`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
- Results:
  - Added `pnpm logs:install:production` to install `/etc/logrotate.d/aialra-babbledeck`.
  - The config rotates BabbleDeck `.log` and `.jsonl` files with `copytruncate`, compression, and 14 retained rotations by default.
  - `scripts/check-production-readiness.ts` now requires the BabbleDeck logrotate config to be present.
  - A temporary logrotate install and dry-run matched only `.log` and `.jsonl` files, leaving lock files out of rotation.
  - The production logrotate config was installed and debug-validated; it covers service, WebSocket, backup, audio retention, health monitor, deployment JSONL, health JSONL, and Nginx logs under `/srv/aialra/logs/babbledeck`.
  - Strict production readiness now passes the required `logrotate_config` check; strict completion still waits on off-host audio storage.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.

## 2026-07-05 Production Health Monitor Timer

- Environment: local workspace and production deployment at `https://babbledeck.aialra.online`.
- Commands:
  - `bash -n scripts/monitor-production-health.sh scripts/install-production-health-monitor.sh scripts/deploy-production.sh scripts/cutover-audio-storage.sh`
  - `BABBLEDECK_LOG_DIR="$tmpdir" BABBLEDECK_HEALTH_BASE_URL=https://babbledeck.aialra.online pnpm health:monitor:production`
  - `pnpm health:install:production`
  - `systemctl status aialra-babbledeck-health-monitor.timer --no-pager`
  - `tail -n 3 /srv/aialra/logs/babbledeck/health-monitor.jsonl`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm deploy:production`
- Results:
  - Added `scripts/monitor-production-health.sh` for non-secret `/api/health` probes with JSONL status output.
  - Added `pnpm health:monitor:production` and `pnpm health:install:production`; the installer creates `aialra-babbledeck-health-monitor.service` and `aialra-babbledeck-health-monitor.timer` using the existing server systemd pattern.
  - `scripts/check-production-readiness.ts` now requires the health monitor timer to be active.
  - A temporary-log monitor run against the live domain returned `httpStatus=200`, `ok=true`, `databaseOk=true`, `audioStorageOk=true`, `audioStorageDriver=local`, and `sonioxConfigured=true`.
  - The production timer was installed and is active, with the next run scheduled every five minutes.
  - The production JSONL monitor log wrote a non-secret record with `httpStatus=200`, `healthStatus=ok`, `databaseOk=true`, `audioStorageOk=true`, `audioStorageDriver=local`, `offHostAudioReady=false`, and `sonioxConfigured=true`.
  - Strict production readiness now passes the required `aialra-babbledeck-health-monitor.timer` check; strict completion still waits on off-host audio storage.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Production deploy wrapper force-built the standalone app, restarted `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, confirmed readiness `requiredOk=true`, confirmed seed-admin login/logout, and passed the anonymous protected-route Playwright smoke.

## 2026-07-05 Production Health Endpoint

- Environment: local workspace first, then production deployment at `https://babbledeck.aialra.online` after deployment.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/health.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm deploy:production`
  - `curl -fsS https://babbledeck.aialra.online/api/health`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `/api/health` as a non-secret monitoring endpoint.
  - The endpoint reports service name, version, generated timestamp, uptime, database connectivity, audio storage driver/core config health, off-host storage readiness, and Soniox configured status without returning secret values.
  - `scripts/check-production-readiness.ts` now verifies that the live production health endpoint reports core database and audio storage health.
  - Local format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests now cover `15` files and `48` tests, including non-secret health status coverage.
  - Production deploy wrapper force-built the standalone app, restarted `aialra-babbledeck.service` and `aialra-babbledeck-ws.service` at `2026-07-05 03:54:06 CEST`, confirmed readiness `requiredOk=true`, confirmed seed-admin login/logout, and passed the anonymous protected-route Playwright smoke.
  - Live `/api/health` returned `ok=true`, service `babbledeck`, status `ok`, version `0.1.0`, database `ok=true`, audio storage `{ ok: true, driver: "local", offHostReady: false }`, and Soniox configured `true`.
  - Strict production readiness passed all required checks, including `health_endpoint` and live Soniox connectivity with `360ms` accepted probe audio.
  - Strict production completion still waits on off-host R2/S3-compatible audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.

## 2026-07-05 Audio Storage Cutover Guard

- Environment: local workspace, production secret env inspected without printing secrets, production audio driver still local.
- Commands:
  - `bash -n scripts/cutover-audio-storage.sh`
  - `pnpm audio:cutover:production`
  - `BABBLEDECK_ENV_FILE="$tmp_env" BABBLEDECK_AUDIO_CUTOVER_BATCH_SIZE=2 pnpm audio:cutover:production`
  - `SOURCE_AUDIO_STORAGE_DIR=/tmp/babbledeck-source-does-not-exist AUDIO_STORAGE_DRIVER=r2 R2_ACCOUNT_ID=raw-sql-smoke R2_BUCKET=raw-sql-smoke R2_ACCESS_KEY_ID=raw-sql-smoke R2_SECRET_ACCESS_KEY=raw-sql-smoke pnpm tsx scripts/migrate-audio-storage.ts --limit=1`
  - `pnpm tsx scripts/audit-audio-storage.ts --all --limit=2`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live`
- Results:
  - Added `pnpm audio:cutover:production` for guarded R2/S3 cutover.
  - The wrapper defaults to dry-run source validation and requires `BABBLEDECK_AUDIO_CUTOVER_APPLY=1` before migrating objects.
  - The storage audit script now supports `--all`, and the cutover wrapper uses it so target audits page through every uploaded chunk instead of only the first batch.
  - With the current production env, the wrapper refuses to run because `AUDIO_STORAGE_DRIVER=local`.
  - With a temporary fake R2 env file and production DB URL, the wrapper dry-run scanned `2` chunks, read `2` source objects, found no missing objects, size mismatches, or checksum mismatches, and exited without writing any target objects.
  - A non-dry fake R2 smoke with a nonexistent source directory exercised the current-target skip query and returned nonzero on a missing source object before any network write.
  - The production local storage audit with `--all --limit=2` scanned all `21` uploaded chunks, found `21` present objects, and reported no size mismatches.
  - R2/S3 migrations now skip chunks already marked on the current target by default, which makes repeated batch runs continue from remaining unmigrated rows.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Strict production readiness required checks passed, including live Soniox connectivity with `360ms` accepted probe audio; strict completion still waits on off-host audio storage.
  - Production still needs real R2/S3 credentials before the cutover wrapper can perform an apply run.

## 2026-07-05 Production Deploy Wrapper

- Environment: production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`.
- Commands:
  - `bash -n scripts/deploy-production.sh`
  - `BABBLEDECK_DEPLOY_ALLOW_DIRTY=1 pnpm deploy:production`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
- Results:
  - Added `scripts/deploy-production.sh` and `pnpm deploy:production`.
  - The wrapper lock-checks deploys, refuses dirty worktrees unless explicitly overridden, force-builds standalone output, restarts web and recorder WebSocket services, checks HTTPS/homepage/readiness, runs seed-admin login/logout smoke, runs anonymous protected-route Playwright smoke, and writes non-secret deployment records.
  - Initial wrapper smoke exposed a short post-restart `502` window from Nginx before the Next standalone server was ready; the wrapper now waits up to `BABBLEDECK_DEPLOY_HTTP_WAIT_SECONDS` for HTTPS readiness before continuing.
  - Production deployment wrapper smoke passed against the live domain.
  - The passing wrapper run restarted web and recorder WebSocket services at `2026-07-05 03:30:38 CEST`, confirmed readiness `requiredOk=true`, confirmed seed-admin login/logout, and passed the anonymous protected-route Playwright smoke.
  - Strict production completion still waits on real R2/S3 credentials and audio chunk migration.

## 2026-07-05 Production Deploy Smoke for R2 Endpoint Build

- Environment: production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`.
- Commands:
  - `pnpm build --force`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `systemctl is-active aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `curl -fsS https://babbledeck.aialra.online/ | rg -n "BabbleDeck|Live multilingual captions|Open portal"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "anonymous users"`
  - Login API smoke against `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` using the seed admin from the production secret env.
- Results:
  - Forced production build completed and copied standalone static assets.
  - Web and recorder WebSocket services restarted successfully and were active with start timestamp `2026-07-05 03:20:07 CEST`.
  - HTTPS returned `HTTP/2 200` with HSTS, CSP, COOP, frame, nosniff, referrer, and permissions-policy headers.
  - The homepage HTML contained `BabbleDeck`, `Live multilingual captions`, and `Open portal`.
  - Strict readiness required checks passed, including live Soniox connectivity with `360ms` accepted probe audio.
  - Anonymous protected-route Playwright smoke passed against the live domain without creating data.
  - Seed-admin login, `/api/auth/me`, and logout returned `200` and `ok: true`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; production still needs real R2/S3 credentials and audio chunk migration.

## 2026-07-05 R2 Endpoint Derivation

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/audio-storage.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
  - A fake R2 env smoke with `AUDIO_STORAGE_DRIVER=r2`, fake account/bucket/access-key values, and a redacted fake secret key, followed by `pnpm tsx scripts/check-production-readiness.ts --strict`.
- Results:
  - Audio storage now derives `https://ACCOUNT_ID.r2.cloudflarestorage.com` from `R2_ACCOUNT_ID` when no explicit endpoint is set.
  - Strict readiness now accepts `R2_ACCOUNT_ID` as the Cloudflare R2 endpoint source.
  - Documented that `R2_ENDPOINT` is optional when using the standard R2 account endpoint.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests now cover `14` files and `45` tests, including R2 endpoint derivation.
  - The live Soniox readiness probe passed with `360ms` of accepted probe audio.
  - A read-only fake-R2 readiness smoke confirmed `off_host_audio_storage` passes with `R2_ACCOUNT_ID` and no `R2_ENDPOINT`; strict readiness then fails on `off_host_audio_migration`, as expected before real migration metadata exists.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks, including live Soniox connectivity, pass.

## 2026-07-05 Protected Admin Route Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "anonymous users"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict --check-soniox-live`
- Results:
  - Added a desktop-only Playwright scenario that verifies anonymous browser visits to `/dashboard`, `/sessions/new`, and `/settings` redirect to login.
  - The same scenario verifies anonymous calls to `/api/auth/me`, `/api/settings`, `GET /api/sessions`, and `POST /api/sessions` return `UNAUTHENTICATED`.
  - Production Playwright protected-route smoke passed against the live domain.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - The live Soniox readiness probe passed with `360ms` of accepted probe audio.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks, including `SONIOX_API_KEY` and `soniox_realtime_connectivity`, pass.

## 2026-07-05 Viewer Polling Fallback Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "SSE stream is unavailable"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm build`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Added a desktop-only Playwright scenario that opens a public viewer while aborting the SSE stream request, verifies the viewer switches to `Polling`, injects final transcript/translation events through the recorder-token API, and confirms the viewer still receives captions.
  - Production Playwright polling-fallback smoke passed against the live domain.
  - Production Playwright desktop and mobile MVP flows still passed after the new fallback scenario was added.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production smoke cleanup removed 3 temporary Playwright sessions and 7 local audio objects across the fallback and core-flow runs.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Mobile Recorder Viewport Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm format:check`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - The core Playwright flow now opens the recorder page at `390x844` when running under the `chromium-mobile` project while keeping the wider recorder context for desktop.
  - Production Playwright desktop and mobile MVP flows passed; the mobile project now covers recorder backup reconnect/retry, microphone grant, recording, viewer streaming, stop/history, legal hold, transcript correction, and all export downloads from a phone-sized recorder page.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production smoke cleanup removed 2 temporary Playwright sessions and 6 local audio objects.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Provider Error Viewer UI

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/components/ViewerClient.tsx e2e/mvp.spec.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "provider error events"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Viewer pages now show a `Provider issue` banner when a live `provider_error` event arrives.
  - Added a desktop-only Playwright scenario that creates a session, opens the public viewer, injects a recorder-token `provider_error` event through the production API, and verifies the viewer updates over SSE.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production services restarted successfully and returned `HTTP/2 200` with expected security headers.
  - Production Playwright desktop and mobile MVP flows still passed after the viewer UI change.
  - Production smoke cleanup removed 3 temporary Playwright sessions and 6 local audio objects.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Microphone Denied Browser Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "microphone access is blocked"`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts e2e/mvp.spec.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Added a desktop-only Playwright scenario that creates a live session, opens the recorder token URL in a real Chromium context without automatic microphone permission grants, and verifies the `denied` microphone state plus recovery guidance.
  - First production run reached the expected denied state but failed because the assertion matched both the session title and badge text; the selector was tightened to exact badge text and the production rerun passed.
  - Format, lint, app typecheck, full unit tests, script/E2E typecheck, and production build passed.
  - Unit tests remained at `14` files and `44` tests.
  - Production Playwright desktop and mobile MVP flows still passed after the new scenario was added.
  - Production smoke cleanup removed 4 temporary Playwright sessions and 7 local audio objects across the denied-path and core-flow runs.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Multi-Format Export Browser Coverage

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write e2e/mvp.spec.ts apps/web/src/components/SessionHistoryClient.tsx apps/web/src/lib/export.test.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/lib/export.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --grep "admin creates a live session"`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Session history now exposes an `SRT` export button in addition to Markdown, TXT, JSON, and VTT.
  - The core Playwright MVP flow now downloads all five formats and verifies corrected original/translation text in each export.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `14` files and `44` tests, including TXT, JSON, SRT, and VTT export rendering coverage.
  - Production services restarted successfully; an immediate post-restart HTTPS probe briefly returned `502`, then `HTTP/2 200` with expected security headers after startup settled.
  - Production Playwright desktop and mobile MVP flows both passed against the live domain with multi-format export verification.
  - Production smoke cleanup removed 2 temporary Playwright sessions and 6 local audio objects.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.

## 2026-07-05 Recorder Control and Event Rate Limits

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/sensitive-route-rate-limit.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --check-soniox-live`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added configurable `RECORDER_CONTROL_RATE_LIMIT_PER_MINUTE` and `TRANSCRIPT_EVENT_APPEND_RATE_LIMIT_PER_MINUTE`.
  - Recorder start/stop controls are now limited per session/source IP; transcript event append is now limited per session/source IP before JSON body parsing.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `14` files and `41` tests, including recorder control and transcript event append throttling coverage.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Production Soniox live readiness passed after the credential update; the websocket accepted probe audio and reported `360ms` processed.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming recorder start/stop, mock transcript event append, audio backup uploads, and export generation still work.
  - Production smoke cleanup removed 1 temporary Playwright session and 4 local audio objects.

## 2026-07-05 Export and Audio Upload Rate Limits

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/sensitive-route-rate-limit.test.ts src/server/login-rate-limit.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added configurable `EXPORT_RATE_LIMIT_PER_MINUTE` and `AUDIO_CHUNK_UPLOAD_RATE_LIMIT_PER_MINUTE`.
  - Export generation is now limited per user/session; audio chunk upload is now limited per session/source IP before multipart body parsing.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `14` files and `39` tests, including export and audio chunk upload throttling coverage.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming normal audio backup uploads and Markdown export generation still work.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Security Headers Readiness

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/next.config.mjs scripts/check-production-readiness.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/check-production-readiness.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Production responses now include `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, and `Permissions-Policy` in addition to existing CSP, referrer, frame, and nosniff headers.
  - Strict readiness now includes a required `security_headers` check; production passed it.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `13` files and `37` tests.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200` with the expected security headers.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks, including `security_headers`, pass.
  - Production Playwright desktop MVP passed after restart.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Same-Origin Mutation Guard

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/same-origin.test.ts src/server/recorder-access.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - Logged in to production with the seed admin through the JSON login API using the server secret env, then attempted a cross-site `Origin: https://attacker.example` POST to `/api/sessions`.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Cookie-authenticated admin mutation endpoints now enforce same-origin Origin/Fetch Metadata checks.
  - Recorder-token routes still permit no-cookie recorder links while protecting the admin-cookie path.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `13` files and `37` tests, including same-origin guard and recorder access coverage.
  - Production CSRF probe returned login `200` and cross-site mutation `403 FORBIDDEN` with `Cross-site mutation blocked.`
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming same-origin UI writes and no-cookie recorder-token writes still work.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects; CSRF probe auth sessions were logged out afterward.

## 2026-07-05 Login Rate Limit Hardening

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm --filter @babbledeck/web test -- --run src/server/client-ip.test.ts src/server/login-rate-limit.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - Sent six failed JSON login attempts to production `/api/auth/login` with a synthetic email.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Login throttling now applies both per-IP and per-IP/email windows; `.env.example` documents `LOGIN_IP_RATE_LIMIT_PER_MINUTE`.
  - Client IP parsing now prefers Nginx-managed `X-Real-IP` and falls back to the proxy-appended `X-Forwarded-For` address for rate limits and audit logs.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `12` files and `33` tests, including same-account login throttling, changing-email IP throttling, and trusted proxy IP parsing coverage.
  - Production login probe returned `401` for the first five failed attempts and `429 RATE_LIMITED` on the sixth attempt.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart, confirming normal admin login was not affected.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Soniox Live Readiness Probe

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/server/soniox-realtime.ts apps/web/src/server/soniox-realtime.test.ts scripts/check-production-readiness.ts README.md docs/10_SECURITY_AND_OPERATIONS.md docs/operations/BACKUP_RESTORE.md`
  - `pnpm --filter @babbledeck/web test -- --run src/server/soniox-realtime.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm db:generate`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --check-soniox-live`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Added `--check-soniox-live`, which sends a short generated WAV silence probe through the Soniox realtime websocket and reports success without printing `SONIOX_API_KEY`.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `10` files and `27` tests, including Soniox readiness probe audio coverage and missing-key behavior.
  - Production live Soniox readiness passed: the websocket accepted probe audio and reported `360ms` processed.
  - Production services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed after restart.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 Transcript Segment Corrections

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3110`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/server/schemas.ts apps/web/src/server/session-service.ts apps/web/src/app/api/sessions/[id]/segments/[segmentId]/route.ts apps/web/src/server/serializers.ts apps/web/src/components/SessionHistoryClient.tsx e2e/mvp.spec.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm db:migrate`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm tsx scripts/sync-seed-admin.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev E2E_BASE_URL=http://127.0.0.1:3110 E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Format, lint, app typecheck, script typecheck, and full unit tests passed.
  - Unit tests passed with `10` files and `25` tests, including audited transcript segment update coverage.
  - Local and production Playwright desktop MVP passed while editing the first transcript segment from session history, verifying corrected original and translated text in the UI, and confirming Markdown export content uses the corrections.
  - Production build passed; production web and recorder WS services restarted successfully and remained active.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness confirms all required checks pass, including `SONIOX_API_KEY`; strict completion still waits on off-host R2/S3-compatible audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.
  - Production smoke cleanup removed 1 temporary Playwright session and 3 local audio objects.

## 2026-07-05 CI Workflow Hardening

- Environment: local workspace inspecting `.github/workflows`.
- Commands:
  - `pnpm format:check`
  - `git diff --check`
  - Repository secret-pattern scan with `rg`.
- Results:
  - CI workflow now runs `pnpm format:check`, `pnpm db:validate`, Prisma generate/migrate/seed, lint, app typecheck, unit tests, script typecheck, build, and a repository secret scan.
  - E2E workflow now seeds and logs in with a non-production fallback CI password when `SEED_ADMIN_PASSWORD` is not configured, preventing silent full-flow skips on PRs without secrets.
  - Workflow formatting and whitespace checks passed; secret scan returned no matches.

## 2026-07-05 Soniox Segment Alignment Hardening

- Environment: local workspace, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm prettier --write apps/web/src/server/soniox-realtime.ts apps/web/src/server/soniox-realtime.test.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/server/soniox-realtime.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - Downloaded the public `LDC93S1.wav` sample to `/tmp/babbledeck-soniox-smoke.wav` for Chromium fake microphone input.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" E2E_RUN_SONIOX_UI_TEST=true E2E_FAKE_AUDIO_FILE=/tmp/babbledeck-soniox-smoke.wav E2E_SONIOX_EXPECTED_TEXT='dark|soup|greasy|wash|洗漱|深色' pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "soniox provider streams"`
- Results:
  - Format, lint, app typecheck, script typecheck, and full unit tests passed.
  - Unit tests passed with `9` files and `24` tests.
  - Soniox mapping tests now cover delayed translations arriving after the next original segment has started, plus multiple final original segments queued before their translations arrive.
  - Production build passed; production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Real Soniox UI smoke passed with fake microphone speech against production after matching the current public sample transcript text.
  - Production smoke cleanup removed 1 temporary Soniox session and 6 local audio objects.

## 2026-07-05 Recorder Backup Retry Controls

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3108`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm db:migrate`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev pnpm tsx scripts/sync-seed-admin.ts`
  - `DATABASE_URL=postgresql://babbledeck:babbledeck@localhost:55432/babbledeck_dev E2E_BASE_URL=http://127.0.0.1:3108 E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Format, lint, app typecheck, script typecheck, and full unit tests passed.
  - Unit tests passed with `9` files and `22` tests, including local backup summary coverage.
  - Local Playwright desktop MVP passed while seeding a failed IndexedDB backup chunk, reconnecting backup transport, retrying the pending chunk, uploading it to the server, then completing recording, viewer streaming, legal hold, and export.
  - Production build passed; production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; all required checks pass.
  - Production Playwright desktop MVP passed with the same failed IndexedDB backup retry path.
  - Production smoke cleanup removed 1 temporary Playwright session and 4 local audio objects.

## 2026-07-05 Retention Settings and Legal Hold

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3107`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm db:validate`
  - `pnpm db:generate`
  - `pnpm db:migrate` against local dev DB
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `E2E_BASE_URL=http://127.0.0.1:3107 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm db:migrate` against production DB
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
  - `pnpm tsx scripts/prune-audio-retention.ts --dry-run --batch-size=10`
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - Downloaded the public `LDC93S1.wav` sample to `/tmp/babbledeck-soniox-smoke.wav` for Chromium fake microphone input.
  - `E2E_BASE_URL=https://babbledeck.aialra.online E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" E2E_RUN_SONIOX_UI_TEST=true E2E_FAKE_AUDIO_FILE=/tmp/babbledeck-soniox-smoke.wav E2E_SONIOX_EXPECTED_TEXT='dark|suit|wash' pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "soniox provider streams"`
- Results:
  - Migration `20260705001500_app_settings` applied successfully to local and production Postgres.
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `8` files and `21` tests.
  - Local and production Playwright desktop MVP passed while saving raw audio retention in Settings, enabling session raw audio legal hold, recording from a no-cookie recorder link, streaming captions to the viewer, and exporting from history.
  - Production retention dry-run used the configured `30` day setting and matched `0` chunks.
  - Production app settings contain only non-secret `audio.retentionDays`.
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Strict production readiness confirms all required checks pass, including `SONIOX_API_KEY`; strict completion still waits on off-host R2/S3-compatible audio storage because production currently has `AUDIO_STORAGE_DRIVER=local`.
  - Production smoke cleanup removed 1 temporary Playwright session and 2 local audio objects.
  - Real Soniox UI smoke passed with fake microphone speech against production, then cleanup removed 1 temporary Soniox session and 6 local audio objects.

## 2026-07-05 Audio Storage Cutover Audit Tooling

- Environment: production secret env loaded without printing secrets, current production storage target still local through `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - Checked R2/S3/Cloudflare credential presence as booleans only.
  - `pnpm prettier --write apps/web/src/server/audio-storage.ts apps/web/src/server/audio-storage.test.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts`
  - `pnpm format:check`
  - `pnpm typecheck`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/audit-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/server/audio-storage.test.ts`
  - `pnpm tsx scripts/audit-audio-storage.ts --limit=500`
  - `pnpm tsx scripts/audit-audio-storage.ts --limit=500 --require-current-target`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Server secret env currently has no R2/S3-compatible bucket, endpoint, access key, or secret key variables configured.
  - Format, app typecheck, script typecheck, and targeted audio storage tests passed.
  - Audio storage audit scanned 21 uploaded chunks; all 21 objects were present with no missing objects and no size mismatches.
  - Current-target audit also passed for the current local target.
  - Strict production readiness still fails only because `AUDIO_STORAGE_DRIVER=local`; when R2/S3 env is configured, strict readiness now also checks that all uploaded chunks are marked on the current off-host target.

## 2026-07-04 Recorder Token No-Cookie Access

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3106`, production deployment at `https://babbledeck.aialra.online`, production secret env loaded without printing secrets.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck scripts/recorder-ws-server.ts scripts/prune-audio-retention.ts scripts/migrate-audio-storage.ts scripts/check-production-readiness.ts scripts/sync-seed-admin.ts playwright.config.ts`
  - `E2E_BASE_URL=http://127.0.0.1:3106 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Format, lint, app typecheck, script typecheck, full unit tests, and production build passed.
  - Unit tests passed with `7` files and `18` tests, including recorder token header/query parsing coverage.
  - Local and production Playwright desktop MVP passed while opening the generated recorder URL in a fresh no-cookie browser context, hiding admin-only History controls there, recording through recorder-token HTTP and WebSocket auth, streaming captions to the viewer, stopping, then exporting from the admin history page.
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Production readiness returned `requiredOk=true`; strict completion remains blocked only by local audio storage until R2/S3-compatible credentials are configured.
  - Production smoke cleanup removed 1 temporary Playwright session and 2 local audio objects.

## 2026-07-04 Recorder Viewer Link Restore

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3105`, and production secret env loaded without printing secrets for admin password sync.
- Commands:
  - `pnpm prettier --write apps/web/src/features/recorder/session-tokens.ts apps/web/src/features/recorder/session-tokens.test.ts apps/web/src/components/NewSessionForm.tsx apps/web/src/components/RecorderClient.tsx e2e/mvp.spec.ts`
  - `pnpm --filter @babbledeck/web test -- --run src/features/recorder/session-tokens.test.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm db:migrate`
  - `pnpm tsx scripts/sync-seed-admin.ts`
  - `E2E_BASE_URL=http://127.0.0.1:3105 pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -I -sS https://babbledeck.aialra.online/`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `E2E_BASE_URL=https://babbledeck.aialra.online pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
- Results:
  - Unit tests passed with `6` files and `15` tests.
  - Format, lint, TypeScript typecheck, full unit tests, and production build passed.
  - Playwright desktop MVP passed and verified that opening a recorder from the history page, without the original `share` query parameter, restores the same viewer link from same-browser token cache.
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - Production HTTPS returned `HTTP/2 200`.
  - Production readiness returned `requiredOk=true`; strict completion remains blocked only by local audio storage until R2/S3-compatible credentials are configured.
  - Production Playwright desktop MVP passed against `https://babbledeck.aialra.online`.
  - Production smoke cleanup removed 1 temporary Playwright session and 2 local audio objects.

## 2026-07-04 Soniox Realtime Staging Check

- Environment: production secret env file loaded locally without printing secrets; Soniox realtime WebSocket endpoint `wss://stt-rt.soniox.com/transcribe-websocket`.
- Commands:
  - Checked `SONIOX_API_KEY` presence without echoing the value.
  - Generated a short valid 16 kHz PCM WAV silence sample with `ffmpeg` and confirmed Soniox accepted audio frames without provider errors.
  - Downloaded the public `brooklyn_bridge.flac` speech sample, streamed it to Soniox in 3840-byte frames with 120 ms pacing, and ended the stream with an empty WebSocket frame.
  - Created a temporary production smoke session, streamed the public speech sample through `SonioxRealtimeBridge`, verified database transcript/translation writes, and cleaned up the temporary session/user.
- Results:
  - Soniox WebSocket opened successfully with the configured production API key.
  - Real speech sample returned original transcript tokens and translation tokens.
  - App adapter smoke wrote transcript events, translation events, transcript segment rows, and translation rows with no provider error.
  - The stream returned a `finished` response with no provider error.
  - This uncovered and fixed an app bridge issue where BabbleDeck closed the Soniox socket immediately after sending the end-of-audio frame instead of waiting for the provider's final responses.
  - This also uncovered and fixed a transcript `sequenceNo` race by serializing Soniox message handling before database writes.

## 2026-07-04 Production Soniox and Migration Deploy Smoke

- Environment: `https://babbledeck.aialra.online`, systemd services `aialra-babbledeck.service` and `aialra-babbledeck-ws.service`, production Postgres database `babbledeck_prod`, local production audio root `/srv/aialra/storage/babbledeck`, configured `SONIOX_API_KEY`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test`
  - Script typecheck for `scripts/recorder-ws-server.ts`, `scripts/prune-audio-retention.ts`, `scripts/migrate-audio-storage.ts`, and `playwright.config.ts`.
  - `pnpm build`
  - `pnpm tsx scripts/migrate-audio-storage.ts --dry-run --limit=20`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with a temporary smoke admin and `E2E_RUN_BUDGET_TEST=true`.
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production services restarted successfully and remained active with `NRestarts=0`.
  - HTTPS returned `HTTP/2 200` with expected security headers.
  - Production audio migration dry-run scanned 20 uploaded chunks, read 20 source objects, and found no missing files, size mismatches, or checksum mismatches.
  - Production Playwright passed 4/4 tests, including WebSocket backup and low-budget Soniox-mode degraded-provider coverage.
  - Smoke cleanup removed 4 temporary sessions and 13 local audio objects.

## 2026-07-04 Production Standalone and Soniox UI Smoke

- Environment: `https://babbledeck.aialra.online`, standalone Next server under `aialra-babbledeck.service`, recorder WebSocket sidecar under `aialra-babbledeck-ws.service`, production Postgres database `babbledeck_prod`, configured `SONIOX_API_KEY`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web test`
  - Script typecheck for `scripts/recorder-ws-server.ts`, `scripts/prune-audio-retention.ts`, `scripts/migrate-audio-storage.ts`, and `playwright.config.ts`.
  - `pnpm lint`
  - `pnpm build`
  - `scripts/prepare-standalone-assets.sh`
  - `systemctl restart aialra-babbledeck.service aialra-babbledeck-ws.service`
  - HTTPS smoke for `/` and a static `_next/static` CSS chunk.
  - Minimal Playwright login probe with fake microphone audio.
  - `pnpm e2e` with a temporary smoke admin, `E2E_RUN_BUDGET_TEST=true`, `E2E_RUN_SONIOX_UI_TEST=true`, and a fake microphone WAV converted from the public `brooklyn_bridge.flac` sample.
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Standalone server returned `HTTP/2 200` for the app and static assets with correct CSS MIME type after `.next/static` was copied into the standalone tree.
  - Minimal Playwright login probe reached `/dashboard` with no browser console errors.
  - Production Playwright passed 5/6 tests with 1 intentional mobile skip for the desktop-only real Soniox UI smoke.
  - The Soniox UI smoke created a real Soniox session, used Chromium fake microphone speech, observed expected `Brooklyn` transcript text in the recorder UI and viewer, and confirmed backup chunks.
  - Smoke cleanup removed 5 temporary sessions and 15 local audio objects.

## 2026-07-04 Production Readiness and Seed Admin Audit

- Environment: `https://babbledeck.aialra.online`, production secret env file loaded without printing secrets, production Postgres database `babbledeck_prod`.
- Commands:
  - HTTPS login API probe for `SEED_ADMIN_EMAIL` with `SEED_ADMIN_PASSWORD`.
  - Seed admin password hash check using `verifyPassword` without printing the password.
  - Password hash reset to match `SEED_ADMIN_PASSWORD`, followed by HTTPS login API verification.
  - `pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --types node --skipLibCheck ... scripts/check-production-readiness.ts`
  - `pnpm tsx scripts/check-production-readiness.ts`
  - `pnpm tsx scripts/check-production-readiness.ts --strict`
- Results:
  - Initial audit found the seed admin existed and was enabled but its password hash did not match `SEED_ADMIN_PASSWORD`.
  - The seed admin was reset to match `SEED_ADMIN_PASSWORD`, old auth sessions were revoked, and HTTPS login returned `200` with an auth cookie.
  - Readiness audit returned `requiredOk=true`.
  - Strict readiness returned exit code `1` only because R2/S3-compatible off-host audio storage is not configured yet.

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

## 2026-07-04 Binary Audio Object Storage

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3101`, and `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e` with `E2E_BASE_URL=http://127.0.0.1:3101`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Added unit coverage for local audio object writes.
  - Playwright MVP flow passed on desktop and mobile with assertions for uploaded backup chunk counts.
  - Local post-run verification found `10` audio object files under the configured temporary storage root.
- Screenshots/traces:
  - Final run passed without failure screenshots; temporary Playwright artifacts and local test audio files were removed after the successful run.

## 2026-07-04 Production Binary Audio Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed without Turbopack NFT warnings.
  - Service restarted successfully and remained active with `NRestarts=0`.
  - HTTPS landing smoke returned `HTTP/2 200`.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin that was deleted after the run.
  - Production post-run verification found `5` audio chunk records and `5` matching audio object files before cleanup removed the temporary smoke session objects.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Password Rotation Enforcement

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3102`, and `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e` with `E2E_BASE_URL=http://127.0.0.1:3102`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Seeded admin still starts with `passwordRotationRequired=true`.
  - Playwright desktop flow verified forced password rotation before dashboard access, then completed session creation, recorder, viewer, audio backup, history, and export.
  - Playwright mobile flow logged in with the rotated test password and completed the same MVP flow.
  - Local post-run verification found `8` audio object files under the configured temporary storage root.
- Screenshots/traces:
  - Final run passed without failure screenshots; temporary Playwright artifacts and local test audio files were removed after the successful run.

## 2026-07-04 Production Password Rotation Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed and exposed `/account/password` plus `/api/auth/password`.
  - Service restarted successfully and remained active with `NRestarts=0`.
  - HTTPS landing smoke returned `HTTP/2 200` after the service finished starting.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin created with `passwordRotationRequired=true`.
  - Post-run verification confirmed the temporary smoke admin had `passwordRotationRequired=false` after the browser flow.
  - Production post-run verification found `5` audio chunk records and `5` matching audio object files before cleanup removed the temporary smoke session objects.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Provider Usage Tracking

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3104`, and `AUDIO_STORAGE_DRIVER=local`.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e` with `E2E_BASE_URL=http://127.0.0.1:3104`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, and production build passed.
  - Added unit coverage for provider audio-hour cost estimation.
  - Playwright MVP flow passed on desktop and mobile with assertions for visible non-zero `Audio processed` in session detail.
  - Local post-run verification found `10` audio object files, `10` provider usage rows, and `10000` provider audio milliseconds.
- Screenshots/traces:
  - Final run passed without failure screenshots; temporary Playwright artifacts and local test audio files were removed after the successful run.

## 2026-07-04 Production Provider Usage Smoke

- Environment: `https://babbledeck.aialra.online`, systemd service `aialra-babbledeck.service`, Nginx TLS reverse proxy, production Postgres database `babbledeck_prod`, and local production audio root `/srv/aialra/storage/babbledeck`.
- Commands:
  - `pnpm build`
  - `systemctl restart aialra-babbledeck.service`
  - `curl -fsSI https://babbledeck.aialra.online/`
  - `pnpm e2e` with `E2E_BASE_URL=https://babbledeck.aialra.online`, `E2E_ADMIN_PASSWORD`, and `E2E_NEW_ADMIN_PASSWORD`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Production build passed after adding provider usage serialization and admin display.
  - Service restarted successfully and remained active with `NRestarts=0`.
  - HTTPS landing smoke returned `HTTP/2 200`.
  - Production Playwright MVP flow passed on desktop and mobile using a temporary smoke admin created with `passwordRotationRequired=true`.
  - Production post-run verification found `5` audio chunk records, `5` matching audio object files, `5` provider usage rows, and `5000` provider audio milliseconds before cleanup removed the temporary smoke session objects.
- Screenshots/traces:
  - Production run passed without failure screenshots; temporary Playwright artifacts were removed after the successful run.

## 2026-07-04 Production Backup and Restore

- Environment: production server with `babbledeck_prod`, local audio root `/srv/aialra/storage/babbledeck`, backup root `/srv/aialra/backups/babbledeck`, and Postgres tools from Docker container `2026-07-04-babbledeck-postgres-1`.
- Commands:
  - `scripts/backup-production.sh`
  - `scripts/verify-backup.sh /srv/aialra/backups/babbledeck/20260704T191342Z`
  - `systemctl enable --now aialra-babbledeck-backup.timer`
  - `systemctl start aialra-babbledeck-backup.service`
  - `scripts/verify-backup.sh latest`
  - Production restore refusal check with `TARGET_DATABASE_URL=$DATABASE_URL scripts/restore-backup.sh ...`
- Results:
  - Manual backup created `/srv/aialra/backups/babbledeck/20260704T191342Z`.
  - Systemd service backup created `/srv/aialra/backups/babbledeck/20260704T191624Z`.
  - Latest backup verified by restoring into temporary database `babbledeck_restore_verify_20260704191625_2734377` and a temporary audio directory.
  - Production restore safety check passed: restore script refused to target the production `DATABASE_URL` without explicit `ALLOW_PRODUCTION_RESTORE=I_UNDERSTAND`.
  - `aialra-babbledeck-backup.timer` is active and scheduled daily.
- Artifacts:
  - Backup directories include `db.dump`, `db-counts.json`, `audio.tar.gz`, checksum files, `manifest.json`, and the latest verification counts.

## 2026-07-05 Admin Settings Management

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev servers on `127.0.0.1:3120` and `127.0.0.1:3122`, and secrets loaded from the server env file without printing values.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - Script TypeScript check for recorder, storage, LiveKit, readiness, metrics, Soniox, security, wrapper, seed-admin, and Playwright config scripts.
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-mobile --grep "admin creates a live session"`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, script typecheck, and production build passed.
  - Desktop and mobile Playwright MVP flows passed with coverage for persisted default session settings, glossary create/update/delete, read-only audit log visibility, session create, recorder flow, viewer captions, and exports.
  - Production deploy passed for commit `f84f818` through `pnpm db:generate && pnpm deploy:production`; required readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke passed.
  - Production desktop and mobile Playwright MVP flows passed against `https://babbledeck.aialra.online`.
  - Production LiveKit preflight passed. The first LiveKit UI smoke attempt hit `Room audio: Unavailable`, then an immediate rerun passed and wrote a fresh passing readiness marker.
  - Production Soniox recorder WebSocket smoke and Soniox UI smoke passed with real configured credentials.
  - Strict production readiness with live Soniox passed every required check and still failed only the external `off_host_audio_storage` check because production uses local audio storage.
  - Production health reported `audioDriver=local`, `offHostReady=false`, `soniox=true`, and `livekit=true`; web, recorder WebSocket, and LiveKit services were active with `NRestarts=0`.
  - Production cleanup found no remaining `Playwright glossary` terms and archived `20` recent smoke sessions with test-title prefixes, leaving no recent unarchived smoke sessions.
- Screenshots/traces:
  - Local runs passed without failure screenshots.
  - Production reruns passed without final failure screenshots; the transient LiveKit failure screenshot remains in local Playwright artifacts for diagnosis.

## 2026-07-05 Viewer Caption Controls

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev servers on `127.0.0.1:3124` and `127.0.0.1:3126`, and secrets loaded from the server env file without printing values.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - Script TypeScript check for recorder, storage, LiveKit, readiness, metrics, Soniox, security, wrapper, seed-admin, and Playwright config scripts.
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-mobile --grep "admin creates a live session"`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, script typecheck, and production build passed.
  - Desktop and mobile Playwright MVP flows passed with coverage for viewer translation-only, bilingual, and original-only caption modes, copy-visible-transcript clipboard behavior, caption size toggle, light/dark theme toggle, session create, recorder flow, viewer captions, history corrections, and exports.
  - Production deploy passed for commit `78e1aad` through `pnpm db:generate && pnpm deploy:production`; required readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke passed.
  - Production desktop and mobile Playwright MVP flows passed against `https://babbledeck.aialra.online` with the same viewer control assertions.
  - Strict production readiness with live Soniox passed every required check and still failed only the external `off_host_audio_storage` check because production uses local audio storage.
  - Production health reported `audioDriver=local`, `offHostReady=false`, `soniox=true`, and `livekit=true`; web, recorder WebSocket, and LiveKit services were active with `NRestarts=0`.
  - Production cleanup archived `2` recent Playwright smoke sessions and found no remaining `Playwright glossary` terms.
- Screenshots/traces:
  - Local runs passed without failure screenshots.
  - Production runs passed without failure screenshots.

## 2026-07-05 Recorder Input Health

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev servers on `127.0.0.1:3130`, `127.0.0.1:3132`, and `127.0.0.1:3136`, and secrets loaded from the server env file without printing values.
- Commands:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - Script TypeScript check for recorder, storage, LiveKit, readiness, metrics, Soniox, security, wrapper, seed-admin, and Playwright config scripts.
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "microphone input health"`
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "admin creates a live session"`
  - `pnpm e2e e2e/mvp.spec.ts --project=chromium-mobile --grep "admin creates a live session"`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
  - Playwright Chromium mobile, Pixel 7 profile.
- Results:
  - Static checks, unit tests, script typecheck, and production build passed.
  - The dedicated desktop Playwright input-health test passed with controlled Web Audio streams for silent microphone input and high-gain clipping input.
  - Desktop and mobile Playwright MVP flows passed, confirming the new input-health indicators do not disrupt normal recorder start/stop, backup upload, viewer captions, history corrections, and exports.
  - Production deploy passed for commit `45fbf91` through `pnpm db:generate && pnpm deploy:production`; required readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke passed.
  - Production desktop Playwright input-health test passed against `https://babbledeck.aialra.online`.
  - Production desktop and mobile Playwright MVP flows passed after scoping the retention-settings `Saved.` assertion to its form.
  - Strict production readiness with live Soniox passed every required check and still failed only the external `off_host_audio_storage` check because production uses local audio storage.
  - Production health reported `audioDriver=local`, `offHostReady=false`, `soniox=true`, and `livekit=true`; web, recorder WebSocket, and LiveKit services were active with `NRestarts=0`.
  - Production cleanup archived `3` recent Playwright smoke sessions and found no remaining `Playwright glossary` terms.
- Screenshots/traces:
  - Local rerun passed without failure screenshots after narrowing the clipping assertion to the exact badge text.
  - Production reruns passed without final failure screenshots; the initial mobile run exposed an ambiguous `Saved.` locator and the follow-up passed after the locator was scoped to the retention form.

## 2026-07-05 Transcript Track Timelines

- Environment: local workspace with Docker Postgres on `localhost:55432`, production `https://babbledeck.aialra.online`, production Postgres database `babbledeck_prod`, and secrets loaded from the server env file without printing values.
- Commands:
  - `pnpm db:validate`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm --filter @babbledeck/web test -- src/lib/export.test.ts`
  - `pnpm prettier --check` for the changed TS/TSX files.
  - `pnpm --filter @babbledeck/web build`
  - Local `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "multi-track transcript events"` with `E2E_BASE_URL=http://127.0.0.1:3150`.
  - `scripts/backup-production.sh`
  - Production `pnpm db:migrate`
  - `pnpm deploy:production`
  - Production `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "multi-track transcript events"`
  - `pnpm soniox:smoke:production`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live`
- Browser/device:
  - Playwright Chromium desktop, `1440x960`.
- Results:
  - Added `trackId` and `speakerLabel` persistence for transcript events and final segments, with a per-track unique segment index so independent provider/LiveKit tracks can each emit `segmentIndex=0`.
  - API validation, transcript writer upserts, session serialization, viewer labels, history labels, and JSON/Markdown export metadata now preserve track identity.
  - Local validation passed: Prisma schema valid, TypeScript, ESLint, Prettier check, production build, Vitest `20` files and `78` tests, and the dedicated multi-track Playwright flow.
  - Production backup created `/srv/aialra/backups/babbledeck/20260705T211600Z` before the DB migration.
  - Production migration `20260705210500_transcript_tracks` applied successfully to `babbledeck_prod`.
  - Production deploy passed for commit `f855f30` through `pnpm deploy:production`; required readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke passed.
  - Production multi-track Playwright passed against `https://babbledeck.aialra.online`, verifying independent Speaker A/B timelines, viewer label display, history display, and JSON export `trackId`/`speakerLabel`.
  - Production Soniox smoke passed with `360ms` probe audio, `1` audio chunk, `0` provider errors, and archived cleanup of the smoke session.
  - Production readiness reports `requiredOk=true`; Soniox API key, LiveKit credentials, direct Soniox realtime websocket probe, recent Soniox smoke, recent Soniox UI smoke, recent Soniox trace, and recent LiveKit UI smoke are all passing.
  - `externalOk=false` and `productionReady=false` only because `off_host_audio_storage` still reports `AUDIO_STORAGE_DRIVER=local`; R2/S3 cutover remains the outstanding infrastructure blocker.
  - `aialra-babbledeck.service`, `aialra-babbledeck-ws.service`, and `aialra-babbledeck-livekit.service` are active with `NRestarts=0`.
- Screenshots/traces:
  - Local and production multi-track runs passed without final failure screenshots after strict-mode text assertions were narrowed.

## 2026-07-05 Soniox Track Metadata Propagation

- Environment: production `https://babbledeck.aialra.online`, production Postgres database `babbledeck_prod`, production recorder WebSocket service `aialra-babbledeck-ws.service`, and secrets loaded from the server env file without printing values.
- Commands:
  - `pnpm --filter @babbledeck/web test -- src/server/soniox-realtime.test.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm prettier --check` for the changed TS files.
  - CI-style script typecheck for recorder, storage, LiveKit, readiness, metrics, Soniox, security, wrapper, seed-admin, and Playwright config scripts.
  - `pnpm --filter @babbledeck/web build`
  - `pnpm deploy:production`
  - Generated a short WAV with `ffmpeg`/`flite`, then ran `pnpm soniox:smoke:production -- --audio-file=... --probe-ms=5597 --track-id=soniox-smoke-alpha --speaker-label="Soniox Smoke Alpha" --min-track-events=1 --min-track-segments=1`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live`
- Results:
  - Soniox response mapping now preserves optional `trackId` and `speakerLabel` on original and translation transcript events.
  - Recorder WebSocket connections now accept validated `trackId` and `speakerLabel` URL parameters, record them in `recorder_connections.clientInfo`, and pass them into the Soniox realtime bridge.
  - The production Soniox smoke script can now send an explicit audio file, attach track metadata to the recorder WebSocket URL, and assert minimum persisted track events/segments.
  - Local validation passed: Soniox unit coverage, app typecheck, ESLint, changed-file Prettier, script typecheck, and production build.
  - Production deploy passed for commit `4a5cc6d`; required readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke passed.
  - Production tracked Soniox smoke passed with `5597ms` provider usage, `1` audio chunk, `0` provider errors, archived cleanup, recorder connection metadata `trackId=soniox-smoke-alpha`, `28` matching transcript events, and `3` matching transcript segments.
  - Production readiness reports `requiredOk=true`; recent Soniox recorder smoke now reflects `5597ms` provider usage, Soniox live websocket probe passes, LiveKit remains configured, and all systemd services are active with `NRestarts=0`.
  - `externalOk=false` and `productionReady=false` still only because `off_host_audio_storage` reports local audio storage.
- Screenshots/traces:
  - This slice used direct production recorder WebSocket smoke and database assertions; no browser failure screenshots were produced.

## 2026-07-05 Recorder Track URLs

- Environment: local workspace with Docker Postgres on `localhost:55432`, Playwright dev server on `127.0.0.1:3160`, production `https://babbledeck.aialra.online`, and secrets loaded from the server env file without printing values.
- Commands:
  - `pnpm prettier --check apps/web/src/server/transcript-writer.ts apps/web/src/components/RecorderClient.tsx apps/web/src/app/sessions/[id]/record/page.tsx e2e/mvp.spec.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm --filter @babbledeck/web build`
  - Local `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "recorder track URLs"` with `E2E_BASE_URL=http://127.0.0.1:3160`.
  - `pnpm deploy:production`
  - Production `pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "recorder track URLs"`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live`
- Browser/device:
  - Playwright Chromium desktop, `1040x840` recorder contexts plus the default desktop admin page.
- Results:
  - Recorder pages now accept validated `trackId` and `speakerLabel` query parameters and surface the active recorder label in the page header.
  - The recorder aside now provides copy/open controls for Main recorder, Speaker A, and Speaker B no-cookie recorder URLs while preserving the session share token and recorder token.
  - Mock recorder events and LiveKit publisher metadata now carry the active recorder track identity, so parallel recorder pages can write independent timelines.
  - Local E2E initially exposed a real race in `appendTranscriptEvents`: concurrent recorder requests could compute the same next `sequenceNo` and hit the `transcript_events(sessionId, sequenceNo)` unique constraint.
  - The writer now wraps transcript append work in a PostgreSQL transaction and takes a per-session advisory transaction lock before reading the latest sequence number, serializing concurrent appends for the same live session.
  - Local validation passed: changed-file Prettier, app typecheck, ESLint, production build, and the dedicated recorder-track Playwright flow.
  - Production deploy passed for commit `0430ce3`; required readiness, seed-admin login smoke, and anonymous protected-route Playwright smoke passed.
  - Production recorder-track Playwright passed against `https://babbledeck.aialra.online`, verifying Speaker A and Speaker B recorder URLs can record simultaneously and export JSON with independent `speaker-a`/`speaker-b` segment `index=0` entries.
  - Production readiness reports `requiredOk=true`; Soniox key configuration, direct Soniox realtime websocket probe, recent Soniox smoke/UI smoke/trace evidence, LiveKit credentials, HTTPS, health, backups, metrics, security baseline, and systemd service checks are passing.
  - `externalOk=false` and `productionReady=false` still only because `off_host_audio_storage` reports `AUDIO_STORAGE_DRIVER=local`; R2/S3 cutover remains the outstanding infrastructure blocker.
  - `aialra-babbledeck.service` and `aialra-babbledeck-ws.service` are active with `NRestarts=0`.
- Screenshots/traces:
  - The passing local and production recorder-track runs produced no final failure screenshots. The interrupted local retry before the `$executeRaw` fix left a diagnostic Playwright artifact only.

## 2026-07-05 Audio Cutover Readiness Report

- Environment: production `https://babbledeck.aialra.online`, production secret env loaded without printing secrets, production audio source directory `/srv/aialra/storage/babbledeck`, and production Postgres database `babbledeck_prod`.
- Commands:
  - Server secret variable-name scan for `CLOUDFLARE`, `CF_`, `WRANGLER`, `R2_`, `S3_`, `AWS_`, and `AUDIO_STORAGE_*` target variables.
  - `pnpm audio:readiness:production`
  - `pnpm audio:readiness:production -- --strict` (expected exit `1` while the off-host target is not configured)
  - `bash -n scripts/check-audio-cutover-readiness-production.sh`
  - `pnpm prettier --check scripts/check-audio-cutover-readiness.ts package.json .github/workflows/ci.yml README.md docs/operations/BACKUP_RESTORE.md`
  - CI-style script typecheck including `scripts/check-audio-cutover-readiness.ts`.
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --check-soniox-live`
- Results:
  - Added `pnpm audio:readiness:production`, a non-secret production cutover report that loads the production env, checks accepted R2/S3 variable groups, counts source audio files, counts uploaded audio chunks, and reports how many uploaded chunks are marked on the current off-host target.
  - The current production report shows `cutoverReady=false`, source directory exists with `507` files, database has `381` uploaded chunks totaling `5637981` bytes, and `381` chunks are not marked on a current off-host target.
  - The report confirms the remaining target gaps are `AUDIO_STORAGE_DRIVER=r2|s3`, bucket, access key, and secret key variable groups. No Cloudflare/R2/S3/AWS credentials were found in inspected server secret files, and `wrangler` is not authenticated.
  - Strict mode returns nonzero while those requirements are missing, so the command can be used as a release/cutover gate.
  - README and backup/restore operations docs now start the guarded cutover flow with `pnpm audio:readiness:production`.
  - Local validation passed: changed-file Prettier, shell syntax check, script typecheck, app typecheck, and ESLint.
  - Production readiness still reports `requiredOk=true`; Soniox live websocket probe, LiveKit, HTTPS, health, backup, metrics, security, and systemd checks pass.
  - `externalOk=false` and `productionReady=false` still only because `off_host_audio_storage` reports `AUDIO_STORAGE_DRIVER=local`.
  - `aialra-babbledeck.service`, `aialra-babbledeck-ws.service`, and `aialra-babbledeck-livekit.service` are active with `NRestarts=0`.
- Screenshots/traces:
  - This slice was production operations tooling only; no browser screenshots were produced.

## 2026-07-06 Device Runtime Readiness

- Environment: production `https://babbledeck.aialra.online`, Linux server workspace, Android SDK/ADB installed, Capacitor Android/iOS projects committed, Tauri desktop package installed, and no device serials or secrets printed.
- Commands:
  - `pnpm device:readiness:production`
  - `pnpm device:readiness:production -- --strict` (expected exit `1` until physical/runtime prerequisites are present)
  - `pnpm --filter @babbledeck/mobile native:build:android`
  - `pnpm --filter @babbledeck/desktop native:build`
  - `pnpm wrappers:check`
  - `pnpm prettier --check scripts/check-device-runtime-readiness.ts package.json .github/workflows/ci.yml README.md`
  - CI-style script typecheck including `scripts/check-device-runtime-readiness.ts`
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm build`
- Results:
  - Added `pnpm device:readiness:production`, a non-secret runtime readiness report for native wrapper follow-up against the deployed production PWA.
  - The command checks production reachability, ADB availability, connected physical Android devices without printing serials, Android debug artifact presence, macOS/Xcode/iOS project prerequisites, Tauri CLI presence, desktop release artifact presence, and whether an interactive desktop display session is available.
  - The current production URL check passes with HTTP `200`.
  - Android build passed through `native:build:android`; the current readiness blocker is no physical Android device in `adb device` state.
  - Desktop `native:build` passed and produced the Linux release binary; the current readiness blocker is no interactive desktop display session for a real wrapper microphone check.
  - iOS remains blocked on this Linux host because `xcodebuild` is unavailable and a macOS/iOS runtime is required.
  - Strict mode returns nonzero while Android, iOS, and desktop runtime prerequisites are missing, so this command can gate the remaining physical-device validation work.
  - Local validation passed: changed-file Prettier, script typecheck, wrapper config check, app typecheck, ESLint, and full workspace build.
- Screenshots/traces:
  - This slice was native/runtime operations tooling only; no browser screenshots were produced.

## 2026-07-06 Device Runtime Evidence Gate

- Environment: production `https://babbledeck.aialra.online`, production secret env loaded without printing secrets, production readiness script, temporary JSONL evidence logs for positive-path testing, and production device runtime evidence log intentionally absent until real manual runs happen.
- Commands:
  - `pnpm exec tsx scripts/record-device-runtime-evidence.ts --platform=android --passed --production-url-opened --microphone-granted --recording-started --captions-visible --audio-backup-confirmed`
  - `BABBLEDECK_DEVICE_RUNTIME_LOG=$(mktemp) pnpm device:evidence:production -- --platform=desktop --passed --production-url-opened --microphone-granted --recording-started --captions-visible --audio-backup-confirmed`
  - Temporary three-platform JSONL positive-path readiness check using direct evidence records for `android`, `ios`, and `desktop`, with `BABBLEDECK_DEVICE_RUNTIME_LOG` pointed at the temporary file.
  - `pnpm prettier --check scripts/check-production-readiness.ts scripts/record-device-runtime-evidence.ts package.json .github/workflows/ci.yml README.md`
  - `bash -n scripts/record-device-runtime-evidence-production.sh`
  - CI-style script typecheck including `scripts/record-device-runtime-evidence.ts`.
  - `pnpm --filter @babbledeck/web typecheck`
  - `pnpm --filter @babbledeck/web lint`
  - `pnpm build`
  - `pnpm tsx scripts/check-production-readiness.ts --base-url=https://babbledeck.aialra.online --strict --check-soniox-live` (expected exit `1` while external storage and device runtime evidence remain incomplete)
- Results:
  - Added `pnpm device:evidence:production` for recording non-secret manual Android, iOS, or desktop wrapper runtime evidence after a real device/session run.
  - Evidence records require `--passed` plus production URL opened, microphone granted, recording started, captions visible, and audio backup confirmed flags.
  - The production wrapper writes JSONL to `/srv/aialra/logs/babbledeck/device-runtime.jsonl` by default under a lock; temp-log validation confirmed one JSONL record is appended without touching production evidence.
  - Production readiness now includes external check `recent_device_runtime_evidence`, requiring fresh passing evidence for Android, iOS, and desktop wrappers against the production URL.
  - Current production readiness reports `requiredOk=true`, `externalOk=false`, and `productionReady=false`; `recent_device_runtime_evidence` fails with missing Android/iOS/desktop evidence, and `off_host_audio_storage` still fails because production uses local storage.
  - Strict readiness exits nonzero until both off-host storage and device runtime evidence are complete.
  - Local validation passed: changed-file Prettier, shell syntax check, script typecheck, app typecheck, ESLint, and full workspace build.
- Screenshots/traces:
  - This slice was production operations tooling only; no browser screenshots were produced.
