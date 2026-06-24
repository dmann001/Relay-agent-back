# Relay Personalization Memory

## Goal

Make Relay feel like the user's email agent:

- Write in the user's preferred style.
- Adapt tone for each contact.
- Remember explicit preferences and important working context.
- Learn from drafts the user edits and sends.
- Retrieve relevant past emails when answering or drafting.
- Understand what is happening across the user's inbox: work, personal life,
  bills, receipts, commitments, relationships, and repeated patterns.
- Help the user track trusted facts from email without silently turning every
  message into permanent memory.

Relay's memory system should become a trusted personal context layer. The useful
principles are:

1. Keep stable user profile facts separate from recent activity.
2. Retrieve query-specific history instead of putting the whole mailbox in a
   prompt.
3. Track entities and relationships when they help the user understand their
   email life.
4. Confirm sensitive or durable inferences before saving them as memory.
5. Let users inspect, correct, forget, export, and disable what was learned.

## Existing Relay Foundation

Relay already has most of what this needs:

- `app_settings.user_context` for explicit user instructions.
- `agent_memory.summary` and recent commands.
- `contacts` for contact-specific metadata.
- `emails`, sent mail, drafts, tasks, and reminders.
- `email_embedding_chunks` and pgvector search scaffolding.
- AI routes for drafting, commands, intent, priority, and enrichment.

The current problem is integration: these sources are not assembled into one
consistent personalization context, and user edits or sends do not update it.

### Current AI baseline (implemented 2026-06-13)

Relay now has account-scoped AI preferences and server-side OpenAI routes for
thread summaries, drafts, tasks, Q&A, and inbox briefs. AI thread context uses
the complete Gmail conversation and is explicitly scoped to the owning account.
The UI exposes these controls in Settings, Inbox, and Thread View.

This is the foundation for the memory design below, not the full learning loop.
`ai_account_preferences` stores explicit per-account instructions today; the
proposed `agent_memory` profile, `draft_feedback`, contact learning, and semantic
retrieval remain future work. The eventual personalization service should merge
account preferences at the highest priority and preserve account boundaries in
all retrieval and feedback records.

## Trusted Personal Memory Architecture

Use Supabase directly. Do not add Supermemory as a runtime dependency for the
first version.

```text
Explicit settings + sent emails + draft edits + recent activity + inbox signals
                              |
                              v
                    Relay personal memory layer
                              |
        +----------+-----------+------------+------------+
        |                      |                         |
        v                      v                         v
 Contact context       Email/thread snapshots     Personal records
 relationships         semantic retrieval         bills/receipts/habits
        |                      |                         |
        +----------+-----------+------------+------------+
                              |
                              v
          Draft / command / priority / tracking prompt
```

Add one server-side service:

`lib/server/personalization.ts`

Every AI feature calls this service instead of independently assembling user
context.

## Data Model

### Extend `agent_memory`

Keep the existing table and add:

```sql
writing_profile jsonb not null default '{}',
recent_context jsonb not null default '[]',
profile_version int not null default 1
```

Example `writing_profile`:

```json
{
  "tone": "warm and direct",
  "length": "short",
  "greeting": "Hi {firstName},",
  "signOff": "Best,",
  "formatting": ["short paragraphs", "bullets for multiple asks"],
  "avoid": ["overly formal language", "unnecessary apologies"],
  "language": "en"
}
```

`recent_context` contains only a small number of current items:

```json
[
  {
    "text": "User is preparing the Relay project demo this week",
    "source": "explicit",
    "expiresAt": "2026-06-20T00:00:00Z"
  }
]
```

### Extend `contacts.metadata`

Use the existing JSON field instead of adding a new table:

```json
{
  "relationship": "professor",
  "preferredTone": "professional",
  "usualResponseLength": "medium",
  "importance": "high",
  "notes": ["Usually discusses the Relay capstone"]
}
```

### Add `personal_records`

Use this for user-facing personal trackers extracted from email. These are not
raw memories; they are structured records the user can view, correct, archive,
or delete.

Examples:

- Bills.
- Receipts.
- Subscriptions.
- Travel bookings.
- Appointments.
- Warranties.
- Deliveries.
- Financial account notices.

Suggested shape:

```sql
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete cascade,
  email_id uuid references public.emails(id) on delete set null,
  thread_id text,
  type text not null,
  status text not null default 'active',
  title text not null,
  merchant_or_org text,
  amount numeric,
  currency text,
  due_at timestamptz,
  purchased_at timestamptz,
  category text,
  folder text,
  confidence numeric not null default 0,
  requires_confirmation boolean not null default true,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Folders are product labels, not filesystem folders. Initial folders:

- `Bills`
- `Receipts`
- `Subscriptions`
- `Travel`
- `Appointments`
- `Work`
- `Personal`

### Add `memory_entities` and `memory_edges`

Use a lightweight relationship graph when the user benefits from connected
context. This should be practical and inspectable, not a hidden reasoning
database.

Entities:

- People.
- Organizations.
- Projects.
- Merchants.
- Accounts or services.
- Trips.
- Bills and subscriptions.
- Email threads.

Edges:

- `emailed`
- `works_with`
- `works_at`
- `belongs_to_project`
- `paid`
- `billed_by`
- `subscribed_to`
- `mentioned_in`
- `related_to_thread`
- `introduced_by`

Every edge needs source ids, confidence, timestamps, and review state. Sensitive
edges, such as financial behavior, family relationships, health, legal matters,
or intimate personal relationships, must require user confirmation before they
become durable memory.

### Add `draft_feedback`

This is the only new table required for the first useful version.

```sql
create table public.draft_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_id uuid references public.emails(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  generated_body text,
  final_body text not null,
  accepted_without_edit boolean not null default false,
  created_at timestamptz not null default now()
);
```

Apply RLS using `auth.uid() = user_id`.

This captures the strongest learning signal: what Relay suggested versus what
the user actually sent.

## Personalization Context

```ts
interface PersonalizationContext {
  explicitInstructions: string
  writingProfile: {
    tone?: string
    length?: "short" | "medium" | "detailed"
    greeting?: string
    signOff?: string
    formatting?: string[]
    avoid?: string[]
    language?: string
  }
  contact?: {
    relationship?: string
    preferredTone?: string
    notes?: string[]
  }
  recentContext: string[]
  relevantEmails: Array<{
    id: string
    subject: string
    excerpt: string
  }>
  personalRecords?: Array<{
    id: string
    type: "bill" | "receipt" | "subscription" | "travel" | "appointment" | "other"
    title: string
    amount?: number
    dueAt?: string
    folder?: string
    status: string
  }>
  relationshipContext?: Array<{
    entity: string
    relationship: string
    source: string
  }>
}
```

Implement:

```ts
getPersonalizationContext({
  userId,
  operation,
  query,
  contactEmail,
  threadId,
  limit: 5
})
```

Context priority:

1. Explicit user instructions.
2. Contact-specific preferences.
3. Learned writing style.
4. Current thread and recent context.
5. Confirmed personal records and relationship context relevant to the request.
6. Up to five semantically relevant emails.

Keep the assembled context small and label facts as preferences, not
instructions. Email content must never override the system prompt.

## Learning Loop

### Explicit Preferences

The settings screen remains the highest-authority source. Add simple fields for:

- Default tone.
- Reply length.
- Greeting.
- Sign-off.
- Preferred language.
- Free-form instructions.

Commands such as "remember that I prefer short replies" update this profile only
after user confirmation.

### Sent Email Learning

After an email is sent:

1. Store the final body in `draft_feedback`.
2. If Relay generated the draft, also store the generated body.
3. Periodically analyze the most recent 10-20 sent samples.
4. Update only broad style attributes such as tone, length, greeting, sign-off,
   paragraph size, and bullet usage.

Do not save every stylistic observation as a separate memory. Replace the
compacted writing profile.

Require repeated evidence before changing a learned setting. Explicit settings
always win over inferred behavior.

### Contact Learning

Update `contacts.metadata` from:

- User-set VIP status or notes.
- Typical tone and reply length in sent mail to that contact.
- Repeated thread topics.
- Confirmed relationship facts.
- Shared projects, organizations, or recurring commitments.

Sensitive relationships or personal attributes must stay pending until the user
confirms them. Contact learning should distinguish communication preferences
from durable personal facts.

### Personal Records Learning

When emails look like bills, receipts, subscriptions, travel bookings,
appointments, or account notices:

1. Extract a structured candidate record.
2. Attach source email, thread, account, provider ids, and confidence.
3. Put it in the right folder, such as `Bills` or `Receipts`.
4. Ask for confirmation before saving sensitive or durable facts.
5. After confirmation, use the record for reminders, summaries, search, and
   future AI answers.

Examples:

- A utility bill email becomes a pending `Bills` record with amount and due date.
- A card receipt becomes a pending `Receipts` record with merchant, amount, and
  category.
- Repeated receipts from the same merchant can become a confirmed spending habit
  only after the user approves the interpretation.
- A recurring charge can become a `Subscriptions` record with renewal cadence.

Spending habits should be learned as high-level patterns, not raw card data.
Never store full card numbers, CVV, bank login details, OTPs, reset links, or
authentication tokens.

### Work and Personal Classification

Every email, thread, snapshot, and personal record should support a lightweight
classification:

- `work`
- `personal`
- `finance`
- `shopping`
- `travel`
- `health`
- `education`
- `legal`
- `system`
- `unknown`

Classification should be editable. Sensitive categories should not drive
visible actions or durable memories until confidence is high or the user
confirms the category.

### Recent Context

Store only active items useful for email work:

- Current projects.
- Upcoming deadlines.
- Unresolved commitments.
- Recent decisions.
- Bills or subscriptions due soon.
- Recent purchases or bookings the user may ask about.
- Work/personal boundaries that affect triage.

Each inferred item needs an expiry date. Tasks and reminders remain the
canonical records; `recent_context` is only a compact prompt summary.

## Relevant Email Retrieval

Use the existing `email_embedding_chunks` table rather than building a memory
graph.

Relay's local email cache may be incomplete. Treat local embeddings and
snapshots as an index, not the source of truth. When a high-confidence snapshot
or chunk points to a thread or message, fetch the canonical email/thread record
before answering or drafting from it.

### Thread and Email Snapshots

Maintain lightweight searchable snapshots for threads and important messages:

- `user_id`, `account_id`, `message_id`, `thread_id`, and provider ids.
- Subject, participants, timestamps, labels, and sent/received direction.
- Short summary, key topics, entities, and optional commitments.
- Work/personal classification and record candidates.
- Embedding, source timestamp, and snapshot version.

The AI flow should search snapshots first because they are fast and cheap. A
snapshot match is only a pointer. The answer should be grounded by fetching the
full local thread/message when available, or the provider thread/message when
the local cache is missing or stale.

### Hybrid Provider Fallback

If local snapshot and chunk retrieval is weak, stale, or empty, fall back to the
connected provider:

1. Translate the user request into provider search filters when possible
   (contact, subject, date range, account, thread id, labels).
2. Search Gmail or Outlook for candidate messages/threads.
3. Fetch the exact candidates, persist them locally, and update snapshots and
   embeddings.
4. Build AI context from the fetched source content, not from the snapshot alone.
5. Return context sources that identify the snapshot and the fetched
   thread/message.

This keeps Relay useful before a full mailbox sync exists, while avoiding
silent ingestion of every historical message as memory.

For a draft:

1. Search the current thread first.
2. Search prior sent emails to the same contact.
3. Search local snapshots and semantically similar emails for the user.
4. Fetch the exact thread/message for strong candidates.
5. Return at most five short grounded excerpts.

For an agent command:

1. Search by command text.
2. Apply structured filters for contact, date, account, or thread when known.
3. Search local snapshots and chunks.
4. Fall back to Gmail or Outlook search when local coverage is insufficient.
5. Fetch exact thread/message content for the final context.
6. Include the user profile and recent context.

All vector search must require the authenticated user ID. Remove the legacy
behavior where `match_embeddings` can search without a user filter.

## Feature Integration

### Draft Generation

Update `app/api/ai/generate-draft/route.ts` to:

1. Authenticate the user.
2. Fetch `PersonalizationContext`.
3. Build one structured prompt with profile, contact context, thread context,
   and relevant sent examples.
4. Return the draft and a short list of context sources used.

### Send Flow

Update `app/api/emails/send/route.ts` to accept an optional:

```ts
{
  generatedDraft?: string
}
```

After Gmail confirms the send, store `draft_feedback`. Learning must not block
the send response.

### Agent Commands

Replace the current `memorySummary` and manually selected `topEmails` payload in
`process-command` with server-side `getPersonalizationContext()`.

The browser should send the command, not the user's profile or API key.

For broad mailbox questions, commands should use the hybrid retrieval path:
search local snapshots and chunks first, then provider search when Relay has not
synced enough local mail. The AI should answer only after fetching the relevant
thread or message content.

Agent commands should also be able to create pending personal-record candidates:

- "Track my bills from email."
- "Show my receipts from this month."
- "What subscriptions am I paying for?"
- "Which emails are work related?"
- "Remember that this person is my accountant."

The agent should explain what it found, ask for confirmation when the
information is sensitive or durable, and then save structured records or memory
edges after approval.

### Priority

Keep priority simple:

- Existing AI/content score.
- VIP/contact importance.
- Historical response behavior.
- Active deadline or commitment.

Personalization should adjust the score, not replace deterministic email
signals.

## Privacy Rules

- All profile, feedback, contacts, and vector rows are scoped by `user_id`.
- Use server-side OpenAI credentials; do not pass user keys through browser
  requests.
- Learn durable user preferences from sent mail and opened threads by default,
  not the entire mailbox.
- Provider fallback may fetch missing threads for a user request, but fetched
  email content is retrieval context. It should not become durable memory unless
  it passes the explicit memory learning and review flow.
- Never store passwords, OTPs, full card numbers, CVV values, bank login
  details, financial account credentials, reset links, or authentication tokens.
- Bills, receipts, spending categories, and subscriptions may be tracked, but
  sensitive financial interpretations require confirmation and clear source
  links.
- Provide "View what Relay knows", edit, reset, and disable-learning controls.
- Deleting an account must delete its profile, feedback, and embeddings.

## Implementation Plan

### Phase 1: Profile and Context Service

- Add `writing_profile` and `recent_context` to `agent_memory`.
- Add settings fields for explicit style preferences.
- Implement `getPersonalizationContext()`.
- Require authenticated user scoping in vector search.
- Integrate the context service into draft generation.

Result: Relay drafts consistently use explicit user preferences and relevant
email history.

### Phase 2: Learn From Sends

- Add `draft_feedback` with RLS.
- Capture generated and final bodies after successful sends.
- Add a profile compaction job for recent sent samples.
- Store communication preferences in `contacts.metadata`.

Result: Relay gradually matches the user's real writing style and adapts by
recipient.

### Phase 3: Agent-Wide Personalization

- Use the same context service for commands and reply suggestions.
- Add recent projects, deadlines, and unresolved commitments.
- Add memory review, correction, reset, and disable controls.
- Use learned contact importance in priority scoring.

Result: drafting, triage, and commands share one consistent understanding of
the user.

### Phase 4: Hybrid Mailbox Retrieval

- Add thread/email snapshots as the first retrieval index.
- Fetch full local thread/message content after snapshot matches.
- Add Gmail and Outlook provider fallback when local sync is incomplete.
- Persist fetched candidates and refresh snapshots/embeddings.
- Expose context sources that show snapshot, provider, thread, and message ids.

Result: broad AI chat can answer mailbox questions even before Relay has synced
or embedded every relevant email.

### Phase 5: Personal Records and Relationship Memory

- Add `personal_records` for bills, receipts, subscriptions, travel,
  appointments, deliveries, and warranties.
- Add lightweight `memory_entities` and `memory_edges` for inspectable
  relationships between people, organizations, projects, merchants, threads, and
  records.
- Add classifiers for work, personal, finance, shopping, travel, health,
  education, legal, system, and unknown.
- Build review UI for pending records and relationship facts.
- Add source-backed confirmation flows before saving sensitive financial,
  health, legal, family, or personal relationship inferences.
- Add folders/views such as Bills, Receipts, Subscriptions, Work, and Personal.
- Use confirmed records in reminders, summaries, AI chat, drafting, and priority.

Result: Relay tracks what is happening in the user's email life, not just how to
write emails.

## Success Measures

- Percentage of generated drafts sent.
- Edit distance between generated and final drafts.
- User-rated tone accuracy.
- Correct use of contact-specific tone.
- Precision of retrieved email context.
- Accuracy of bill, receipt, subscription, and spending-category extraction.
- Percentage of sensitive inferences confirmed before use.
- User correction rate for personal records and relationship edges.
- Work/personal classification precision.
- Priority accuracy for emails the user responds to.
- Cross-user data leakage: zero.

## Build Direction

Relay is building a trusted personal memory system for the user. The system can
grow into relationship graphs, personal records, inbox classifiers, and
source-backed trackers as long as it remains inspectable, scoped, correctable,
and consent-aware. The boundary is not "do not build memory"; the boundary is
"do not silently save sensitive or unverified facts as durable truth."

## Research Reference

The design borrows only user profiles and hybrid retrieval concepts from:

- [Supermemory repository](https://github.com/supermemoryai/supermemory)
- [User profiles](https://github.com/supermemoryai/supermemory/blob/94a1e307422302ea4378e257af8ceb51cb591896/apps/docs/user-profiles.mdx)
- [Hybrid search](https://github.com/supermemoryai/supermemory/blob/94a1e307422302ea4378e257af8ceb51cb591896/apps/docs/search.mdx)
