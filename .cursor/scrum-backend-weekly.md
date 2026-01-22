# Backend Weekly Summary (Concise)

What shipped
- Migrated vector store to Supabase (pgvector): `server/services/vector_store.ts`, `server/lib/supabase.ts`.
- Added Express AI routes: `/api/ai/index`, `/api/ai/search`, `/api/ai/summarize`, `/api/ai/draft`, `/api/ai/classify`.
- Integrated frontend with `lib/api.ts` (InboxList + ThreadView).
- Centralized AI logic in `server/services/ai.ts`.

Working now
- Semantic search, thread summarization, context-aware drafts, auto-classification.

Limitations
- No token refresh, manual sync, email sending incomplete.

Env (backend)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_API_URL`.

