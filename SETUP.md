# Relay Email Setup

## Prerequisites

- Node.js 20 or newer
- pnpm
- A Google Cloud project with the Gmail API enabled
- A Supabase project

## Install

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and provide the required values.

## Google OAuth

Create a Web application OAuth client in Google Cloud and configure:

- Authorized origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/auth/gmail/callback`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env.local`.

## Supabase

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOKEN_ENCRYPTION_KEY`

Apply the SQL in `supabase/schema.sql`, followed by the migrations in `supabase/migrations`.

## Relay AI

Set `OPENAI_API_KEY` to enable contextual summaries, task extraction, reply drafts, questions, and inbox briefs. The key is used only by server-side API routes. `OPENAI_MODEL` is optional and defaults to `gpt-5.4-mini`.

Apply `supabase/migrations/20260613_ai_account_preferences.sql` so each connected account can store isolated AI enablement, writing-style, signature, and drafting instructions.

## Run

```bash
pnpm dev
```

Open `http://localhost:3000`, create or sign in to an account, then connect Gmail from Settings.

## Verification

```bash
pnpm lint
pnpm test:ci
pnpm build
```
