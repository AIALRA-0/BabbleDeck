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

# Cloudflare R2 / S3-compatible storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=babbledeck-dev
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=

# Realtime
REALTIME_TRANSPORT=websocket
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Cost controls
DEFAULT_SESSION_BUDGET_CAP_USD=1.50
HARD_MAX_AUDIO_HOUR_COST_USD=3.00

# Security/rate limit
RATE_LIMIT_REDIS_URL=
LOGIN_RATE_LIMIT_PER_MINUTE=5
SESSION_CREATE_RATE_LIMIT_PER_MINUTE=10

# Testing
MOCK_PROVIDER_ENABLED=true
E2E_BASE_URL=http://localhost:3000
```

## Secret handling rules

- Do not commit real values.
- Do not print `SEED_ADMIN_PASSWORD`.
- Do not expose provider keys in client bundle.
- Store production secrets in deployment platform secret manager.
- Rotate bootstrap admin password after first login.
