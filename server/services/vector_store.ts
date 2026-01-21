import { supabase } from '../lib/supabase';

interface EmbeddingRecord {
    id: string;
    embedding: number[];
    metadata: Record<string, any>;
    text?: string;
}

export class VectorStore {
    constructor() { }

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

    async getRecord(id: string): Promise<EmbeddingRecord | undefined> {
        if (!supabase) return undefined;
        const { data, error } = await supabase
            .from('embeddings')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return undefined;

        return {
            id: data.id,
            embedding: data.embedding, // Note: pgvector returns string or array depending on driver, supabase-js handles it
            metadata: data.metadata,
            text: data.content
        };
    }
}

// Singleton instance
export const vectorStore = new VectorStore();
