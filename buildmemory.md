# Relay Memory Layer Handoff

This document is the continuation context for future agentic chats that work on Relay's memory and personalization layer. It captures what has already been built, how to test it in the app, and the next execution plan.

## Current State

Relay now has a first version of a durable, user-controlled memory architecture. The design intentionally avoids an opaque "remember everything" system. It uses scoped retrieval, explicit user approval for learned memories, and privacy filters for sensitive text.

Implemented surfaces:

- Persistent memory tables and profile fields in Supabase.
- Central server-side personalization service for AI routes.
- Contact-aware context retrieval for compose, thread assistant, inbox brief, meeting AI, and meeting briefs.
- Long-context email retrieval through scoped embedding chunks.
- Draft edit feedback capture after sending generated drafts.
- Pending memory suggestions that require user acceptance before reuse.
- Settings UI for reviewing, accepting, rejecting, archiving, deleting, and toggling learning.
- Chat composer `@` contact suggestions, similar to mentioning a person in chat.
- Context source metadata returned by AI APIs for observability.
- Future direction updated: Relay should become a trusted personal memory system, including bills, receipts, subscriptions, spending patterns, work/personal classification, and inspectable relationship memory.

## Key Files

- `supabase/migrations/20260619_memory_architecture.sql`
- `supabase/schema.sql`
- `lib/server/personalization.ts`
- `lib/server/embeddings.ts`
- `app/api/memory/route.ts`
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

New `draft_feedback` table:

- Stores generated draft body versus final sent body.
- Used to infer possible style/preference memories.
- Suggestions stay pending until user accepts them.

Indexes were added for memory status, account scope, contact scope, expiration, draft feedback, contacts, and email embedding chunk lookup.

Embedding search RPCs were tightened:

- `match_email_embedding_chunks` now requires `target_user_id`.
- It supports optional `target_account_id`.
- Legacy `match_embeddings` no longer allows unsafe null-user search behavior.

## Server Architecture

`lib/server/personalization.ts` is the center of the memory layer.

Main exported functions:

- `getPersonalizationContext`
- `personalizationContextText`
- `normalizeEmailAddress`
- `firstEmailFromList`
- `containsSensitiveMemoryText`
- `upsertContactFromAddress`
- `recordDraftFeedback`
- `storeEmailEmbeddingChunk`

The personalization context combines:

- Account preferences from `agent_memory`.
- Writing profile and accepted learned style notes.
- Accepted `memory_items`.
- Recent context snippets.
- Contact metadata.
- Sent messages to the same contact.
- Semantically relevant email chunks.

`lib/server/embeddings.ts` wraps OpenAI embeddings with `text-embedding-3-small`. Embedding failures are soft failures so the main app workflow does not break if `OPENAI_API_KEY` is missing or the provider fails.

## AI Route Integrations

Personalization context is injected into:

- Compose AI.
- Thread summary, task extraction, draft reply, and ask modes.
- Inbox brief generation.
- Meeting-related draft generation.
- Meeting brief prep.

Most responses now include `contextSources`, which lets future UI work show why Relay used certain memories or messages.

Compose-specific behavior:

- Accepts `contactEmail`.
- Pulls contact-specific personalization when available.
- Returns draft provenance metadata so send can compare generated versus final body.

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
- Accept pending memories.
- Reject pending memories.
- Archive accepted memories.
- Delete memories.
- Reset profile state through the memory API.

Accepted style and preference memories are compacted into `agent_memory.writing_profile.learnedStyleNotes`.

## In-App Testing Checklist

Before testing:

- Apply `supabase/migrations/20260619_memory_architecture.sql`.
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

## Verification Already Run

Passed:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- Targeted Jest contract and personalization tests:
  - `Tests/contracts/supabase-schema.test.ts`
  - `Tests/unit/lib/server/personalization.test.ts`

Not fully completed:

- Full `pnpm test:ci` timed out.
- `pnpm build` could not complete because existing `next dev` processes were active and Next refused concurrent build locking.

Future agents should rerun full CI after stopping dev servers or using a clean environment.

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

## Next Execution Plan

1. Run database migration in a real Supabase environment and verify RLS with authenticated user flows.
2. Add UI display for `contextSources` so users can see what Relay used.
3. Add memory suggestion quality controls:
   - Deduplicate pending suggestions.
   - Merge similar accepted memories.
   - Add confidence thresholds per memory type.
4. Add a background compaction job:
   - Compact accepted style memories into `writing_profile`.
   - Archive stale or superseded memories.
   - Recompute profile version.
5. Improve contact identity:
   - Add contact detail view.
   - Support aliases and organizations.
   - Let users pin relationship notes to a contact.
6. Improve long-context retrieval:
   - Add thread/email snapshots with provider ids, local ids, summaries, topics, participants, timestamps, and embeddings.
   - Search snapshots first, then fetch the exact thread/message by id for grounded context.
   - Add Gmail and Outlook provider fallback when Relay's local sync is incomplete.
   - Persist provider-fetched candidates and refresh their snapshots/embeddings.
   - Chunk sent and received email consistently during sync, not only on open.
   - Add recency weighting.
   - Add per-contact and per-thread retrieval budgets.
7. Build deep personalization records:
   - Add `personal_records` for Bills, Receipts, Subscriptions, Travel, Appointments, Deliveries, and Warranties.
   - Add lightweight `memory_entities` and `memory_edges` with source ids, confidence, and review state.
   - Add work/personal/finance/shopping/travel/health/education/legal/system/unknown classification.
   - Add review UI for pending records and sensitive relationship facts.
   - Use confirmed records in reminders, summaries, AI chat, drafting, and priority.
8. Add tests for:
   - Memory API accept/reject/archive/delete.
   - Learning toggle behavior.
   - `@` mention parsing.
   - Sensitive text filtering.
   - Account isolation in retrieval.
   - Personal record extraction and confirmation.
   - Work/personal classification correction.
   - Relationship edge review and deletion.
9. Rerun full CI and build in a clean environment.

## Product Direction

The goal is true personalization: Relay should understand how the user writes, who they are talking to, what matters in ongoing threads, and which preferences are stable. The system should feel like it knows the user through repeated use, but it must remain inspectable and correctable.

The memory layer should therefore optimize for:

- Explicit control.
- High trust.
- Contact-specific behavior.
- Long-context recall.
- Low-friction correction.
- No silent sensitive-data capture.
