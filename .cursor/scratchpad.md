# Relay Email Agent - Context (Concise)

Purpose
- AI-powered email client for Gmail (Outlook planned) with smart summaries, labels, drafts, and semantic search.

Architecture
- Next.js App Router frontend + API routes (`app/api/*`) for basic operations.
- Express server (`server/index.ts`, port 3001) for advanced AI features (embeddings, semantic search, thread summarization).
- Storage: client-side localStorage for app data; Supabase (pgvector) for embeddings.

Key flows
- OAuth: `app/api/auth/gmail/*` -> tokens stored in localStorage.
- Email sync: `app/api/emails` -> parse in `lib/gmail.ts` -> store via `lib/storage.ts`.
- AI enrichment: Next.js routes for summaries/labels/drafts; Express routes for search/summarize/draft/classify.

AI endpoints (Express)
- POST `/api/ai/index` (index email embeddings)
- POST `/api/ai/search` (semantic search)
- POST `/api/ai/summarize` (thread summary)
- POST `/api/ai/draft` (context-aware draft)
- POST `/api/ai/classify` (email category)

Key files
- `lib/gmail.ts` email parsing and Gmail API wrapper
- `lib/storage.ts` localStorage abstraction
- `lib/api.ts` client for Express AI endpoints
- `server/services/ai.ts` embeddings + LLM features
- `server/services/vector_store.ts` Supabase pgvector operations

Commands
- `pnpm dev` (Next.js + Express)
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:ci`

Quality tooling
- ESLint 9 flat config in `eslint.config.mjs`.
- Uses Next.js core-web-vitals and TypeScript recommended configurations.
- Legacy compatibility overrides currently disable:
  - `@typescript-eslint/no-explicit-any`
  - `react-hooks/immutability`
  - `react-hooks/purity`
  - `react-hooks/set-state-in-effect`
  - `react/no-unescaped-entities`
- Lint exits successfully but reports 56 existing warnings, primarily unused
  variables/imports and React hook dependency advisories.
- Jest 29 config is in `jest.config.mjs` and uses the Node environment.
- Unit tests are in `lib/email-utils.test.ts`.
- GitHub Actions workflow is in `.github/workflows/ci.yml`.
- CI installs with pnpm, then runs lint, tests, and the production build.

Dependency notes
- Replaced `isomorphic-dompurify` with browser-native `dompurify`.
- Removed `jest-environment-jsdom`.
- The project dependency tree no longer contains `jsdom`.
- `email-utils` is currently consumed only by the client component
  `components/thread-view.tsx`.

Latest verification
- `pnpm lint`: passes with 56 warnings.
- `pnpm test:ci`: passes, 11 tests.
- `pnpm build`: passes.
- Build still warns about multiple lockfiles because a separate
  `C:\Users\dhruv\pnpm-lock.yaml` is detected outside this repository.
- `next@16.0.0` is reported by pnpm as vulnerable and should be upgraded in a
  separate compatibility-focused change.

Env vars (core)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`, `SESSION_SECRET`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)

Known limitations
- No token refresh
- Manual email sync
