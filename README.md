# Relay Email

Relay is a Gmail-focused email client built with Next.js, Supabase, and the Gmail API.

## Implemented

- Supabase authentication
- Gmail OAuth with encrypted server-side token storage
- Inbox sync with cached metadata and live message-body loading
- Inbox categories, local search, pagination, and unread counts
- Sent, Drafts, Archives, and Trash mailboxes
- Compose, Cc, attachments, manual replies, and Gmail draft autosave
- Archive, trash, restore, read-state updates, and attachment downloads
- Multi-account connection and disconnection

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test:ci
pnpm build
```

See [SETUP.md](SETUP.md) for environment and OAuth configuration.
