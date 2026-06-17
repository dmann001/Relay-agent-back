# Relay — Agent Scratchpad

Living notes for AI agents and developers. **README.md is stale** (describes an old “relay request” school project). The app is **Relay Email** — an AI-assisted unified Gmail + Outlook client.

Last updated: 2026-06-17 (minimal redesign + settings + resizable panels session)

---

## Product (what’s actually built)

- **Auth:** Supabase email/password (`/login`). Gmail/Outlook OAuth is separate, done in Settings → Connections.
- **Core:** Inbox, sent, drafts, archives, trash, compose, thread view, multi-account.
- **AI:** Inbox brief, thread assistant (summarize/draft/tasks/ask), per-account AI prefs.
- **Workflow:** Commitments, meeting briefs, agent activity (with approval gates), optional calendar reminders.
- **Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui, Geist fonts, Supabase, pnpm.

Post-login default route: `/inbox`. Public routes: `/`, `/login`.

---

## Design system (2026 minimal redesign)

**Direction:** Neutral monochrome (Vercel / Linear / Parallel inspired). **No gold/noir theme.** Landing is **forced light** via `.light` class in `globals.css`; app defaults **dark** with light toggle in sidebar.

**Tokens:** `app/globals.css` — `--background`, `--foreground`, `--primary`, `--brand`, `--sidebar-*`, `--surface-*`. Brand maps to near-black (light) / near-white (dark).

**Fonts:** Geist Sans + Mono via `geist` package in `app/layout.tsx`.

**Landing:** `components/landing-page.tsx` — hero, product features (honest/implemented only), FAQ accordion, sign in/up CTAs. **No** pricing, testimonials, or “used by”. Links: `/login`, `/login?tab=signup`.

**Login:** `app/login/login-form.tsx` + Suspense wrapper in `app/login/page.tsx`. Light card UI; `?tab=signup` opens create-account tab.

---

## Layout & shell

- **`components/app-shell.tsx`** — Shared authenticated layout: sidebar + main + mobile bottom nav. Content area uses `h-full min-h-0`.
- **`components/app-sidebar.tsx`** — Nav, compose, accounts list, settings link, theme toggle, sign-out row.
- **Collapse:** ChatGPT-style — `PanelLeftClose` in header when expanded, `PanelLeft` when collapsed. Not the old floating chevron pill.
- **Sign-out label:** Shows profile display name (`user_metadata.full_name` → `name` → email → “Sign out”).
- **Settings highlight:** Active when `pathname.startsWith("/settings/")`.

---

## Resizable panels (Cursor-style drag)

- **`hooks/use-resizable-panel.ts`** — Drag + localStorage persistence.
- **`components/resize-handle.tsx`** — 1px divider with wide hit area, `col-resize` cursor.

| Panel | Storage key | Default | Min–Max | Edge |
|-------|-------------|---------|---------|------|
| Sidebar | `relay-sidebar-width` | 240px | 200–360 | end (disabled when collapsed) |
| Inbox list | `relay-inbox-list-width` | 380px | 280–560 | end |
| AI assistant | `relay-ai-panel-width` | 384px | 280–560 | start |

Desktop only (`md+`) for list/AI handles. Reading pane width follows list resize (flex-1).

---

## Settings structure

Routes under `app/settings/` with shared **`components/settings/settings-shell.tsx`** + **`settings-nav.tsx`**:

| Route | Component | Purpose |
|-------|-----------|---------|
| `/settings` | redirect | → profile, or → connections if OAuth query params |
| `/settings/profile` | `profile-settings.tsx` | Display name (Supabase `updateUser`), email read-only, sign out |
| `/settings/connections` | `connections-settings.tsx` | Gmail/Outlook connect/disconnect, calendar per account |
| `/settings/ai` | `ai-settings.tsx` | Per-account AI toggle, writing style, draft instructions, signature |

OAuth/calendar callbacks redirect to **`/settings/connections`** (with query params). Toast handling: `components/settings/use-settings-oauth-toast.ts`.

**Removed:** monolithic `components/settings-content.tsx`.

---

## Key files map

```
app/
  layout.tsx          # Geist, ThemeProvider, AuthProvider
  globals.css         # Design tokens + .light scope
  page.tsx            # Landing
  login/              # login-form.tsx + page (Suspense)
  settings/
    layout.tsx        # AppShell wrapper
    page.tsx          # Redirect
    profile|connections|ai/page.tsx

components/
  landing-page.tsx
  app-shell.tsx
  app-sidebar.tsx
  inbox-list.tsx      # Split list + reading pane
  thread-view.tsx
  ai-thread-assistant.tsx
  resize-handle.tsx
  settings/           # settings-shell, settings-nav, *-settings.tsx
  ui/accordion.tsx    # FAQ + shadcn primitives

hooks/
  use-resizable-panel.ts
  use-toast.ts
```

---

## UI fixes done in this session

1. **Email reading pane** — Height chain via `AppShell` `h-full min-h-0`; reading section `flex flex-col min-h-0`.
2. **Appearance row** — Theme toggle matches Settings row layout (`h-10`, icon + `ml-3` label); `ThemeToggle` is full-width nav row, not isolated icon button with `justify-between`.
3. **Inbox “Connect Gmail”** → `/settings/connections`.

---

## Marketing vs reality (don’t re-add to landing)

Not implemented or overstated elsewhere: semantic/vector search, autopilot rules, E2EE, `/demo` route, waitlist backend.

---

## Commands

```bash
pnpm dev          # Next + Express server
pnpm typecheck
pnpm lint
pnpm test:e2e     # auth.smoke expects hero "Email, distilled"
```

---

## Open follow-ups

- Replace landing/product placeholder mockups with real imagery.
- Wire forgot-password dialog to Supabase.
- Optional: resizable agent-activity detail panel; settings “Appearance” page if theme moves out of sidebar.
- Update root README to match Relay Email product.

---

## Agent conventions

- Prefer semantic tokens (`bg-background`, `text-brand`) in app shell; landing/login use `.light` + neutral hex where needed.
- Don’t restore gold/noir effects (`.bg-grain`, `.liquid-panel`, ambient gold orbs).
- OAuth errors: keep redirect target `/settings/connections`.
- Profile name lives in `user.user_metadata.full_name` (signup + profile settings).
