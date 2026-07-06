# `.env.example` template for BabbleDeck

Create `.env.local` from this template for local development. Never commit `.env.local`.

```bash
# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_ORIGIN=http://localhost:3000

# Auth
AUTH_SECRET=replace-with-long-random-secret
SEED_ADMIN_EMAIL=admin@example.invalid
SEED_ADMIN_PASSWORD=replace-with-secure-password-from-operator-never-commit

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/babbledeck

# Redis optional
REDIS_URL=

# Audio object storage (self-hosted server default)
AUDIO_STORAGE_DRIVER=local
AUDIO_STORAGE_DIR=./storage/babbledeck
AUDIO_STORAGE_BUCKET=
AUDIO_STORAGE_ENDPOINT=
AUDIO_STORAGE_REGION=
AUDIO_STORAGE_ACCESS_KEY_ID=
AUDIO_STORAGE_SECRET_ACCESS_KEY=
AUDIO_STORAGE_FORCE_PATH_STYLE=

# Soniox default provider
SONIOX_API_KEY=replace-with-soniox-key
SONIOX_DEFAULT_TARGET_LANGUAGE=zh
SONIOX_DEFAULT_SOURCE_MODE=auto

# Azure Translator optional final-segment enhancement
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_REGION=
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com

# OpenAI optional fallback/retranslate/summarize
OPENAI_API_KEY=

# LiveKit V2 multi-audio mode
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_TOKEN_TTL_SECONDS=900
LIVEKIT_TOKEN_RATE_LIMIT_PER_MINUTE=60

# Optional Cloudflare R2 / S3-compatible migration target
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
R2_PUBLIC_BASE_URL=

# Realtime
REALTIME_TRANSPORT=websocket
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Cost controls
DEFAULT_SESSION_BUDGET_CAP_USD=1.50
HARD_MAX_AUDIO_HOUR_COST_USD=3.00
PROVIDER_COST_MOCK_AUDIO_HOUR_USD=0
PROVIDER_COST_SONIOX_REALTIME_AUDIO_HOUR_USD=0.35

# Security/rate limit
RATE_LIMIT_REDIS_URL=
LOGIN_RATE_LIMIT_PER_MINUTE=5
SESSION_CREATE_RATE_LIMIT_PER_MINUTE=10

# Testing
MOCK_PROVIDER_ENABLED=true
E2E_BASE_URL=http://localhost:3000
E2E_NEW_ADMIN_PASSWORD=replace-with-new-test-password-when-rotation-is-required
E2E_RUN_SONIOX_UI_TEST=false
E2E_FAKE_AUDIO_FILE=
E2E_SONIOX_EXPECTED_TEXT=Brooklyn
BABBLEDECK_SONIOX_UI_SMOKE_EXPECTED_TEXT=Brooklyn
```

## Secret handling rules

- Do not commit real values.
- Do not print `SEED_ADMIN_PASSWORD`.
- Do not expose provider keys in client bundle.
- Store production secrets in deployment platform secret manager.
- Rotate bootstrap admin password after first login.
