# Known Issues

- Production audio storage currently uses a local object directory; configure R2/S3 credentials and run `pnpm audio:cutover:production` for off-host raw audio durability.
- The Tauri desktop wrapper scaffold is configured, but this server lacks `webkit2gtk-4.1` and `rsvg2`; run `pnpm --filter @babbledeck/desktop native:dev` on a desktop host with Tauri prerequisites installed before treating the desktop wrapper as fully runtime-verified.
