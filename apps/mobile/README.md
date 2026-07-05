# BabbleDeck Mobile Wrapper

This package is a Capacitor scaffold for the live BabbleDeck PWA. By default it
loads `https://babbledeck.aialra.online` so mobile wrapper testing follows the
actual deployed site instead of a purely local build.

Useful commands:

```bash
pnpm --filter @babbledeck/mobile check
pnpm --filter @babbledeck/mobile native:sync
pnpm --filter @babbledeck/mobile native:run:android
pnpm --filter @babbledeck/mobile native:run:ios
```

Set `BABBLEDECK_MOBILE_SERVER_URL` when testing against another HTTPS
environment.
