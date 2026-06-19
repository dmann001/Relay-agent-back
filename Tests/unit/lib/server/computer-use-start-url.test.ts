import { inferComputerUseStartUrl } from '@/lib/server/computer-use/start-url';
import { resolveComputerUseModel } from '@/lib/server/computer-use/config';

describe('computer use start url + model', () => {
  const originalModel = process.env.OPENAI_MODEL;
  const originalComputerModel = process.env.COMPUTER_USE_MODEL;

  afterEach(() => {
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
    if (originalComputerModel === undefined) delete process.env.COMPUTER_USE_MODEL;
    else process.env.COMPUTER_USE_MODEL = originalComputerModel;
  });

  it('opens weather.com when the task mentions weather.com', () => {
    expect(inferComputerUseStartUrl('Check weather.com for Brampton')).toBe('https://weather.com/');
  });

  it('uses explicit URLs from the task', () => {
    expect(inferComputerUseStartUrl('Visit https://example.com/docs and summarize')).toBe('https://example.com/docs');
  });

  it('avoids mini chat models for computer use', () => {
    process.env.OPENAI_MODEL = 'gpt-5.4';
    expect(resolveComputerUseModel('gpt-5.4-mini')).toBe('gpt-5.4');
    expect(resolveComputerUseModel('gpt-5.5')).toBe('gpt-5.5');
  });
});
