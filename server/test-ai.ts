import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { aiService } from './services/ai';
import { vectorStore } from './services/vector_store';

async function testAI() {
    console.log('Starting AI Service Test...');

    // Mock email data
    const mockEmail: any = {
        id: 'test-email-1',
        threadId: 'thread-1',
        from: { name: 'John Doe', email: 'john@example.com', avatar: '' },
        to: [{ name: 'Me', email: 'me@example.com' }],
        subject: 'Project Update Meeting',
        body: 'Hi, can we meet tomorrow at 10 AM to discuss the project status? We need to finalize the roadmap.',
        bodyPlain: 'Hi, can we meet tomorrow at 10 AM to discuss the project status? We need to finalize the roadmap.',
        date: new Date().toISOString(),
        read: true,
        labels: [],
        provider: 'gmail',
        hasAttachments: false
    };

    try {
        // 1. Test Indexing
        console.log('\n1. Testing Indexing...');
        await aiService.indexEmail(mockEmail);
        console.log('Indexing successful.');

        // 2. Test Search
        console.log('\n2. Testing Search...');
        const results = await aiService.searchEmails('meeting roadmap');
        console.log('Search Results:', results.map(r => ({ id: r.id, score: r.score, subject: r.metadata.subject })));

        // 3. Test Classification
        console.log('\n3. Testing Classification...');
        const category = await aiService.classifyEmail(mockEmail);
        console.log('Classification:', category);

        // 4. Test Draft Reply
        console.log('\n4. Testing Draft Reply...');
        const draft = await aiService.draftReply(mockEmail);
        console.log('Draft Reply:', draft);

        // 5. Test Summarization
        console.log('\n5. Testing Summarization...');
        const summary = await aiService.summarizeThread([mockEmail]);
        console.log('Summary:', summary);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAI();
