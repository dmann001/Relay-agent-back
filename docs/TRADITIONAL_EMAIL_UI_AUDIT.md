# Traditional Email UI Audit

## Assessment

The project implements roughly 70% of a conventional Gmail client workflow.
The main read, compose, send, draft, archive, trash, and restore paths are real
Gmail-backed operations. It is not production-complete and does not cover all
email edge cases.

## Implemented

| Area | Coverage |
| --- | --- |
| Authentication | Supabase sign-in, protected routes, sign-out |
| Accounts | Gmail OAuth, encrypted server-side tokens, connect/disconnect |
| Inbox | Cached metadata, Gmail sync, categories, current-page search, pagination |
| Reading | Live Gmail body fetch, HTML sanitization, plain-text fallback |
| Sending | Compose, Cc, attachments, manual reply, sent-message cache update |
| Drafts | Gmail create/update/delete, debounce autosave, draft editing |
| Mail actions | Archive, trash, unarchive, restore, mark read |
| Attachments | Upload on new messages and download from received messages |
| States | Loading, empty mailbox, sync errors, expired OAuth messaging |

## Important Gaps

1. A route called a thread renders one Gmail message, not the complete Gmail conversation.
2. Inbox search and category filtering only inspect the currently loaded page.
3. Sent, Archives, Trash, and Drafts are limited to 100 cached items with no pagination.
4. Recipient addresses are split on commas but are not rigorously validated.
5. Attachment count, type, and Gmail size limits are not validated before upload.
6. Attachments are not persisted by the draft autosave API.
7. Closing compose before the debounce completes can lose the latest unsaved edits.
8. Multiple connected accounts default to the first account for compose and draft creation.
9. Trash supports restore but not permanent deletion or empty-trash behavior.
10. Star/unstar and mark-unread exist in the API but have no traditional UI controls.
11. There are no integration tests for OAuth, sync, send, draft, or mailbox mutations.
12. Mobile and keyboard-accessibility behavior has not been verified end to end.

## Removed

- Agent and demo routes
- Relayed mode and agent controls
- AI summaries, labels, sentiment, priority, task extraction, and draft generation
- AI API routes, server services, vector-store code, and OpenAI dependency
- Decorative checkboxes, disconnected search boxes, and inactive message actions
- Placeholder marketing claims and demo content
