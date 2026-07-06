# Known Issues

- Production audio storage intentionally uses the self-hosted server object directory at `/srv/aialra/storage/babbledeck`; R2/S3 cutover remains optional migration tooling, not a launch blocker.
- `pnpm device:readiness:production` currently reports a built Android debug APK but no connected physical Android device, no macOS/Xcode host for iOS, and no interactive desktop display session; generate the release-bound checklist with `pnpm device:evidence:checklist:production`, then record `pnpm device:evidence:production` JSONL evidence after Android, iOS, and desktop runs.
- The Capacitor Android wrapper builds on the server and the iOS wrapper project syncs with Swift Package Manager metadata, but Android still needs a physical device run and iOS still needs a macOS/iOS build-and-run check.
- The Tauri desktop wrapper passes Linux toolchain checks, native release build, and headless startup smoke on this server, but camera/microphone behavior still needs a physical desktop session before treating the desktop wrapper as fully runtime-verified.
