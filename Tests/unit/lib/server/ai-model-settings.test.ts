import {
  defaultAiModelSettings,
  isComputerUseRequested,
  resolveAiTooling,
  toolsForOpenAi,
  WIRED_AI_TOOLS,
} from '@/lib/server/ai-model-settings';

describe('ai-model-settings computer use', () => {
  it('includes computer use in wired tools', () => {
    expect(WIRED_AI_TOOLS).toContain('computerUse');
  });

  it('detects when computer use is requested and enabled', () => {
    const settings = defaultAiModelSettings();
    settings.tools.computerUse = true;
    expect(isComputerUseRequested(settings, ['computerUse'])).toBe(true);
    expect(isComputerUseRequested(settings, ['webSearch'])).toBe(false);
  });

  it('routes computer use separately from structured tools', () => {
    const settings = defaultAiModelSettings();
    settings.tools.webSearch = true;
    settings.tools.computerUse = true;

    const resolved = resolveAiTooling(settings, ['computerUse', 'webSearch']);
    expect(resolved.computerUse).toBe(true);
    expect(resolved.structuredTools).toEqual([{ type: 'web_search' }]);
  });

  it('does not pass computer use through toolsForOpenAi', () => {
    const settings = defaultAiModelSettings();
    settings.tools.computerUse = true;
    expect(toolsForOpenAi(settings, ['computerUse'])).toEqual([]);
  });
});
