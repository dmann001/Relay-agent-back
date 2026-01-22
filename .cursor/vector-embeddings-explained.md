# Vector Embeddings (Concise)

Purpose
- Semantic search by meaning, not keywords.

Flow
1. Index email text -> embedding (`text-embedding-3-small`, 1536 dims).
2. Store in Supabase `embeddings` table (pgvector).
3. Query -> embedding, compare with cosine similarity via `match_embeddings` RPC.
4. Return top matches above threshold.

Key files
- `server/services/ai.ts` (generate + search embeddings)
- `server/services/vector_store.ts` (Supabase save/find)

Schema (minimal)
```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding vector(1536)
);
```

RPC (minimal)
```sql
match_embeddings(query_embedding vector(1536), match_threshold float, match_count int)
```

