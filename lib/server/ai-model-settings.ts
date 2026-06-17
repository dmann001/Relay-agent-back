import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

export const OPENAI_MODEL_OPTIONS = [
  { id: 'gpt-5.5', label: 'GPT-5.5', description: 'Best quality for deeper reasoning and web-assisted work.' },
  { id: 'gpt-5.4', label: 'GPT-5.4', description: 'Strong default for complex email analysis.' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', description: 'Balanced speed and cost for day-to-day email help.' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', description: 'Fastest option for short drafts and simple questions.' },
] as const;

export type AiToolKey =
  | 'webSearch'
  | 'fileSearch'
  | 'codeInterpreter'
  | 'imageGeneration'
  | 'computerUse'
  | 'mcpConnectors'
  | 'toolSearch';

export const aiToolKeySchema = z.enum([
  'webSearch',
  'fileSearch',
  'codeInterpreter',
  'imageGeneration',
  'computerUse',
  'mcpConnectors',
  'toolSearch',
]);

export const DEFAULT_AI_TOOLS: Record<AiToolKey, boolean> = {
  webSearch: false,
  fileSearch: false,
  codeInterpreter: false,
  imageGeneration: false,
  computerUse: false,
  mcpConnectors: false,
  toolSearch: false,
};

export const aiModelSettingsSchema = z.object({
  defaultModel: z.string().trim().min(1).max(80),
  tools: z.object({
    webSearch: z.boolean().default(false),
    fileSearch: z.boolean().default(false),
    codeInterpreter: z.boolean().default(false),
    imageGeneration: z.boolean().default(false),
    computerUse: z.boolean().default(false),
    mcpConnectors: z.boolean().default(false),
    toolSearch: z.boolean().default(false),
  }).default(DEFAULT_AI_TOOLS),
});

export type AiModelSettings = z.infer<typeof aiModelSettingsSchema>;

const normalizeTools = (value: unknown): Record<AiToolKey, boolean> => ({
  ...DEFAULT_AI_TOOLS,
  ...(value && typeof value === 'object' ? value as Partial<Record<AiToolKey, boolean>> : {}),
});

export function defaultAiModelSettings(): AiModelSettings {
  return {
    defaultModel: DEFAULT_AI_MODEL,
    tools: { ...DEFAULT_AI_TOOLS },
  };
}

export async function getAiModelSettings(userId: string): Promise<AiModelSettings> {
  const fallback = defaultAiModelSettings();
  const { data, error } = await getSupabaseAdmin()
    .from('ai_model_settings')
    .select('default_model, enabled_tools')
    .eq('user_id', userId)
    .maybeSingle();

  // Keep AI usable before the migration is applied.
  if (error && error.code === '42P01') return fallback;
  if (error) throw error;

  return {
    defaultModel: data?.default_model || fallback.defaultModel,
    tools: normalizeTools(data?.enabled_tools),
  };
}

export async function updateAiModelSettings(userId: string, settings: AiModelSettings): Promise<AiModelSettings> {
  const normalized = aiModelSettingsSchema.parse({
    defaultModel: settings.defaultModel,
    tools: normalizeTools(settings.tools),
  });

  const { error } = await getSupabaseAdmin().from('ai_model_settings').upsert({
    user_id: userId,
    default_model: normalized.defaultModel,
    enabled_tools: normalized.tools,
  }, { onConflict: 'user_id' });

  if (error) throw error;
  return normalized;
}

export const WIRED_AI_TOOLS: AiToolKey[] = [
  'webSearch',
  'codeInterpreter',
  'imageGeneration',
];

export function toolsForOpenAi(settings: AiModelSettings, selectedTools: AiToolKey[] = []): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = [];
  if (settings.tools.webSearch && selectedTools.includes('webSearch')) {
    tools.push({ type: 'web_search' });
  }
  if (settings.tools.codeInterpreter && selectedTools.includes('codeInterpreter')) {
    tools.push({ type: 'code_interpreter', container: { type: 'auto' } });
  }
  if (settings.tools.imageGeneration && selectedTools.includes('imageGeneration')) {
    tools.push({ type: 'image_generation' });
  }
  return tools;
}
