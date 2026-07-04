# Known Issues

- Soniox realtime audio streaming is not implemented yet.
- Audio upload currently stores server metadata only; R2/S3 object upload is still pending.
- Viewer live updates use SSE with polling fallback; WebSocket recorder transport is still pending.
- Reopened recorder pages cannot recover the one-time plaintext share token because only token hashes are stored.
- Password rotation after first login is tracked but not enforced in the UI yet.
