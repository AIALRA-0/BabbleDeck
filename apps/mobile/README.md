# BabbleDeck Mobile Wrapper

This package is a Capacitor scaffold for the live BabbleDeck PWA. By default it
loads `https://babbledeck.aialra.online` so mobile wrapper testing follows the
actual deployed site instead of a purely local build.

Useful commands:

```bash
pnpm --filter @babbledeck/mobile check
pnpm --filter @babbledeck/mobile native:sync
pnpm --filter @babbledeck/mobile native:check:android
pnpm --filter @babbledeck/mobile native:build:android
pnpm --filter @babbledeck/mobile native:run:android
pnpm --filter @babbledeck/mobile native:run:ios
```

Set `BABBLEDECK_MOBILE_SERVER_URL` when testing against another HTTPS
environment.

The Android project is committed in `android/`. `native:sync` runs Capacitor
sync and then normalizes the generated pnpm module path for the Android Gradle
build. The Android check/build commands default to `/usr/lib/android-sdk` when
`ANDROID_HOME` is not set.
