# Relay Personalization Memory

## Goal

Make Relay feel like the user's email agent:

- Write in the user's preferred style.
- Adapt tone for each contact.
- Remember explicit preferences and important working context.
- Learn from drafts the user edits and sends.
- Retrieve relevant past emails when answering or drafting.

Relay does not need to reproduce Supermemory's graph engine, document platform,
version chains, or provider architecture. The useful Supermemory ideas are:

1. Keep a short persistent user profile.
2. Separate stable preferences from recent context.
3. Retrieve query-specific history instead of putting the whole mailbox in a
   prompt.
4. Let users inspect, correct, and forget what was learned.

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

## Minimal Architecture

Use Supabase directly. Do not add Supermemory as a runtime dependency for the
first version.

```text
Explicit settings + sent emails + draft edits + recent activity
                              |
                              v
                    Relay personalization profile
                              |
               +--------------+--------------+
               |                             |
               v                             v
      Contact-specific context       Relevant email search
               |                             |
               +--------------+--------------+
                              |
                              v
                 Draft / command / priority prompt
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
5. Up to five semantically relevant emails.

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

Do not infer sensitive relationships or personal attributes. Contact learning
should remain communication-focused.

### Recent Context

Store only active items useful for email work:

- Current projects.
- Upcoming deadlines.
- Unresolved commitments.
- Recent decisions.

Each inferred item needs an expiry date. Tasks and reminders remain the
canonical records; `recent_context` is only a compact prompt summary.

## Relevant Email Retrieval

Use the existing `email_embedding_chunks` table rather than building a memory
graph.

For a draft:

1. Search the current thread first.
2. Search prior sent emails to the same contact.
3. Search semantically similar emails for the user.
4. Return at most five short excerpts.

For an agent command:

1. Search by command text.
2. Apply structured filters for contact, date, account, or thread when known.
3. Include the user profile and recent context.

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
- Learn from sent mail and opened threads by default, not the entire mailbox.
- Never learn passwords, OTPs, financial identifiers, or authentication links.
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

## Success Measures

- Percentage of generated drafts sent.
- Edit distance between generated and final drafts.
- User-rated tone accuracy.
- Correct use of contact-specific tone.
- Precision of retrieved email context.
- Priority accuracy for emails the user responds to.
- Cross-user data leakage: zero.

## What We Are Deliberately Not Building

- A general knowledge graph.
- `updates`, `extends`, and `derives` relationships.
- Memory version chains.
- A separate documents platform.
- A generic memory provider abstraction.
- Automatic ingestion of every mailbox message.
- Supermemory hosted or local infrastructure.

Those can be reconsidered only if the compact Relay-native system cannot meet
measured personalization quality.

## Research Reference

The design borrows only user profiles and hybrid retrieval concepts from:

- [Supermemory repository](https://github.com/supermemoryai/supermemory)
- [User profiles](https://github.com/supermemoryai/supermemory/blob/94a1e307422302ea4378e257af8ceb51cb591896/apps/docs/user-profiles.mdx)
- [Hybrid search](https://github.com/supermemoryai/supermemory/blob/94a1e307422302ea4378e257af8ceb51cb591896/apps/docs/search.mdx)
