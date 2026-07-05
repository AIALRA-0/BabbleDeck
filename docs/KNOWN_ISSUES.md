# Known Issues

- Production audio storage currently uses a local object directory; configure R2/S3 credentials and run `pnpm audio:cutover:production` for off-host raw audio durability.
- The Capacitor Android wrapper now builds a debug APK on the server and the iOS wrapper project is scaffolded with Swift Package Manager metadata, but Android still needs a physical device run and iOS still needs a macOS/iOS build-and-run check.
- The Tauri desktop wrapper now passes Linux toolchain checks, native release build, and headless startup smoke on this server, but camera/microphone behavior still needs a physical desktop session before treating the desktop wrapper as fully runtime-verified.
