# CHANGELOG.md

All notable changes to this project will be documented in this file.

This changelog follows a simplified version of the principles from
https://keepachangelog.com/ and uses semantic, easy-to-read entries
to document the repository’s evolution.

---

# [Unreleased]

## Added
- Reworked Gmail sync to a metadata-cache architecture: the Relay DB stores
  email metadata only (sender, subject, snippet, labels, flags); full email
  bodies are fetched live from Gmail when an email is opened
- Gmail OAuth tokens are now stored server-side in `email_accounts`,
  encrypted at rest (AES-256-GCM); tokens never reach the browser
- Incremental sync via the Gmail History API with list-based fallback,
  plus periodic background refresh while the inbox is open
- Archive, delete (move to Trash), restore, and mark-read now call the Gmail
  API first and then update the DB cache, keeping Gmail and Relay in sync
- New Trash view (synced from Gmail only when opened)
- Drafts are autosaved to Gmail Drafts; the DB stores only the
  `gmailDraftId` plus a small preview with save status
- New API routes: `/api/emails` (GET cached list), `/api/emails/sync`,
  `/api/emails/[id]` (live body), `/api/emails/[id]/modify`,
  `/api/emails/counts`, `/api/drafts`, `/api/accounts`
- Requires `SUPABASE_SERVICE_ROLE_KEY` and `TOKEN_ENCRYPTION_KEY` env vars
  and the SQL migration `supabase/migrations/20260611_gmail_metadata_sync.sql`

## Planned
- Implement Gmail OAuth integration and account connection features (#14)
- Configure Google Cloud and environment validation (#17, #20)
- Integrate OpenAI API and AI-powered features such as email summaries (#18, #19)
- Add Gmail token refresh and account disconnect functionality (#16, #15)
- Improve backend architecture and modular structure (#21, #22)
- Maintain Kanban board and backlog organization (#10, #8)

---

# 2026-05-23

## Added
- Added changelog entry for project integration milestone  
  PR #23

---

# 2026-05-21

## Added
- Created WORKING_AGREEMENT.md to define collaboration rules  
  PR #13

- Added CHANGELOG.md to document project changes  
  PR #12

- Added README.md with team information and project description  
  PR #11

---

# 2026-01-21

## Closed
- Attempted integration of the Gmail API for email retrieval  
- This pull request was closed without merging  
- PR #4

---

# 2025-11-18

## Changed
- Fixed and improved the inbox page user interface layout for better usability  
- PR #3

---

# 2025-11-13

## Added
- Initial backend setup and project structure configuration  
- PR #2

- Built the core backend functionality to support the frontend application  
- PR #1