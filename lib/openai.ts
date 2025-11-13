// OpenAI utilities for email draft generation
import OpenAI from 'openai';
import { Email } from '@/types';

export const openai = {
  // Generate email draft
  async generateDraft(
    apiKey: string,
    emailContext: Email,
    userInstructions?: string
  ): Promise<string> {
    const client = new OpenAI({ apiKey });

    const systemPrompt = `You are an intelligent email assistant that helps users compose professional and contextually appropriate email replies.
Your task is to generate a well-written email draft based on the provided email context.

Guidelines:
- Maintain a professional yet friendly tone
- Address all points raised in the original email
- Keep the response concise and clear
- Use proper email formatting
- Do not include subject line or greeting unless specifically requested
- Sign off appropriately based on the context`;

    const userPrompt = `Original Email:
From: ${emailContext.from.name} <${emailContext.from.email}>
Subject: ${emailContext.subject}
Date: ${emailContext.date}

${emailContext.bodyPlain || emailContext.body}

${userInstructions ? `\nUser Instructions: ${userInstructions}` : ''}

Please generate a professional reply to this email.`;

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating draft:', error);
      throw error;
    }
  },

  // Generate email summary
  async generateSummary(apiKey: string, email: Email): Promise<string> {
    const client = new OpenAI({ apiKey });

    const prompt = `Summarize this email in 1-2 concise sentences:

From: ${email.from.name}
Subject: ${email.subject}

${email.bodyPlain || email.body}`;

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 100,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  },

  // Generate smart labels
  async generateLabels(apiKey: string, email: Email): Promise<string[]> {
    const client = new OpenAI({ apiKey });

    const prompt = `Analyze this email and suggest 1-3 appropriate labels from this list:
urgent, action, followup, meeting, financial, important, personal, work, social, newsletter

Email:
From: ${email.from.name}
Subject: ${email.subject}
${email.bodyPlain || email.body}

Return only the labels as a comma-separated list.`;

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      });

      const response = completion.choices[0]?.message?.content || '';
      return response
        .split(',')
        .map((label) => label.trim().toLowerCase())
        .filter((label) => label);
    } catch (error) {
      console.error('Error generating labels:', error);
      return [];
    }
  },

  // Generate suggested actions
  async generateActions(apiKey: string, email: Email): Promise<string[]> {
    const client = new OpenAI({ apiKey });

    const prompt = `Based on this email, suggest 2-4 quick action items:

From: ${email.from.name}
Subject: ${email.subject}
${email.bodyPlain || email.body}

Return only the action items as a simple list, one per line.`;

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 150,
      });

      const response = completion.choices[0]?.message?.content || '';
      return response
        .split('\n')
        .map((action) => action.trim())
        .filter((action) => action && !action.match(/^\d+\.?\s*$/));
    } catch (error) {
      console.error('Error generating actions:', error);
      return [];
    }
  },
};
