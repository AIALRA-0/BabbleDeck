# BabbleDeck Coding Standards / Tech Stack

## 1. Core stack

Frontend:

```text
Next.js App Router
React
TypeScript strict
Tailwind CSS
shadcn/ui
```

Mobile/desktop:

```text
Capacitor for iOS/Android wrappers
Tauri for desktop wrappers
```

Backend:

```text
TypeScript backend preferred
NestJS or clean Node service for realtime backend
Next.js for web app
```

Data:

```text
PostgreSQL
Prisma or Drizzle
Redis optional
Cloudflare R2/S3-compatible object storage
```

Realtime:

```text
V1 WebSocket/SSE
V2 LiveKit
```

AI providers:

```text
Soniox realtime default
Azure Translator optional final enhancement
OpenAI optional fallback/retranslation/summary
Mock provider for tests
```

Testing:

```text
Vitest/Jest
Playwright
GitHub Actions
```

## 2. Repository structure

Recommended monorepo:

```text
apps/
  web/                     Next.js PWA
  realtime/                realtime backend if separate
  desktop/                 Tauri wrapper later
  mobile/                  Capacitor wrapper later
packages/
  ui/                      shared UI components if needed
  config/                  shared eslint/tsconfig/tailwind config
  schemas/                 Zod schemas and shared types
  providers/               provider adapter interfaces and implementations
  db/                      database schema/migrations/client
  audio/                   audio utilities
  testing/                 test utilities/mock provider
 docs/
```

If Codex chooses single-app structure for MVP, it must keep boundaries clear:

```text
src/app
src/components
src/features
src/lib
src/server
src/providers
src/db
src/tests
```

## 3. TypeScript rules

- `strict: true`.
- Avoid `any`. If unavoidable, isolate and explain.
- Use discriminated unions for realtime events.
- Use Zod for runtime validation.
- Export shared schemas from one package/module.
- Keep provider payload types separate from canonical BabbleDeck event types.

## 4. Naming conventions

Files:

- React components: `PascalCase.tsx`.
- Hooks: `useSomething.ts`.
- Utilities: `kebab-case.ts` or `camelCase.ts`, choose one and stay consistent.
- Tests: `*.test.ts`, `*.spec.ts`, E2E `*.e2e.ts`.

Database:

- SQL tables snake_case.
- TypeScript models camelCase.

Branches:

```text
feat/session-create
feat/realtime-provider
fix/auth-rate-limit
test/mobile-recorder-flow
docs/update-prd
```

Commits:

```text
feat: add live session creation
fix: handle recorder reconnect state
test: add viewer realtime e2e coverage
docs: document provider adapter contract
```

## 5. Component standards

- Prefer shadcn/ui primitives.
- Do not create custom primitive components if shadcn/radix already solves it.
- Keep components accessible.
- Split smart/container components from presentational pieces when complexity grows.
- Keep recorder/viewer UI mobile-first.

## 6. State management

Use local state for simple components. Use Zustand only for client session UI state that crosses components. Use TanStack Query or server actions for server state if appropriate.

Avoid global state for everything.

Recommended stores:

```text
recorderStore: mic status, volume, backup queue summary, connection state
viewerStore: display preferences, live connection state
```

Canonical session/transcript data should come from server APIs/realtime events, not only client store.

## 7. Realtime event handling

Rules:

- Every event has `type`, `sessionId`, `sequenceNo` where appropriate.
- Ignore duplicate sequence numbers.
- Keep partial text separate from final segment list.
- Never overwrite final text with partial text.
- Persist final segments.
- Keep raw provider events in payload only server-side.

## 8. Provider adapter standards

All providers must:

- Implement the common interface.
- Normalize their events to canonical events.
- Never leak provider API key to client.
- Report usage.
- Handle stop/close gracefully.
- Expose deterministic mock behavior for tests.

Provider-specific code must stay isolated.

## 9. Audio standards

- User must explicitly grant microphone permission.
- Show audio level before start.
- Backup local chunks while streaming.
- Chunk duration target 10–30 seconds for backup.
- Avoid memory growth: release old blob URLs and buffers.
- Use feature detection for browser APIs.
- Provide fallback messages for unsupported browsers.

## 10. Security coding standards

- Never commit `.env.local`.
- Never hard-code passwords or provider keys.
- Never log raw passwords/tokens/API keys.
- Hash share/recorder tokens in DB.
- Validate all REST and WebSocket payloads.
- Rate limit auth and token endpoints.
- Escape user text in UI.
- Use secure cookies in production.
- Add CSP/security headers.
- Use least privilege for object storage credentials.

## 11. Error handling standards

User-facing errors must be plain and actionable.

Internal errors must include:

```text
code
message
correlationId
sessionId if available
provider if relevant
timestamp
```

Do not expose stack traces to users.

## 12. Testing standards

No feature done without tests.

Minimum per feature:

- Unit test for logic.
- Integration/API test if server behavior changed.
- Playwright real-page test if UI/flow changed.
- Mobile viewport if user-facing.

For realtime features, mock provider tests are mandatory.

## 13. Documentation standards

When behavior changes, update:

- README setup if needed.
- API spec if endpoint changed.
- DB design if schema changed.
- Test plan if new test class added.
- CHANGELOG/progress log.

## 14. CI requirements

GitHub Actions should run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

If E2E is too slow for every commit, run smoke E2E on PR and full E2E on main/nightly. But core MVP flows must be tested before release.

## 15. Dependency policy

Prefer mature maintained libraries.

Before adding a dependency, check:

- Maintained recently.
- License acceptable.
- Security history acceptable.
- Bundle impact reasonable.
- Avoid overlapping dependencies.

Do not build custom replacements for:

- UI primitives.
- QR code generation.
- Date formatting.
- Schema validation.
- Password hashing.
- WebSocket framework.
- Object storage client.

## 16. MCP / skills policy for agents

Codex should use available MCP servers and tools when useful:

- Browser automation / Playwright MCP for UI testing.
- GitHub MCP for repo/issues/PRs when available.
- Cloudflare MCP for domain/deploy/R2 when available.
- Database MCP for schema inspection when available.
- Figma/design MCP if provided later.
- Official documentation via web/MCP for library details.

Do not guess current API behavior when official docs are available.
