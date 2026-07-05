# BabbleDeck Desktop Wrapper

This package is a Tauri 2 scaffold for the live BabbleDeck PWA. It loads
`https://babbledeck.aialra.online` through `devUrl` and `frontendDist`, keeping
desktop wrapper testing pointed at the deployed service.

Useful commands:

```bash
pnpm --filter @babbledeck/desktop check
pnpm --filter @babbledeck/desktop native:info
pnpm --filter @babbledeck/desktop native:dev
```

The wrapper does not expose `window.__TAURI__` to the remote page and does not
grant remote capabilities by default.
