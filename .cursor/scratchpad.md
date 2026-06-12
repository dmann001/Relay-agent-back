# Relay Email Agent - Context (Concise)

Purpose
- AI-powered email client for Gmail (Outlook planned) with smart summaries, labels, drafts, and semantic search.

Architecture
- Next.js App Router frontend + API routes (`app/api/*`) for Gmail sync, email CRUD, and basic AI.
- Express server (`server/index.ts`, port 3001) for advanced AI features (embeddings, semantic search, thread summarization).
- **Email metadata cache:** Supabase `public.emails` stores display metadata only (sender, subject, snippet, labels, flags). Full bodies are fetched live from Gmail when an email is opened.
- **OAuth tokens:** stored server-side in `public.email_accounts`, encrypted at rest (AES-256-GCM). Tokens never reach the browser.
- **Client storage:** `lib/storage.ts` mirrors metadata-only emails for legacy AI features (Relayed Hub, agent actions). Bodies are stripped on persist.
- **API routing:** `next.config.mjs` must NOT blanket-proxy `/api/*` to Express. Email/auth/draft routes live in Next.js (`app/api`). Only legacy Express AI routes are proxied (`/api/ai/summarize`, `/draft`, `/search`, `/classify`, `/index`, `/api/status/*`). `lib/api.ts` still calls Express directly via `NEXT_PUBLIC_API_URL`.

Gmail sync flow (8-step spec)
1. **Connect** — OAuth via `app/api/auth/gmail/*`; callback saves encrypted tokens + account row; encrypted `state` binds callback to Supabase user.
2. **Initial sync** — latest 50 inbox + 50 sent + drafts from Gmail; metadata upserted to DB; `email_sync_state.initial_sync_done` set; history baseline stored.
3. **Display** — inbox/sent/archives lists read cached metadata from DB (`GET /api/emails`); fast first paint; **zero Gmail quota**.
4. **Open email** — full body fetched live from Gmail (`GET /api/emails/[id]` via Next.js, not Express); cached flags refreshed from Gmail labels.
5. **Keep updated** — incremental sync via Gmail History API (~2 quota units when nothing changed); list-based fallback when history expires; background refresh every **5 min** while inbox tab is visible; server skips Gmail if synced < 3 min ago unless `force: true`.
6. **Archive** — `POST /api/emails/[id]/modify` removes INBOX label in Gmail, then updates DB cache.
7. **Delete** — moves to Gmail Trash (not permanent delete); trash synced only when user opens Trash.
8. **Drafts** — autosaved to Gmail Drafts; DB stores `gmail_draft_id` + snippet preview only.

Key flows
- OAuth: `app/api/auth/gmail` → Google consent → `app/api/auth/gmail/callback` → redirect to `/inbox?gmail_auth=success`.
- List emails: `emailApi.listEmails(mailbox)` → `GET /api/emails?mailbox=...` (DB cache).
- Sync: `emailApi.sync(mailbox?, { force? })` → `POST /api/emails/sync` → `lib/server/email-sync.ts`.
- Open email: `emailApi.getEmail(id)` → `GET /api/emails/[id]` (live Gmail body).
- Mutations: `emailApi.modifyEmail(id, action)` → `POST /api/emails/[id]/modify`.
- Frontend auth: `lib/email-api.ts` attaches Supabase session JWT to all API requests.

API routes (email — all Next.js, not Express)
- `GET /api/accounts` — list connected Gmail accounts (no tokens).
- `DELETE /api/accounts` — disconnect account.
- `GET /api/emails` — cached metadata list (inbox, sent, archive, trash).
- `POST /api/emails/sync` — trigger Gmail → DB sync (`{ mailbox?, force? }`).
- `GET /api/emails/[id]` — full email body from Gmail.
- `POST /api/emails/[id]/modify` — archive, trash, mark read/unread, star.
- `POST /api/emails/send` — send via Gmail; cache sent metadata.
- `POST /api/emails/attachment` — fetch attachment from Gmail.
- `GET /api/emails/counts` — sidebar mailbox counts from DB.
- `GET|POST|DELETE /api/drafts` — Gmail-backed drafts.

Server libs (new)
- `lib/server/crypto.ts` — token encryption, OAuth state.
- `lib/server/supabase-admin.ts` — service-role client, `requireUser()`.
- `lib/server/gmail-accounts.ts` — account CRUD, token refresh, sync state.
- `lib/server/gmail-api.ts` — Gmail API wrapper (metadata, full message, history, drafts); attachment detection from metadata payload parts (no extra `has:attachment` query).
- `lib/server/email-sync.ts` — sync orchestration, row mapping, 42P10 upsert fallback, 3-min background sync throttle.
- `lib/server/api-utils.ts` — centralized API error handling.

Frontend (refactored for new data flow)
- `components/inbox-list.tsx` — DB list + background sync; category filter defaults to **all categories** (not Primary-only); manual sync passes `force: true`.
- `components/thread-view.tsx` — live body fetch on open; falls back to `snippet` if body empty.
- `components/sent-list.tsx`, `archives-list.tsx`, `trash-list.tsx`, `drafts-list.tsx`.
- `components/compose-dialog.tsx` — debounced Gmail draft autosave.
- `components/settings-content.tsx` — server-backed connect/disconnect.
- `components/app-sidebar.tsx` — counts from `/api/emails/counts` (DB only).
- `app/trash/page.tsx` — Trash mailbox.

AI endpoints (Express, unchanged)
- POST `/api/ai/index`, `/api/ai/search`, `/api/ai/summarize`, `/api/ai/draft`, `/api/ai/classify`

Key files
- `lib/email-api.ts` — frontend client for all email API routes.
- `lib/gmail.ts` — legacy client-side Gmail helpers (still used for full-message parsing via `parseGmailMessage`).
- `lib/storage.ts` — localStorage; metadata-only email mirror.
- `lib/api.ts` — client for Express AI endpoints.
- `next.config.mjs` — narrow API rewrites only (see Architecture).
- `server/services/ai.ts`, `server/services/vector_store.ts` — embeddings + pgvector.

Database setup (required)
Run both migrations in the Supabase SQL editor (in order):
1. `supabase/migrations/20260611_gmail_metadata_sync.sql` — metadata columns on `emails`, draft fields, sync state.
2. `supabase/migrations/20260611_fix_sync_constraints.sql` — fixes Postgres `42P10` upsert errors:
   - ensures unique index on `emails(account_id, provider_message_id)`.
   - replaces partial drafts index with full unique index on `drafts(account_id, gmail_draft_id)`.

Env vars (core)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`, `SESSION_SECRET` (fallback for `TOKEN_ENCRYPTION_KEY`)
- `TOKEN_ENCRYPTION_KEY` — encrypts Gmail OAuth tokens at rest (**required**)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side DB access (**required** for sync)
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)

Commands
- `pnpm dev` (Next.js + Express) — **restart required** after `next.config.mjs` changes.
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:ci`

Quality tooling
- ESLint 9 flat config in `eslint.config.mjs`.
- Jest 29 in `jest.config.mjs`; unit tests in `lib/email-utils.test.ts`.
- CI: `.github/workflows/ci.yml` — lint, test, build.

Gmail API quota (practical notes)
- Quota is in **units**, not raw request count. Per-user limit ~15k units/min; daily project limit is huge.
- `history.list` ≈ 2 units (incremental sync, no changes). `messages.get` ≈ 5 units. `messages.list` ≈ 5 units.
- Steady state after initial sync: ~12 incremental syncs/hour × 2 units ≈ 24 units/hour (negligible).
- Initial connect: ~100 metadata fetches ≈ 500 units (one-time).
- Opening an email: 1 `messages.get` (full) ≈ 5 units per open.
- List/count endpoints (`GET /api/emails`, `/counts`) hit Supabase only — no Gmail cost.

Known issues / fixes
- **Fixed (2026-06-11):** Sync loop + empty inbox after clicking email. Root cause: Postgres `42P10` — upsert `ON CONFLICT` had no matching unique index. Fix: run `20260611_fix_sync_constraints.sql`; code also has 42P10 upsert fallback in `email-sync.ts`; drafts sync failure is non-fatal during initial sync.
- **Fixed (2026-06-11):** Thread view used filtered Gmail labels for cache refresh; `fetchFullMessage` now returns raw `labelIds`.
- **Fixed (2026-06-11):** Inbox appeared empty despite sync working. Root cause: category filter defaulted to **Primary only**; synced top-50 had 0 `primary` (mostly promotions/updates). Fix: inbox filter defaults to all categories enabled.
- **Fixed (2026-06-11):** Email body missing on open (subject/sender only). Root cause: `next.config.mjs` blanket `/api/:path*` rewrite proxied `GET /api/emails/[id]` to Express (port 3001), which has no such route → `ECONNREFUSED`. Fix: narrow rewrites to legacy Express AI routes only; `thread-view.tsx` falls back to snippet.
- **Fixed (2026-06-11):** Gmail quota waste. Removed extra `has:attachment` list queries (detect from metadata parts); server 3-min sync throttle; client polling 3→5 min, visible-tab only; manual sync uses `force: true`.

Known limitations
- Outlook not implemented.
- AI features still read mirrored metadata from `lib/storage.ts` (not DB directly).
- Trash synced on demand only (by design).
- `next@16.0.0` reported vulnerable; upgrade separately.
- Multiple lockfiles warning during build (`C:\Users\dhruv\pnpm-lock.yaml` outside repo).

Latest verification (2026-06-11 session)
- DB: 56 inbox emails cached for test account; `initial_sync_done: true`; upsert constraint OK.
- `pnpm build`: passes with new email API routes.
- Gmail connect → initial sync → inbox list → open email → archive/trash: working after constraint migration applied.
- After `next.config.mjs` fix + dev restart: full email body loads on thread open.
