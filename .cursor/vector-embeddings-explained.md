# How Vector Embeddings Work in Relay Email Agent

## Conceptual Overview

**Vector embeddings** are numerical representations of text that capture semantic meaning. Think of them as coordinates in a high-dimensional space (1536 dimensions for `text-embedding-3-small`) where similar meanings are positioned close together.

### Simple Analogy
Imagine a map where:
- Emails about "project deadlines" are clustered in one area
- Emails about "meeting schedules" are in another area
- Emails about "budget approvals" are in yet another area

When you search for "when is the project due?", the system finds emails in the "project deadlines" cluster, even if they don't contain the exact words "project due".

---

## How It Works in This Project

### Step 1: Generating Embeddings (When Emails Are Indexed)

**Location:** `server/services/ai.ts::indexEmail()`

```29:44:server/services/ai.ts
async indexEmail(email: Email) {
    const text = `
Subject: ${email.subject}
From: ${email.from.name} <${email.from.email}>
Date: ${email.date}
Body: ${email.bodyPlain || email.body}
    `.trim();

    const embedding = await this.generateEmbedding(text);
    await vectorStore.saveEmbedding(email.id, embedding, {
        subject: email.subject,
        from: email.from,
        date: email.date,
        threadId: email.threadId
    }, text);
},
```

**What happens:**
1. Email content is combined into a single text string (subject, from, date, body)
2. This text is sent to OpenAI's `text-embedding-3-small` model
3. OpenAI returns a **1536-dimensional vector** (array of 1536 numbers)
4. This vector represents the semantic meaning of the email

**Example:**
- Email: "Meeting tomorrow at 3pm about Q4 budget"
- Embedding: `[0.123, -0.456, 0.789, ..., 0.234]` (1536 numbers)

---

### Step 2: Storing Embeddings (Supabase + pgvector)

**Location:** `server/services/vector_store.ts::saveEmbedding()`

```13:36:server/services/vector_store.ts
async saveEmbedding(id: string, embedding: number[], metadata: Record<string, any>, text?: string) {
    if (!supabase) {
        console.warn('Supabase not configured, skipping saveEmbedding');
        return;
    }
    try {
        const { error } = await supabase
            .from('embeddings')
            .upsert({
                id,
                content: text,
                metadata,
                embedding,
            });

        if (error) {
            console.error('Error saving embedding to Supabase:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in saveEmbedding:', error);
        throw error;
    }
}
```

**What happens:**
1. The embedding vector (1536 numbers) is stored in Supabase's `embeddings` table
2. The table uses **pgvector** extension (PostgreSQL extension for vector operations)
3. Also stored: original text, metadata (subject, from, date, threadId)
4. The `id` field links back to the email ID

**Database Schema (Supabase):**
```sql
CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,              -- Email ID
    content TEXT,                     -- Original email text
    metadata JSONB,                   -- Subject, from, date, threadId
    embedding vector(1536)            -- The 1536-dimensional vector
);
```

---

### Step 3: Searching with Embeddings (Semantic Search)

**Location:** `server/services/ai.ts::searchEmails()`

```46:50:server/services/ai.ts
async searchEmails(query: string, limit: number = 5) {
    const queryEmbedding = await this.generateEmbedding(query);
    const results = await vectorStore.findSimilar(queryEmbedding, limit);
    return results;
},
```

**What happens:**
1. User types a search query: "emails about project deadlines"
2. The query is converted to an embedding vector (same 1536 dimensions)
3. This query vector is compared against all stored email embeddings
4. **Cosine similarity** is calculated to find the closest matches
5. Results are returned sorted by similarity score

**The Magic:** Even if the email says "Q4 deliverables due next week" and you search for "project deadlines", they'll match because they're semantically similar!

---

### Step 4: Finding Similar Vectors (Cosine Similarity)

**Location:** `server/services/vector_store.ts::findSimilar()`

```38:66:server/services/vector_store.ts
async findSimilar(queryVector: number[], limit: number = 5): Promise<Array<EmbeddingRecord & { score: number }>> {
    if (!supabase) {
        console.warn('Supabase not configured, skipping findSimilar');
        return [];
    }
    try {
        const { data, error } = await supabase.rpc('match_embeddings', {
            query_embedding: queryVector,
            match_threshold: 0.5, // Adjustable threshold
            match_count: limit,
        });

        if (error) {
            console.error('Error searching embeddings in Supabase:', error);
            throw error;
        }

        return (data || []).map((item: any) => ({
            id: item.id,
            embedding: [], // We don't need the vector back usually
            metadata: item.metadata,
            text: item.content,
            score: item.similarity,
        }));
    } catch (error) {
        console.error('Error in findSimilar:', error);
        return [];
    }
}
```

**What happens:**
1. Calls Supabase RPC function `match_embeddings`
2. This function uses **pgvector's cosine similarity** operator (`<=>`)
3. Calculates similarity between query vector and all stored vectors
4. Returns only vectors with similarity score ≥ 0.5 (threshold)
5. Results sorted by similarity (highest first)

**Supabase RPC Function (PostgreSQL):**
```sql
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        embeddings.id,
        embeddings.content,
        embeddings.metadata,
        1 - (embeddings.embedding <=> query_embedding) AS similarity
    FROM embeddings
    WHERE 1 - (embeddings.embedding <=> query_embedding) > match_threshold
    ORDER BY embeddings.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

**Key Operator:** `<=>` is pgvector's cosine distance operator
- Returns 0 for identical vectors
- Returns 1 for completely different vectors
- `1 - (distance)` gives us similarity (0 to 1 scale)

---

## Complete Flow Example

### Scenario: User searches for "meeting about budget"

**1. Frontend Request:**
```typescript
// lib/api.ts
api.ai.searchEmails("meeting about budget", 5)
```

**2. Express Route:**
```typescript
// server/routes/ai.ts
POST /api/ai/search
{ query: "meeting about budget", limit: 5 }
```

**3. Generate Query Embedding:**
```typescript
// server/services/ai.ts
const queryEmbedding = await aiService.generateEmbedding("meeting about budget");
// Returns: [0.234, -0.567, 0.891, ..., 0.123] (1536 numbers)
```

**4. Search Supabase:**
```typescript
// server/services/vector_store.ts
const results = await vectorStore.findSimilar(queryEmbedding, 5);
// Supabase calculates cosine similarity for all stored embeddings
// Returns top 5 matches with similarity scores
```

**5. Results:**
```json
[
  {
    "id": "email-123",
    "metadata": { "subject": "Q4 Budget Discussion", "from": {...} },
    "text": "Subject: Q4 Budget Discussion\nFrom: John...",
    "score": 0.87  // 87% similarity
  },
  {
    "id": "email-456",
    "metadata": { "subject": "Financial Planning Meeting", "from": {...} },
    "text": "Subject: Financial Planning Meeting\nFrom: Jane...",
    "score": 0.82  // 82% similarity
  },
  // ... 3 more results
]
```

**6. Frontend Display:**
- Shows matching emails sorted by relevance
- Even if they don't contain exact words "meeting about budget"

---

## Technical Details

### Embedding Model: `text-embedding-3-small`
- **Dimensions:** 1536
- **Cost:** Very cheap (~$0.02 per 1M tokens)
- **Speed:** Fast generation
- **Quality:** Good for semantic search

### Similarity Calculation: Cosine Similarity
- Measures the angle between two vectors
- Range: 0 (identical) to 1 (completely different)
- **Formula:** `cos(θ) = (A · B) / (||A|| × ||B||)`
- pgvector optimizes this with indexes for fast queries

### Threshold: 0.5
- Only returns results with similarity ≥ 50%
- Can be adjusted based on needs
- Lower threshold = more results (but less relevant)
- Higher threshold = fewer results (but more relevant)

---

## Why This Is Powerful

### Traditional Keyword Search:
- ❌ "project deadline" won't find "Q4 deliverables due"
- ❌ "meeting" won't find "sync up" or "standup"
- ❌ Requires exact word matches

### Semantic Vector Search:
- ✅ "project deadline" finds "Q4 deliverables due"
- ✅ "meeting" finds "sync up", "standup", "huddle"
- ✅ Understands context and meaning
- ✅ Works across languages (to some extent)

---

## Performance Considerations

### Indexing (One-time per email):
- **Cost:** ~$0.00002 per email (very cheap)
- **Time:** ~100-200ms per email
- **Storage:** ~6KB per embedding (1536 floats × 4 bytes)

### Searching:
- **Cost:** ~$0.00002 per search query
- **Time:** ~50-100ms (with pgvector index)
- **Scalability:** Can handle millions of emails efficiently

### Optimization:
- pgvector creates **HNSW indexes** for fast approximate nearest neighbor search
- Batch indexing for multiple emails
- Caching query results if needed

---

## Current Implementation Status

✅ **Working:**
- Email indexing on sync
- Semantic search in inbox
- Vector storage in Supabase
- Cosine similarity search

⚠️ **Potential Improvements:**
- Batch indexing (currently sequential)
- Background job for indexing (currently synchronous)
- Index optimization for large datasets
- Query result caching

---

## Summary

**Vector embeddings** transform text into numerical vectors that capture meaning. In this project:

1. **Emails are indexed** → Converted to 1536-dimensional vectors
2. **Vectors are stored** → In Supabase with pgvector extension
3. **Queries are converted** → Search query becomes a vector
4. **Similarity is calculated** → Cosine similarity finds closest matches
5. **Results are returned** → Sorted by relevance score

This enables **semantic search** - finding emails by meaning, not just keywords!

