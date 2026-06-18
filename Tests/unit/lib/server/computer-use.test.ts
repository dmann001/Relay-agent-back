import { AiProviderError } from '@/lib/server/openai';
import { getComputerUseConfig } from '@/lib/server/computer-use/config';
import { extractResponseText, runComputerUseAgent } from '@/lib/server/computer-use/runner';
import { SimulatedComputerUseHarness } from '@/lib/server/computer-use/harness';
import { isValidPng, pngDimensions, createSolidColorPng } from '@/lib/server/computer-use/screenshot';
import { normalizePlaywrightKey } from '@/lib/server/computer-use/normalize-keys';

const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  delete process.env.COMPUTER_USE_DRIVER;
  delete process.env.COMPUTER_USE_MAX_STEPS;
  jest.restoreAllMocks();
});

describe('computer use scaffolding', () => {
  it('normalizes keyboard aliases for Playwright', () => {
    expect(normalizePlaywrightKey('ENTER')).toBe('Enter');
    expect(normalizePlaywrightKey('CMD')).toBe('Meta');
  });

  it('extracts final text from Responses API payloads', () => {
    expect(extractResponseText({
      output_text: 'Done',
    })).toBe('Done');

    expect(extractResponseText({
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: 'Found it' }],
      }],
    })).toBe('Found it');
  });

  it('runs the screenshot loop until the model returns a final answer', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.COMPUTER_USE_DRIVER = 'simulated';
    process.env.COMPUTER_USE_MAX_STEPS = '3';

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'resp-1',
        output: [{
          type: 'computer_call',
          call_id: 'call-1',
          actions: [{ type: 'screenshot' }],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'resp-2',
        output_text: 'Task complete.',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await runComputerUseAgent({
      instructions: 'Test harness',
      task: 'Open the filters panel.',
    });

    expect(result.answer).toContain('Task complete.');
    expect(result.driver).toBe('simulated');
    expect(result.stepCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, firstRequest] = fetchMock.mock.calls[0];
    const firstBody = JSON.parse(String(firstRequest?.body));
    expect(firstBody.store).toBe(true);
    expect(firstBody.tools).toEqual([{ type: 'computer' }]);

    const [, secondRequest] = fetchMock.mock.calls[1];
    const secondBody = JSON.parse(String(secondRequest?.body));
    expect(secondBody.previous_response_id).toBe('resp-1');
    expect(secondBody.input[0].type).toBe('computer_call_output');
  });

  it('rejects when the provider returns no final answer', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.COMPUTER_USE_DRIVER = 'simulated';

    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'resp-empty',
      output: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(runComputerUseAgent({
      instructions: 'Test harness',
      task: 'Do nothing.',
    })).rejects.toBeInstanceOf(AiProviderError);
  });

  it('captures viewport-sized screenshots from the simulated harness', async () => {
    const config = getComputerUseConfig();
    const harness = new SimulatedComputerUseHarness({ ...config, driver: 'simulated' });
    await harness.executeActions([{ type: 'click', x: 1, y: 2 }, { type: 'type', text: 'hello' }]);
    const screenshot = await harness.captureScreenshot();
    expect(isValidPng(screenshot)).toBe(true);
    expect(pngDimensions(screenshot)).toEqual({
      width: config.viewportWidth,
      height: config.viewportHeight,
    });
    expect(harness.getActionLog()).toEqual(['click (1, 2)', 'type "hello"']);
    await harness.dispose();
  });

  it('creates valid PNG buffers for computer use screenshots', () => {
    const png = createSolidColorPng(1280, 720);
    expect(isValidPng(png)).toBe(true);
    expect(pngDimensions(png)).toEqual({ width: 1280, height: 720 });
  });
});
