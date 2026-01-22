AI & RAG Backend Summary

Key changes
- Vector store migrated to Supabase (pgvector). Uses `embeddings` table + `match_embeddings` RPC.
- Supabase client added at `server/lib/supabase.ts`.
- AI service in `server/services/ai.ts`:
  - Embeddings: `text-embedding-3-small`
  - RAG: `indexEmail`, `searchEmails`
  - LLM: `summarizeThread`, `draftReply`, `classifyEmail` (gpt-4o-mini)
- Routes in `server/routes/ai.ts`:
  - POST `/api/ai/index`, `/api/ai/search`, `/api/ai/summarize`, `/api/ai/draft`, `/api/ai/classify`
- Mounted at `/api/ai` in `server/index.ts`.

Setup required
- Supabase project with pgvector, `embeddings` table, and `match_embeddings` RPC
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
