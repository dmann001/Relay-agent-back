import type { ComputerUseConfig } from '@/lib/server/computer-use/config';
import type { ComputerAction, ComputerUseHarness } from '@/lib/server/computer-use/types';
import { summarizeComputerActions } from '@/lib/server/computer-use/actions';
import { createSolidColorPng } from '@/lib/server/computer-use/screenshot';
import { inferComputerUseStartUrl } from '@/lib/server/computer-use/start-url';

export class SimulatedComputerUseHarness implements ComputerUseHarness {
  readonly driver = 'simulated';
  private actionLog: string[] = [];
  private screenshot: Buffer;

  constructor(private readonly config: ComputerUseConfig) {
    this.screenshot = createSolidColorPng(
      config.viewportWidth,
      config.viewportHeight,
      [245, 245, 245],
    );
  }

  async executeActions(actions: ComputerAction[]) {
    this.actionLog.push(...summarizeComputerActions(actions));
  }

  async captureScreenshot() {
    return this.screenshot;
  }

  async dispose() {
    this.actionLog = [];
  }

  getActionLog() {
    return [...this.actionLog];
  }
}

type PlaywrightBrowser = {
  newContext: (options: Record<string, unknown>) => Promise<PlaywrightContext>;
  close: () => Promise<void>;
};

type PlaywrightContext = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
};

type PlaywrightPage = {
  goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<void>;
  screenshot: (options: { type: 'png' }) => Promise<Buffer>;
  mouse: {
    click: (x: number, y: number, options?: { button?: string }) => Promise<void>;
    dblclick: (x: number, y: number, options?: { button?: string }) => Promise<void>;
    move: (x: number, y: number) => Promise<void>;
    down: () => Promise<void>;
    up: () => Promise<void>;
    wheel: (deltaX: number, deltaY: number) => Promise<void>;
  };
  keyboard: {
    press: (key: string, options?: { delay?: number }) => Promise<void>;
    type: (text: string, options?: { delay?: number }) => Promise<void>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
  waitForLoadState: (state?: 'load' | 'domcontentloaded' | 'networkidle') => Promise<void>;
  bringToFront: () => Promise<void>;
};

export async function createPlaywrightComputerUseHarness(
  config: ComputerUseConfig,
  options: { task?: string } = {},
): Promise<ComputerUseHarness> {
  let chromium: { launch: (options: Record<string, unknown>) => Promise<unknown> };
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not installed. Run `pnpm add playwright` and `npx playwright install chromium`.');
  }

  const browser = await chromium.launch({
    headless: process.env.COMPUTER_USE_HEADLESS !== 'false',
    ...(process.platform === 'linux' ? { chromiumSandbox: true } : {}),
    env: {},
    args: [
      '--disable-extensions',
      '--disable-file-system',
      '--disable-blink-features=AutomationControlled',
    ],
  }) as unknown as PlaywrightBrowser;

  const context = await browser.newContext({
    viewport: { width: config.viewportWidth, height: config.viewportHeight },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    colorScheme: 'light',
  });

  const page = await context.newPage();
  const startUrl = inferComputerUseStartUrl(options.task || '', config.startUrl);

  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1000);
  } catch (error) {
    console.warn(`[computer-use] Initial navigation to ${startUrl} failed, continuing from current page.`, error);
  }

  return {
    driver: 'playwright',
    startUrl,
    async executeActions(actions) {
      const { executePlaywrightComputerActions } = await import('@/lib/server/computer-use/actions');
      await executePlaywrightComputerActions(page, actions);
    },
    async captureScreenshot() {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return page.screenshot({ type: 'png' });
    },
    async dispose() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

export async function createComputerUseHarness(
  config: ComputerUseConfig,
  options: { task?: string } = {},
): Promise<ComputerUseHarness> {
  if (config.driver === 'simulated') {
    return new SimulatedComputerUseHarness(config);
  }

  try {
    return await createPlaywrightComputerUseHarness(config, options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Playwright error';
    if (config.driver === 'playwright' || config.driver === 'auto') {
      throw new Error(
        `Computer use needs a real browser. ${detail} Run: pnpm add playwright && npx playwright install chromium`,
      );
    }
    console.warn('[computer-use] Playwright harness unavailable, falling back to synthetic viewport screenshots.', error);
  }

  return new SimulatedComputerUseHarness(config);
}
