import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import type { AiToolKey } from '@/lib/server/ai-model-settings';

export interface AiChatSessionSummary {
  id: string;
  accountId: string | null;
  messageId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string | null;
}

export interface AiChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  tools: AiToolKey[];
  responseId: string | null;
  createdAt: string;
}

export interface AiChatSessionDetail extends AiChatSessionSummary {
  messages: AiChatMessageRecord[];
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === '42P01';
}

export async function listAiChatSessions(userId: string, limit = 50): Promise<AiChatSessionSummary[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_chat_sessions')
    .select('id, account_id, message_id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (isMissingTableError(error)) return [];
  if (error) throw error;
  if (!data?.length) return [];

  const sessionIds = data.map((row) => row.id);
  const { data: previews, error: previewError } = await getSupabaseAdmin()
    .from('ai_chat_messages')
    .select('session_id, content, created_at')
    .in('session_id', sessionIds)
    .eq('role', 'user')
    .order('created_at', { ascending: false });

  if (previewError && !isMissingTableError(previewError)) throw previewError;

  const previewBySession = new Map<string, string>();
  for (const row of previews || []) {
    if (!previewBySession.has(row.session_id)) {
      previewBySession.set(row.session_id, row.content);
    }
  }

  return data.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    messageId: row.message_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preview: previewBySession.get(row.id) || null,
  }));
}

export async function getAiChatSession(userId: string, sessionId: string): Promise<AiChatSessionDetail | null> {
  const { data: session, error } = await getSupabaseAdmin()
    .from('ai_chat_sessions')
    .select('id, account_id, message_id, title, created_at, updated_at')
    .eq('user_id', userId)
    .eq('id', sessionId)
    .maybeSingle();

  if (isMissingTableError(error)) return null;
  if (error) throw error;
  if (!session) return null;

  const { data: messages, error: messagesError } = await getSupabaseAdmin()
    .from('ai_chat_messages')
    .select('id, role, content, model, tools, response_id, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (messagesError && !isMissingTableError(messagesError)) throw messagesError;

  return {
    id: session.id,
    accountId: session.account_id,
    messageId: session.message_id,
    title: session.title,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    preview: messages?.find((row) => row.role === 'user')?.content || null,
    messages: (messages || []).map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      model: row.model,
      tools: Array.isArray(row.tools) ? row.tools as AiToolKey[] : [],
      responseId: row.response_id,
      createdAt: row.created_at,
    })),
  };
}

export async function createAiChatSession(
  userId: string,
  params: { accountId?: string; messageId?: string; title?: string },
): Promise<AiChatSessionSummary> {
  const title = (params.title || 'New chat').trim().slice(0, 120) || 'New chat';
  const { data, error } = await getSupabaseAdmin()
    .from('ai_chat_sessions')
    .insert({
      user_id: userId,
      account_id: params.accountId || null,
      message_id: params.messageId || null,
      title,
    })
    .select('id, account_id, message_id, title, created_at, updated_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    accountId: data.account_id,
    messageId: data.message_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    preview: null,
  };
}

export async function appendAiChatMessages(
  userId: string,
  sessionId: string,
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    tools?: AiToolKey[];
    responseId?: string;
  }>,
): Promise<void> {
  const session = await getAiChatSession(userId, sessionId);
  if (!session) throw new Error('Chat session not found');

  const { error } = await getSupabaseAdmin()
    .from('ai_chat_messages')
    .insert(messages.map((message) => ({
      session_id: sessionId,
      role: message.role,
      content: message.content,
      model: message.model || null,
      tools: message.tools || [],
      response_id: message.responseId || null,
    })));

  if (error) throw error;

  const firstUser = messages.find((message) => message.role === 'user');
  if (session.title === 'New chat' && firstUser?.content) {
    await getSupabaseAdmin()
      .from('ai_chat_sessions')
      .update({ title: firstUser.content.trim().slice(0, 120) || 'New chat' })
      .eq('id', sessionId)
      .eq('user_id', userId);
  } else {
    await getSupabaseAdmin()
      .from('ai_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
  }
}

export async function deleteAiChatSession(userId: string, sessionId: string): Promise<boolean> {
  const { error, count } = await getSupabaseAdmin()
    .from('ai_chat_sessions')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('id', sessionId);

  if (isMissingTableError(error)) return false;
  if (error) throw error;
  return (count ?? 0) > 0;
}
