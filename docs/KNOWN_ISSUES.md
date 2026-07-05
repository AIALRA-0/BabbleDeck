# Known Issues

- Production audio storage currently uses a local object directory; configure R2/S3 credentials and run `pnpm audio:cutover:production` for off-host raw audio durability.
- `pnpm device:readiness:production` currently reports no connected physical Android device, no macOS/Xcode host for iOS, and no interactive desktop display session; production readiness also lacks `pnpm device:evidence:production` JSONL evidence for Android, iOS, and desktop runs.
- The Capacitor Android wrapper builds on the server and the iOS wrapper project is scaffolded with Swift Package Manager metadata, but Android still needs a physical device run and iOS still needs a macOS/iOS build-and-run check.
- The Tauri desktop wrapper passes Linux toolchain checks, native release build, and headless startup smoke on this server, but camera/microphone behavior still needs a physical desktop session before treating the desktop wrapper as fully runtime-verified.
