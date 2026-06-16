# Relay Email Setup

## Prerequisites

- Node.js 20 or newer
- pnpm
- A Google Cloud project with the Gmail API enabled and/or a Microsoft Entra app registration
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

## Microsoft Outlook OAuth

Register a Web application in Microsoft Entra ID that supports organizational
and personal Microsoft accounts. Add this redirect URI:

- `http://localhost:3000/api/auth/outlook/callback`

Grant delegated `User.Read`, `Mail.ReadWrite`, and `Mail.Send` permissions, then set:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_REDIRECT_URI`
- `MICROSOFT_TENANT_ID` (optional; defaults to `common`)

Use `MICROSOFT_TENANT_ID=common` when Relay must support both Microsoft 365
and personal Outlook.com accounts. Use `consumers` only for personal Microsoft
accounts. A tenant GUID can sign an external Outlook.com address in as a guest
(`...#EXT#@...onmicrosoft.com`), but that guest identity does not provide the
user's Outlook mailbox.

For `MICROSOFT_CLIENT_SECRET`, copy the secret **Value** shown when the client
secret is created. Do not use the **Secret ID**. Entra only displays the Value
once; if it is no longer available or has expired, create a new client secret.
Restart Relay after changing any environment variable.

### Outlook maintenance context

- Use `MICROSOFT_TENANT_ID=common` when supporting both Microsoft 365 and
  personal Outlook.com accounts. A tenant-specific ID may authenticate a
  personal account as a `#EXT#` guest with no mailbox access.
- Outlook email rows have `provider='outlook'` and `gmail_category=null`.
  Inbox queries and UI filters must not apply Gmail category filtering to an
  Outlook-only account. The unified Primary view should include Outlook inbox
  mail alongside Gmail Primary mail.
- After changing the tenant authority, restart Relay and disconnect/reconnect
  any Outlook account whose stored email contains `#EXT#`.

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

Open `http://localhost:3000`, create or sign in to an account, then connect Gmail or Outlook from Settings.

## Verification

```bash
pnpm lint
pnpm test:ci
pnpm build
```
# Background agent jobs

Set `CRON_SECRET` to a long random value in every deployed environment. The
included `vercel.json` invokes `/api/agent-jobs/commitments` hourly; the route
accepts only `Authorization: Bearer $CRON_SECRET`. On another hosting platform,
schedule the same authenticated GET or POST request once per hour.
