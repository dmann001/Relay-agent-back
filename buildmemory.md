# Relay Memory Layer Handoff

This document is the continuation context for future agentic chats that work on Relay's memory and personalization layer. It captures what has already been built, how to test it in the app, and the next execution plan.

## Current State

Relay now has two implemented memory iterations:

1. A durable, user-controlled memory foundation with scoped retrieval, explicit approval for learned memories, and sensitive-text filtering.
2. A trust-and-quality layer that makes memory suggestions deduplicated, inspectable, editable, compacted, and visible through context-source UI.

Implemented surfaces:

- Persistent memory tables and profile fields in Supabase.
- Central server-side personalization service for AI routes.
- Contact-aware context retrieval for compose, thread assistant, inbox brief, meeting AI, and meeting briefs.
- Long-context email retrieval through scoped embedding chunks.
- Draft edit feedback capture after sending generated drafts.
- Pending memory suggestions that require user acceptance before reuse.
- Memory suggestion quality controls: confidence thresholds, canonical fingerprints, duplicate pending merge, accepted-duplicate blocking, occurrence counts, and last-seen timestamps.
- Memory maintenance and compaction into `agent_memory.writing_profile.learnedStyleNotes`.
- Settings UI for reviewing, editing, accepting, rejecting, archiving, deleting, and toggling learning.
- Chat composer `@` contact suggestions, similar to mentioning a person in chat.
- Context source metadata returned by AI APIs, persisted in chat history metadata, and shown in the chat UI.
- Safer multi-account compose behavior: compose AI no longer silently chooses the first connected account when multiple accounts exist and no account is selected.
- Safer send behavior: if a cached Gmail/Outlook draft was already deleted remotely, send falls back to a normal provider send instead of failing with "Requested entity was not found."
- Future direction updated: Relay should become a trusted personal memory system, including bills, receipts, subscriptions, spending patterns, work/personal classification, and inspectable relationship memory.

## Key Files

- `supabase/migrations/20260619_memory_architecture.sql`
- `supabase/migrations/20260624_memory_quality_maintenance.sql`
- `supabase/schema.sql`
- `lib/server/memory-quality.ts`
- `lib/server/memory-maintenance.ts`
- `lib/server/personalization.ts`
- `lib/server/embeddings.ts`
- `app/api/memory/route.ts`
- `app/api/memory/maintenance/route.ts`
- `app/api/contacts/route.ts`
- `app/api/ai/compose/route.ts`
- `app/api/ai/thread/route.ts`
- `app/api/ai/brief/route.ts`
- `app/api/ai/meeting/route.ts`
- `app/api/meeting-briefs/route.ts`
- `app/api/emails/send/route.ts`
- `app/api/emails/[id]/route.ts`
- `app/api/emails/[id]/thread/route.ts`
- `components/settings/ai-settings.tsx`
- `components/ai-chat-shared.tsx`
- `components/ai-inbox-chat.tsx`
- `components/compose-dialog.tsx`
- `lib/email-api.ts`
- `Tests/contracts/supabase-schema.test.ts`
- `Tests/unit/lib/server/memory-quality.test.ts`
- `Tests/unit/lib/server/personalization.test.ts`

## Database Additions

`agent_memory` was extended with:

- `writing_profile jsonb`
- `recent_context jsonb`
- `profile_version integer`
- `learning_enabled boolean`
- `confirmed_learning_only boolean`

New `memory_items` table:

- Stores pending, accepted, rejected, and archived memories.
- Supports user, account, contact, email, and thread scoping.
- Supports memory types like preference, style, relationship, fact, task, and project.
- Includes confidence, source, expiration, accepted timestamp, and RLS policies.
- Implementation 2 added:
  - `fingerprint text`
  - `occurrence_count integer`
  - `last_seen_at timestamptz`
  - `superseded_by uuid`
  - Active fingerprint indexes for dedupe and merge behavior.

New `draft_feedback` table:

- Stores generated draft body versus final sent body.
- Used to infer possible style/preference memories.
- Suggestions stay pending until user accepts them.

Indexes were added for memory status, account scope, contact scope, expiration, fingerprint dedupe, draft feedback, contacts, and email embedding chunk lookup.

Embedding search RPCs were tightened:

- `match_email_embedding_chunks` now requires `target_user_id`.
- It supports optional `target_account_id`.
- Legacy `match_embeddings` no longer allows unsafe null-user search behavior.

## Server Architecture

`lib/server/personalization.ts` is the center of the memory layer.

Main exported functions in `lib/server/personalization.ts`:

- `getPersonalizationContext`
- `personalizationContextText`
- `normalizeEmailAddress`
- `firstEmailFromList`
- `upsertContactFromAddress`
- `recordDraftFeedback`
- `storeEmailEmbeddingChunk`

Memory quality and maintenance are now split out:

- `lib/server/memory-quality.ts`
  - `containsSensitiveMemoryText`
  - `canonicalMemoryText`
  - `memoryFingerprint`
  - `meetsMemoryConfidenceThreshold`
  - `createPendingMemorySuggestion`
- `lib/server/memory-maintenance.ts`
  - `runMemoryMaintenance`

The personalization context combines:

- Account preferences from `agent_memory`.
- Writing profile and accepted learned style notes.
- Accepted `memory_items`.
- Recent context snippets.
- Contact metadata.
- Sent messages to the same contact.
- Semantically relevant email chunks.

Memory suggestion creation now goes through `createPendingMemorySuggestion`. Do not insert pending `memory_items` directly from new learning sources unless there is a specific reason to bypass thresholding, fingerprinting, and dedupe.

`lib/server/embeddings.ts` wraps OpenAI embeddings with `text-embedding-3-small`. Embedding failures are soft failures so the main app workflow does not break if `OPENAI_API_KEY` is missing or the provider fails.

## AI Route Integrations

Personalization context is injected into:

- Compose AI.
- Thread summary, task extraction, draft reply, and ask modes.
- Inbox brief generation.
- Meeting-related draft generation.
- Meeting brief prep.

Most responses now include `contextSources`, and chat responses persist those sources inside the existing hidden `relay-chat` metadata marker. `components/ai-chat-shared.tsx` renders a "Context used" disclosure with labels only, not raw email body text.

Compose-specific behavior:

- Accepts `contactEmail`.
- Pulls contact-specific personalization when available.
- Returns draft provenance metadata so send can compare generated versus final body.
- Requires an explicit account when more than one connected account exists. Previously it used the oldest connected account (`accounts[0]`), which could silently choose Outlook over Gmail.
- Labels default account style as "Default writing style for ..." instead of "AI preferences for ..." unless the user has customized writing style, draft instructions, or signature.

## Contact Mention System

The app now has an `@` mention flow in the AI chat composer.

Implemented behavior:

- Typing `@` plus a name or email searches contacts and recent email metadata.
- Selecting a result inserts `@Name <email>` into the prompt.
- The compose AI path extracts that mentioned email and passes it as `contactEmail`.
- Relay can then retrieve memories, sent messages, and semantic context scoped to that person.

This is the right first version of "remember people and add them fast." A full contact system can come later, but the relay does need contact identity as a first-class axis for memory. Without it, personalization becomes too generic and may leak preferences across people.

## Memory Review UI

Settings now includes a "What Relay remembers" card in `components/settings/ai-settings.tsx`.

Supported actions:

- Toggle learning.
- View pending memories.
- Edit pending memory text before accepting.
- Accept pending memories.
- Reject pending memories.
- Archive accepted memories.
- Delete memories.
- Reset profile state through the memory API.

Accepted style and preference memories are compacted into `agent_memory.writing_profile.learnedStyleNotes`.
Maintenance runs after accept, update, archive, and delete actions, and is also available at `POST /api/memory/maintenance`.

## In-App Testing Checklist

Before testing:

- Apply `supabase/migrations/20260619_memory_architecture.sql`.
- Apply `supabase/migrations/20260624_memory_quality_maintenance.sql`.
- Ensure `OPENAI_API_KEY` is configured for embeddings and AI generation.
- Ensure Supabase service role configuration is available to server routes.
- Connect at least one Gmail or Outlook account with real or test email data.
- Start the app dev server.

Test memory settings:

1. Open Settings.
2. Go to the AI personalization area.
3. Confirm the "What Relay remembers" card appears.
4. Toggle learning off and on.
5. Confirm no crash and that the setting persists after refresh.
6. Confirm pending memories show confidence, occurrence count when duplicated, and last-seen metadata when available.
7. Edit a pending memory and save it before accepting.

Test draft feedback learning:

1. Open compose.
2. Add a recipient.
3. Use AI to generate a draft.
4. Insert or use the generated body.
5. Edit the body before sending, especially tone, greeting, or signoff.
6. Send the email.
7. Refresh Settings > AI personalization.
8. Look for pending memory suggestions.
9. Accept one suggestion.
10. Generate another draft and confirm the style preference influences the new output.
11. Repeat the same kind of edit several times and confirm duplicate suggestions merge into one row with a higher occurrence count.

Test context source visibility:

1. Ask Relay to draft or answer something using email/contact context.
2. Open the "Context used" disclosure under the assistant response.
3. Confirm it shows source labels such as default writing style, profile, memory, contact, or email.
4. Confirm it does not expose raw email bodies.

Test multi-account compose behavior:

1. Connect at least two accounts, for example Gmail and Outlook.
2. Open a global Relay chat with no account selected.
3. Ask Relay to draft an email.
4. Confirm Relay asks for an account instead of silently choosing the oldest connected account.
5. Open Relay from an account-scoped view or pass an account explicitly and confirm drafting uses that account.

Test `@` contact mentions:

1. Open Relay chat.
2. Type `@` followed by a contact name or email.
3. Select a suggestion.
4. Ask Relay to draft a reply or new email involving that person.
5. Confirm the prompt contains `@Name <email>`.
6. Inspect the network response if needed and confirm `contextSources` contains contact or email context.

Test long-context retrieval:

1. Open an email or email thread.
2. Confirm the page still loads normally.
3. With `OPENAI_API_KEY` configured, the opened email/thread should be stored as embedding chunks in the background.
4. Ask AI a related question later.
5. Inspect API response `contextSources` to confirm relevant email chunks were considered.

Future broad mailbox retrieval should not depend on every email already being
synced into Relay. The intended path is snapshot-first and provider-backed:

1. Search local thread/email snapshots and embedding chunks.
2. If a snapshot matches, use its `thread_id` or `message_id` only as a pointer.
3. Fetch the exact local thread/message before answering.
4. If local results are weak or missing, search Gmail or Outlook directly.
5. Persist fetched candidates, refresh snapshots/embeddings, and answer from the fetched source content.

Test safety behavior:

1. Use a test email containing OTP, password reset, authentication links, SSN-like text, or credit-card-like numbers.
2. Open/send through the normal flows.
3. Confirm sensitive text is not turned into memory suggestions.
4. Confirm main email workflows still succeed.

Test stale provider draft behavior:

1. Create or autosave a draft in Relay.
2. Delete the provider draft directly from Gmail or Outlook.
3. Return to Relay and send the cached draft.
4. Confirm Relay falls back to normal send instead of surfacing "Requested entity was not found."

## Verification Already Run

Passed:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm test:ci`
- Targeted Jest contract and personalization tests:
  - `Tests/contracts/supabase-schema.test.ts`
  - `Tests/unit/lib/server/memory-quality.test.ts`
  - `Tests/unit/lib/server/personalization.test.ts`
- Targeted compose/send-adjacent tests:
  - `Tests/unit/components/compose-dialog.test.tsx`
  - `Tests/unit/lib/server/gmail-api.test.ts`

Build:

- `pnpm build` passed when run with `NODE_OPTIONS=--max-old-space-size=4096`.
- Default Node heap compiled the app but failed during Next's TypeScript phase with an out-of-memory error. Use the larger heap for build verification on this machine.

## Architectural Decision: Knowledge Graph Or Not

Do not start with an opaque broad graph, but do plan for an inspectable
relationship memory layer.

The current best path is a scoped memory ledger plus retrieval:

- User profile for stable preferences.
- Contact-level memories for relationship-specific behavior.
- Account/workspace scope for email identity.
- Email/thread chunks for long context.
- Pending review queue for learned facts and preferences.
- Personal records for bills, receipts, subscriptions, travel, appointments, deliveries, and warranties.
- Lightweight entities and edges for people, organizations, projects, merchants, records, and threads.

The graph becomes useful when Relay needs multi-hop reasoning such as "this person is connected to this project through three past threads," "this merchant is a recurring subscription," or "this bill belongs to the user's home utilities." It must be source-backed, reviewable, and editable.

Recommended future graph shape, if needed:

- Nodes: user, account, contact, organization, project, thread, email, commitment, memory item.
- Additional nodes: merchant, bill, receipt, subscription, trip, appointment, warranty, delivery.
- Edges: emailed, mentioned, works_at, belongs_to_project, asked_for, committed_to, prefers, introduced_by, paid, billed_by, subscribed_to, related_to_thread.
- Edge metadata: confidence, source ids, timestamps, visibility scope, expiry, review state.

Sensitive financial, health, legal, family, or personal relationship edges must remain pending until user confirmation.

## Deep Personalization Direction

Relay should track what is happening in the user's email life, not only how the
user writes emails.

Future memory capabilities:

- Bills folder: due dates, amounts, merchants, source emails, paid/active status.
- Receipts folder: purchases, merchant, amount, category, warranty/delivery links.
- Subscriptions: recurring charges, renewal cadence, cancellation links when available.
- Spending patterns: high-level confirmed categories and merchants, never raw card data.
- Work/personal classification: editable category on emails, threads, records, and snapshots.
- Relationship memory: people, organizations, projects, roles, and confirmed connections.
- Personal facts from email: only source-backed and reviewable, with sensitive facts requiring confirmation.

Rule: the system may infer candidates, but durable sensitive memory requires confirmation. Never store full card numbers, CVV values, OTPs, passwords, reset links, or authentication tokens.

## Edge Cases To Preserve

- Learning can be disabled.
- Confirmed-learning-only behavior must remain the default posture.
- Pending suggestions must not influence prompts until accepted.
- Memories must be scoped by user and never cross users.
- Account-specific context must not leak between connected inboxes.
- Contact-specific tone should not apply to every contact.
- Sensitive text should not become memory.
- Embedding failures must not block reading or sending email.
- AI route failures should not corrupt memory state.
- Deleted or archived memories should not appear in future prompts.
- Expired memories should be ignored.
- Empty or malformed `@` mentions should degrade to normal chat.
- Duplicate contacts by casing or display name should normalize by email.
- Generated-vs-final draft comparisons must only run after provider send succeeds.
- RLS policies must protect memory tables.
- Pending duplicate suggestions should merge instead of creating noisy repeated rows.
- Accepted duplicate memories should block new pending duplicates.
- Context source UI must show labels/metadata only, not raw email body content.
- Global compose AI with multiple connected accounts must require account selection instead of choosing `accounts[0]`.
- Default account writing style should not be presented as if the user explicitly set a preference.
- Stale provider drafts should fall back to normal send when safe.

## Next Execution Plan

1. Run both memory migrations in a real Supabase environment and verify RLS with authenticated user flows.
2. Add deeper tests for:
   - Memory API accept/reject/archive/delete/update.
   - Maintenance route compaction/archive behavior with Supabase mocks.
   - Multi-account compose `ACCOUNT_REQUIRED` behavior.
   - Context source persistence after chat history reload.
3. Improve contact identity:
   - Add contact detail view.
   - Support aliases and organizations.
   - Let users pin relationship notes to a contact.
4. Improve long-context retrieval:
   - Add thread/email snapshots with provider ids, local ids, summaries, topics, participants, timestamps, and embeddings.
   - Search snapshots first, then fetch the exact thread/message by id for grounded context.
   - Add Gmail and Outlook provider fallback when Relay's local sync is incomplete.
   - Persist provider-fetched candidates and refresh their snapshots/embeddings.
   - Chunk sent and received email consistently during sync, not only on open.
   - Add recency weighting.
   - Add per-contact and per-thread retrieval budgets.
5. Build deep personalization records:
   - Add `personal_records` for Bills, Receipts, Subscriptions, Travel, Appointments, Deliveries, and Warranties.
   - Add lightweight `memory_entities` and `memory_edges` with source ids, confidence, and review state.
   - Add work/personal/finance/shopping/travel/health/education/legal/system/unknown classification.
   - Add review UI for pending records and sensitive relationship facts.
   - Use confirmed records in reminders, summaries, AI chat, drafting, and priority.
6. Add tests for:
   - Learning toggle behavior.
   - `@` mention parsing.
   - Sensitive text filtering.
   - Account isolation in retrieval.
   - Personal record extraction and confirmation.
   - Work/personal classification correction.
   - Relationship edge review and deletion.
7. Rerun full CI and build in a clean environment, using larger Node heap for `pnpm build` if needed.

## Product Direction

The goal is true personalization: Relay should understand how the user writes, who they are talking to, what matters in ongoing threads, and which preferences are stable. The system should feel like it knows the user through repeated use, but it must remain inspectable and correctable.

The memory layer should therefore optimize for:

- Explicit control.
- High trust.
- Contact-specific behavior.
- Long-context recall.
- Low-friction correction.
- No silent sensitive-data capture.
